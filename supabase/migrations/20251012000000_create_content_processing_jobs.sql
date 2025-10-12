-- Create content_processing_jobs table for tracking async job queue
-- This table tracks all content processing operations submitted to the SQS queue

CREATE TABLE content_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- User and group context
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,

  -- Job details
  action TEXT NOT NULL,  -- 'seo-extract', 'libgen-search', 'tmdb-search', etc.
  payload JSONB NOT NULL, -- Original request payload

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  progress JSONB,  -- Optional progress tracking (e.g., {"current": 5, "total": 10, "message": "Processing item 5 of 10"})

  -- Results and errors
  result JSONB,  -- Final result when completed
  error TEXT,    -- Error message if failed

  -- Timing information
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Content tracking
  content_ids TEXT[]  -- Array of content IDs created by this job
);

-- Indexes for efficient querying
CREATE INDEX idx_content_processing_jobs_user_status ON content_processing_jobs(user_id, status);
CREATE INDEX idx_content_processing_jobs_group_status ON content_processing_jobs(group_id, status);
CREATE INDEX idx_content_processing_jobs_created_at ON content_processing_jobs(created_at DESC);
CREATE INDEX idx_content_processing_jobs_status ON content_processing_jobs(status) WHERE status IN ('pending', 'processing');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_content_processing_jobs_updated_at_trigger
  BEFORE UPDATE ON content_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_content_processing_jobs_updated_at();

-- Row Level Security policies
ALTER TABLE content_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON content_processing_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own jobs (via authenticated requests)
CREATE POLICY "Users can create their own jobs"
  ON content_processing_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (for cancellation)
CREATE POLICY "Users can update their own jobs"
  ON content_processing_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can do anything (for Lambda processing)
CREATE POLICY "Service role has full access"
  ON content_processing_jobs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE content_processing_jobs;

-- Comments for documentation
COMMENT ON TABLE content_processing_jobs IS 'Tracks async content processing jobs queued via SQS';
COMMENT ON COLUMN content_processing_jobs.action IS 'Type of content processing action (e.g., seo-extract, libgen-search)';
COMMENT ON COLUMN content_processing_jobs.payload IS 'Original request payload as JSON';
COMMENT ON COLUMN content_processing_jobs.status IS 'Current job status: pending (queued), processing (running), completed (success), failed (error), cancelled (user cancelled)';
COMMENT ON COLUMN content_processing_jobs.progress IS 'Optional progress tracking for long-running jobs';
COMMENT ON COLUMN content_processing_jobs.result IS 'Final result data when job completes successfully';
COMMENT ON COLUMN content_processing_jobs.content_ids IS 'Array of content IDs created by this job for easy lookup';
