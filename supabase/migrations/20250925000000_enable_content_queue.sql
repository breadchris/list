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
-- Note: cron extension may not be available in local Supabase, so we make this conditional
DO $$
BEGIN
  -- Check if cron schema exists (only available in production)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'process-content-queue',
      '* * * * *', -- Every minute
      $CRON$
      select
        net.http_post(
            url:='https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content',
            headers:=jsonb_build_object(),
            body:='{"action": "queue-process"}',
            timeout_milliseconds:=1000
        ) as response;
      $CRON$
    );
    RAISE NOTICE 'Cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'Cron extension not available - skipping job scheduling (local development)';
  END IF;
END $$;

-- Ensure the service role key setting exists (this should be set in your environment)
-- You may need to set this manually in your Supabase project settings:
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- Add helpful comment
COMMENT ON EXTENSION pgmq IS 'PostgreSQL Message Queue for async content processing';