/**
 * Types for Group-Based P2P File Sharing
 * Uses Y.js for real-time sync and WebRTC for file transfer
 */

/**
 * Metadata for a shared file in the group
 * Stored in Y.Map keyed by hash
 */
export interface SharedFile {
  /** SHA-256 hash of file content (primary key) */
  hash: string;
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** ISO timestamp when first added */
  added_at: string;
  /** User ID who first added this file */
  added_by: string;
  /** Display name of user who added */
  added_by_name: string;
}

/**
 * Status of a file transfer request
 */
export type TransferStatus =
  | 'pending'    // Waiting for holder to accept
  | 'active'     // Transfer in progress
  | 'completed'  // Successfully transferred
  | 'failed'     // Transfer failed
  | 'cancelled'; // Cancelled by requester or holder

/**
 * A request to download a file from a holder
 * Stored in Y.Map keyed by request ID
 */
export interface TransferRequest {
  /** Unique request ID (UUID) */
  id: string;
  /** Hash of the file being requested */
  file_hash: string;
  /** User ID of the requester */
  requester_id: string;
  /** Display name of requester */
  requester_name: string;
  /** Current status of the request */
  status: TransferStatus;
  /** ISO timestamp when request was created */
  created_at: string;
  /** User ID of holder who accepted (if any) */
  seeder_id?: string;
  /** Display name of seeder */
  seeder_name?: string;
  /** Transfer progress 0-100 */
  progress?: number;
  /** Error message if failed */
  error?: string;
  /** ISO timestamp when completed */
  completed_at?: string;
}

/**
 * User presence state for file sharing
 * Broadcast via Yjs Awareness
 */
export interface ShareAwarenessState {
  /** User ID */
  user_id: string;
  /** Display name */
  user_name: string;
  /** Consistent color for avatars (hex) */
  color: string;
  /** File hashes that user has available locally */
  available_files: string[];
  /** File hashes currently being sent */
  serving_files: string[];
  /** Whether WebRTC is ready */
  client_ready: boolean;
  /** Current action for UI feedback */
  current_action?: 'idle' | 'uploading' | 'downloading';
  /** File hash being transferred (if any) */
  transfer_target?: string;
}

/**
 * Message types for WebRTC data channel file transfer protocol
 */
export type FileTransferMessage =
  | FileStartMessage
  | FileChunkMessage
  | FileEndMessage
  | FileErrorMessage
  | FileProgressMessage;

export interface FileStartMessage {
  type: 'file-start';
  /** Request ID this transfer is for */
  request_id: string;
  /** File name */
  name: string;
  /** Total size in bytes */
  size: number;
  /** SHA-256 hash for verification */
  hash: string;
  /** Total number of chunks */
  total_chunks: number;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  /** Request ID */
  request_id: string;
  /** Chunk index (0-based) */
  index: number;
  /** Chunk data (Uint8Array as base64 or raw) */
  data: ArrayBuffer;
}

export interface FileEndMessage {
  type: 'file-end';
  /** Request ID */
  request_id: string;
  /** Final hash for verification */
  hash: string;
}

export interface FileErrorMessage {
  type: 'file-error';
  /** Request ID */
  request_id: string;
  /** Error message */
  error: string;
}

export interface FileProgressMessage {
  type: 'file-progress';
  /** Request ID */
  request_id: string;
  /** Progress 0-100 */
  progress: number;
  /** Current speed in bytes/sec */
  speed: number;
}

/**
 * Holder info for a file
 */
export interface FileHolder {
  user_id: string;
  user_name: string;
  is_online: boolean;
  is_serving: boolean;
}

/**
 * File availability status
 */
export interface FileAvailability {
  /** File hash */
  hash: string;
  /** All holders (online and offline) */
  holders: FileHolder[];
  /** Online holders who can serve */
  available_holders: FileHolder[];
  /** Whether file is currently available */
  is_available: boolean;
}

/**
 * Transfer progress tracking
 */
export interface TransferProgress {
  /** Request ID */
  request_id: string;
  /** File hash */
  file_hash: string;
  /** Progress 0-100 */
  progress: number;
  /** Download/upload speed in bytes/sec */
  speed: number;
  /** Estimated time remaining in seconds */
  eta: number;
  /** Bytes transferred */
  transferred: number;
  /** Total bytes */
  total: number;
  /** Transfer status */
  status: 'connecting' | 'transferring' | 'verifying' | 'done' | 'error';
}

/**
 * Configuration for the share room
 */
export interface ShareRoomConfig {
  /** Group ID */
  group_id: string;
  /** Current user ID */
  user_id: string;
  /** Current user display name */
  user_name: string;
  /** Optional password for encryption */
  password?: string;
  /** Y-Sweet signaling server URLs */
  signaling_urls?: string[];
}

/**
 * Y.Doc structure for file sharing
 * Document ID: share-{groupId}
 */
export interface ShareDocSchema {
  /** Y.Map<hash, SharedFile> */
  files: Map<string, SharedFile>;
  /** Y.Map<requestId, TransferRequest> */
  requests: Map<string, TransferRequest>;
  /** Y.Map<hash, userId[]> - who has each file */
  holders: Map<string, string[]>;
}
