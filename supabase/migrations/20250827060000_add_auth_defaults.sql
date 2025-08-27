-- Add auth.uid() as default values for user_id columns
-- This ensures user IDs are automatically set from the authenticated user

alter table "public"."content" alter column "user_id" set default auth.uid();

alter table "public"."group_memberships" alter column "user_id" set default auth.uid();

alter table "public"."groups" alter column "created_by" set default auth.uid();