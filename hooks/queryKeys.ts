/**
 * Query key factories for consistent cache keys across the application
 * Following TanStack Query best practices for hierarchical keys
 */

// Base keys for different data types
export const QueryKeys = {
  // User groups
  groups: ['groups'] as const,
  
  // Content operations
  content: ['content'] as const,
  contentByParent: (groupId: string, parentId: string | null) => 
    ['content', 'by-parent', groupId, parentId] as const,
  contentById: (contentId: string) => 
    ['content', 'by-id', contentId] as const,
  contentSearch: (groupId: string, query: string, parentId: string | null) =>
    ['content', 'search', groupId, query, parentId] as const,
  
  // Group operations
  groupById: (groupId: string) => 
    ['groups', 'by-id', groupId] as const,
  
  // Tag operations
  tags: ['tags'] as const,
  tagsByContent: (contentId: string) =>
    ['tags', 'by-content', contentId] as const,
  tagsSearch: (query: string) =>
    ['tags', 'search', query] as const,
  
  // SEO operations
  seoChildren: (contentId: string) =>
    ['content', 'seo-children', contentId] as const,
} as const;

/**
 * Utility functions for invalidating related queries
 */
export const QueryInvalidation = {
  // Invalidate all content queries for a specific group
  allContentForGroup: (groupId: string) => ['content', 'by-parent', groupId],
  
  // Invalidate all search queries for a specific group
  allSearchForGroup: (groupId: string) => ['content', 'search', groupId],
  
  // Invalidate all queries related to a specific content item
  allForContent: (contentId: string) => ['content', 'by-id', contentId],
  
  // Invalidate all group-related queries
  allGroups: () => ['groups'],
} as const;