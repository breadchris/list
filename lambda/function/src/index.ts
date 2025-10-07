import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SessionManager } from './session-manager.js';
import { executeClaudeCode } from './claude-executor.js';

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
}

// CORS headers for all responses
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

export const handler: APIGatewayProxyHandlerV2 = async (
	event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
	const method = event.requestContext.http.method;
	const path = event.rawPath;

	// Handle preflight OPTIONS request
	if (method === 'OPTIONS') {
		return {
			statusCode: 204,
			headers: corsHeaders
		};
	}

	try {
		// Only handle POST requests
		if (method !== 'POST') {
			return {
				statusCode: 405,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				},
				body: JSON.stringify({ success: false, error: 'Method not allowed' })
			};
		}

		// Parse request body
		const body: ClaudeCodeRequest = JSON.parse(event.body || '{}');

		// Route based on path
		if (path === '/claude-code' || path === '/claude-code/') {
			return await handleClaudeCodeRequest(body);
		}

		return {
			statusCode: 404,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
			body: JSON.stringify({ success: false, error: 'Endpoint not found' })
		};
	} catch (error) {
		console.error('Lambda error:', error);

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
};

async function handleClaudeCodeRequest(body: ClaudeCodeRequest): Promise<APIGatewayProxyResultV2> {
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
		const result = await executeClaudeCode({
			prompt,
			sessionFiles
		});

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
					error: result.error
				})
			};
		}

		// Upload session to S3
		console.log('Uploading session:', result.session_id, 'Files:', result.outputFiles);
		const s3Key = await sessionManager.uploadSession(result.session_id, result.outputFiles);
		console.log('Session uploaded to:', s3Key);

		const response: ClaudeCodeResponse = {
			success: true,
			session_id: result.session_id,
			messages: result.messages,
			s3_url: `s3://${bucketName}/${s3Key}`
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
