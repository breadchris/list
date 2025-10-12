-- Enable Realtime for content_tags table
-- This allows clients to subscribe to real-time changes for tag assignments

BEGIN;

-- Add content_tags table to the supabase_realtime publication
-- This enables real-time subscriptions for tag additions/removals
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_tags;

COMMIT;

-- Verify the publication includes content_tags
-- You can check this with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
