-- Improve search functionality with fuzzy matching capabilities
-- This migration adds fuzzy search support using PostgreSQL's pg_trgm extension
-- for better user experience with typos, partial matches, and natural queries

-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration:
-- DROP FUNCTION IF EXISTS fuzzy_search_content;
-- DROP INDEX IF EXISTS idx_content_data_trigram;
-- -- Note: pg_trgm extension should be kept if used elsewhere

-- Enable pg_trgm extension for trigram similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Enable unaccent extension for accent-insensitive search (optional but helpful)
CREATE EXTENSION IF NOT EXISTS unaccent;
-- Create trigram index on content.data for fast fuzzy matching
-- This significantly improves performance for LIKE queries and similarity operations
CREATE INDEX IF NOT EXISTS idx_content_data_trigram 
ON content 
USING gin (data gin_trgm_ops);
-- Create improved fuzzy search function that combines multiple search strategies
-- This provides a more forgiving search experience compared to the strict websearch_to_tsquery
CREATE OR REPLACE FUNCTION fuzzy_search_content(
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
  rank real,
  match_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize search query (trim, lowercase)
  search_query := trim(lower(search_query));
  
  -- Return empty if query is too short
  IF length(search_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH search_results AS (
    -- Strategy 1: Full-text search with plainto_tsquery (most forgiving FTS)
    -- This handles stemming, stop words, and doesn't require special syntax
    SELECT 
      c.*,
      ts_rank(c.search_vector, plainto_tsquery('english', search_query)) * 1.0 AS search_rank,
      'fulltext'::text AS match_type
    FROM content c
    WHERE 
      c.search_vector @@ plainto_tsquery('english', search_query)
      AND (group_uuid IS NULL OR c.group_id = group_uuid)
      AND c.data IS NOT NULL

    UNION ALL

    -- Strategy 2: Trigram similarity for fuzzy/partial matching
    -- This catches typos and partial word matches
    SELECT 
      c.*,
      similarity(lower(c.data), search_query) * 0.8 AS search_rank,
      'fuzzy'::text AS match_type
    FROM content c
    WHERE 
      similarity(lower(c.data), search_query) > 0.2
      AND (group_uuid IS NULL OR c.group_id = group_uuid)
      AND c.data IS NOT NULL
      -- Avoid duplicates from full-text search
      AND NOT (c.search_vector @@ plainto_tsquery('english', search_query))

    UNION ALL

    -- Strategy 3: Simple substring matching as final fallback
    -- This ensures we catch basic substring matches
    SELECT 
      c.*,
      0.3 AS search_rank,
      'substring'::text AS match_type
    FROM content c
    WHERE 
      lower(c.data) LIKE '%' || search_query || '%'
      AND (group_uuid IS NULL OR c.group_id = group_uuid)
      AND c.data IS NOT NULL
      -- Avoid duplicates from previous strategies
      AND NOT (c.search_vector @@ plainto_tsquery('english', search_query))
      AND similarity(lower(c.data), search_query) <= 0.2
  )
  SELECT 
    s.id,
    s.created_at,
    s.updated_at,
    s.type,
    s.data,
    s.group_id,
    s.user_id,
    s.parent_content_id,
    s.search_rank::real,
    s.match_type
  FROM search_results s
  ORDER BY s.search_rank DESC, s.updated_at DESC
  LIMIT result_limit;
END;
$$;
-- Add helpful comments to document the function
COMMENT ON FUNCTION fuzzy_search_content IS 'Fuzzy search function that combines full-text search, trigram similarity, and substring matching for forgiving search results';
-- Create a simple wrapper function for backwards compatibility
-- This allows gradual migration from the old search_content function
CREATE OR REPLACE FUNCTION search_content_fuzzy(
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
    f.id,
    f.created_at,
    f.updated_at,
    f.type,
    f.data,
    f.group_id,
    f.user_id,
    f.parent_content_id,
    f.rank
  FROM fuzzy_search_content(search_query, group_uuid, result_limit) f;
END;
$$;
-- Example usage and testing queries (commented out)
/*
-- Test fuzzy search capabilities:

-- 1. Exact match (should work)
SELECT * FROM fuzzy_search_content('test');

-- 2. Typo tolerance (should find "list" even with typo)
SELECT * FROM fuzzy_search_content('lsit');

-- 3. Partial word matching (should find "testing" when searching "test")
SELECT * FROM fuzzy_search_content('tes');

-- 4. Natural language query (should work without special syntax)
SELECT * FROM fuzzy_search_content('new list items');

-- 5. Case insensitive (should work regardless of case)
SELECT * FROM fuzzy_search_content('LIST');

-- Performance testing:
EXPLAIN ANALYZE SELECT * FROM fuzzy_search_content('test', NULL, 10);
*/;
