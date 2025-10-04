import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SessionFile } from './session-manager.js';

export interface ClaudeExecutionOptions {
	prompt: string;
	sessionFiles?: SessionFile[];
}

export interface ClaudeExecutionResult {
	session_id: string;
	messages: SDKMessage[];
	outputFiles: SessionFile[];
	status: 'completed' | 'error';
	error?: string;
}

/**
 * Execute Claude Code SDK with the given prompt and optional session files
 */
export async function executeClaudeCode(
	options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
	const { prompt } = options;

	let capturedSessionId: string | null = null;
	const messages: SDKMessage[] = [];

	try {
		// Execute Claude Code SDK
		const resultStream = query({
			prompt,
			options: {
				model: 'claude-sonnet-4-5-20250929',
				permissionMode: 'bypassPermissions',
				includePartialMessages: false,
				cwd: '/tmp', // Lambda provides /tmp for temporary storage
				hooks: {
					SessionStart: [
						{
							hooks: [
								async (input) => {
									capturedSessionId = input.session_id;
									return {};
								}
							]
						}
					]
				}
			}
		});

		// Process the stream and collect all messages
		for await (const message of resultStream) {
			messages.push(message);
		}

		// Generate session ID if not captured
		if (!capturedSessionId) {
			capturedSessionId = generateSessionId();
		}

		return {
			session_id: capturedSessionId,
			messages,
			outputFiles: [], // Files will be managed separately via S3
			status: 'completed'
		};
	} catch (error) {
		return {
			session_id: capturedSessionId || generateSessionId(),
			messages,
			outputFiles: [],
			status: 'error',
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const randomPart = Math.random().toString(36).substring(2, 15);
	return `session-${timestamp}-${randomPart}`;
}
