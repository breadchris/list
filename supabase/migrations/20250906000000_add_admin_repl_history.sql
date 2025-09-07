-- Admin REPL command history tracking
-- Allows administrators to maintain a persistent history of their commands
-- Each command is logged with execution details and results

-- Admin REPL command history table
CREATE TABLE IF NOT EXISTS public.repl_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  result JSONB,
  status TEXT CHECK (status IN ('success', 'error', 'pending')) DEFAULT 'pending',
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Add constraints
  CONSTRAINT repl_history_command_not_empty CHECK (length(trim(command)) > 0),
  CONSTRAINT repl_history_execution_time_positive CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

-- Indexes for performance
CREATE INDEX idx_repl_history_user_id ON public.repl_history(user_id);
CREATE INDEX idx_repl_history_executed_at ON public.repl_history(executed_at DESC);
CREATE INDEX idx_repl_history_status ON public.repl_history(status) WHERE status != 'success';
CREATE INDEX idx_repl_history_command_search ON public.repl_history USING gin(to_tsvector('english', command));

-- Comment on table and columns
COMMENT ON TABLE public.repl_history IS 'Stores admin REPL command history with execution results and metadata';
COMMENT ON COLUMN public.repl_history.command IS 'The S-expression command that was executed';
COMMENT ON COLUMN public.repl_history.result IS 'JSON result data from command execution';
COMMENT ON COLUMN public.repl_history.status IS 'Execution status: pending, success, or error';
COMMENT ON COLUMN public.repl_history.execution_time_ms IS 'Command execution time in milliseconds';
COMMENT ON COLUMN public.repl_history.metadata IS 'Additional metadata like affected entities, dry run flag, etc.';

-- Enable Row Level Security
ALTER TABLE public.repl_history ENABLE ROW LEVEL SECURITY;

-- Function to check if a user is an admin
-- Admins are users who have 'admin' role in any group or are explicitly marked as admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Return false if no user provided
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has admin role in any group
  RETURN EXISTS (
    SELECT 1 FROM public.group_memberships 
    WHERE user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Users can only view their own command history
CREATE POLICY "Users can view own REPL history"
  ON public.repl_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own commands (and only if they're admin)
CREATE POLICY "Admin users can insert own REPL commands"
  ON public.repl_history FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin_user(auth.uid()));

-- Users can update their own pending commands (for status updates)
CREATE POLICY "Users can update own REPL history status"
  ON public.repl_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent deletion of history for audit purposes
-- Only allow deletion of commands older than 1 year
CREATE POLICY "Users can delete old own REPL history"
  ON public.repl_history FOR DELETE
  USING (auth.uid() = user_id AND executed_at < NOW() - INTERVAL '1 year');

-- Super admins can view all history for system monitoring (optional)
-- This would require a separate admin role system - commented out for now
-- CREATE POLICY "Super admins can view all REPL history"
--   ON public.repl_history FOR SELECT
--   USING (public.is_super_admin(auth.uid()));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.repl_history TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create a function to clean up old REPL history (older than 1 year)
CREATE OR REPLACE FUNCTION public.cleanup_old_repl_history()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.repl_history 
  WHERE executed_at < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on cleanup function
COMMENT ON FUNCTION public.cleanup_old_repl_history() IS 'Cleans up REPL history entries older than 1 year. Returns count of deleted records.';