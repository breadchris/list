-- Allow public access to storage files for content marked as public
-- Uses EXISTS with direct ID lookup (uses primary key index) instead of IN subquery
CREATE POLICY "Anyone can view public shared content files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'content'
  AND EXISTS (
    SELECT 1
    FROM content c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.metadata->'sharing'->>'isPublic')::boolean = true
  )
);
