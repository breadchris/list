-- Add SEO functionality to content table
-- This migration adds metadata storage and optimizations for SEO content type

-- Add metadata column to store SEO information
ALTER TABLE "public"."content" ADD COLUMN "metadata" jsonb;

-- Create indexes for better performance
CREATE INDEX "idx_content_type_seo" ON "public"."content"("type") WHERE "type" = 'seo';
CREATE INDEX "idx_content_metadata" ON "public"."content" USING gin("metadata");
CREATE INDEX "idx_content_parent_and_type" ON "public"."content"("parent_content_id", "type");

-- Create function to extract URLs from text
CREATE OR REPLACE FUNCTION extract_urls(input_text text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
DECLARE
    url_pattern text := 'https?://[^\s<>"{}|\\^`\[\]]+';
    urls text[];
BEGIN
    -- Extract URLs using regex and return as array
    SELECT array_agg(match[1]) 
    INTO urls
    FROM regexp_matches(input_text, url_pattern, 'gi') AS match;
    
    RETURN COALESCE(urls, ARRAY[]::text[]);
END;
$$;

-- Create function to find existing SEO content for a URL
CREATE OR REPLACE FUNCTION find_seo_content_by_url(
    parent_id uuid,
    url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    seo_id uuid;
BEGIN
    -- Find existing SEO content with the same URL under the same parent
    SELECT id INTO seo_id
    FROM content
    WHERE parent_content_id = parent_id
      AND type = 'seo'
      AND data = url
    LIMIT 1;
    
    RETURN seo_id;
END;
$$;

-- Create function to upsert SEO content
CREATE OR REPLACE FUNCTION upsert_seo_content(
    parent_id uuid,
    user_id uuid,
    group_id uuid,
    url text,
    seo_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_seo_id uuid;
    new_seo_id uuid;
BEGIN
    -- Check if SEO content already exists for this URL under this parent
    existing_seo_id := find_seo_content_by_url(parent_id, url);
    
    IF existing_seo_id IS NOT NULL THEN
        -- Update existing SEO content if metadata is provided
        IF seo_metadata IS NOT NULL THEN
            UPDATE content 
            SET metadata = seo_metadata,
                updated_at = NOW()
            WHERE id = existing_seo_id;
        END IF;
        
        RETURN existing_seo_id;
    ELSE
        -- Create new SEO content
        INSERT INTO content (
            type,
            data,
            group_id,
            user_id,
            parent_content_id,
            metadata
        ) VALUES (
            'seo',
            url,
            group_id,
            user_id,
            parent_id,
            COALESCE(seo_metadata, '{}'::jsonb)
        ) RETURNING id INTO new_seo_id;
        
        RETURN new_seo_id;
    END IF;
END;
$$;

-- Update RLS policies to allow SEO content operations
-- SEO content should be viewable by anyone who can view the parent content
CREATE POLICY "SEO content inherits parent permissions"
ON "public"."content"
AS permissive
FOR ALL
TO public
USING (
    CASE 
        WHEN type = 'seo' AND parent_content_id IS NOT NULL THEN
            EXISTS (
                SELECT 1 FROM content parent
                WHERE parent.id = content.parent_content_id
                AND EXISTS (
                    SELECT 1 FROM group_memberships
                    WHERE group_memberships.group_id = parent.group_id 
                    AND group_memberships.user_id::text = auth.uid()::text
                )
            )
        ELSE
            -- Use existing policies for non-SEO content
            EXISTS (
                SELECT 1 FROM group_memberships
                WHERE group_memberships.group_id = content.group_id 
                AND group_memberships.user_id::text = auth.uid()::text
            )
    END
)
WITH CHECK (
    CASE 
        WHEN type = 'seo' AND parent_content_id IS NOT NULL THEN
            EXISTS (
                SELECT 1 FROM content parent
                WHERE parent.id = content.parent_content_id
                AND EXISTS (
                    SELECT 1 FROM group_memberships
                    WHERE group_memberships.group_id = parent.group_id 
                    AND group_memberships.user_id::text = auth.uid()::text
                )
            )
        ELSE
            -- Use existing policies for non-SEO content
            user_id::text = auth.uid()::text 
            AND EXISTS (
                SELECT 1 FROM group_memberships
                WHERE group_memberships.group_id = content.group_id 
                AND group_memberships.user_id::text = auth.uid()::text
            )
    END
);

-- Grant execute permissions on the new functions to authenticated users
GRANT EXECUTE ON FUNCTION extract_urls(text) TO authenticated;
GRANT EXECUTE ON FUNCTION find_seo_content_by_url(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_seo_content(uuid, uuid, uuid, text, jsonb) TO authenticated;