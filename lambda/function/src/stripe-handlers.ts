import type { ContentResponse } from './types.js';
import {
  createConnectAccount,
  createAccountLink,
  retrieveAccount,
  createLoginLink,
  createTransfer,
  createPayout,
  getAccountBalance,
  verifyWebhookSignature,
} from './stripe-client.js';

/**
 * Handle Stripe Connect onboarding - creates account and returns onboarding URL
 */
export async function handleStripeConnectOnboard(
  supabase: any,
  payload: { user_id: string; return_url: string; refresh_url: string }
): Promise<ContentResponse> {
  const { user_id, return_url, refresh_url } = payload;

  // Check if user already has a connected account
  const { data: existing } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', user_id)
    .single();

  let stripeAccountId: string;

  if (existing) {
    stripeAccountId = existing.stripe_account_id;

    // If onboarding is already complete, return early
    if (existing.onboarding_complete) {
      return {
        success: true,
        data: {
          already_onboarded: true,
          account: existing,
        },
      };
    }
  } else {
    // Get user email from auth
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);

    // Create new Stripe Connect account
    const account = await createConnectAccount(userData?.user?.email);
    stripeAccountId = account.id;

    // Store in database
    await supabase.from('stripe_connected_accounts').insert({
      user_id,
      stripe_account_id: account.id,
      email: userData?.user?.email,
    });
  }

  // Create account link for onboarding
  const accountLink = await createAccountLink(stripeAccountId, return_url, refresh_url);

  return {
    success: true,
    data: {
      onboarding_url: accountLink.url,
      stripe_account_id: stripeAccountId,
    },
  };
}

/**
 * Handle checking account status after onboarding
 */
export async function handleStripeConnectStatus(
  supabase: any,
  payload: { user_id: string }
): Promise<ContentResponse> {
  const { user_id } = payload;

  // Get account from database
  const { data: account, error } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error || !account) {
    return {
      success: true,
      data: null,
    };
  }

  // Fetch latest status from Stripe
  const stripeAccount = await retrieveAccount(account.stripe_account_id);

  // Update database with latest status
  const updates = {
    onboarding_complete: stripeAccount.details_submitted && stripeAccount.charges_enabled,
    charges_enabled: stripeAccount.charges_enabled,
    payouts_enabled: stripeAccount.payouts_enabled,
    details_submitted: stripeAccount.details_submitted,
    business_type: stripeAccount.business_type,
    capabilities: stripeAccount.capabilities,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('stripe_connected_accounts')
    .update(updates)
    .eq('id', account.id);

  // Get balance
  let balance = 0;
  let pendingBalance = 0;
  if (stripeAccount.charges_enabled) {
    try {
      const balanceData = await getAccountBalance(account.stripe_account_id);
      balance = balanceData?.available?.[0]?.amount || 0;
      pendingBalance = balanceData?.pending?.[0]?.amount || 0;
    } catch (e) {
      console.warn('Could not fetch balance:', e);
    }
  }

  return {
    success: true,
    data: {
      ...account,
      ...updates,
      balance,
      pending_balance: pendingBalance,
    },
  };
}

/**
 * Handle creating Express Dashboard login link
 */
export async function handleStripeConnectDashboard(
  supabase: any,
  payload: { user_id: string }
): Promise<ContentResponse> {
  const { user_id } = payload;

  const { data: account } = await supabase
    .from('stripe_connected_accounts')
    .select('stripe_account_id')
    .eq('user_id', user_id)
    .single();

  if (!account) {
    return { success: false, error: 'No connected account found' };
  }

  const loginLink = await createLoginLink(account.stripe_account_id);

  return {
    success: true,
    data: { dashboard_url: loginLink.url },
  };
}

/**
 * Handle creating a P2P transfer
 */
export async function handleStripeCreateTransfer(
  supabase: any,
  payload: {
    sender_user_id: string;
    recipient_user_id: string;
    amount_cents: number;
    currency?: string;
    description?: string;
    idempotency_key: string;
  }
): Promise<ContentResponse> {
  const {
    sender_user_id,
    recipient_user_id,
    amount_cents,
    currency = 'usd',
    description,
    idempotency_key,
  } = payload;

  // Get sender's connected account
  const { data: senderAccount } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', sender_user_id)
    .single();

  if (!senderAccount || !senderAccount.charges_enabled) {
    return {
      success: false,
      error: 'Sender account not found or not fully onboarded',
    };
  }

  // Get recipient's connected account
  const { data: recipientAccount } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', recipient_user_id)
    .single();

  if (!recipientAccount || !recipientAccount.payouts_enabled) {
    return {
      success: false,
      error: 'Recipient account not found or cannot receive payouts',
    };
  }

  // Create transfer record first (pending)
  const { data: transfer, error: insertError } = await supabase
    .from('transfers')
    .insert({
      sender_user_id,
      recipient_user_id,
      sender_stripe_account_id: senderAccount.stripe_account_id,
      recipient_stripe_account_id: recipientAccount.stripe_account_id,
      amount_cents,
      currency,
      description,
      status: 'pending',
      idempotency_key,
    })
    .select()
    .single();

  if (insertError) {
    // Check for idempotency key collision
    if (insertError.code === '23505') {
      const { data: existingTransfer } = await supabase
        .from('transfers')
        .select('*')
        .eq('idempotency_key', idempotency_key)
        .single();

      return {
        success: true,
        data: { transfer: existingTransfer, duplicate: true },
      };
    }
    return { success: false, error: insertError.message };
  }

  try {
    // Execute the Stripe transfer
    const stripeTransfer = await createTransfer({
      recipientAccountId: recipientAccount.stripe_account_id,
      amountCents: amount_cents,
      currency,
      description,
      idempotencyKey: idempotency_key,
    });

    // Update transfer with Stripe IDs and completed status
    await supabase
      .from('transfers')
      .update({
        status: 'completed',
        stripe_transfer_id: stripeTransfer.id,
      })
      .eq('id', transfer.id);

    return {
      success: true,
      data: {
        transfer: { ...transfer, status: 'completed', stripe_transfer_id: stripeTransfer.id },
      },
    };
  } catch (error: any) {
    // Update transfer with error
    await supabase
      .from('transfers')
      .update({
        status: 'failed',
        error_code: error.code || 'unknown',
        error_message: error.message,
      })
      .eq('id', transfer.id);

    return {
      success: false,
      error: error.message,
      data: { transfer_id: transfer.id },
    };
  }
}

/**
 * Handle listing transfers for a user
 */
export async function handleStripeListTransfers(
  supabase: any,
  payload: { user_id: string; limit?: number; offset?: number; status?: string }
): Promise<ContentResponse> {
  const { user_id, limit = 20, offset = 0, status } = payload;

  let query = supabase
    .from('transfers')
    .select('*')
    .or(`sender_user_id.eq.${user_id},recipient_user_id.eq.${user_id}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: { transfers: data },
  };
}

/**
 * Handle initiating a payout to bank
 */
export async function handleStripeInitiatePayout(
  supabase: any,
  payload: { user_id: string; amount_cents: number; currency?: string }
): Promise<ContentResponse> {
  const { user_id, amount_cents, currency = 'usd' } = payload;

  // Get user's connected account
  const { data: account } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (!account || !account.payouts_enabled) {
    return {
      success: false,
      error: 'Account not found or payouts not enabled',
    };
  }

  // Check available balance
  const balance = await getAccountBalance(account.stripe_account_id);
  const availableAmount = balance.available?.[0]?.amount || 0;

  if (availableAmount < amount_cents) {
    return {
      success: false,
      error: `Insufficient balance. Available: ${availableAmount}, Requested: ${amount_cents}`,
    };
  }

  // Create payout record
  const { data: payoutRecord, error: insertError } = await supabase
    .from('payouts')
    .insert({
      user_id,
      stripe_account_id: account.stripe_account_id,
      amount_cents,
      currency,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  try {
    // Create Stripe payout
    const stripePayout = await createPayout(account.stripe_account_id, amount_cents, currency);

    // Update record with Stripe details
    await supabase
      .from('payouts')
      .update({
        status: stripePayout.status === 'paid' ? 'paid' : 'in_transit',
        stripe_payout_id: stripePayout.id,
        arrival_date: stripePayout.arrival_date
          ? new Date(stripePayout.arrival_date * 1000).toISOString()
          : null,
      })
      .eq('id', payoutRecord.id);

    return {
      success: true,
      data: {
        payout: {
          ...payoutRecord,
          stripe_payout_id: stripePayout.id,
          status: stripePayout.status,
        },
      },
    };
  } catch (error: any) {
    await supabase
      .from('payouts')
      .update({
        status: 'failed',
        error_code: error.code || 'unknown',
        error_message: error.message,
      })
      .eq('id', payoutRecord.id);

    return { success: false, error: error.message };
  }
}

/**
 * Handle listing payouts for a user
 */
export async function handleStripeListPayouts(
  supabase: any,
  payload: { user_id: string; limit?: number; offset?: number }
): Promise<ContentResponse> {
  const { user_id, limit = 20, offset = 0 } = payload;

  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: { payouts: data },
  };
}

/**
 * Search for users who can receive transfers
 */
export async function handleStripeSearchUsers(
  supabase: any,
  payload: { query: string; exclude_user_id: string; limit?: number }
): Promise<ContentResponse> {
  const { query, exclude_user_id, limit = 10 } = payload;

  // Search users with connected accounts who can receive payments
  const { data, error } = await supabase
    .from('stripe_connected_accounts')
    .select(`
      user_id,
      onboarding_complete,
      payouts_enabled
    `)
    .eq('payouts_enabled', true)
    .neq('user_id', exclude_user_id)
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  // Get usernames for the found accounts
  const userIds = data.map((d: any) => d.user_id);

  if (userIds.length === 0) {
    return { success: true, data: { users: [] } };
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .in('id', userIds);

  // Filter by username if query provided
  const filtered = query
    ? users?.filter((u: any) => u.username?.toLowerCase().includes(query.toLowerCase()))
    : users;

  return {
    success: true,
    data: {
      users: filtered || [],
    },
  };
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  supabase: any,
  payload: { body: string; signature: string }
): Promise<ContentResponse> {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    return { success: false, error: 'Webhook secret not configured' };
  }

  try {
    const event = verifyWebhookSignature(payload.body, payload.signature, endpointSecret);

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as any;
        await supabase
          .from('stripe_connected_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            onboarding_complete: account.details_submitted && account.charges_enabled,
            capabilities: account.capabilities,
          })
          .eq('stripe_account_id', account.id);
        break;
      }

      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object as any;
        await supabase
          .from('payouts')
          .update({
            status: event.type === 'payout.paid' ? 'paid' : 'failed',
            error_message: payout.failure_message || null,
          })
          .eq('stripe_payout_id', payout.id);
        break;
      }

      case 'transfer.created':
      case 'transfer.failed': {
        const transfer = event.data.object as any;
        await supabase
          .from('transfers')
          .update({
            status: event.type === 'transfer.created' ? 'completed' : 'failed',
          })
          .eq('stripe_transfer_id', transfer.id);
        break;
      }
    }

    return { success: true, data: { event_type: event.type } };
  } catch (error: any) {
    return { success: false, error: `Webhook error: ${error.message}` };
  }
}
