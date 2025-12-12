/**
 * File chunking utilities for WebRTC data channel transfer
 * WebRTC data channels have message size limits, so we chunk large files
 */

// 64KB chunks - safe size for WebRTC data channels
// Most browsers support up to 256KB, but 64KB is more reliable
export const CHUNK_SIZE = 64 * 1024;

// Maximum message size for metadata (JSON)
export const MAX_METADATA_SIZE = 16 * 1024;

/**
 * Information about a chunked file transfer
 */
export interface ChunkedFileInfo {
  name: string;
  size: number;
  type: string;
  hash: string;
  total_chunks: number;
  chunk_size: number;
}

/**
 * Calculate total chunks for a file
 */
export function calculateChunkCount(fileSize: number): number {
  return Math.ceil(fileSize / CHUNK_SIZE);
}

/**
 * Create file info for transfer
 */
export function createChunkedFileInfo(
  file: File,
  hash: string
): ChunkedFileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    hash,
    total_chunks: calculateChunkCount(file.size),
    chunk_size: CHUNK_SIZE,
  };
}

/**
 * Async generator that yields file chunks
 * Streams the file to avoid loading entire file in memory
 */
export async function* chunkFile(
  file: File,
  chunkSize: number = CHUNK_SIZE
): AsyncGenerator<{ index: number; data: Uint8Array; isLast: boolean }, void, void> {
  const totalChunks = calculateChunkCount(file.size);
  let index = 0;
  let offset = 0;

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const blob = file.slice(offset, end);
    const buffer = await blob.arrayBuffer();
    const data = new Uint8Array(buffer);

    yield {
      index,
      data,
      isLast: index === totalChunks - 1,
    };

    offset = end;
    index++;
  }
}

/**
 * Read a specific chunk from a file
 */
export async function readFileChunk(
  file: File,
  chunkIndex: number,
  chunkSize: number = CHUNK_SIZE
): Promise<Uint8Array> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const blob = file.slice(start, end);
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Reassemble chunks into a File
 */
export function assembleFile(
  chunks: Uint8Array[],
  fileName: string,
  mimeType: string
): File {
  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Class to manage receiving and assembling chunks
 */
export class ChunkAssembler {
  private chunks: Map<number, Uint8Array> = new Map();
  private expectedChunks: number;
  private fileName: string;
  private mimeType: string;
  private expectedHash: string;
  private receivedBytes: number = 0;
  private totalBytes: number;

  constructor(info: ChunkedFileInfo) {
    this.expectedChunks = info.total_chunks;
    this.fileName = info.name;
    this.mimeType = info.type;
    this.expectedHash = info.hash;
    this.totalBytes = info.size;
  }

  /**
   * Add a chunk
   * Returns true if all chunks received
   */
  addChunk(index: number, data: Uint8Array): boolean {
    if (this.chunks.has(index)) {
      // Duplicate chunk, ignore
      return this.isComplete();
    }

    this.chunks.set(index, data);
    this.receivedBytes += data.length;

    return this.isComplete();
  }

  /**
   * Check if all chunks received
   */
  isComplete(): boolean {
    return this.chunks.size === this.expectedChunks;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    if (this.totalBytes === 0) return 100;
    return Math.round((this.receivedBytes / this.totalBytes) * 100);
  }

  /**
   * Get number of missing chunks
   */
  getMissingChunks(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.expectedChunks; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  /**
   * Assemble the final file
   * Should only be called when isComplete() is true
   */
  assemble(): File {
    if (!this.isComplete()) {
      throw new Error(
        `Cannot assemble: missing ${this.expectedChunks - this.chunks.size} chunks`
      );
    }

    // Sort chunks by index and combine
    const sortedChunks: Uint8Array[] = [];
    for (let i = 0; i < this.expectedChunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      sortedChunks.push(chunk);
    }

    return assembleFile(sortedChunks, this.fileName, this.mimeType);
  }

  /**
   * Get expected hash for verification
   */
  getExpectedHash(): string {
    return this.expectedHash;
  }

  /**
   * Clear chunks from memory
   */
  clear(): void {
    this.chunks.clear();
    this.receivedBytes = 0;
  }
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format transfer speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format ETA
 */
export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
