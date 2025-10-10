import { spawn } from 'child_process';
import type { GoRequest, GoResponse } from './go-client.js';
import { isGoResponse } from './go-client.js';

export interface GoExecutorOptions {
	binaryPath?: string;
	timeout?: number; // milliseconds
}

/**
 * Execute Go binary with JSON request via stdin and parse JSON response from stdout
 */
export async function executeGo(
	request: GoRequest,
	options: GoExecutorOptions = {}
): Promise<GoResponse> {
	const {
		binaryPath = '/usr/local/bin/youtube-handler',
		timeout = 30000 // 30 seconds default
	} = options;

	return new Promise((resolve, reject) => {
		const child = spawn(binaryPath, [], {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdoutData = '';
		let stderrData = '';

		// Set up timeout
		const timeoutId = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error(`Go binary execution timed out after ${timeout}ms`));
		}, timeout);

		// Collect stdout
		child.stdout.on('data', (data) => {
			stdoutData += data.toString();
		});

		// Collect stderr
		child.stderr.on('data', (data) => {
			stderrData += data.toString();
		});

		// Handle process completion
		child.on('close', (code) => {
			clearTimeout(timeoutId);

			if (code !== 0) {
				reject(new Error(`Go binary exited with code ${code}. stderr: ${stderrData}`));
				return;
			}

			// Parse JSON response
			try {
				const response = JSON.parse(stdoutData.trim());

				if (!isGoResponse(response)) {
					reject(new Error(`Invalid response format from Go binary: ${stdoutData}`));
					return;
				}

				resolve(response);
			} catch (error) {
				reject(new Error(`Failed to parse Go binary output: ${error}. stdout: ${stdoutData}`));
			}
		});

		// Handle spawn errors
		child.on('error', (error) => {
			clearTimeout(timeoutId);
			reject(new Error(`Failed to spawn Go binary: ${error.message}`));
		});

		// Send request to stdin
		try {
			const requestJSON = JSON.stringify(request);
			child.stdin.write(requestJSON + '\n');
			child.stdin.end();
		} catch (error) {
			clearTimeout(timeoutId);
			child.kill('SIGTERM');
			reject(new Error(`Failed to write request to Go binary: ${error}`));
		}
	});
}
