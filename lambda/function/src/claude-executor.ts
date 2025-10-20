import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SessionFile } from './session-manager.js';
import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import { writeFile, readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export interface ClaudeExecutionOptions {
	prompt: string;
	sessionFiles?: SessionFile[];
	resumeSessionId?: string; // Session ID to resume
	githubRepo?: {
		owner: string;
		name: string;
		branch: string;
		token: string;
	};
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
	git_commit_sha?: string;
	git_commit_url?: string;
}

/**
 * Execute Claude Code SDK with the given prompt and optional session files
 */
/**
 * Get list of files in a directory recursively
 */
async function getFilesRecursive(dir: string, baseDir: string = dir): Promise<SessionFile[]> {
	const files: SessionFile[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		// Skip hidden files, node_modules, and system directories
		if (entry.name.startsWith('.') || entry.name === 'node_modules') {
			continue;
		}

		if (entry.isDirectory()) {
			const subFiles = await getFilesRecursive(fullPath, baseDir);
			files.push(...subFiles);
		} else {
			const content = await readFile(fullPath);
			const relativePath = fullPath.substring(baseDir.length + 1);
			files.push({
				path: relativePath,
				content: new Uint8Array(content)
			});
		}
	}

	return files;
}

export async function executeClaudeCode(
	options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
	const { prompt, sessionFiles, resumeSessionId, githubRepo } = options;

	let capturedSessionId: string | null = null;
	const messages: SDKMessage[] = [];
	let stdoutBuffer = '';
	let stderrBuffer = '';
	let exitCode: number | null = null;
	const workDir = '/tmp/claude-workspace';

	// Add coding conventions to prompt
	const codingConventions = `
CODING CONVENTIONS:
- When creating React/TSX components, ALWAYS use default exports with named functions
- Example: export default function ComponentName() { ... }
- Do NOT use: export const ComponentName = () => { ... }
- This ensures components work correctly with dynamic imports

USER REQUEST:
`;

	const enhancedPrompt = resumeSessionId
		? prompt // Don't add conventions when resuming - they were already added to the initial prompt
		: codingConventions + prompt;

	try {
		process.stderr.write('=== executeClaudeCode called ===\n');
		process.stderr.write(`Prompt: ${enhancedPrompt.substring(0, 100)}\n`);
		process.stderr.write(`CLI path: /var/lang/bin/claude\n`);
		process.stderr.write(`Work Dir: ${workDir}\n`);
		process.stderr.write(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}\n`);
		process.stderr.write(`Running as root: ${process.getuid?.() === 0}\n`);
		process.stderr.write(`HOME: ${process.env.HOME}\n`);
		process.stderr.write(`GitHub repo provided: ${!!githubRepo}\n`);

		// Create work directory (clear if exists from previous invocations)
		try {
			await readdir(workDir);
			process.stderr.write('Work directory exists, using it\n');
		} catch {
			const { mkdir } = await import('fs/promises');
			await mkdir(workDir, { recursive: true });
			process.stderr.write('Created work directory\n');
		}

		// Clone GitHub repository if provided (BEFORE session restore)
		if (githubRepo) {
			const { owner, name, branch, token } = githubRepo;
			const cloneUrl = `https://${token}@github.com/${owner}/${name}.git`;

			process.stderr.write(`Cloning GitHub repo: ${owner}/${name} (branch: ${branch})\n`);

			try {
				// Clone the repository into workDir
				execSync(`git clone -b ${branch} ${cloneUrl} ${workDir}`, {
					stdio: 'inherit',
					env: {
						...process.env,
						GIT_TERMINAL_PROMPT: '0' // Disable interactive prompts
					}
				});

				process.stderr.write(`Successfully cloned ${owner}/${name}\n`);
			} catch (gitError) {
				process.stderr.write(`Git clone failed: ${gitError}\n`);
				throw new Error(`Failed to clone GitHub repository: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`);
			}
		}

		// Restore session files if provided
		if (sessionFiles && sessionFiles.length > 0) {
			process.stderr.write(`Restoring ${sessionFiles.length} session files\n`);
			for (const file of sessionFiles) {
				const { mkdir } = await import('fs/promises');

				// Session data files (prefixed with .session/) go to Claude CLI session directory
				if (file.path.startsWith('.session/')) {
					if (!resumeSessionId) {
						process.stderr.write('Warning: Session files found but no resumeSessionId provided, skipping\n');
						continue;
					}

					// Restore to Claude CLI session directory
					const sessionPath = file.path.substring('.session/'.length);
					const sessionFilePath = `/tmp/.config/claude-code/sessions/${resumeSessionId}/${sessionPath}`;
					const sessionDirPath = join(sessionFilePath, '..');
					await mkdir(sessionDirPath, { recursive: true });
					await writeFile(sessionFilePath, file.content);
					process.stderr.write(`Restored session file: ${sessionPath}\n`);
				} else {
					// Regular workspace files go to workDir
					const filePath = join(workDir, file.path);
					const dirPath = join(filePath, '..');
					await mkdir(dirPath, { recursive: true });
					await writeFile(filePath, file.content);
				}
			}
		}

		// Execute Claude Code SDK with bypass permissions for automated execution
		const resultStream = query({
			prompt: enhancedPrompt,
			options: {
				model: 'claude-sonnet-4-5-20250929',
				permissionMode: 'bypassPermissions', // Allow automated file operations
				includePartialMessages: false,
				pathToClaudeCodeExecutable: '/var/lang/bin/claude',
				cwd: workDir, // Use dedicated workspace directory
				resume: resumeSessionId, // Resume previous session if provided
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

		// Capture all files written to workspace
		process.stderr.write('Capturing output files from workspace...\n');
		const workspaceFiles = await getFilesRecursive(workDir);
		process.stderr.write(`Captured ${workspaceFiles.length} workspace files\n`);

		// Capture Claude CLI session data (conversation history and context)
		const sessionDir = `/tmp/.config/claude-code/sessions/${capturedSessionId}`;
		let capturedSessionFiles: SessionFile[] = [];
		try {
			await readdir(sessionDir);
			process.stderr.write(`Capturing session data from ${sessionDir}...\n`);
			capturedSessionFiles = await getFilesRecursive(sessionDir);
			// Prefix session files with .session/ to differentiate from workspace files
			capturedSessionFiles = capturedSessionFiles.map(file => ({
				...file,
				path: `.session/${file.path}`
			}));
			process.stderr.write(`Captured ${capturedSessionFiles.length} session files\n`);
		} catch {
			process.stderr.write('No session directory found (session data not persisted)\n');
		}

		const outputFiles = [...workspaceFiles, ...capturedSessionFiles];

		// Commit and push to GitHub if repo was provided
		let git_commit_sha: string | undefined;
		let git_commit_url: string | undefined;

		if (githubRepo) {
			const { owner, name, branch } = githubRepo;
			process.stderr.write('Committing and pushing changes to GitHub...\n');

			try {
				// Configure git user (required for commits)
				execSync('git config user.name "Claude Code"', { cwd: workDir });
				execSync('git config user.email "claude-code@anthropic.com"', { cwd: workDir });

				// Add all changes
				execSync('git add .', { cwd: workDir });

				// Check if there are any changes to commit
				const gitStatus = execSync('git status --porcelain', { cwd: workDir, encoding: 'utf-8' });

				if (gitStatus.trim()) {
					// Create commit message from prompt
					const commitMessage = `Claude Code: ${prompt.substring(0, 72)}

Session: ${capturedSessionId}
Generated by Claude Code`;

					// Commit changes
					execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: workDir });

					// Get commit SHA
					git_commit_sha = execSync('git rev-parse HEAD', { cwd: workDir, encoding: 'utf-8' }).trim();
					git_commit_url = `https://github.com/${owner}/${name}/commit/${git_commit_sha}`;

					process.stderr.write(`Created commit: ${git_commit_sha}\n`);

					// Push to GitHub
					execSync(`git push origin ${branch}`, {
						cwd: workDir,
						env: {
							...process.env,
							GIT_TERMINAL_PROMPT: '0'
						}
					});

					process.stderr.write(`Successfully pushed to ${owner}/${name} (${branch})\n`);
					process.stderr.write(`Commit URL: ${git_commit_url}\n`);
				} else {
					process.stderr.write('No changes to commit\n');
				}
			} catch (gitError) {
				process.stderr.write(`Git commit/push failed: ${gitError}\n`);
				// Don't fail the entire execution if git operations fail
				// The Claude Code execution was successful, just log the git error
			}
		}

		return {
			session_id: capturedSessionId,
			messages,
			outputFiles,
			status: 'completed',
			stdout: stdoutBuffer,
			stderr: stderrBuffer,
			exitCode: exitCode || 0,
			git_commit_sha,
			git_commit_url
		};
	} catch (error) {
		process.stderr.write(`ERROR in executeClaudeCode: ${error}\n`);
		if (error instanceof Error) {
			process.stderr.write(`Error message: ${error.message}\n`);
			process.stderr.write(`Error stack: ${error.stack}\n`);

			// Log full error object for debugging
			try {
				const errorDetails = JSON.stringify({
					stack: error.stack,
					...error
				}, null, 2);
				process.stderr.write(`Full error details:\n${errorDetails}\n`);
			} catch (stringifyError) {
				process.stderr.write(`Could not stringify error: ${stringifyError}\n`);
			}
		}

		// Log captured state before returning
		process.stderr.write(`Session ID at error: ${capturedSessionId || 'none'}\n`);
		process.stderr.write(`Messages collected: ${messages.length}\n`);
		process.stderr.write(`Exit code: ${exitCode || 'none'}\n`);

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
