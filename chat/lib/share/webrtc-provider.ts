/**
 * Y-webrtc provider setup for file sharing
 * Uses Y-Sweet signaling for peer discovery
 */

import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import type { ShareRoomConfig } from '@/types/share';

// Default Y-Sweet signaling servers
// These should be configured via environment variable in production
const DEFAULT_SIGNALING_URLS = [
  // Y-Sweet public signaling servers
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-us.herokuapp.com',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
];

/**
 * Create a WebRTC provider for file sharing
 * Handles peer discovery and connection via Y-Sweet signaling
 */
export function createShareProvider(
  doc: Y.Doc,
  config: ShareRoomConfig
): WebrtcProvider {
  const roomName = `share-${config.group_id}`;
  const signalingUrls = config.signaling_urls || DEFAULT_SIGNALING_URLS;

  const provider = new WebrtcProvider(roomName, doc, {
    signaling: signalingUrls,
    password: config.password,
    maxConns: 25,
    // Filter function to only connect to peers in the same group
    filterBcConns: true,
  });

  // Set initial awareness state
  provider.awareness?.setLocalStateField('user_id', config.user_id);
  provider.awareness?.setLocalStateField('user_name', config.user_name);
  provider.awareness?.setLocalStateField('color', generateUserColor(config.user_id));
  provider.awareness?.setLocalStateField('available_files', []);
  provider.awareness?.setLocalStateField('serving_files', []);
  provider.awareness?.setLocalStateField('client_ready', true);

  return provider;
}

/**
 * Generate a consistent color for a user based on their ID
 */
export function generateUserColor(userId: string): string {
  // Simple hash to generate a hue
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Get connected peers from provider
 */
export function getConnectedPeers(provider: WebrtcProvider): Map<string, unknown> {
  // Access the internal room's webrtc connections
  const room = (provider as unknown as { room?: { webrtcConns: Map<string, unknown> } }).room;
  return room?.webrtcConns || new Map();
}

/**
 * Check if provider is connected to any peers
 */
export function isConnected(provider: WebrtcProvider): boolean {
  const peers = getConnectedPeers(provider);
  return peers.size > 0;
}

/**
 * Get peer count
 */
export function getPeerCount(provider: WebrtcProvider): number {
  return getConnectedPeers(provider).size;
}
