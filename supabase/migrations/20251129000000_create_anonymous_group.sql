-- Create anonymous uploads group for unauthenticated file uploads
-- This group allows all anonymous users to upload and view files in a shared space

-- Insert the anonymous uploads group with a fixed UUID
INSERT INTO groups (id, name, join_code, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Anonymous Uploads',
  'ANON00',
  now()
)
ON CONFLICT (id) DO NOTHING;
