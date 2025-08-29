-- Fix infinite recursion in SEO content policy
-- The "SEO content inherits parent permissions" policy creates infinite recursion
-- by querying the content table within its own policy evaluation.
-- 
-- Solution: Remove the special case policy for SEO content.
-- SEO content will use the same policies as any other content type:
-- - Group members can view all content in their groups
-- - Users can create/update/delete their own content
--
-- This is simpler, faster, and follows the principle that content permissions
-- are based on group membership, not parent-child relationships.

DROP POLICY IF EXISTS "SEO content inherits parent permissions" ON "public"."content";