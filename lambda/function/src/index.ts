import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SessionManager } from './session-manager.js';
import { executeClaudeCode } from './claude-executor.js';
import { getPlaylistVideos } from './youtube-client.js';
import { getSupabaseClient } from './supabase-client.js';
import {
	handleSEOExtract,
	handleLLMGenerate,
	handleChatMessage,
	handleMarkdownExtract,
	handleYouTubePlaylistExtract,
	handleTMDbSearch
} from './content-handlers.js';
import type { ContentRequest } from './types.js';
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

export const handler: APIGatewayProxyHandlerV2 = async (
	event: APIGatewayProxyEventV2 | any
): Promise<APIGatewayProxyResultV2> => {
	// Direct stderr write - should bypass all buffering
	process.stderr.write('=== HANDLER STARTED ===\n');
	process.stderr.write(`Event: ${JSON.stringify(event)}\n`);

	console.log('LAMBDA_START: Handler invoked');
	console.log('LAMBDA_EVENT:', JSON.stringify(event, null, 2));

	// Handle direct Lambda invocation (testing) vs API Gateway invocation
	const isDirectInvocation = !event.requestContext;

	if (isDirectInvocation) {
		// Direct invocation - event is the ClaudeCodeRequest
		process.stderr.write('Direct invocation detected\n');
		const result = await handleClaudeCodeRequest(event as ClaudeCodeRequest);
		await flushLogs();
		return result;
	}

	const method = event.requestContext.http.method;
	const path = event.rawPath;

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

async function handleContentRequest(request: ContentRequest): Promise<APIGatewayProxyResultV2> {
	const { action, payload } = request;

	if (!action || !payload) {
		return {
			statusCode: 400,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({
				success: false,
				error: 'Missing required parameters: action, payload'
			})
		};
	}

	try {
		const supabase = getSupabaseClient();
		let result;

		switch (action) {
			case 'seo-extract':
				result = await handleSEOExtract(supabase, payload);
				break;

			case 'llm-generate':
				result = await handleLLMGenerate(supabase, payload);
				break;

			case 'chat-message':
				result = await handleChatMessage(supabase, payload);
				break;

			case 'markdown-extract':
				result = await handleMarkdownExtract(supabase, payload);
				break;

			case 'youtube-playlist-extract':
				result = await handleYouTubePlaylistExtract(supabase, payload);
				break;

			case 'tmdb-search':
				result = await handleTMDbSearch(supabase, payload);
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
