/**
 * Persistent Auth Token Handlers
 *
 * Provides shareable authentication links for group access.
 * - Admins generate tokens with display names for users
 * - Users redeem tokens to get authenticated sessions
 * - Admins can instantly revoke access
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

// Types
export interface GenerateTokenPayload {
	group_id: string;
	display_name: string;
	user_id: string; // Admin who is generating the token
}

export interface RedeemTokenPayload {
	token: string;
	device_fingerprint: string;
}

export interface RevokeTokenPayload {
	token_id: string;
	user_id: string; // Admin who is revoking
}

export interface ValidateSessionPayload {
	user_id: string;
	device_fingerprint: string;
}

export interface ListTokensPayload {
	group_id: string;
	user_id: string; // Admin requesting the list
}

export interface GenerateTokenResult {
	success: boolean;
	link?: string;
	token_id?: string;
	display_name?: string;
	error?: string;
}

export interface RedeemTokenResult {
	success: boolean;
	access_token?: string;
	refresh_token?: string;
	user?: {
		id: string;
		display_name: string;
	};
	group_id?: string;
	error?: string;
}

export interface RevokeTokenResult {
	success: boolean;
	error?: string;
}

export interface ValidateSessionResult {
	valid: boolean;
	error?: string;
}

export interface TokenInfo {
	id: string;
	display_name: string;
	created_at: string;
	redeemed_at: string | null;
	last_used_at: string | null;
	is_revoked: boolean;
	user_id: string | null;
}

export interface ListTokensResult {
	success: boolean;
	tokens?: TokenInfo[];
	error?: string;
}

/**
 * Generate a cryptographically secure token
 */
function generateSecureToken(): string {
	return randomBytes(32).toString('hex'); // 256-bit token
}

/**
 * Hash a token using SHA-256
 */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Get the base URL for token redemption links
 */
function getBaseUrl(): string {
	return process.env.APP_BASE_URL || 'https://share.littlemanstack.com';
}

/**
 * Generate a new persistent auth token
 */
export async function handleGenerateToken(
	supabase: SupabaseClient,
	payload: GenerateTokenPayload
): Promise<GenerateTokenResult> {
	const { group_id, display_name, user_id } = payload;

	if (!group_id || !display_name || !user_id) {
		return {
			success: false,
			error: 'Missing required parameters: group_id, display_name, user_id'
		};
	}

	try {
		// Verify the admin is a member of the group
		const { data: membership, error: membershipError } = await supabase
			.from('group_memberships')
			.select('id')
			.eq('group_id', group_id)
			.eq('user_id', user_id)
			.single();

		if (membershipError || !membership) {
			return {
				success: false,
				error: 'You must be a member of the group to generate access links'
			};
		}

		// Generate token
		const rawToken = generateSecureToken();
		const tokenHash = hashToken(rawToken);

		// Insert token record
		const { data: tokenRecord, error: insertError } = await supabase
			.from('persistent_auth_tokens')
			.insert({
				token_hash: tokenHash,
				display_name,
				group_id,
				granted_by: user_id
			})
			.select('id')
			.single();

		if (insertError) {
			console.error('Error creating token:', insertError);
			return {
				success: false,
				error: 'Failed to generate access link'
			};
		}

		// Build the shareable link
		const baseUrl = getBaseUrl();
		const link = `${baseUrl}/auth/token?t=${rawToken}`;

		return {
			success: true,
			link,
			token_id: tokenRecord.id,
			display_name
		};
	} catch (error) {
		console.error('Error in handleGenerateToken:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Redeem a token to create a session
 */
export async function handleRedeemToken(
	supabase: SupabaseClient,
	payload: RedeemTokenPayload
): Promise<RedeemTokenResult> {
	const { token, device_fingerprint } = payload;

	if (!token || !device_fingerprint) {
		return {
			success: false,
			error: 'Missing required parameters: token, device_fingerprint'
		};
	}

	try {
		const tokenHash = hashToken(token);

		// Look up the token
		const { data: tokenRecord, error: lookupError } = await supabase
			.from('persistent_auth_tokens')
			.select('*')
			.eq('token_hash', tokenHash)
			.single();

		if (lookupError || !tokenRecord) {
			return {
				success: false,
				error: 'Invalid or expired link'
			};
		}

		// Check if revoked
		if (tokenRecord.is_revoked) {
			return {
				success: false,
				error: 'This access link has been revoked'
			};
		}

		// Check if already redeemed
		if (tokenRecord.redeemed_at) {
			return {
				success: false,
				error: 'This link has already been used'
			};
		}

		// Create a new Supabase user with the display name
		// Using admin API to create user without email
		const { data: authData, error: authError } = await supabase.auth.admin.createUser({
			email: `token-${tokenRecord.id}@persistent-auth.internal`,
			email_confirm: true,
			user_metadata: {
				display_name: tokenRecord.display_name,
				auth_type: 'persistent_token',
				token_id: tokenRecord.id
			}
		});

		if (authError || !authData.user) {
			console.error('Error creating user:', authError);
			return {
				success: false,
				error: 'Failed to create user session'
			};
		}

		const userId = authData.user.id;

		// Update the token record with user_id and device fingerprint
		const { error: updateError } = await supabase
			.from('persistent_auth_tokens')
			.update({
				user_id: userId,
				device_fingerprint,
				redeemed_at: new Date().toISOString(),
				last_used_at: new Date().toISOString()
			})
			.eq('id', tokenRecord.id);

		if (updateError) {
			console.error('Error updating token record:', updateError);
			// Continue anyway - user was created
		}

		// Add user to the group
		const { error: groupError } = await supabase
			.from('group_memberships')
			.insert({
				user_id: userId,
				group_id: tokenRecord.group_id,
				role: 'member'
			});

		if (groupError) {
			console.error('Error adding user to group:', groupError);
			// Continue anyway - they can be added later
		}

		// Also add entry to users table with display name
		const { error: userError } = await supabase
			.from('users')
			.insert({
				id: userId,
				username: tokenRecord.display_name
			});

		if (userError) {
			console.error('Error creating user profile:', userError);
			// Continue anyway
		}

		// Generate session tokens for the user
		// Using admin API to generate a magic link token that can be immediately redeemed
		const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
			type: 'magiclink',
			email: `token-${tokenRecord.id}@persistent-auth.internal`
		});

		if (sessionError) {
			console.error('Error generating session:', sessionError);
			// Fall back to returning user info without session
			return {
				success: true,
				user: {
					id: userId,
					display_name: tokenRecord.display_name
				},
				group_id: tokenRecord.group_id,
				error: 'Session creation pending - user created successfully'
			};
		}

		// Extract token hash from the magic link to create session
		const linkUrl = new URL(sessionData.properties.hashed_token ?
			`${getBaseUrl()}/auth/confirm?token_hash=${sessionData.properties.hashed_token}&type=magiclink` :
			sessionData.properties.action_link);

		// Verify the OTP to get actual session tokens
		const tokenHashFromLink = linkUrl.searchParams.get('token_hash') || sessionData.properties.hashed_token;

		if (tokenHashFromLink) {
			const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
				token_hash: tokenHashFromLink,
				type: 'magiclink'
			});

			if (!verifyError && verifyData.session) {
				return {
					success: true,
					access_token: verifyData.session.access_token,
					refresh_token: verifyData.session.refresh_token,
					user: {
						id: userId,
						display_name: tokenRecord.display_name
					},
					group_id: tokenRecord.group_id
				};
			}
		}

		// Return success even if we couldn't get session tokens
		// Client can use the user info to set up their own session
		return {
			success: true,
			user: {
				id: userId,
				display_name: tokenRecord.display_name
			},
			group_id: tokenRecord.group_id
		};

	} catch (error) {
		console.error('Error in handleRedeemToken:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Revoke a token (instant access removal)
 */
export async function handleRevokeToken(
	supabase: SupabaseClient,
	payload: RevokeTokenPayload
): Promise<RevokeTokenResult> {
	const { token_id, user_id } = payload;

	if (!token_id || !user_id) {
		return {
			success: false,
			error: 'Missing required parameters: token_id, user_id'
		};
	}

	try {
		// Get the token to verify the revoker has permission
		const { data: tokenRecord, error: lookupError } = await supabase
			.from('persistent_auth_tokens')
			.select('group_id, is_revoked')
			.eq('id', token_id)
			.single();

		if (lookupError || !tokenRecord) {
			return {
				success: false,
				error: 'Token not found'
			};
		}

		if (tokenRecord.is_revoked) {
			return {
				success: true // Already revoked, treat as success
			};
		}

		// Verify the user is a member of the group
		const { data: membership, error: membershipError } = await supabase
			.from('group_memberships')
			.select('id')
			.eq('group_id', tokenRecord.group_id)
			.eq('user_id', user_id)
			.single();

		if (membershipError || !membership) {
			return {
				success: false,
				error: 'You must be a member of the group to revoke access links'
			};
		}

		// Revoke the token
		const { error: updateError } = await supabase
			.from('persistent_auth_tokens')
			.update({
				is_revoked: true,
				revoked_at: new Date().toISOString(),
				revoked_by: user_id
			})
			.eq('id', token_id);

		if (updateError) {
			console.error('Error revoking token:', updateError);
			return {
				success: false,
				error: 'Failed to revoke access link'
			};
		}

		return {
			success: true
		};

	} catch (error) {
		console.error('Error in handleRevokeToken:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Validate that a user's session is still valid (not revoked)
 */
export async function handleValidateSession(
	supabase: SupabaseClient,
	payload: ValidateSessionPayload
): Promise<ValidateSessionResult> {
	const { user_id, device_fingerprint } = payload;

	if (!user_id || !device_fingerprint) {
		return {
			valid: false,
			error: 'Missing required parameters'
		};
	}

	try {
		// Look up the token for this user
		const { data: tokenRecord, error: lookupError } = await supabase
			.from('persistent_auth_tokens')
			.select('is_revoked, device_fingerprint')
			.eq('user_id', user_id)
			.single();

		if (lookupError || !tokenRecord) {
			// User might not be a token-based user, treat as valid
			return {
				valid: true
			};
		}

		// Check if revoked
		if (tokenRecord.is_revoked) {
			return {
				valid: false,
				error: 'Access has been revoked'
			};
		}

		// Check device fingerprint
		if (tokenRecord.device_fingerprint && tokenRecord.device_fingerprint !== device_fingerprint) {
			return {
				valid: false,
				error: 'Device mismatch'
			};
		}

		// Update last_used_at
		await supabase
			.from('persistent_auth_tokens')
			.update({ last_used_at: new Date().toISOString() })
			.eq('user_id', user_id);

		return {
			valid: true
		};

	} catch (error) {
		console.error('Error in handleValidateSession:', error);
		return {
			valid: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * List all tokens for a group
 */
export async function handleListTokens(
	supabase: SupabaseClient,
	payload: ListTokensPayload
): Promise<ListTokensResult> {
	const { group_id, user_id } = payload;

	if (!group_id || !user_id) {
		return {
			success: false,
			error: 'Missing required parameters: group_id, user_id'
		};
	}

	try {
		// Verify the user is a member of the group
		const { data: membership, error: membershipError } = await supabase
			.from('group_memberships')
			.select('id')
			.eq('group_id', group_id)
			.eq('user_id', user_id)
			.single();

		if (membershipError || !membership) {
			return {
				success: false,
				error: 'You must be a member of the group to view access links'
			};
		}

		// Get all tokens for the group
		const { data: tokens, error: tokensError } = await supabase
			.from('persistent_auth_tokens')
			.select('id, display_name, created_at, redeemed_at, last_used_at, is_revoked, user_id')
			.eq('group_id', group_id)
			.order('created_at', { ascending: false });

		if (tokensError) {
			console.error('Error fetching tokens:', tokensError);
			return {
				success: false,
				error: 'Failed to fetch access links'
			};
		}

		return {
			success: true,
			tokens: tokens || []
		};

	} catch (error) {
		console.error('Error in handleListTokens:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
