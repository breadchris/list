import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2, APIGatewayProxyResultV2, SQSEvent, SQSRecord } from 'aws-lambda';
import { convertToModelMessages } from 'ai';
import { SessionManager } from './session-manager.js';
import { executeClaudeCode } from './claude-executor.js';
import { getPlaylistVideos } from './youtube-client.js';
import { getSupabaseClient } from './supabase-client.js';
import { JobManager } from './job-manager.js';
import {
	handleSEOExtract,
	handleLLMGenerate,
	handleChatMessage,
	handleChatV2Stream,
	handleChatV2StreamResponse,
	handleMarkdownExtract,
	handleYouTubePlaylistExtract,
	handleYouTubeSubtitleExtract,
	handleTMDbSearch,
	handleLibgenSearch,
	handleScreenshotQueue,
	handleTSXTranspile,
	handleTranscribeAudio,
	handleTellerAccounts,
	handleTellerBalances,
	handleTellerTransactions
} from './content-handlers.js';
import {
	handleStripeConnectOnboard,
	handleStripeConnectStatus,
	handleStripeConnectDashboard,
	handleStripeCreateTransfer,
	handleStripeListTransfers,
	handleStripeInitiatePayout,
	handleStripeListPayouts,
	handleStripeSearchUsers,
	handleStripeWebhook
} from './stripe-handlers.js';
import { handleBlockNoteExport } from './blocknote-handler.js';
import { handleMapKitTokenRequest } from './mapkit-token-handler.js';
import {
	handleSendNotification,
	handleRegisterDevice,
	handleUnregisterDevice
} from './apns-handler.js';
import {
	handleGenerateToken,
	handleRedeemToken,
	handleRevokeToken,
	handleValidateSession,
	handleListTokens
} from './persistent-auth-handler.js';
import type { ContentRequest, ClaudeCodeStatusPayload, ClaudeCodeJobResponse, SQSMessageBody } from './types.js';
import { writeFileSync } from 'fs';

// Helper to flush stdout/stderr before Lambda freezes
const flushLogs = async (): Promise<void> => {
	return new Promise((resolve) => {
		process.stdout.write('', () => {
			process.stderr.write('', () => {
				resolve();
			});
		});
	});
};

interface ClaudeCodeRequest {
	prompt: string;
	session_id?: string;
}

interface ClaudeCodeResponse {
	success: boolean;
	session_id?: string;
	messages?: any[];
	s3_url?: string;
	error?: string;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
	file_count?: number;
}

// CORS headers for all responses
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

/**
 * Generate a unique job ID for async Claude Code execution
 */
function generateJobId(): string {
	const timestamp = Date.now().toString(36);
	const randomPart = Math.random().toString(36).substring(2, 15);
	return `job-${timestamp}-${randomPart}`;
}

/**
 * Map file extension to content type for child content items
 */
function getContentTypeFromExtension(extension: string): string {
	const typeMap: Record<string, string> = {
		// JavaScript/TypeScript
		'js': 'js',
		'jsx': 'jsx',
		'ts': 'ts',
		'tsx': 'tsx',
		'mjs': 'js',
		'cjs': 'js',
		// Web
		'html': 'html',
		'css': 'css',
		'scss': 'scss',
		'sass': 'sass',
		'less': 'less',
		// Data formats
		'json': 'json',
		'yaml': 'yaml',
		'yml': 'yaml',
		'xml': 'xml',
		'toml': 'toml',
		// Markdown/Docs
		'md': 'markdown',
		'mdx': 'markdown',
		'txt': 'text',
		// Config
		'env': 'text',
		'gitignore': 'text',
		'dockerignore': 'text',
		// Other languages
		'py': 'python',
		'rb': 'ruby',
		'go': 'go',
		'rs': 'rust',
		'java': 'java',
		'c': 'c',
		'cpp': 'cpp',
		'h': 'c',
		'hpp': 'cpp',
		'sh': 'shell',
		'bash': 'shell',
		'zsh': 'shell',
		'sql': 'sql'
	};

	return typeMap[extension] || 'text';
}

/**
 * Handle SQS event - process jobs from the queue
 */
async function handleSQSEvent(event: SQSEvent): Promise<any> {
	console.log(`Processing ${event.Records.length} SQS messages`);

	const supabase = getSupabaseClient();
	const jobManager = new JobManager(supabase);

	// Track failed message IDs for partial batch failure reporting
	const batchItemFailures: Array<{ itemIdentifier: string }> = [];

	for (const record of event.Records) {
		try {
			console.log(`Processing message: ${record.messageId}`);

			// Parse SQS message body
			const message: SQSMessageBody = JSON.parse(record.body);
			const { job_id, action, payload } = message;

			console.log(`Job ${job_id}: Starting processing for action: ${action}`);

			// Load job from database
			const job = await jobManager.getJob(job_id);
			if (!job) {
				console.error(`Job ${job_id} not found in database`);
				// Don't retry if job doesn't exist
				continue;
			}

			// Check if job was cancelled
			if (job.status === 'cancelled') {
				console.log(`Job ${job_id} was cancelled, skipping`);
				continue;
			}

			// Mark job as processing
			await jobManager.startJob(job_id);

			// Execute the content handler based on action
			let result;
			let content_ids: string[] = [];

			try {
				switch (action) {
					case 'seo-extract':
						result = await handleSEOExtract(supabase, payload);
						// Extract content IDs from result
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.seo_children?.map((child: any) => child.id) || []
							);
						}
						break;

					case 'llm-generate':
						result = await handleLLMGenerate(supabase, payload);
						break;

					case 'chat-message':
						result = await handleChatMessage(supabase, payload);
						break;

					case 'markdown-extract':
						result = await handleMarkdownExtract(supabase, payload);
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.markdown_children?.map((child: any) => child.id) || []
							);
						}
						break;

					case 'youtube-playlist-extract':
						result = await handleYouTubePlaylistExtract(supabase, payload);
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.videos_created?.map((video: any) => video.id) || []
							);
						}
						break;

					case 'youtube-subtitle-extract':
						result = await handleYouTubeSubtitleExtract(supabase, payload);
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.transcript_content_ids || []
							);
						}
						break;

					case 'tmdb-search':
						result = await handleTMDbSearch(supabase, payload);
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.results_created?.map((r: any) => r.id) || []
							);
						}
						break;

					case 'libgen-search':
						result = await handleLibgenSearch(supabase, payload);
						if (result.data) {
							content_ids = result.data.flatMap((item: any) =>
								item.book_children?.map((book: any) => book.id) || []
							);
						}
						break;

					case 'screenshot-queue':
						result = await handleScreenshotQueue(supabase, payload);
						if (result.data) {
							content_ids = result.data
								.filter((item: any) => item.success)
								.map((item: any) => item.content_id);
						}
						break;

					case 'tsx-transpile':
						result = await handleTSXTranspile(supabase, payload);
						break;

					case 'transcribe-audio':
						result = await handleTranscribeAudio(supabase, payload);
						if (result.data) {
							content_ids = result.data
								.filter((item: any) => item.success)
								.map((item: any) => item.transcript_content_id)
								.filter((id: string) => id);
						}
						break;

					case 'teller-accounts':
						result = await handleTellerAccounts(supabase, payload);
						if (result.data) {
							content_ids = result.data
								.flatMap((item: any) => item.account_children || []);
						}
						break;

					case 'teller-balances':
						result = await handleTellerBalances(supabase, payload);
						break;

					case 'teller-transactions':
						result = await handleTellerTransactions(supabase, payload);
						if (result.data) {
							content_ids = result.data
								.flatMap((item: any) => item.transaction_children || []);
						}
						break;

					case 'stripe-connect-onboard':
						result = await handleStripeConnectOnboard(supabase, payload);
						break;

					case 'stripe-connect-status':
						result = await handleStripeConnectStatus(supabase, payload);
						break;

					case 'stripe-connect-dashboard':
						result = await handleStripeConnectDashboard(supabase, payload);
						break;

					case 'stripe-create-transfer':
						result = await handleStripeCreateTransfer(supabase, payload);
						break;

					case 'stripe-list-transfers':
						result = await handleStripeListTransfers(supabase, payload);
						break;

					case 'stripe-initiate-payout':
						result = await handleStripeInitiatePayout(supabase, payload);
						break;

					case 'stripe-list-payouts':
						result = await handleStripeListPayouts(supabase, payload);
						break;

					case 'stripe-search-users':
						result = await handleStripeSearchUsers(supabase, payload);
						break;

					case 'stripe-webhook':
						result = await handleStripeWebhook(supabase, payload);
						break;

					case 'blocknote-export':
						result = await handleBlockNoteExport(supabase, payload);
						break;

					case 'claude-code': {
						const bucketName = process.env.S3_BUCKET_NAME;
						if (!bucketName) {
							throw new Error('S3_BUCKET_NAME not configured');
						}

						const sessionManager = new SessionManager(bucketName, process.env.AWS_REGION);

						// Fetch conversation context from sibling content
						let conversationContext = '';
						if (payload.parent_content_id) {
							console.log(`[Conversation Context] Fetching siblings for parent: ${payload.parent_content_id}`);

							const { data: siblings, error: siblingsError } = await supabase
								.from('content')
								.select('id, type, data, created_at, metadata')
								.eq('parent_content_id', payload.parent_content_id)
								.in('type', ['text', 'claude-code'])
								.order('created_at', { ascending: true });

							if (siblingsError) {
								console.error('[Conversation Context] Error fetching siblings:', siblingsError);
							} else if (siblings && siblings.length > 0) {
								console.log(`[Conversation Context] Found ${siblings.length} sibling messages`);

								// Build conversation history (exclude current message by checking data)
								const messages = siblings
									.filter(item => item.data !== payload.prompt) // Skip current message if already saved
									.map(item => {
										const timestamp = new Date(item.created_at).toLocaleTimeString();
										// Truncate long messages for context
										const messageText = item.data.length > 500
											? item.data.substring(0, 500) + '...'
											: item.data;
										return `[${timestamp}] ${messageText}`;
									});

								if (messages.length > 0) {
									conversationContext = `
<conversation_history>
Previous messages in this conversation:
${messages.join('\n')}
</conversation_history>

Current message:
`;
									console.log(`[Conversation Context] Built history with ${messages.length} messages`);
								}
							}
						}

						// Download session files if continuing session
						let sessionFiles;
						if (payload.session_id) {
							const exists = await sessionManager.sessionExists(payload.session_id);
							if (exists) {
								sessionFiles = await sessionManager.downloadSession(payload.session_id);
							}
						}

						// Prepend conversation context to prompt
						const enhancedPrompt = conversationContext + payload.prompt;

						// Execute Claude Code with conversation context and optional GitHub integration
						const claudeResult = await executeClaudeCode({
							prompt: enhancedPrompt,
							sessionFiles,
							resumeSessionId: payload.session_id,
							githubRepo: payload.github_repo // Pass GitHub repo info if provided
						});

						// Upload output files to S3
						let s3_url = '';
						if (claudeResult.outputFiles?.length > 0) {
							s3_url = await sessionManager.uploadSession(claudeResult.session_id, claudeResult.outputFiles);
						}

						// Create child content items for generated files (v2)
						const createdContentIds: string[] = [];
						if (claudeResult.status === 'completed' && payload.parent_content_id) {
							// Filter out .session/ files (internal Claude CLI data)
							const workspaceFiles = claudeResult.outputFiles?.filter(
								file => !file.path.startsWith('.session/')
							) || [];

							console.log(`[Child Content] Creating ${workspaceFiles.length} items from generated files`);

							for (const file of workspaceFiles) {
								try {
									// Determine content type from file extension
									const fileExtension = file.path.split('.').pop()?.toLowerCase() || 'text';
									const contentType = getContentTypeFromExtension(fileExtension);

									// Convert Uint8Array to string
									const fileContent = new TextDecoder().decode(file.content);

									// Create child content item
									const { data: childContent, error: createError } = await supabase
										.from('content')
										.insert({
											type: contentType,
											data: fileContent,
											group_id: payload.group_id,
											user_id: payload.user_id,
											parent_content_id: payload.parent_content_id,
											metadata: {
												filename: file.path,
												generated_by_claude_code: true,
												session_id: claudeResult.session_id
											}
										})
										.select()
										.single();

									if (createError) {
										console.error(`Error creating child content for ${file.path}:`, createError);
										continue;
									}

									if (childContent) {
										createdContentIds.push(childContent.id);
										console.log(`Created child content ${childContent.id} for file: ${file.path}`);
									}
								} catch (fileError) {
									console.error(`Error processing file ${file.path}:`, fileError);
								}
							}

							console.log(`Successfully created ${createdContentIds.length} child content items`);
						}

						// Include created content IDs in result for cache invalidation
						content_ids = createdContentIds;

						// Extract TSX files and convert to base64 for JSON serialization
						const tsxFiles = (claudeResult.outputFiles || [])
							.filter(file => file.path.endsWith('.tsx') && !file.path.startsWith('.session/'))
							.map(file => ({
								path: file.path,
								content: Buffer.from(file.content).toString('base64')
							}));

						result = {
							success: claudeResult.status === 'completed',
							session_id: claudeResult.session_id,
							messages: claudeResult.messages,
							s3_url,
							tsx_files: tsxFiles,
							error: claudeResult.error,
							stdout: claudeResult.stdout,
							stderr: claudeResult.stderr,
							exitCode: claudeResult.exitCode,
							file_count: claudeResult.outputFiles?.length || 0,
							child_content_count: createdContentIds.length,
							git_commit_sha: claudeResult.git_commit_sha,
							git_commit_url: claudeResult.git_commit_url
						};
						break;
					}

					default:
						throw new Error(`Unknown action: ${action}`);
				}

				// Mark job as completed
				await jobManager.completeJob({
					job_id,
					result,
					content_ids: content_ids.length > 0 ? content_ids : undefined
				});

				console.log(`Job ${job_id}: Completed successfully`);

			} catch (handlerError) {
				// Handler failed - mark job as failed
				const errorMessage = handlerError instanceof Error ? handlerError.message : 'Handler execution failed';
				console.error(`Job ${job_id}: Handler failed:`, errorMessage);

				await jobManager.failJob({
					job_id,
					error: errorMessage
				});

				// Add to batch failures for retry
				batchItemFailures.push({ itemIdentifier: record.messageId });
			}

		} catch (error) {
			// Error processing this message - add to batch failures
			console.error(`Error processing message ${record.messageId}:`, error);
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	// Return batch item failures for partial batch failure handling
	// This allows SQS to retry only the failed messages
	return {
		batchItemFailures
	};
}

export const handler: APIGatewayProxyHandlerV2 = async (
	event: APIGatewayProxyEventV2 | any
): Promise<APIGatewayProxyResultV2 | any> => {
	// Direct stderr write - should bypass all buffering
	process.stderr.write('=== HANDLER STARTED ===\n');
	process.stderr.write(`Event: ${JSON.stringify(event)}\n`);

	console.log('LAMBDA_START: Handler invoked');
	console.log('LAMBDA_EVENT:', JSON.stringify(event, null, 2));

	// Detect invocation source
	const isSQSEvent = event.Records && Array.isArray(event.Records) && event.Records[0]?.eventSource === 'aws:sqs';
	const isAPIGateway = event.requestContext !== undefined;

	// Handle SQS event (job processing)
	if (isSQSEvent) {
		process.stderr.write('SQS event detected\n');
		return await handleSQSEvent(event);
	}

	// Handle direct Lambda invocation (testing)
	if (!isAPIGateway) {
		process.stderr.write('Direct invocation detected\n');
		// Check if it's a content request (has action and payload OR has action and messages/prompt for Vercel AI SDK)
		if (event.action && (event.payload || event.messages || event.prompt)) {
			const result = await handleContentRequest(event as ContentRequest);
			await flushLogs();
			return result;
		}
		// Otherwise treat as Claude Code request
		const result = await handleClaudeCodeRequest(event as ClaudeCodeRequest);
		await flushLogs();
		return result;
	}

	const method = event.requestContext.http.method;
	const path = event.rawPath;

	console.log(`[ROUTING] Method: ${method}, Path: ${path}`);

	let result: APIGatewayProxyResultV2;

	// Handle preflight OPTIONS request
	if (method === 'OPTIONS') {
		result = {
			statusCode: 204,
			headers: corsHeaders
		};
		await flushLogs();
		return result;
	}

	// Handle GET /health request
	if (method === 'GET' && (path === '/health' || path === '/health/')) {
		const healthResponse = {
			status: 'healthy',
			version: process.env.CODE_VERSION || 'unknown',
			deployed_at: process.env.DEPLOYED_AT || 'unknown',
			deployment_type: process.env.DEPLOYMENT_TYPE || 'unknown',
			git_commit: process.env.GIT_COMMIT || 'unknown',
			git_branch: process.env.GIT_BRANCH || 'unknown',
			uptime: process.uptime()
		};

		result = {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify(healthResponse)
		};
		await flushLogs();
		return result;
	}

	try {
		// Only handle POST requests
		if (method !== 'POST') {
			result = {
				statusCode: 405,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({ success: false, error: 'Method not allowed' })
			};
			await flushLogs();
			return result;
		}

		// Parse request body
		const body = JSON.parse(event.body || '{}');

		// Route based on path
		if (path === '/claude-code' || path === '/claude-code/') {
			result = await handleClaudeCodeRequest(body as ClaudeCodeRequest);
			await flushLogs();
			return result;
		}

		if (path === '/youtube/playlist' || path === '/youtube/playlist/') {
			result = await handleYouTubePlaylistRequest(body);
			await flushLogs();
			return result;
		}

		if (path === '/content' || path === '/content/') {
			result = await handleContentRequest(body as ContentRequest);
			await flushLogs();
			return result;
		}

		if (path === '/mapkit/token' || path === '/mapkit/token/') {
			console.log('[ROUTING] Matched /mapkit/token, calling handler');
			result = await handleMapKitTokenRequest(event);
			await flushLogs();
			return result;
		}

		console.log('[ROUTING] No route matched, returning 404');
		result = {
			statusCode: 404,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({ success: false, error: 'Endpoint not found' })
		};
		await flushLogs();
		return result;
	} catch (error) {
		console.error('Lambda error:', error);

		result = {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			})
		};
		await flushLogs();
		return result;
	}
}

async function handleYouTubePlaylistRequest(body: { url?: string }): Promise<APIGatewayProxyResultV2> {
	const { url } = body;

	if (!url) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: url'
			})
		};
	}

	try {
		const videos = await getPlaylistVideos(url);

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: true,
				videos
			})
		};
	} catch (error) {
		console.error('YouTube playlist error:', error);

		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch playlist'
			})
		};
	}
}

async function handleClaudeCodeRequest(body: ClaudeCodeRequest): Promise<APIGatewayProxyResultV2> {
	console.log('handleClaudeCodeRequest called with:', JSON.stringify(body, null, 2));

	const { prompt, session_id } = body;

	if (!prompt) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: prompt'
			})
		};
	}

	const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
	if (!anthropicApiKey) {
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'ANTHROPIC_API_KEY not configured'
			})
		};
	}

	const bucketName = process.env.S3_BUCKET_NAME;
	if (!bucketName) {
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'S3_BUCKET_NAME not configured'
			})
		};
	}

	try {
		const sessionManager = new SessionManager(bucketName, process.env.AWS_REGION);

		// Download session files if session_id provided
		let sessionFiles;
		if (session_id) {
			const exists = await sessionManager.sessionExists(session_id);
			if (!exists) {
				return {
					statusCode: 404,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					},
					body: JSON.stringify({
						success: false,
						error: `Session ${session_id} not found`
					})
				};
			}

			sessionFiles = await sessionManager.downloadSession(session_id);
		}

		// Execute Claude Code
		console.log('About to execute Claude Code with prompt:', prompt.substring(0, 100));
		const result = await executeClaudeCode({
			prompt,
			sessionFiles,
			resumeSessionId: session_id // Pass session ID for resumption
		});
		console.log('Claude Code execution result:', JSON.stringify(result, null, 2));

		if (result.status === 'error') {
			return {
				statusCode: 500,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({
					success: false,
					session_id: result.session_id,
					error: result.error,
					stdout: result.stdout,
					stderr: result.stderr,
					exitCode: result.exitCode
				})
			};
		}

		// Upload output files to S3 if any were generated
		let s3_url = '';
		if (result.outputFiles && result.outputFiles.length > 0) {
			process.stderr.write(`Uploading ${result.outputFiles.length} files to S3...\n`);
			s3_url = await sessionManager.uploadSession(result.session_id, result.outputFiles);
			process.stderr.write(`Files uploaded to: ${s3_url}\n`);
		} else {
			process.stderr.write('No output files to upload\n');
		}

		const response: ClaudeCodeResponse = {
			success: true,
			session_id: result.session_id,
			messages: result.messages,
			s3_url,
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.exitCode,
			file_count: result.outputFiles?.length || 0
		};

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify(response)
		};
	} catch (error) {
		console.error('Claude Code execution error:', error);

		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			})
		};
	}
}

/**
 * Get specific job status
 */
async function handleGetJobStatus(jobManager: JobManager, payload: any): Promise<APIGatewayProxyResultV2> {
	const { job_id } = payload;

	if (!job_id) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: job_id'
			})
		};
	}

	try {
		const job = await jobManager.getJob(job_id);

		if (!job) {
			return {
				statusCode: 404,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({
					success: false,
					error: 'Job not found'
				})
			};
		}

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: true,
				job
			})
		};
	} catch (error) {
		console.error('Error getting job status:', error);
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Failed to get job status'
			})
		};
	}
}

/**
 * List user's jobs with optional filtering
 */
async function handleListJobs(jobManager: JobManager, payload: any): Promise<APIGatewayProxyResultV2> {
	const { user_id, status, limit, offset } = payload;

	if (!user_id) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: user_id'
			})
		};
	}

	try {
		const jobs = await jobManager.listUserJobs({
			user_id,
			status,
			limit,
			offset
		});

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: true,
				jobs,
				total: jobs.length
			})
		};
	} catch (error) {
		console.error('Error listing jobs:', error);
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Failed to list jobs'
			})
		};
	}
}

/**
 * Cancel a pending job
 */
async function handleCancelJob(jobManager: JobManager, payload: any): Promise<APIGatewayProxyResultV2> {
	const { job_id, user_id } = payload;

	if (!job_id || !user_id) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameters: job_id, user_id'
			})
		};
	}

	try {
		const cancelled = await jobManager.cancelJob(job_id, user_id);

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: true,
				cancelled
			})
		};
	} catch (error) {
		console.error('Error cancelling job:', error);
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Failed to cancel job'
			})
		};
	}
}

async function handleContentRequest(request: ContentRequest): Promise<APIGatewayProxyResultV2> {
	let { action, payload } = request;

	console.log('[HANDLER] Received request:', JSON.stringify(request, null, 2));
	console.log('[HANDLER] action:', action);
	console.log('[HANDLER] payload:', payload);
	console.log('[HANDLER] messages:', (request as any).messages);

	// Transform Vercel AI SDK format to Lambda format
	// experimental_useObject sends: { prompt, action }
	// useChat sends: { id, messages, action }
	// Lambda needs: { action, payload: { prompt } } or { action, payload: { messages } }
	if (action === 'chat-v2-stream') {
		if ((request as any).prompt) {
			console.log('[HANDLER] Transforming experimental_useObject format to Lambda format');
			payload = {
				prompt: (request as any).prompt
			};
		} else if ((request as any).messages) {
			console.log('[HANDLER] Transforming useChat format to Lambda format');
			payload = {
				id: (request as any).id,
				messages: (request as any).messages
			};
		} else if (!payload) {
			return {
				statusCode: 400,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({
					success: false,
					error: 'Missing required parameter: prompt or messages'
				})
			};
		}
	}

	if (!action) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: action'
			})
		};
	}

	if (!payload && action !== 'chat-v2-stream') {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameter: payload'
			})
		};
	}

	try {
		// Handle chat-v2-stream early since it doesn't need Supabase
		if (action === 'chat-v2-stream') {
			// Return Response directly for streaming support
			return await handleChatV2StreamResponse(payload);
		}

		const supabase = getSupabaseClient();
		const queueUrl = process.env.CONTENT_QUEUE_URL;
		const jobManager = new JobManager(supabase, queueUrl);

		// Actions that should be enqueued (async processing)
		const queueableActions = [
			'seo-extract',
			'llm-generate',
			'markdown-extract',
			'youtube-playlist-extract',
			'youtube-subtitle-extract',
			'tmdb-search',
			'libgen-search',
			'screenshot-queue',
			'tsx-transpile',
			'transcribe-audio',
			'claude-code'
		];

		if (queueableActions.includes(action)) {
			// Auto-detect local mode: no queue URL means local development
			const isLocalMode = !queueUrl;

			// Force sync mode for claude-code when running locally
			const shouldRunSync = request.sync === true || (isLocalMode && action === 'claude-code');

			if (shouldRunSync) {
				if (isLocalMode && action === 'claude-code') {
					console.log(`[Local Mode] Auto-enabling synchronous execution for claude-code`);
				}
				// Execute handler immediately and return results
				console.log(`Executing ${action} synchronously (immediate mode)`);

				let result;
				switch (action) {
					case 'seo-extract':
						result = await handleSEOExtract(supabase, payload);
						break;

					case 'llm-generate':
						result = await handleLLMGenerate(supabase, payload);
						break;

					case 'markdown-extract':
						result = await handleMarkdownExtract(supabase, payload);
						break;

					case 'youtube-playlist-extract':
						result = await handleYouTubePlaylistExtract(supabase, payload);
						break;

					case 'youtube-subtitle-extract':
						result = await handleYouTubeSubtitleExtract(supabase, payload);
						break;

					case 'tmdb-search':
						result = await handleTMDbSearch(supabase, payload);
						break;

					case 'libgen-search':
						result = await handleLibgenSearch(supabase, payload);
						break;

					case 'screenshot-queue':
						result = await handleScreenshotQueue(supabase, payload);
						break;

					case 'tsx-transpile':
						result = await handleTSXTranspile(supabase, payload);
						break;

					case 'transcribe-audio':
						result = await handleTranscribeAudio(supabase, payload);
						break;

					case 'teller-accounts':
						result = await handleTellerAccounts(supabase, payload);
						break;

					case 'teller-balances':
						result = await handleTellerBalances(supabase, payload);
						break;

					case 'teller-transactions':
						result = await handleTellerTransactions(supabase, payload);
						break;

					case 'stripe-connect-onboard':
						result = await handleStripeConnectOnboard(supabase, payload);
						break;

					case 'stripe-connect-status':
						result = await handleStripeConnectStatus(supabase, payload);
						break;

					case 'stripe-connect-dashboard':
						result = await handleStripeConnectDashboard(supabase, payload);
						break;

					case 'stripe-create-transfer':
						result = await handleStripeCreateTransfer(supabase, payload);
						break;

					case 'stripe-list-transfers':
						result = await handleStripeListTransfers(supabase, payload);
						break;

					case 'stripe-initiate-payout':
						result = await handleStripeInitiatePayout(supabase, payload);
						break;

					case 'stripe-list-payouts':
						result = await handleStripeListPayouts(supabase, payload);
						break;

					case 'stripe-search-users':
						result = await handleStripeSearchUsers(supabase, payload);
						break;

					case 'stripe-webhook':
						result = await handleStripeWebhook(supabase, payload);
						break;

					case 'blocknote-export':
						result = await handleBlockNoteExport(supabase, payload);
						break;

					case 'claude-code': {
						// Execute Claude Code synchronously (local mode or explicitly requested)
						const bucketName = process.env.S3_BUCKET_NAME || 'local-test-bucket';
						const sessionManager = new SessionManager(bucketName, process.env.AWS_REGION);

						// Fetch conversation context from sibling content
						let conversationContext = '';
						if (payload.parent_content_id) {
							console.log(`[Conversation Context] Fetching siblings for parent: ${payload.parent_content_id}`);

							const { data: siblings, error: siblingsError } = await supabase
								.from('content')
								.select('id, type, data, created_at, metadata')
								.eq('parent_content_id', payload.parent_content_id)
								.in('type', ['text', 'claude-code'])
								.order('created_at', { ascending: true });

							if (siblingsError) {
								console.error('[Conversation Context] Error fetching siblings:', siblingsError);
							} else if (siblings && siblings.length > 0) {
								console.log(`[Conversation Context] Found ${siblings.length} sibling messages`);

								// Build conversation history (exclude current message by checking data)
								const messages = siblings
									.filter(item => item.data !== payload.prompt) // Skip current message if already saved
									.map(item => {
										const timestamp = new Date(item.created_at).toLocaleTimeString();
										// Truncate long messages for context
										const messageText = item.data.length > 500
											? item.data.substring(0, 500) + '...'
											: item.data;
										return `[${timestamp}] ${messageText}`;
									});

								if (messages.length > 0) {
									conversationContext = `
<conversation_history>
Previous messages in this conversation:
${messages.join('\n')}
</conversation_history>

Current message:
`;
									console.log(`[Conversation Context] Built history with ${messages.length} messages`);
								}
							}
						}

						// Download session files if continuing session
						let sessionFiles;
						if (payload.session_id) {
							const exists = await sessionManager.sessionExists(payload.session_id);
							if (exists) {
								sessionFiles = await sessionManager.downloadSession(payload.session_id);
							}
						}

						// Prepend conversation context to prompt
						const enhancedPrompt = conversationContext + payload.prompt;

						// Execute Claude Code with conversation context and optional GitHub integration
						const claudeResult = await executeClaudeCode({
							prompt: enhancedPrompt,
							sessionFiles,
							resumeSessionId: payload.session_id,
							githubRepo: payload.github_repo // Pass GitHub repo info if provided
						});

						// Upload output files to S3 (skip in local mode if S3 not configured)
						let s3_url = '';
						if (claudeResult.outputFiles?.length > 0 && process.env.S3_BUCKET_NAME) {
							try {
								s3_url = await sessionManager.uploadSession(claudeResult.session_id, claudeResult.outputFiles);
							} catch (s3Error) {
								console.warn('[Local Mode] S3 upload skipped:', s3Error);
							}
						}

						// Create child content items for generated files (v2)
						const createdContentIds: string[] = [];
						if (claudeResult.status === 'completed' && payload.parent_content_id) {
							// Filter out .session/ files (internal Claude CLI data)
							const workspaceFiles = claudeResult.outputFiles?.filter(
								file => !file.path.startsWith('.session/')
							) || [];

							console.log(`[Child Content] Creating ${workspaceFiles.length} items from generated files`);

							for (const file of workspaceFiles) {
								try {
									// Determine content type from file extension
									const fileExtension = file.path.split('.').pop()?.toLowerCase() || 'text';
									const contentType = getContentTypeFromExtension(fileExtension);

									// Convert Uint8Array to string
									const fileContent = new TextDecoder().decode(file.content);

									// Create child content item
									const { data: childContent, error: createError } = await supabase
										.from('content')
										.insert({
											type: contentType,
											data: fileContent,
											group_id: payload.group_id,
											user_id: payload.user_id,
											parent_content_id: payload.parent_content_id,
											metadata: {
												filename: file.path,
												generated_by_claude_code: true,
												session_id: claudeResult.session_id
											}
										})
										.select()
										.single();

									if (createError) {
										console.error(`Error creating child content for ${file.path}:`, createError);
										continue;
									}

									if (childContent) {
										createdContentIds.push(childContent.id);
										console.log(`Created child content ${childContent.id} for file: ${file.path}`);
									}
								} catch (fileError) {
									console.error(`Error processing file ${file.path}:`, fileError);
								}
							}

							console.log(`Successfully created ${createdContentIds.length} child content items`);
						}

						result = {
							success: claudeResult.status === 'completed',
							session_id: claudeResult.session_id,
							messages: claudeResult.messages,
							s3_url,
							error: claudeResult.error,
							stdout: claudeResult.stdout,
							stderr: claudeResult.stderr,
							exitCode: claudeResult.exitCode,
							file_count: claudeResult.outputFiles?.length || 0,
							child_content_count: createdContentIds.length,
							git_commit_sha: claudeResult.git_commit_sha,
							git_commit_url: claudeResult.git_commit_url
						};
						break;
					}

					default:
						return {
							statusCode: 400,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders
							},
							body: JSON.stringify({
								success: false,
								error: `Unknown action: ${action}`
							})
						};
				}

				// Return results immediately
				return {
					statusCode: 200,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					},
					body: JSON.stringify(result)
				};
			}

			// Asynchronous mode (default) - create job and enqueue
			console.log(`Executing ${action} asynchronously (queued mode)`);

			// Extract user_id and group_id from payload
			let user_id: string;
			let group_id: string;

			// Special handling for screenshot-queue which has jobs array instead of selectedContent
			if (action === 'screenshot-queue') {
				const firstJob = payload.jobs?.[0];
				if (!firstJob || !firstJob.contentId) {
					return {
						statusCode: 400,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						},
						body: JSON.stringify({
							success: false,
							error: 'Missing jobs array or contentId in payload'
						})
					};
				}

				// Fetch content to get user_id and group_id
				const { data: content, error: fetchError } = await supabase
					.from('content')
					.select('user_id, group_id')
					.eq('id', firstJob.contentId)
					.single();

				if (fetchError || !content) {
					return {
						statusCode: 400,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						},
						body: JSON.stringify({
							success: false,
							error: `Failed to fetch content: ${fetchError?.message || 'Content not found'}`
						})
					};
				}

				user_id = content.user_id;
				group_id = content.group_id;
			} else if (action === 'claude-code') {
				// Special handling for claude-code which has user_id and group_id directly in payload
				user_id = payload.user_id;
				group_id = payload.group_id;

				if (!user_id || !group_id) {
					return {
						statusCode: 400,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						},
						body: JSON.stringify({
							success: false,
							error: 'Missing user_id or group_id in payload'
						})
					};
				}
			} else {
				// Standard handling for actions with selectedContent
				const firstContent = payload.selectedContent?.[0];
				if (!firstContent) {
					return {
						statusCode: 400,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						},
						body: JSON.stringify({
							success: false,
							error: 'Missing selectedContent in payload'
						})
					};
				}

				user_id = firstContent.user_id;
				group_id = firstContent.group_id;

				if (!user_id || !group_id) {
					return {
						statusCode: 400,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						},
						body: JSON.stringify({
							success: false,
							error: 'Missing user_id or group_id in selectedContent'
						})
					};
				}
			}

			// Extract target content IDs from payload
			let target_content_ids: string[] = [];
			if (action === 'screenshot-queue' && payload.jobs) {
				// Extract content IDs from screenshot jobs array
				target_content_ids = payload.jobs
					.map((job: any) => job.contentId)
					.filter((id: string) => id);
			} else if (payload.selectedContent && Array.isArray(payload.selectedContent)) {
				// Extract IDs from selectedContent array
				target_content_ids = payload.selectedContent
					.map((content: any) => content.id)
					.filter((id: string) => id);
			}

			// Create job in database
			const job = await jobManager.createJob({
				user_id,
				group_id,
				action,
				payload,
				target_content_ids: target_content_ids.length > 0 ? target_content_ids : undefined
			});

			// Enqueue job to SQS
			if (queueUrl) {
				await jobManager.enqueueJob(job);
			} else {
				console.warn('Queue URL not configured - job created but not enqueued');
			}

			// Return job ID immediately
			return {
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({
					success: true,
					job_id: job.id,
					status: 'pending'
				})
			};
		}

		// Handle special actions that don't use queue
		let result;

		switch (action) {
			case 'chat-message':
				result = await handleChatMessage(supabase, payload);
				break;

			case 'send-notification':
				result = await handleSendNotification(supabase, payload);
				break;

			case 'register-device':
				result = await handleRegisterDevice(supabase, payload);
				break;

			case 'unregister-device':
				result = await handleUnregisterDevice(supabase, payload);
				break;

			case 'blocknote-export':
				result = await handleBlockNoteExport(supabase, payload);
				break;

			case 'get-job':
				// Get specific job status
				return await handleGetJobStatus(jobManager, payload);

			case 'list-jobs':
				// List user's jobs
				return await handleListJobs(jobManager, payload);

			case 'cancel-job':
				// Cancel a pending job
				return await handleCancelJob(jobManager, payload);

			case 'auth-generate-token':
				result = await handleGenerateToken(supabase, payload);
				break;

			case 'auth-redeem-token':
				result = await handleRedeemToken(supabase, payload);
				break;

			case 'auth-revoke-token':
				result = await handleRevokeToken(supabase, payload);
				break;

			case 'auth-validate-session':
				result = await handleValidateSession(supabase, payload);
				break;

			case 'auth-list-tokens':
				result = await handleListTokens(supabase, payload);
				break;

			default:
				return {
					statusCode: 400,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					},
					body: JSON.stringify({
						success: false,
						error: `Unknown action: ${action}`
					})
				};
		}

		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify(result)
		};
	} catch (error) {
		console.error('Content request error:', error);

		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error'
			})
		};
	}
}

// =============================================================================
// STREAMING HANDLER
// =============================================================================

/**
 * Streaming handler for chat-v2-stream action
 * Uses awslambda.streamifyResponse for true streaming support with CORS headers
 *
 * This handler works for both local Docker testing and production Lambda Function URLs.
 */
export const streamingHandler = awslambda.streamifyResponse(
	async (
		event: APIGatewayProxyEventV2 | ContentRequest | any,
		responseStream: awslambda.ResponseStream,
		_context: any
	) => {
		try {
			// Handle OPTIONS preflight request (Lambda Function URL format)
			// Note: event.httpMethod is set by Lambda Function URLs, not Lambda Runtime Interface Emulator
			if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
				console.log('[STREAMING] Handling OPTIONS preflight');
				// Return plain object for OPTIONS (don't use HttpResponseStream)
				return {
					statusCode: 200,
					headers: corsHeaders,
					body: JSON.stringify('Preflight request successful')
				};
			}

			// Parse request based on invocation type
			let request: ContentRequest;

			// Direct invocation (local Docker testing)
			if (event.action && event.payload) {
				request = event as ContentRequest;
			}
			// Direct invocation with experimental_useObject format: { action, prompt }
			else if (event.action && event.prompt) {
				request = {
					action: event.action,
					payload: {
						prompt: event.prompt
					}
				};
			}
			// API Gateway or Function URL invocation
			else if (event.body) {
				const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
				request = body as ContentRequest;
			}
			// Vercel AI SDK useChat format: { id, messages }
			else if (event.messages) {
				request = {
					action: 'chat-v2-stream',
					payload: {
						id: event.id,
						messages: event.messages
					}
				};
			}
			else {
				throw new Error('Invalid request format - expected action/payload, prompt, or messages');
			}

			const { action, payload } = request;

			if (action !== 'chat-v2-stream') {
				throw new Error(`Streaming handler only supports chat-v2-stream, got: ${action}`);
			}

			if (!payload) {
				throw new Error('Missing payload');
			}

			// Convert UIMessages to ModelMessages if needed
			let convertedPayload = payload;
			if (payload.messages && payload.messages.length > 0) {
				const firstMessage = payload.messages[0];
				// Check if messages are in UIMessage format (have 'parts' property)
				if ('parts' in firstMessage) {
					console.log('[HANDLER] Converting UIMessages to ModelMessages');
					try {
						const modelMessages = convertToModelMessages(payload.messages as any);
						convertedPayload = {
							...payload,
							messages: modelMessages
						};
						console.log('[HANDLER] Conversion successful');
					} catch (error) {
						console.error('[HANDLER] Message conversion failed:', error);
						throw new Error('Invalid message format');
					}
				}
			}

			// Wrap response stream with CORS headers and content type
			const metadata = {
				statusCode: 200,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive',
					'X-Accel-Buffering': 'no', // Disable nginx buffering
				}
			};
			responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

			// Get the stream from handleChatV2Stream with converted messages
			const stream = await handleChatV2Stream(convertedPayload);

			// Stream chunks to response
			for await (const chunk of stream) {
				responseStream.write(chunk);
			}

			responseStream.end();
		} catch (error) {
			console.error('Streaming handler error:', error);

			// Wrap error response with proper headers
			const metadata = {
				statusCode: 500,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				}
			};
			responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

			// Write error as JSON
			const errorResponse = JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Streaming error'
			});

			responseStream.write(errorResponse);
			responseStream.end();
		}
	}
);
