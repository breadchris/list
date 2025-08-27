-- Enable full text search on content table's data column
-- This migration adds PostgreSQL full text search capabilities to efficiently search through content

-- Add a tsvector column to store the searchable text vector
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS search_vector tsvector;
-- Create a GIN index for fast full-text search queries
CREATE INDEX IF NOT EXISTS idx_content_search_vector 
ON content 
USING gin(search_vector);
-- Create a function to update the search vector
-- This will be called by a trigger to keep the search vector in sync with the data column
CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the search vector using English text search configuration
  -- This handles stemming, stop words, and other language-specific processing
  NEW.search_vector := CASE 
    WHEN NEW.data IS NOT NULL AND NEW.data != '' 
    THEN to_tsvector('english', NEW.data)
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;
-- Create trigger to automatically update search vector on insert or update
DROP TRIGGER IF EXISTS trigger_update_content_search_vector ON content;
CREATE TRIGGER trigger_update_content_search_vector
BEFORE INSERT OR UPDATE OF data
ON content
FOR EACH ROW
EXECUTE FUNCTION update_content_search_vector();
-- Create a helper function to search content
-- This function makes it easy to search content with proper ranking
CREATE OR REPLACE FUNCTION search_content(
  search_query text,
  group_uuid uuid DEFAULT NULL,
  result_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  type text,
  data text,
  group_id uuid,
  user_id uuid,
  parent_content_id uuid,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.created_at,
    c.updated_at,
    c.type,
    c.data,
    c.group_id,
    c.user_id,
    c.parent_content_id,
    ts_rank(c.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM content c
  WHERE 
    c.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (group_uuid IS NULL OR c.group_id = group_uuid)
  ORDER BY rank DESC, c.updated_at DESC
  LIMIT result_limit;
END;
$$;
-- Create a simpler search function that returns just the content
CREATE OR REPLACE FUNCTION simple_search_content(
  search_query text,
  group_uuid uuid DEFAULT NULL
)
RETURNS SETOF content
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM content c
  WHERE 
    c.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (group_uuid IS NULL OR c.group_id = group_uuid)
  ORDER BY 
    ts_rank(c.search_vector, websearch_to_tsquery('english', search_query)) DESC,
    c.updated_at DESC;
END;
$$;
-- Update existing rows to populate the search vector
-- This ensures all existing content is immediately searchable
UPDATE content 
SET search_vector = to_tsvector('english', data)
WHERE data IS NOT NULL AND data != '';
-- Add a comment to document the search vector column
COMMENT ON COLUMN content.search_vector IS 'Full text search vector for the data column, automatically maintained by trigger';
-- Add comments to document the search functions
COMMENT ON FUNCTION search_content IS 'Search content using full text search with ranking. Returns results ordered by relevance.';
COMMENT ON FUNCTION simple_search_content IS 'Simple content search that returns full content records ordered by relevance.';
-- Example usage comments
/*
Example searches:

-- Search for content containing "meeting" or "notes"
SELECT * FROM search_content('meeting notes');

-- Search for exact phrase "project deadline"
SELECT * FROM search_content('"project deadline"');

-- Search for content with "budget" but not "draft"
SELECT * FROM search_content('budget -draft');

-- Search within a specific group
SELECT * FROM search_content('roadmap', 'group-uuid-here');

-- Use the simple search function
SELECT * FROM simple_search_content('typescript react');

-- Direct query with websearch syntax
SELECT * FROM content 
WHERE search_vector @@ websearch_to_tsquery('english', 'database OR postgres');
*/;
