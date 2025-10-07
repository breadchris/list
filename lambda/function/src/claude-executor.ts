import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SessionFile } from './session-manager.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';

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
	stdout?: string;
	stderr?: string;
	exitCode?: number;
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
	let stdoutBuffer = '';
	let stderrBuffer = '';
	let exitCode: number | null = null;

	try {
		process.stderr.write('=== executeClaudeCode called ===\n');
		process.stderr.write(`Prompt: ${prompt.substring(0, 100)}\n`);
		process.stderr.write(`CLI path: /var/lang/bin/claude\n`);
		process.stderr.write(`CWD: /tmp\n`);
		process.stderr.write(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}\n`);
		process.stderr.write(`Running as root: ${process.getuid?.() === 0}\n`);
		process.stderr.write(`HOME: ${process.env.HOME}\n`);

		// Execute Claude Code SDK with default permission mode (acceptEdits)
		// Note: Using 'accept Edits' instead of 'bypassPermissions' to avoid root user restrictions
		const resultStream = query({
			prompt,
			options: {
				model: 'claude-sonnet-4-5-20250929',
				permissionMode: 'acceptEdits', // Works with root user
				includePartialMessages: false,
				pathToClaudeCodeExecutable: '/var/lang/bin/claude',
				cwd: '/tmp', // Lambda provides /tmp for temporary storage
				hooks: {
					SessionStart: [
						{
							hooks: [
								async (input: any) => {
									capturedSessionId = input.session_id;
									process.stderr.write(`Session ID captured: ${input.session_id}\n`);
									return {};
								}
							]
						}
					]
				}
			}
		});

		process.stderr.write('Starting message stream...\n');

		// Process the stream and collect all messages
		for await (const message of resultStream) {
			messages.push(message);
			process.stderr.write(`Message received: ${JSON.stringify(message).substring(0, 200)}\n`);
		}

		process.stderr.write('Message stream completed\n');

		// Generate session ID if not captured
		if (!capturedSessionId) {
			capturedSessionId = generateSessionId();
		}

		return {
			session_id: capturedSessionId,
			messages,
			outputFiles: [], // Files will be managed separately via S3
			status: 'completed',
			stdout: stdoutBuffer,
			stderr: stderrBuffer,
			exitCode: exitCode || 0
		};
	} catch (error) {
		process.stderr.write(`ERROR in executeClaudeCode: ${error}\n`);
		if (error instanceof Error) {
			process.stderr.write(`Error message: ${error.message}\n`);
			process.stderr.write(`Error stack: ${error.stack}\n`);
		}
		return {
			session_id: capturedSessionId || generateSessionId(),
			messages,
			outputFiles: [],
			status: 'error',
			error: error instanceof Error ? error.message : 'Unknown error',
			stdout: stdoutBuffer,
			stderr: stderrBuffer,
			exitCode: exitCode || 1
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
