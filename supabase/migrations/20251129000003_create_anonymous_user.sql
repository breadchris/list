-- Create anonymous system user for unauthenticated file uploads
-- This user will be used for all anonymous content uploads

-- Insert the anonymous system user with a fixed UUID
INSERT INTO users (id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Update the anonymous uploads group to be created by the anonymous user
UPDATE groups
SET created_by = '00000000-0000-0000-0000-000000000000'
WHERE id = '00000000-0000-0000-0000-000000000001';
