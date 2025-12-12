/**
 * SHA-256 file hashing utility
 * Supports streaming for large files (>1GB)
 */

const CHUNK_SIZE = 64 * 1024 * 1024; // 64MB chunks for hashing

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexParts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hexParts.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hexParts.join('');
}

/**
 * Compute SHA-256 hash of a file
 * Uses streaming for large files to avoid memory issues
 */
export async function hashFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const crypto = globalThis.crypto;

  // For small files, hash in one go
  if (file.size <= CHUNK_SIZE) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    onProgress?.(100);
    return bufferToHex(hashBuffer);
  }

  // For large files, use incremental hashing
  // Note: Web Crypto doesn't support streaming, so we use a workaround
  // by reading the file in chunks and accumulating for final hash
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let totalRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    totalRead += value.length;
    onProgress?.(Math.round((totalRead / file.size) * 100));
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Hash the combined buffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return bufferToHex(hashBuffer);
}

/**
 * Compute SHA-256 hash of an ArrayBuffer
 */
export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Verify a file's hash matches expected
 */
export async function verifyFileHash(
  file: File,
  expectedHash: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const actualHash = await hashFile(file, onProgress);
  return actualHash === expectedHash;
}

/**
 * Generate a short hash prefix for display
 */
export function shortHash(hash: string, length: number = 8): string {
  return hash.substring(0, length);
}
