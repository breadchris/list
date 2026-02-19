import { spawn, type ChildProcess } from 'child_process';
import * as Y from 'yjs';
import { DocumentManager } from '@y-sweet/sdk';

// Polyfill WebSocket for Node.js (Y-Sweet SDK needs it)
import WebSocket from 'ws';
(globalThis as any).WebSocket = WebSocket;

const CONNECTION_STRING = process.env.CONNECTION_STRING || '';
const SHELL_TIMEOUT_MS = 290_000; // 290s (Lambda timeout is 300s)

/**
 * shell-start: Creates a Y-Sweet doc and returns the doc_id.
 * Called synchronously from the /content endpoint.
 */
export async function handleShellStart(payload: { doc_id: string; cols?: number; rows?: number }) {
	const { doc_id } = payload;

	if (!doc_id) {
		return { success: false, error: 'doc_id is required' };
	}

	if (!CONNECTION_STRING) {
		return { success: false, error: 'CONNECTION_STRING not configured' };
	}

	const manager = new DocumentManager(CONNECTION_STRING);
	await manager.getOrCreateDocAndToken(doc_id);

	return {
		success: true,
		data: { doc_id }
	};
}

/**
 * shell-run: Connects to Y-Sweet doc, spawns a shell, bridges I/O.
 * Called from SQS handler (async, up to 5min).
 *
 * YJS doc structure (single Y.Map called "shell"):
 *   output: string   - terminal output (append-only)
 *   input: string    - keyboard input from frontend (append-only)
 *   status: string   - "starting" | "running" | "exited" | "timeout"
 *   cols: number
 *   rows: number
 *   exit_code: number
 *   started_at: string
 */
export async function handleShellRun(payload: { doc_id: string; cols?: number; rows?: number }) {
	const { doc_id, cols = 80, rows = 24 } = payload;

	if (!doc_id) {
		return { success: false, error: 'doc_id is required' };
	}

	if (!CONNECTION_STRING) {
		return { success: false, error: 'CONNECTION_STRING not configured' };
	}

	const manager = new DocumentManager(CONNECTION_STRING);
	const clientToken = await manager.getOrCreateDocAndToken(doc_id);

	// Create Y.Doc and connect via Y-Sweet
	const doc = new Y.Doc();
	const { createYjsProvider } = await import('@y-sweet/client');
	const provider = createYjsProvider(doc, clientToken, { disableBc: true });

	// Wait for sync
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Y-Sweet sync timeout')), 15_000);
		provider.on('sync', (synced: boolean) => {
			if (synced) {
				clearTimeout(timeout);
				resolve();
			}
		});
	});

	const shell = doc.getMap('shell');

	// Set initial metadata
	doc.transact(() => {
		shell.set('status', 'starting');
		shell.set('cols', cols);
		shell.set('rows', rows);
		shell.set('started_at', new Date().toISOString());
		shell.set('output', '');
		shell.set('input', '');
	});

	// Spawn shell with PTY via `script` command
	let child: ChildProcess;
	try {
		child = spawn('script', ['-qc', '/bin/bash', '/dev/null'], {
			env: {
				...process.env,
				TERM: 'xterm-256color',
				COLUMNS: String(cols),
				LINES: String(rows),
				HOME: '/tmp',
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});
	} catch {
		// Fallback if script command not available
		child = spawn('/bin/bash', ['-i'], {
			env: {
				...process.env,
				TERM: 'xterm-256color',
				COLUMNS: String(cols),
				LINES: String(rows),
				HOME: '/tmp',
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});
	}

	shell.set('status', 'running');
	shell.set('pid', child.pid);

	// Bridge stdout/stderr -> Y.Map output (append)
	const appendOutput = (data: Buffer) => {
		const str = data.toString();
		const current = (shell.get('output') as string) || '';
		shell.set('output', current + str);
	};

	child.stdout?.on('data', appendOutput);
	child.stderr?.on('data', appendOutput);

	// Bridge Y.Map input -> shell stdin
	let inputOffset = 0;

	const inputObserver = () => {
		const currentInput = (shell.get('input') as string) || '';
		if (currentInput.length > inputOffset) {
			const newChars = currentInput.substring(inputOffset);
			inputOffset = currentInput.length;
			if (child.stdin?.writable) {
				child.stdin.write(newChars);
			}
		}
	};

	shell.observe(inputObserver);

	// Handle resize from frontend
	const metaObserver = () => {
		const newCols = shell.get('cols') as number;
		const newRows = shell.get('rows') as number;
		if (newCols && newRows && child.pid) {
			try {
				// For script-based PTY, resize via SIGWINCH isn't straightforward.
				// Best effort: environment will reflect initial size.
			} catch {}
		}
	};
	shell.observe(metaObserver);

	// Wait for shell to exit or timeout
	return new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
		let resolved = false;

		const cleanup = () => {
			if (resolved) return;
			resolved = true;
			shell.unobserve(inputObserver);
			shell.unobserve(metaObserver);
			provider.disconnect();
			doc.destroy();
		};

		// Timeout safety
		const timer = setTimeout(() => {
			shell.set('status', 'timeout');
			try { child.kill('SIGTERM'); } catch {}
			setTimeout(() => {
				cleanup();
				resolve({ success: true, data: { status: 'timeout', doc_id } });
			}, 1000);
		}, SHELL_TIMEOUT_MS);

		child.on('close', (code) => {
			clearTimeout(timer);
			doc.transact(() => {
				shell.set('status', 'exited');
				shell.set('exit_code', code ?? -1);
			});
			// Give Y-Sweet a moment to sync the final state
			setTimeout(() => {
				cleanup();
				resolve({ success: true, data: { status: 'exited', exit_code: code, doc_id } });
			}, 1000);
		});

		child.on('error', (err) => {
			clearTimeout(timer);
			shell.set('status', 'exited');
			shell.set('exit_code', -1);
			setTimeout(() => {
				cleanup();
				resolve({ success: false, error: err.message });
			}, 1000);
		});
	});
}
