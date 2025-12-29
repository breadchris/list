/**
 * APNs Push Notification Handler
 *
 * Uses HTTP/2 to communicate with APNs using token-based (.p8) authentication.
 * Device tokens are stored as content items with type='device_token'.
 *
 * Reference: https://developer.apple.com/documentation/usernotifications/sending-push-notifications-using-command-line-tools
 */

import * as jwt from 'jsonwebtoken';
import * as http2 from 'http2';
import type { SupabaseClient } from '@supabase/supabase-js';

// APNs endpoints
const APNS_HOST_PRODUCTION = 'api.push.apple.com';
const APNS_HOST_SANDBOX = 'api.sandbox.push.apple.com';

interface APNsConfig {
	teamId: string;
	keyId: string;
	privateKey: string;
	bundleId: string;
	isProduction: boolean;
}

interface APNsPayload {
	aps: {
		alert: {
			title: string;
			body: string;
			subtitle?: string;
		};
		badge?: number;
		sound?: string;
		'thread-id'?: string;
		'mutable-content'?: number;
		'content-available'?: number;
	};
	content_id?: string;
	group_id?: string;
	action?: string;
}

interface DeviceNotificationResult {
	device_token: string;
	success: boolean;
	apns_id?: string;
	error?: string;
	should_deactivate?: boolean;
}

// JWT token cache (APNs tokens are valid for up to 1 hour)
let cachedToken: { token: string; expires_at: number } | null = null;

/**
 * Generate APNs JWT token for authentication
 */
function generateAPNsToken(config: APNsConfig): string {
	const now = Math.floor(Date.now() / 1000);

	// Check cache (use cached token if still valid for at least 5 minutes)
	if (cachedToken && cachedToken.expires_at > now + 300) {
		return cachedToken.token;
	}

	const expiresAt = now + 3600; // 1 hour

	const token = jwt.sign(
		{
			iss: config.teamId,
			iat: now,
		},
		config.privateKey,
		{
			algorithm: 'ES256',
			keyid: config.keyId,
		}
	);

	cachedToken = { token, expires_at: expiresAt };
	return token;
}

/**
 * Send push notification to a single device via APNs HTTP/2
 */
async function sendToDevice(
	deviceToken: string,
	payload: APNsPayload,
	config: APNsConfig
): Promise<DeviceNotificationResult> {
	const host = config.isProduction ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;
	const path = `/3/device/${deviceToken}`;
	const authToken = generateAPNsToken(config);

	return new Promise((resolve) => {
		const client = http2.connect(`https://${host}`);

		client.on('error', (err) => {
			console.error('APNs connection error:', err);
			resolve({
				device_token: deviceToken,
				success: false,
				error: err.message,
			});
		});

		const req = client.request({
			':method': 'POST',
			':path': path,
			authorization: `bearer ${authToken}`,
			'apns-topic': config.bundleId,
			'apns-push-type': 'alert',
			'apns-priority': '10',
			'apns-expiration': '0',
			'content-type': 'application/json',
		});

		req.on('response', (headers) => {
			const status = headers[':status'] as number;
			let body = '';

			req.on('data', (chunk) => {
				body += chunk;
			});

			req.on('end', () => {
				client.close();

				if (status === 200) {
					resolve({
						device_token: deviceToken,
						success: true,
						apns_id: headers['apns-id'] as string,
					});
				} else {
					let errorReason = 'Unknown error';
					let shouldDeactivate = false;

					try {
						const errorBody = JSON.parse(body);
						errorReason = errorBody.reason || errorReason;

						// These errors mean the token is invalid and should be removed
						shouldDeactivate = ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(
							errorReason
						);
					} catch (e) {
						// Body might not be JSON
					}

					console.error(`APNs error for ${deviceToken}: ${status} - ${errorReason}`);

					resolve({
						device_token: deviceToken,
						success: false,
						error: `${status}: ${errorReason}`,
						should_deactivate: shouldDeactivate,
					});
				}
			});
		});

		req.write(JSON.stringify(payload));
		req.end();
	});
}

/**
 * Build APNs payload from content info
 */
function buildNotificationPayload(
	content: { id: string; type: string; data: string; group_id: string },
	authorName: string
): APNsPayload {
	// Truncate content for notification (max ~200 chars for body)
	const truncatedData = content.data.length > 150 ? content.data.substring(0, 147) + '...' : content.data;

	// Determine title based on content type
	let title = `${authorName} shared something`;

	switch (content.type) {
		case 'text':
			title = `${authorName} shared a link`;
			break;
		case 'chat':
			title = `${authorName} started a conversation`;
			break;
		case 'audio':
			title = `${authorName} shared audio`;
			break;
		case 'image':
			title = `${authorName} shared an image`;
			break;
		case 'markdown':
			title = `${authorName} shared a note`;
			break;
	}

	return {
		aps: {
			alert: {
				title,
				body: truncatedData,
			},
			sound: 'default',
			badge: 1,
			'thread-id': content.group_id,
			'mutable-content': 1,
		},
		content_id: content.id,
		group_id: content.group_id,
		action: 'view_content',
	};
}

// ============================================================================
// Exported Handlers
// ============================================================================

export interface SendNotificationPayload {
	content_id: string;
}

export interface SendNotificationResult {
	success: boolean;
	content_id: string;
	notifications_sent: number;
	notifications_failed: number;
	tokens_deactivated: number;
	error?: string;
}

/**
 * Send notifications for new content to group members
 */
export async function handleSendNotification(
	supabase: SupabaseClient,
	payload: SendNotificationPayload
): Promise<SendNotificationResult> {
	const { content_id } = payload;

	// Get APNs configuration from environment
	const teamId = process.env.APNS_TEAM_ID;
	const keyId = process.env.APNS_KEY_ID;
	const privateKeyBase64 = process.env.APNS_PRIVATE_KEY;
	const bundleId = process.env.APNS_BUNDLE_ID || 'com.breadchris.list';
	const isProduction = process.env.APNS_ENVIRONMENT === 'production';

	if (!teamId || !keyId || !privateKeyBase64) {
		console.warn('APNs not configured - skipping notification');
		return {
			success: true,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
			error: 'APNs not configured',
		};
	}

	const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

	const config: APNsConfig = {
		teamId,
		keyId,
		privateKey,
		bundleId,
		isProduction,
	};

	// 1. Fetch content details
	const { data: content, error: contentError } = await supabase
		.from('content')
		.select('id, type, data, group_id, user_id, metadata')
		.eq('id', content_id)
		.single();

	if (contentError || !content) {
		console.error(`Content not found: ${content_id}`);
		return {
			success: false,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
			error: `Content not found: ${content_id}`,
		};
	}

	// Skip device_token content type (don't notify about token registrations)
	if (content.type === 'device_token') {
		return {
			success: true,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
		};
	}

	// 2. Fetch content author info
	const { data: author } = await supabase.from('users').select('id, username').eq('id', content.user_id).single();

	const authorName = author?.username || 'Someone';

	// 3. Get all group members (except the author)
	const { data: members, error: membersError } = await supabase
		.from('group_memberships')
		.select('user_id')
		.eq('group_id', content.group_id)
		.neq('user_id', content.user_id);

	if (membersError || !members || members.length === 0) {
		return {
			success: true,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
		};
	}

	const memberIds = members.map((m) => m.user_id);

	// 4. Get device tokens for all members (stored as content items with type='device_token')
	const { data: deviceTokens, error: tokensError } = await supabase
		.from('content')
		.select('id, data, metadata, user_id')
		.eq('type', 'device_token')
		.in('user_id', memberIds);

	if (tokensError) {
		console.error(`Failed to fetch device tokens: ${tokensError.message}`);
		return {
			success: false,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
			error: `Failed to fetch device tokens: ${tokensError.message}`,
		};
	}

	if (!deviceTokens || deviceTokens.length === 0) {
		return {
			success: true,
			content_id,
			notifications_sent: 0,
			notifications_failed: 0,
			tokens_deactivated: 0,
		};
	}

	// 5. Build notification payload
	const notificationPayload = buildNotificationPayload(content, authorName);

	// 6. Send notifications to all devices
	const results = await Promise.all(
		deviceTokens.map((token) => {
			const platform = token.metadata?.platform || 'ios';
			return sendToDevice(token.data, notificationPayload, {
				...config,
				isProduction: platform === 'ios',
			});
		})
	);

	// 7. Process results - delete invalid tokens (content items)
	const tokensToDelete = results
		.filter((r) => r.should_deactivate)
		.map((r) => {
			const tokenContent = deviceTokens.find((t) => t.data === r.device_token);
			return tokenContent?.id;
		})
		.filter((id): id is string => !!id);

	if (tokensToDelete.length > 0) {
		await supabase.from('content').delete().in('id', tokensToDelete);
		console.log(`Deleted ${tokensToDelete.length} invalid device tokens`);
	}

	return {
		success: true,
		content_id,
		notifications_sent: results.filter((r) => r.success).length,
		notifications_failed: results.filter((r) => !r.success).length,
		tokens_deactivated: tokensToDelete.length,
	};
}

export interface RegisterDevicePayload {
	device_token: string;
	user_id: string;
	group_id: string;
	platform?: 'ios' | 'ios_sandbox';
}

/**
 * Register a device token (stored as content item)
 */
export async function handleRegisterDevice(
	supabase: SupabaseClient,
	payload: RegisterDevicePayload
): Promise<{ success: boolean; content_id?: string; error?: string }> {
	const { device_token, user_id, group_id, platform = 'ios' } = payload;

	// Validate device token format (64 hex characters for APNs)
	if (!/^[a-fA-F0-9]{64}$/.test(device_token)) {
		return { success: false, error: 'Invalid device token format' };
	}

	if (!user_id || !group_id) {
		return { success: false, error: 'Missing user_id or group_id' };
	}

	// Check if token already exists for this user
	const { data: existing } = await supabase
		.from('content')
		.select('id')
		.eq('type', 'device_token')
		.eq('user_id', user_id)
		.eq('data', device_token)
		.single();

	if (existing) {
		// Token already registered
		return { success: true, content_id: existing.id };
	}

	// Create new device token content item
	const { data: newToken, error } = await supabase
		.from('content')
		.insert({
			type: 'device_token',
			data: device_token,
			user_id,
			group_id,
			metadata: {
				platform,
				app_bundle_id: 'com.breadchris.list',
				registered_at: new Date().toISOString(),
			},
		})
		.select()
		.single();

	if (error) {
		console.error('Failed to register device token:', error);
		return { success: false, error: error.message };
	}

	console.log(`Registered device token for user ${user_id}`);
	return { success: true, content_id: newToken.id };
}

export interface UnregisterDevicePayload {
	device_token: string;
	user_id: string;
}

/**
 * Unregister a device token
 */
export async function handleUnregisterDevice(
	supabase: SupabaseClient,
	payload: UnregisterDevicePayload
): Promise<{ success: boolean; error?: string }> {
	const { device_token, user_id } = payload;

	if (!device_token || !user_id) {
		return { success: false, error: 'Missing device_token or user_id' };
	}

	const { error } = await supabase
		.from('content')
		.delete()
		.eq('type', 'device_token')
		.eq('user_id', user_id)
		.eq('data', device_token);

	if (error) {
		return { success: false, error: error.message };
	}

	console.log(`Unregistered device token for user ${user_id}`);
	return { success: true };
}
