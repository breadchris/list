import Stripe from 'stripe';

// Initialize Stripe with secret key
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });
}

/**
 * Create a Stripe Connect Express account for a user
 */
export async function createConnectAccount(email?: string): Promise<Stripe.Account> {
  const stripe = getStripeClient();

  return stripe.accounts.create({
    type: 'express',
    country: 'US',
    capabilities: {
      transfers: { requested: true },
    },
    ...(email && { email }),
  });
}

/**
 * Create an Account Link for onboarding
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<Stripe.AccountLink> {
  const stripe = getStripeClient();

  return stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });
}

/**
 * Retrieve account details to check onboarding status
 */
export async function retrieveAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripeClient();
  return stripe.accounts.retrieve(accountId);
}

/**
 * Create a login link for the Express Dashboard
 */
export async function createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
  const stripe = getStripeClient();
  return stripe.accounts.createLoginLink(accountId);
}

/**
 * Create a transfer to a connected account
 */
export async function createTransfer(params: {
  recipientAccountId: string;
  amountCents: number;
  currency: string;
  description?: string;
  idempotencyKey: string;
}): Promise<Stripe.Transfer> {
  const stripe = getStripeClient();

  return stripe.transfers.create(
    {
      amount: params.amountCents,
      currency: params.currency,
      destination: params.recipientAccountId,
      description: params.description,
    },
    {
      idempotencyKey: `tr_${params.idempotencyKey}`,
    }
  );
}

/**
 * Create a payout to connected account's bank
 */
export async function createPayout(
  accountId: string,
  amountCents: number,
  currency: string = 'usd'
): Promise<Stripe.Payout> {
  const stripe = getStripeClient();

  return stripe.payouts.create(
    {
      amount: amountCents,
      currency,
    },
    {
      stripeAccount: accountId,
    }
  );
}

/**
 * Retrieve connected account balance
 */
export async function getAccountBalance(accountId: string): Promise<Stripe.Balance> {
  const stripe = getStripeClient();
  return stripe.balance.retrieve({
    stripeAccount: accountId,
  });
}

/**
 * List payouts for a connected account
 */
export async function listPayouts(
  accountId: string,
  limit: number = 10
): Promise<Stripe.ApiList<Stripe.Payout>> {
  const stripe = getStripeClient();
  return stripe.payouts.list({ limit }, { stripeAccount: accountId });
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  endpointSecret: string
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
}
