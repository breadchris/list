-- Add missing INSERT policies for users and groups tables
-- This fixes the 403 Forbidden errors when creating users and groups

-- Add INSERT policy for users table
-- Allow authenticated users to create their own user record
CREATE POLICY "Users can create their own record" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);
-- Add INSERT policy for groups table
-- Allow authenticated users to create groups (they become the creator)
CREATE POLICY "Authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);
