/**
 * Device Fingerprinting Utility
 *
 * Generates a unique identifier for the current device/browser.
 * Used for binding persistent auth tokens to specific devices.
 */

/**
 * Generate a device fingerprint based on browser characteristics
 * This is a simplified implementation - for production, consider using FingerprintJS
 */
export async function getDeviceFingerprint(): Promise<string> {
	const components: string[] = [];

	// User agent
	components.push(navigator.userAgent);

	// Screen info
	components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

	// Timezone
	components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

	// Language
	components.push(navigator.language);

	// Platform
	components.push(navigator.platform);

	// Hardware concurrency (CPU cores)
	if (navigator.hardwareConcurrency) {
		components.push(String(navigator.hardwareConcurrency));
	}

	// Device memory (if available)
	if ((navigator as any).deviceMemory) {
		components.push(String((navigator as any).deviceMemory));
	}

	// Canvas fingerprint
	try {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (ctx) {
			canvas.width = 200;
			canvas.height = 50;
			ctx.textBaseline = 'top';
			ctx.font = '14px Arial';
			ctx.fillStyle = '#f60';
			ctx.fillRect(125, 1, 62, 20);
			ctx.fillStyle = '#069';
			ctx.fillText('Hello, fingerprint!', 2, 15);
			ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
			ctx.fillText('Hello, fingerprint!', 4, 17);
			components.push(canvas.toDataURL());
		}
	} catch {
		components.push('canvas-error');
	}

	// WebGL info
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (gl && gl instanceof WebGLRenderingContext) {
			const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
			if (debugInfo) {
				components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
				components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
			}
		}
	} catch {
		components.push('webgl-error');
	}

	// Create hash of all components
	const fingerprint = components.join('|');
	return await hashString(fingerprint);
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store the device fingerprint in localStorage for consistency
 */
export async function getOrCreateDeviceFingerprint(): Promise<string> {
	const storageKey = 'device_fingerprint';

	// Check if we already have a fingerprint
	const stored = localStorage.getItem(storageKey);
	if (stored) {
		return stored;
	}

	// Generate new fingerprint
	const fingerprint = await getDeviceFingerprint();
	localStorage.setItem(storageKey, fingerprint);
	return fingerprint;
}
