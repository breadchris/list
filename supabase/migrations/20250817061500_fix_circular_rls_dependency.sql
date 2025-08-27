-- Fix circular RLS policy dependency between groups and group_memberships
-- Create security definer function to bypass RLS when checking group creator

-- Function to check if user is creator of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_creator(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups 
    WHERE id = group_uuid 
    AND created_by = user_uuid
  );
$$;
-- Drop existing policy that causes circular dependency
DROP POLICY IF EXISTS "Group memberships viewable by owners and creators" ON group_memberships;
-- Create new policy using the security definer function
CREATE POLICY "Group memberships viewable by owners and creators" ON group_memberships
  FOR SELECT USING (
    user_id::text = auth.uid()::text OR
    is_group_creator(group_id, auth.uid())
  );
