-- Enable pgmq extension for Supabase queues
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create the content queue for async job processing
SELECT pgmq.create('content');

-- Grant necessary permissions for edge functions to use the queue
GRANT USAGE ON SCHEMA pgmq TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgmq TO service_role;

-- Create a cron job to process the content queue every minute
-- This will invoke the content function with queue-process action
SELECT
  cron.schedule(
    'process-content-queue',
    '* * * * *', -- Every minute
    $$
    select
      net.http_post(
          url:='https://zazsrepfnamdmibcyenx.supabase.co/functions/v1/content',
          headers:=jsonb_build_object(),
          body:='{"action": "queue-process"}',
          timeout_milliseconds:=1000
      ) as response;
    $$
  );

-- Ensure the service role key setting exists (this should be set in your environment)
-- You may need to set this manually in your Supabase project settings:
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- Add helpful comment
COMMENT ON EXTENSION pgmq IS 'PostgreSQL Message Queue for async content processing';