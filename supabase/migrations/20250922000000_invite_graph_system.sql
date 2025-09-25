-- Migration: Invite Graph System
-- Replace global group join codes with user-specific invite codes and track invitation relationships

-- Create user_invite_codes table
CREATE TABLE "public"."user_invite_codes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "invite_code" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone,
  "max_uses" integer DEFAULT 50,
  "current_uses" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);

-- Create group_invitations table to track invitation relationships
CREATE TABLE "public"."group_invitations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL,
  "inviter_user_id" uuid NOT NULL,
  "invitee_user_id" uuid NOT NULL,
  "invite_code_used" text NOT NULL,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for user_invite_codes
CREATE UNIQUE INDEX user_invite_codes_pkey ON public.user_invite_codes USING btree (id);
CREATE UNIQUE INDEX user_invite_codes_invite_code_key ON public.user_invite_codes USING btree (invite_code);
CREATE INDEX idx_user_invite_codes_user_group ON public.user_invite_codes USING btree (user_id, group_id);
CREATE INDEX idx_user_invite_codes_group_id ON public.user_invite_codes USING btree (group_id);
CREATE INDEX idx_user_invite_codes_invite_code ON public.user_invite_codes USING btree (invite_code);

-- Create indexes for group_invitations
CREATE UNIQUE INDEX group_invitations_pkey ON public.group_invitations USING btree (id);
CREATE INDEX idx_group_invitations_group_id ON public.group_invitations USING btree (group_id);
CREATE INDEX idx_group_invitations_inviter ON public.group_invitations USING btree (inviter_user_id);
CREATE INDEX idx_group_invitations_invitee ON public.group_invitations USING btree (invitee_user_id);
CREATE INDEX idx_group_invitations_code ON public.group_invitations USING btree (invite_code_used);

-- Add primary key constraints
ALTER TABLE "public"."user_invite_codes" ADD CONSTRAINT "user_invite_codes_pkey" PRIMARY KEY USING INDEX "user_invite_codes_pkey";
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_pkey" PRIMARY KEY USING INDEX "group_invitations_pkey";

-- Add unique constraint for invite codes
ALTER TABLE "public"."user_invite_codes" ADD CONSTRAINT "user_invite_codes_invite_code_key" UNIQUE USING INDEX "user_invite_codes_invite_code_key";

-- Add foreign key constraints
ALTER TABLE "public"."user_invite_codes" ADD CONSTRAINT "user_invite_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "public"."user_invite_codes" ADD CONSTRAINT "user_invite_codes_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_inviter_user_id_fkey" FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "public"."group_invitations" ADD CONSTRAINT "group_invitations_invitee_user_id_fkey" FOREIGN KEY (invitee_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE "public"."user_invite_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."group_invitations" ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."user_invite_codes" TO "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."group_invitations" TO "anon", "authenticated";

-- RLS policies for user_invite_codes
CREATE POLICY "Users can view invite codes for their groups"
ON "public"."user_invite_codes"
AS PERMISSIVE
FOR SELECT
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = user_invite_codes.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can create invite codes for their groups"
ON "public"."user_invite_codes"
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (
  user_id::text = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = user_invite_codes.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can update their own invite codes"
ON "public"."user_invite_codes"
AS PERMISSIVE
FOR UPDATE
TO PUBLIC
USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete their own invite codes"
ON "public"."user_invite_codes"
AS PERMISSIVE
FOR DELETE
TO PUBLIC
USING (user_id::text = auth.uid()::text);

-- RLS policies for group_invitations
CREATE POLICY "Group members can view invitation graph"
ON "public"."group_invitations"
AS PERMISSIVE
FOR SELECT
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = group_invitations.group_id
    AND gm.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "System can insert invitation records"
ON "public"."group_invitations"
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (true); -- Controlled by functions

-- Migrate existing group creators to have the first invite code
-- For each group, create an invite code for the creator
DO $$
DECLARE
    group_record RECORD;
    new_invite_code TEXT;
BEGIN
    FOR group_record IN
        SELECT id, created_by, join_code
        FROM groups
        WHERE created_by IS NOT NULL
    LOOP
        -- Generate new invite code by prefixing the old one with user identifier
        new_invite_code := UPPER(SUBSTRING(group_record.created_by::text, 1, 3)) || SUBSTRING(group_record.join_code, 1, 3);

        -- Ensure it's exactly 6 characters
        IF LENGTH(new_invite_code) < 6 THEN
            new_invite_code := new_invite_code || SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1, 6 - LENGTH(new_invite_code));
        END IF;

        -- Make sure the code is unique
        WHILE EXISTS (SELECT 1 FROM user_invite_codes WHERE invite_code = new_invite_code) LOOP
            new_invite_code := SUBSTRING(new_invite_code, 1, 5) || CHR(65 + (RANDOM() * 25)::int);
        END LOOP;

        -- Insert the invite code for the group creator
        INSERT INTO user_invite_codes (user_id, group_id, invite_code)
        VALUES (group_record.created_by, group_record.id, new_invite_code);
    END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON TABLE user_invite_codes IS 'User-specific invite codes for groups, enabling invitation attribution';
COMMENT ON TABLE group_invitations IS 'Tracks invitation relationships - who invited whom to which group';