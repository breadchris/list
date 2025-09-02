-- Enable Realtime for content, groups, and group_memberships tables
-- This allows clients to subscribe to real-time changes via postgres_changes

-- First, ensure the supabase_realtime publication exists
-- Drop and recreate to ensure clean state
BEGIN;

-- Remove the existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create the publication fresh
CREATE PUBLICATION supabase_realtime;

-- Add tables to the publication for real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_memberships;

-- Optional: Add other tables if they exist and need realtime
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.content_tags;

COMMIT;

-- Verify the publication was created and tables were added
-- You can check this with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';