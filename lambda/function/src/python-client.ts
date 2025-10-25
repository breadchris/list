import { spawn } from 'child_process';
import { z } from 'zod';

// Zod schemas for YouTube transcript response from Python script

export const TranscriptSegmentSchema = z.object({
	text: z.string(),
	offset: z.number(), // milliseconds
	offsetText: z.string(), // formatted as HH:MM:SS
	duration: z.number() // milliseconds
});

export const YouTubeTranscriptResponseSchema = z.object({
	title: z.string(),
	channel: z.string(),
	transcript: z.array(TranscriptSegmentSchema)
});

// TypeScript types

export interface TranscriptSegment {
	text: string;
	offset: number;
	offsetText: string;
	duration: number;
}

export interface YouTubeTranscriptResponse {
	title: string;
	channel: string;
	transcript: TranscriptSegment[];
}

// Type guard

export function isYouTubeTranscriptResponse(data: unknown): data is YouTubeTranscriptResponse {
	const result = YouTubeTranscriptResponseSchema.safeParse(data);
	return result.success;
}

// Python executor options

export interface PythonExecutorOptions {
	pythonPath?: string;
	scriptPath?: string;
	timeout?: number;
}

/**
 * Execute Python yt_transcript2.py script to extract YouTube video transcripts
 *
 * @param videoUrl - YouTube video URL
 * @param options - Execution options (python path, script path, timeout)
 * @returns Promise resolving to transcript response
 */
export async function executeYouTubeTranscript(
	videoUrl: string,
	options: PythonExecutorOptions = {}
): Promise<YouTubeTranscriptResponse> {
	const {
		pythonPath = 'python3.11', // Use Python 3.11 which has working SSL
		scriptPath = '/var/task/yt_transcript2.py',
		timeout = 60000 // 60 seconds default (yt-dlp can be slow)
	} = options;

	return new Promise((resolve, reject) => {
		// Spawn Python process with video URL as argument
		const child = spawn(pythonPath, [scriptPath, videoUrl], {
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdoutData = '';
		let stderrData = '';

		// Set up timeout
		const timeoutId = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error(`Python script execution timed out after ${timeout}ms`));
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
				reject(new Error(`Python script exited with code ${code}. stderr: ${stderrData}`));
				return;
			}

			// Parse JSON response
			try {
				const response = JSON.parse(stdoutData.trim());

				if (!isYouTubeTranscriptResponse(response)) {
					reject(new Error(`Invalid response format from Python script: ${stdoutData}`));
					return;
				}

				resolve(response);
			} catch (error) {
				reject(new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}. stdout: ${stdoutData}`));
			}
		});

		// Handle spawn errors
		child.on('error', (error) => {
			clearTimeout(timeoutId);
			reject(new Error(`Failed to spawn Python process: ${error.message}`));
		});
	});
}
