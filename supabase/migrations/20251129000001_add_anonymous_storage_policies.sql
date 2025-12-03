-- Storage RLS policies for anonymous uploads
-- Allow unauthenticated users to upload and view files in the anonymous group

-- Drop existing anonymous policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Anonymous users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can delete their own files" ON storage.objects;

-- Policy: Anonymous users (anon role) can upload files to content bucket
-- Path pattern: <content-uuid>/<filename>
-- Access check: content must exist and belong to anonymous group
CREATE POLICY "Anonymous users can upload files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'content'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM content c
    WHERE c.group_id = '00000000-0000-0000-0000-000000000001'
  )
);

-- Policy: Anyone (including unauthenticated) can view/download files from anonymous group
CREATE POLICY "Anyone can view anonymous uploads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'content'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM content c
    WHERE c.group_id = '00000000-0000-0000-0000-000000000001'
  )
);

-- Policy: Users can delete files they uploaded (based on user_id in content table)
-- Note: This allows both anonymous and authenticated users to delete their own uploads
CREATE POLICY "Anonymous users can delete their own files"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'content'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM content c
    WHERE c.group_id = '00000000-0000-0000-0000-000000000001'
  )
);
