-- Fix infinite recursion in group_memberships RLS policy
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Group memberships are viewable by group members" ON group_memberships;
-- Create new non-recursive policy
-- Users can view their own memberships OR memberships in groups they created
CREATE POLICY "Group memberships viewable by owners and creators" ON group_memberships
  FOR SELECT USING (
    user_id::text = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_memberships.group_id
      AND groups.created_by::text = auth.uid()::text
    )
  );
