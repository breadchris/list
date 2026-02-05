-- Migration: Persistent Auth Tokens System
-- Allows admins to generate shareable authentication links for group access
-- Features: Single-use per device, instant revocation, admin-assigned display names

-- Create persistent_auth_tokens table
CREATE TABLE "public"."persistent_auth_tokens" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Token identification (raw token never stored, only hash)
  "token_hash" text NOT NULL,

  -- User info set by admin at generation time
  "display_name" text NOT NULL,

  -- User association (nullable until redeemed)
  "user_id" uuid,
  "group_id" uuid NOT NULL,

  -- Admin tracking
  "granted_by" uuid NOT NULL,

  -- Device binding (set on first use)
  "device_fingerprint" text,

  -- Lifecycle
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "redeemed_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,

  -- Revocation
  "is_revoked" boolean NOT NULL DEFAULT false,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid
);

-- Create indexes
CREATE UNIQUE INDEX persistent_auth_tokens_pkey ON public.persistent_auth_tokens USING btree (id);
CREATE UNIQUE INDEX persistent_auth_tokens_token_hash_key ON public.persistent_auth_tokens USING btree (token_hash);
CREATE INDEX idx_persistent_tokens_user_id ON public.persistent_auth_tokens USING btree (user_id);
CREATE INDEX idx_persistent_tokens_group_id ON public.persistent_auth_tokens USING btree (group_id);
CREATE INDEX idx_persistent_tokens_granted_by ON public.persistent_auth_tokens USING btree (granted_by);
CREATE INDEX idx_persistent_tokens_not_revoked ON public.persistent_auth_tokens USING btree (is_revoked) WHERE is_revoked = false;

-- Add primary key constraint
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_pkey" PRIMARY KEY USING INDEX "persistent_auth_tokens_pkey";

-- Add unique constraint for token hash
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_token_hash_key" UNIQUE USING INDEX "persistent_auth_tokens_token_hash_key";

-- Add foreign key constraints
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_group_id_fkey"
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_granted_by_fkey"
  FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."persistent_auth_tokens" ADD CONSTRAINT "persistent_auth_tokens_revoked_by_fkey"
  FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE "public"."persistent_auth_tokens" ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."persistent_auth_tokens" TO "anon", "authenticated";

-- RLS Policies

-- Group members can view tokens for their groups
CREATE POLICY "Group members can view tokens"
ON "public"."persistent_auth_tokens"
AS PERMISSIVE
FOR SELECT
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = persistent_auth_tokens.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

-- Only the admin who granted the token (or group members) can manage tokens
CREATE POLICY "Admins can create tokens for their groups"
ON "public"."persistent_auth_tokens"
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (
  granted_by::text = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = persistent_auth_tokens.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

-- Group members can update tokens (for revocation)
CREATE POLICY "Group members can update tokens"
ON "public"."persistent_auth_tokens"
AS PERMISSIVE
FOR UPDATE
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = persistent_auth_tokens.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

-- Group members can delete tokens
CREATE POLICY "Group members can delete tokens"
ON "public"."persistent_auth_tokens"
AS PERMISSIVE
FOR DELETE
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = persistent_auth_tokens.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

-- Function to check if a token is valid (not revoked, device matches if redeemed)
CREATE OR REPLACE FUNCTION check_persistent_token_valid(
  p_user_id uuid,
  p_device_fingerprint text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  SELECT * INTO token_record
  FROM persistent_auth_tokens
  WHERE user_id = p_user_id
    AND is_revoked = false
    AND redeemed_at IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check device fingerprint matches
  IF token_record.device_fingerprint IS NOT NULL
     AND token_record.device_fingerprint != p_device_fingerprint THEN
    RETURN false;
  END IF;

  -- Update last_used_at
  UPDATE persistent_auth_tokens
  SET last_used_at = now()
  WHERE id = token_record.id;

  RETURN true;
END;
$$;

-- Function to redeem a token (called during token redemption flow)
-- Returns the token record if successful, NULL if invalid
CREATE OR REPLACE FUNCTION redeem_persistent_token(
  p_token_hash text,
  p_device_fingerprint text,
  p_user_id uuid
)
RETURNS TABLE (
  success boolean,
  token_id uuid,
  group_id uuid,
  display_name text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Find the token by hash
  SELECT * INTO token_record
  FROM persistent_auth_tokens pat
  WHERE pat.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Invalid token';
    RETURN;
  END IF;

  -- Check if revoked
  IF token_record.is_revoked THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Token has been revoked';
    RETURN;
  END IF;

  -- Check if already redeemed
  IF token_record.redeemed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Token has already been used';
    RETURN;
  END IF;

  -- Redeem the token
  UPDATE persistent_auth_tokens
  SET
    user_id = p_user_id,
    device_fingerprint = p_device_fingerprint,
    redeemed_at = now(),
    last_used_at = now()
  WHERE id = token_record.id;

  RETURN QUERY SELECT
    true,
    token_record.id,
    token_record.group_id,
    token_record.display_name,
    NULL::text;
END;
$$;

-- Function to revoke a token
CREATE OR REPLACE FUNCTION revoke_persistent_token(
  p_token_id uuid,
  p_revoked_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE persistent_auth_tokens
  SET
    is_revoked = true,
    revoked_at = now(),
    revoked_by = p_revoked_by
  WHERE id = p_token_id
    AND is_revoked = false;

  RETURN FOUND;
END;
$$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION check_persistent_token_valid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_persistent_token(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION revoke_persistent_token(uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE persistent_auth_tokens IS 'Shareable authentication tokens for group access. Admin generates a token with a display name, user redeems it to get authenticated access to the group.';
COMMENT ON COLUMN persistent_auth_tokens.token_hash IS 'SHA-256 hash of the raw token. Raw token is never stored.';
COMMENT ON COLUMN persistent_auth_tokens.display_name IS 'Name assigned by admin (e.g., "Mom", "Dad"). Becomes the user display_name.';
COMMENT ON COLUMN persistent_auth_tokens.device_fingerprint IS 'Browser/device fingerprint. Set on first redemption, verified on subsequent requests.';
COMMENT ON COLUMN persistent_auth_tokens.is_revoked IS 'When true, token is invalidated and user loses access immediately.';
