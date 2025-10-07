import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SessionManager } from './session-manager.js';
import { executeClaudeCode } from './claude-executor.js';
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
		const body: ClaudeCodeRequest = JSON.parse(event.body || '{}');

		// Route based on path
		if (path === '/claude-code' || path === '/claude-code/') {
			result = await handleClaudeCodeRequest(body);
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
};

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
			sessionFiles
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

		// Upload session to S3 (skip for now - files managed separately)
		// TODO: Implement proper session file storage when needed
		const response: ClaudeCodeResponse = {
			success: true,
			session_id: result.session_id,
			messages: result.messages,
			s3_url: '', // Session files not currently stored
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: result.exitCode
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
