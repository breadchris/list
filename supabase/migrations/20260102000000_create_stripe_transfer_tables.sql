-- Stripe P2P Transfer Tables
-- Creates tables for Stripe Connect accounts, transfers, and payouts

-- Table 1: stripe_connected_accounts
-- Links users to their Stripe Connect Express accounts
CREATE TABLE stripe_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- User reference
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Stripe account details
  stripe_account_id TEXT NOT NULL UNIQUE,

  -- Onboarding status
  onboarding_complete BOOLEAN DEFAULT FALSE,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,

  -- Account metadata from Stripe
  business_type TEXT,
  country TEXT DEFAULT 'US',
  default_currency TEXT DEFAULT 'usd',
  email TEXT,

  -- Capabilities status
  capabilities JSONB DEFAULT '{}'::jsonb
);

-- Table 2: transfers
-- Records P2P transfer transactions
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- User references
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,

  -- Stripe references
  sender_stripe_account_id TEXT NOT NULL,
  recipient_stripe_account_id TEXT NOT NULL,

  -- Transfer details
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT DEFAULT 'usd',
  description TEXT,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Stripe transfer/payment objects
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Idempotency
  idempotency_key TEXT UNIQUE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table 3: payouts (user-initiated withdrawals to bank)
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- User reference
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  stripe_account_id TEXT NOT NULL,

  -- Payout details
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT DEFAULT 'usd',

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'cancelled')),

  -- Stripe payout reference
  stripe_payout_id TEXT,

  -- Bank account info (masked)
  bank_account_last4 TEXT,
  bank_name TEXT,

  -- Timing
  arrival_date TIMESTAMPTZ,

  -- Errors
  error_code TEXT,
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_stripe_connected_accounts_user ON stripe_connected_accounts(user_id);
CREATE INDEX idx_stripe_connected_accounts_stripe_id ON stripe_connected_accounts(stripe_account_id);
CREATE INDEX idx_transfers_sender ON transfers(sender_user_id);
CREATE INDEX idx_transfers_recipient ON transfers(recipient_user_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created ON transfers(created_at DESC);
CREATE INDEX idx_payouts_user ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Trigger function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_stripe_connected_accounts_updated_at
  BEFORE UPDATE ON stripe_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE stripe_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own connected account
CREATE POLICY "Users can view own connected account"
  ON stripe_connected_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view transfers where they are sender or recipient
CREATE POLICY "Users can view their transfers"
  ON transfers FOR SELECT
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

-- Users can view their own payouts
CREATE POLICY "Users can view own payouts"
  ON payouts FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access (for Lambda)
CREATE POLICY "Service role full access on stripe_connected_accounts"
  ON stripe_connected_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on transfers"
  ON transfers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on payouts"
  ON payouts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE payouts;
