import { supabase, withRetry } from "./SupabaseClient";
import { LambdaClient } from "./LambdaClient";

// Types based on our database schema
export interface User {
  id: string;
  username?: string;
  created_at: string;
}

export interface Group {
  id: string;
  created_at: string;
  name: string;
  created_by?: string;
}

// New interfaces for invite graph system
export interface UserInviteCode {
  id: string;
  user_id: string;
  group_id: string;
  invite_code: string;
  created_at: string;
  expires_at?: string;
  max_uses?: number;
  current_uses: number;
  is_active: boolean;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  invite_code_used: string;
  joined_at: string;
}

export interface InviteGraphNode {
  inviter_user_id: string;
  inviter_username?: string;
  invitee_user_id: string;
  invitee_username?: string;
  joined_at: string;
  invite_code_used: string;
}

export interface InviteStats {
  group_id: string;
  group_name: string;
  invite_code: string;
  created_at: string;
  expires_at?: string;
  max_uses?: number;
  current_uses: number;
  successful_invites: number;
}

export interface Content {
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  data: string;
  group_id: string;
  user_id: string;
  parent_content_id?: string;
  metadata?: any; // JSONB field for SEO and other metadata
  tags?: Tag[];
  child_count?: number; // Number of direct children
}

export interface ContentRelationship {
  id: string;
  from_content_id: string;
  to_content_id: string;
  display_order: number;
  created_at: string;
}

export interface SEOMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
  siteName?: string;
  type?: string;
  url?: string;
}

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeVideoMetadata {
  youtube_video_id?: string;
  youtube_title?: string;
  youtube_url?: string;
  youtube_author?: string;
  youtube_channel_id?: string;
  youtube_channel_handle?: string;
  youtube_description?: string;
  youtube_duration?: number;
  youtube_views?: number;
  youtube_publish_date?: string;
  youtube_thumbnails?: YouTubeThumbnail[];
  source_playlist_url?: string;
  extracted_from_playlist?: boolean;
}

export interface SharingMetadata {
  isPublic: boolean;
  enabledAt?: string;
  enabledBy?: string;
  disabledAt?: string;
  disabledBy?: string;
}

export interface SharingResponse {
  success: boolean;
  isPublic: boolean;
  publicUrl?: string;
}

export interface Tag {
  id: string;
  created_at: string;
  name: string;
  color?: string;
  user_id: string;
}

export interface TagFilter {
  tag: Tag;
  mode: "include" | "exclude";
}

export interface ContentTag {
  content_id: string;
  tag_id: string;
  created_at: string;
}

export interface SerializedContent {
  id: string;
  type: string;
  data: string;
  metadata: any;
  children: Array<{
    id: string;
    type: string;
    data: string;
    metadata: any;
  }>;
}

// Content Repository class for data access
export class ContentRepository {
  // Content methods
  async createContent(content: {
    type: string;
    data: string;
    group_id: string;
    user_id: string;
    parent_content_id?: string;
  }): Promise<Content> {
    // Dual-write period: write to both parent_content_id and content_relationships table
    const { data, error } = await supabase
      .from("content")
      .insert([content])
      .select()
      .single();

    if (error) {
      console.error("Error creating content:", error);
      throw new Error(error.message);
    }

    // Relationship creation is now handled automatically by database trigger
    // See migration: 20251028213151_add_content_relationship_trigger.sql
    // The trigger creates relationships based on parent_content_id:
    // - NULL parent → root relationship (from_content_id = NULL)
    // - Non-NULL parent → child relationship (from_content_id = parent_content_id)
    // No manual relationship creation needed here.

    return data;
  }

  async getContentByParent(
    groupId: string,
    parentId: string | null,
    offset = 0,
    limit = 20,
    viewMode:
      | "chronological"
      | "random"
      | "alphabetical"
      | "oldest" = "chronological",
  ): Promise<Content[]> {
    let contentWithTags: Content[] = [];

    // Determine database ordering based on viewMode
    let orderColumn: string;
    let ascending: boolean;

    switch (viewMode) {
      case "chronological":
        orderColumn = "child(created_at)";
        ascending = false; // Newest first
        break;
      case "oldest":
        orderColumn = "child(created_at)";
        ascending = true; // Oldest first
        break;
      case "alphabetical":
        orderColumn = "child(data)";
        ascending = true;
        break;
      case "random":
        // Random ordering not directly supported by PostgREST
        // Fall back to chronological for database query
        orderColumn = "child(created_at)";
        ascending = false;
        break;
    }

    if (parentId === null) {
      // Root items: query relationships where from_content_id IS NULL
      // Use !inner join to exclude orphaned relationships (where child is NULL)
      const { data, error } = await supabase
        .from("content_relationships")
        .select(
          `
          display_order,
          child:content!inner!to_content_id (
            *,
            content_tags!left (
              tags (
                id,
                created_at,
                name,
                color,
                user_id
              )
            )
          )
        `,
        )
        .is("from_content_id", null)
        .eq("child.group_id", groupId)
        .order(orderColumn, { ascending })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching root content:", error);
        throw new Error(error.message);
      }

      // Extract child content and transform tags
      const rootData = (data || []).map((item: any) => item.child);

      contentWithTags = rootData.map((item: any) => ({
        ...item,
        tags:
          (item as any).content_tags
            ?.map((ct: any) => ct.tags)
            .filter(Boolean) || [],
      }));

      // Note: Ordering now handled by database query above
      // No client-side sorting to avoid misleading results with pagination
    } else {
      // Child items: query from content_relationships join table
      // Use !inner join to exclude orphaned relationships (where child is NULL)
      const { data, error } = await supabase
        .from("content_relationships")
        .select(
          `
          display_order,
          child:content!inner!to_content_id (
            *,
            content_tags!left (
              tags (
                id,
                created_at,
                name,
                color,
                user_id
              )
            )
          )
        `,
        )
        .eq("from_content_id", parentId)
        .order(orderColumn, { ascending })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching child content:", error);
        throw new Error(error.message);
      }

      // Extract child content and transform tags
      const childrenData = (data || []).map((item: any) => item.child);

      // Filter by groupId (in case of cross-group relationships)
      const filteredChildren = childrenData.filter(
        (child: any) => child?.group_id === groupId,
      );

      contentWithTags = filteredChildren.map((item: any) => ({
        ...item,
        tags:
          (item as any).content_tags
            ?.map((ct: any) => ct.tags)
            .filter(Boolean) || [],
      }));

      // Note: Ordering now handled by database query above
      // No client-side sorting to avoid misleading results with pagination
    }

    // Fetch child counts for all content items using join table
    if (contentWithTags.length > 0) {
      const contentIds = contentWithTags.map((item) => item.id);
      const { data: childCounts, error: countError } = await supabase
        .from("content_relationships")
        .select("from_content_id")
        .in("from_content_id", contentIds);

      if (!countError && childCounts) {
        // Create a map of parent_id -> child_count
        const countMap = new Map<string, number>();
        childCounts.forEach((rel) => {
          const parentId = rel.from_content_id;
          if (parentId) {
            countMap.set(parentId, (countMap.get(parentId) || 0) + 1);
          }
        });

        // Add child_count to each content item
        contentWithTags = contentWithTags.map((item) => ({
          ...item,
          child_count: countMap.get(item.id) || 0,
        }));
      }
    }

    // Apply random shuffle if in random mode
    if (viewMode === "random" && contentWithTags.length > 0) {
      // Use seeded random based on group ID for consistent randomization within session
      const seed = groupId
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = this.seededRandom(seed + offset);
      contentWithTags = contentWithTags.sort(() => random() - 0.5);
    }

    return contentWithTags;
  }

  // Seeded random number generator for consistent randomization
  private seededRandom(seed: number) {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  async getParentsForContent(contentId: string): Promise<Content[]> {
    const { data, error } = await supabase
      .from("content_relationships")
      .select(
        `
        from_content_id,
        parent:content!inner!from_content_id (
          *
        )
      `,
      )
      .eq("to_content_id", contentId)
      .not("from_content_id", "is", null);

    if (error) {
      console.error("Error fetching parents for content:", error);
      throw new Error(error.message);
    }

    // Extract parent content
    return (data || []).map((item: any) => item.parent).filter(Boolean);
  }

  async createRelationship(relationship: {
    from_content_id: string;
    to_content_id: string;
    display_order?: number;
  }): Promise<{
    from_content_id: string;
    to_content_id: string;
    display_order?: number;
  }> {
    const { data, error } = await supabase
      .from("content_relationships")
      .insert([relationship])
      .select()
      .single();

    if (error) {
      console.error("Error creating relationship:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    const { error } = await supabase
      .from("content_relationships")
      .delete()
      .eq("id", relationshipId);

    if (error) {
      console.error("Error deleting relationship:", error);
      throw new Error(error.message);
    }
  }

  async getPublicContentChildren(parentId: string): Promise<Content[]> {
    const { data, error } = await supabase
      .from("content_relationships")
      .select(
        `
        child:content!inner!to_content_id (
          *,
          content_tags!left (
            tags (
              id,
              created_at,
              name,
              color,
              user_id
            )
          )
        )
      `,
      )
      .eq("from_content_id", parentId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching public content children:", error);
      throw new Error(error.message);
    }

    // Extract child content and transform tags
    const childData = (data || []).map((item: any) => item.child);

    return childData.map((item: any) => ({
      ...item,
      tags:
        (item as any).content_tags?.map((ct: any) => ct.tags).filter(Boolean) ||
        [],
    }));
  }

  async getContentByParentAndTag(
    groupId: string,
    parentId: string | null,
    includeTagIds: string | string[],
    excludeTagIds: string | string[] = [],
    offset = 0,
    limit = 20,
    viewMode:
      | "chronological"
      | "random"
      | "alphabetical"
      | "oldest" = "chronological",
  ): Promise<Content[]> {
    // Normalize tag IDs to always be arrays
    const includeTagArray = Array.isArray(includeTagIds)
      ? includeTagIds
      : [includeTagIds];
    const excludeTagArray = Array.isArray(excludeTagIds)
      ? excludeTagIds
      : [excludeTagIds];

    if (includeTagArray.length === 0 && excludeTagArray.length === 0) {
      return [];
    }

    // Step 1: Get content IDs that have ALL included tags (AND logic)
    let includedContentIds: string[] = [];

    if (includeTagArray.length > 0) {
      if (includeTagArray.length === 1) {
        // Single include tag - simple query
        const { data: taggedContentIds, error: tagError } = await supabase
          .from("content_tags")
          .select("content_id")
          .eq("tag_id", includeTagArray[0]);

        if (tagError) {
          console.error("Error fetching tagged content:", tagError);
          throw new Error(tagError.message);
        }

        includedContentIds =
          taggedContentIds?.map((item) => item.content_id) || [];
      } else {
        // Multiple include tags - find intersection (content with ALL tags)
        const { data: allTaggedContent, error: tagError } = await supabase
          .from("content_tags")
          .select("content_id, tag_id")
          .in("tag_id", includeTagArray);

        if (tagError) {
          console.error("Error fetching tagged content:", tagError);
          throw new Error(tagError.message);
        }

        // Group by content_id and count how many tags each content has
        const contentTagCount = new Map<string, Set<string>>();
        allTaggedContent?.forEach((item) => {
          if (!contentTagCount.has(item.content_id)) {
            contentTagCount.set(item.content_id, new Set());
          }
          contentTagCount.get(item.content_id)!.add(item.tag_id);
        });

        // Filter to only content that has ALL specified tags
        includedContentIds = Array.from(contentTagCount.entries())
          .filter(([, tags]) => tags.size === includeTagArray.length)
          .map(([contentId]) => contentId);
      }
    }

    // Step 2: Get content IDs that have ANY excluded tags (to filter out)
    let excludedContentIds: string[] = [];

    if (excludeTagArray.length > 0) {
      const { data: excludedTaggedContent, error: excludeError } =
        await supabase
          .from("content_tags")
          .select("content_id")
          .in("tag_id", excludeTagArray);

      if (excludeError) {
        console.error("Error fetching excluded tagged content:", excludeError);
        throw new Error(excludeError.message);
      }

      excludedContentIds =
        excludedTaggedContent?.map((item) => item.content_id) || [];
    }

    // Step 3: Combine logic - content must have ALL included tags AND NOT have ANY excluded tags
    let contentIds: string[] = [];

    if (includeTagArray.length > 0 && excludeTagArray.length > 0) {
      // Both include and exclude: filter included content to remove excluded
      const excludedSet = new Set(excludedContentIds);
      contentIds = includedContentIds.filter((id) => !excludedSet.has(id));
    } else if (includeTagArray.length > 0) {
      // Only include: use included content
      contentIds = includedContentIds;
    } else {
      // Only exclude: would need to query all content in group/parent first
      // For now, return empty if only exclude tags are specified without include tags
      // This prevents accidentally returning all content
      return [];
    }

    if (contentIds.length === 0) {
      return []; // No content matching the filter criteria
    }

    // Step 4: Get the full content with all tags (not just the filtered tags)
    let query = supabase
      .from("content")
      .select(
        `
        *,
        content_tags!left (
          tags (
            id,
            created_at,
            name,
            color,
            user_id
          )
        )
      `,
      )
      .eq("group_id", groupId)
      .in("id", contentIds);

    // Filter by parent
    if (parentId === null) {
      query.is("parent_content_id", null);
    } else {
      query.eq("parent_content_id", parentId);
    }

    // Apply ordering based on view mode
    switch (viewMode) {
      case "chronological":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "alphabetical":
        query = query.order("data", { ascending: true });
        break;
      case "random":
        // Will shuffle client-side below
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching content:", error);
      throw new Error(error.message);
    }

    // Transform the data to include tags properly
    let contentWithTags =
      data?.map((item) => ({
        ...item,
        tags:
          (item as any).content_tags
            ?.map((ct: any) => ct.tags)
            .filter(Boolean) || [],
      })) || [];

    // Fetch child counts for all content items in a single query
    if (contentWithTags.length > 0) {
      const contentIds = contentWithTags.map((item) => item.id);
      const { data: childCounts, error: countError } = await supabase
        .from("content")
        .select("parent_content_id")
        .in("parent_content_id", contentIds);

      if (!countError && childCounts) {
        // Create a map of parent_id -> child_count
        const countMap = new Map<string, number>();
        childCounts.forEach((child) => {
          const parentId = child.parent_content_id;
          if (parentId) {
            countMap.set(parentId, (countMap.get(parentId) || 0) + 1);
          }
        });

        // Add child_count to each content item
        contentWithTags = contentWithTags.map((item) => ({
          ...item,
          child_count: countMap.get(item.id) || 0,
        }));
      }
    }

    // Apply random shuffle if in random mode
    if (viewMode === "random" && contentWithTags.length > 0) {
      // Use seeded random based on group ID for consistent randomization within session
      const seed = groupId
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = this.seededRandom(seed + offset);
      contentWithTags = contentWithTags.sort(() => random() - 0.5);
    }

    return contentWithTags;
  }

  async getContentById(id: string): Promise<Content | null> {
    const { data, error } = await supabase
      .from("content")
      .select(
        `
        *,
        content_tags!left (
          tags (
            id,
            created_at,
            name,
            color,
            user_id
          )
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("Error fetching content:", error);
      throw new Error(error.message);
    }

    // Transform the data to include tags properly
    const contentWithTags = {
      ...data,
      tags:
        (data as any).content_tags?.map((ct: any) => ct.tags).filter(Boolean) ||
        [],
    };

    return contentWithTags;
  }

  async serializeContentWithChildren(
    contentId: string,
  ): Promise<SerializedContent> {
    // Fetch the main content item
    const content = await this.getContentById(contentId);
    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Fetch direct children of this content
    const { data: children, error } = await supabase
      .from("content")
      .select("id, type, data, metadata")
      .eq("parent_content_id", contentId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching content children:", error);
      throw new Error(error.message);
    }

    // Return serialized structure
    return {
      id: content.id,
      type: content.type,
      data: content.data,
      metadata: content.metadata,
      children: (children || []).map((child) => ({
        id: child.id,
        type: child.type,
        data: child.data,
        metadata: child.metadata,
      })),
    };
  }

  async searchContent(
    groupId: string,
    searchQuery: string,
    parentId: string | null = null,
    offset = 0,
    limit = 20,
    viewMode:
      | "chronological"
      | "random"
      | "alphabetical"
      | "oldest" = "chronological",
  ): Promise<Content[]> {
    // Use the new fuzzy search function for more forgiving search results
    // Falls back to the original search_content if fuzzy search is not available
    let data, error;

    try {
      // Try fuzzy search first (requires migration 20250826195340_improve_fuzzy_search.sql)
      const fuzzyResult = await supabase.rpc("search_content_fuzzy", {
        search_query: searchQuery,
        group_uuid: groupId,
        result_limit: limit + offset, // Get all results up to the desired page
      });

      data = fuzzyResult.data;
      error = fuzzyResult.error;
    } catch (fuzzyError) {
      console.warn(
        "Fuzzy search not available, falling back to exact search:",
        fuzzyError,
      );

      // Fallback to original search function
      const exactResult = await supabase.rpc("search_content", {
        search_query: searchQuery,
        group_uuid: groupId,
        result_limit: limit + offset, // Get all results up to the desired page
      });

      data = exactResult.data;
      error = exactResult.error;
    }

    if (error) {
      console.error("Error searching content:", error);
      throw new Error(error.message);
    }

    let results = data || [];

    // If we have a parent context, filter results to only show children of that parent
    if (parentId !== null) {
      results = results.filter(
        (item: Content) => item.parent_content_id === parentId,
      );
    } else {
      // If no parent context, only show top-level items
      results = results.filter(
        (item: Content) => item.parent_content_id === null,
      );
    }

    // Apply ordering based on view mode (search results are pre-ranked by relevance)
    switch (viewMode) {
      case "chronological":
        results.sort(
          (a: Content, b: Content) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case "oldest":
        results.sort(
          (a: Content, b: Content) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        break;
      case "alphabetical":
        results.sort((a: Content, b: Content) => a.data.localeCompare(b.data));
        break;
      case "random":
        // Use seeded random for consistent results
        const seed = groupId
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const random = this.seededRandom(seed + offset);
        results.sort(() => random() - 0.5);
        break;
    }

    // Apply pagination - slice the results to get the requested page
    const paginatedResults = results.slice(offset, offset + limit);

    // For each result, fetch and attach tags
    const contentWithTags = await Promise.all(
      paginatedResults.map(async (item: Content) => {
        try {
          const tags = await this.getTagsForContent(item.id);
          return { ...item, tags };
        } catch (error) {
          console.warn("Error fetching tags for content:", error);
          return { ...item, tags: [] };
        }
      }),
    );

    return contentWithTags;
  }

  async updateContent(id: string, updates: Partial<Content>): Promise<Content> {
    const { data, error } = await supabase
      .from("content")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating content:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async generateUrlPreview(
    contentId: string,
    url: string,
  ): Promise<{ success: boolean; screenshot_url?: string; error?: string }> {
    try {
      const response = await LambdaClient.invoke({
        action: "generate-screenshot",
        payload: { content_id: contentId, url },
        sync: true,
      });

      if (!response.success) {
        return { success: false, error: response.error || "Unknown error" };
      }

      return {
        success: true,
        screenshot_url: response.data?.screenshot_url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  async updateContentUrlPreview(
    contentId: string,
    screenshotUrl: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("content")
      .update({
        metadata: supabase.rpc("jsonb_set_nested", {
          target: "metadata",
          path: ["screenshot_url"],
          value: screenshotUrl,
        }),
      })
      .eq("id", contentId);

    if (error) {
      // Fallback: fetch content, merge metadata, update
      const { data: content } = await supabase
        .from("content")
        .select("metadata")
        .eq("id", contentId)
        .single();

      await supabase
        .from("content")
        .update({
          metadata: {
            ...(content?.metadata || {}),
            screenshot_url: screenshotUrl,
          },
        })
        .eq("id", contentId);
    }
  }

  async deleteContent(id: string): Promise<void> {
    const { error } = await supabase.from("content").delete().eq("id", id);

    if (error) {
      console.error("Error deleting content:", error);
      throw new Error(error.message);
    }
  }

  async bulkDeleteContent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await supabase.from("content").delete().in("id", ids);

    if (error) {
      console.error("Error bulk deleting content:", error);
      throw new Error(error.message);
    }
  }

  async deleteImage(fileUrl: string): Promise<void> {
    // Extract the path from the storage URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const urlParts = fileUrl.split("/storage/v1/object/public/");
    if (urlParts.length !== 2) {
      console.warn("Invalid storage URL format:", fileUrl);
      return;
    }

    const pathParts = urlParts[1].split("/");
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join("/");

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error("Error deleting image:", error);
      throw new Error(error.message);
    }
  }

  async uploadFile(file: File, contentId: string): Promise<string> {
    const bucket = "content";

    // Sanitize filename: replace invalid chars with underscore, collapse multiples
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");

    const filePath = `${contentId}/${sanitizedName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async copyContentToGroup(
    contentIds: string[],
    targetGroupId: string,
    copyTags: boolean = true,
  ): Promise<Content[]> {
    if (contentIds.length === 0) return [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const copiedContent: Content[] = [];

      // Process each content item
      for (const contentId of contentIds) {
        // Fetch the content item with tags
        const content = await this.getContentById(contentId);
        if (!content) {
          console.warn(`Content ${contentId} not found, skipping`);
          continue;
        }

        // Create copy metadata
        const copyMetadata = {
          ...content.metadata,
          copied_from_content_id: content.id,
          copied_from_group_id: content.group_id,
          copied_at: new Date().toISOString(),
        };

        // Create the content copy
        const { data: newContent, error: createError } = await supabase
          .from("content")
          .insert([
            {
              type: content.type,
              data: content.data,
              group_id: targetGroupId,
              parent_content_id: null, // Always create as top-level item
              metadata: copyMetadata,
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error(`Error copying content ${contentId}:`, createError);
          throw new Error(`Failed to copy content: ${createError.message}`);
        }

        // Copy tags if requested
        if (copyTags && content.tags && content.tags.length > 0) {
          const tagInserts = content.tags.map((tag) => ({
            content_id: newContent.id,
            tag_id: tag.id,
          }));

          const { error: tagError } = await supabase
            .from("content_tags")
            .insert(tagInserts);

          if (tagError) {
            console.warn(
              `Error copying tags for content ${contentId}:`,
              tagError,
            );
            // Don't fail the entire operation if tag copying fails
          }
        }

        copiedContent.push(newContent);
      }

      return copiedContent;
    } catch (error) {
      console.error("Error copying content to group:", error);
      throw error;
    }
  }

  // Group methods
  async createGroup(name: string): Promise<Group> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from("groups")
          .insert([{ name }])
          .select()
          .single();
      });

      if (error) {
        console.error("Error creating group:", error);
        throw new Error(error.message);
      }

      // Automatically add the creator as a member
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("group_memberships")
          .insert([{ user_id: user.id, group_id: data.id, role: "admin" }]);

        // Create the first invite code for the group creator
        await this.createUserInviteCode(data.id);
      }

      return data;
    } catch (error) {
      console.error("Failed to create group after retries:", error);
      throw error;
    }
  }

  async joinGroupWithUserCode(
    inviteCode: string,
  ): Promise<Group & { inviter?: { user_id: string } }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc("join_group_with_user_code", {
          p_invite_code: inviteCode,
        });
      });

      if (error) {
        console.error("Error joining group:", error);
        throw new Error("Failed to join group");
      }

      if (!data.success) {
        if (data.status === "invalid_code") {
          throw new Error("Invalid or expired invite code");
        }
        if (data.status === "own_code") {
          throw new Error("You cannot use your own invite code");
        }
        throw new Error(data.message || "Failed to join group");
      }

      // Fetch the full group details
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", data.group.id)
        .single();

      if (groupError) {
        console.error("Error fetching group details:", groupError);
        throw new Error("Failed to fetch group details");
      }

      return {
        ...group,
        alreadyMember: data.status === "already_member",
        inviter: data.inviter,
      } as Group & { alreadyMember?: boolean; inviter?: { user_id: string } };
    } catch (error) {
      console.error("Failed to join group after retries:", error);
      throw error;
    }
  }

  async getUserGroups(): Promise<Group[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await withRetry(async () => {
        return await supabase
          .from("group_memberships")
          .select(
            `
            group_id,
            groups (
              id,
              created_at,
              name,
              join_code,
              created_by
            )
          `,
          )
          .eq("user_id", user.id);
      });

      if (error) {
        console.error("Error fetching user groups:", error);
        throw new Error(error.message);
      }

      return data?.map((item) => (item as any).groups).filter(Boolean) || [];
    } catch (error) {
      console.error("Failed to fetch groups after retries:", error);
      throw error;
    }
  }

  async getGroupById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("Error fetching group:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async leaveGroup(groupId: string): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { error } = await withRetry(async () => {
        return await supabase
          .from("group_memberships")
          .delete()
          .eq("user_id", user.id)
          .eq("group_id", groupId);
      });

      if (error) {
        console.error("Error leaving group:", error);
        throw new Error("Failed to leave group");
      }
    } catch (error) {
      console.error("Failed to leave group after retries:", error);
      throw error;
    }
  }

  // Tag methods
  async createTag(name: string, color?: string): Promise<Tag> {
    // Get current user ID for RLS policy
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User must be authenticated to create tags");
    }

    const { data, error } = await supabase
      .from("tags")
      .insert([{ name: name.toLowerCase(), color, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async searchTags(query: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .ilike("name", `%${query.toLowerCase()}%`)
      .limit(10);

    if (error) {
      console.error("Error searching tags:", error);
      throw new Error(error.message);
    }

    return data || [];
  }

  async addTagToContent(contentId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from("content_tags")
      .upsert([{ content_id: contentId, tag_id: tagId }], {
        onConflict: "content_id,tag_id",
      });

    if (error) {
      console.error("Error adding tag to content:", error);
      throw new Error(error.message);
    }
  }

  async removeTagFromContent(contentId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from("content_tags")
      .delete()
      .eq("content_id", contentId)
      .eq("tag_id", tagId);

    if (error) {
      console.error("Error removing tag from content:", error);
      throw new Error(error.message);
    }
  }

  async getTagsForContent(contentId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from("content_tags")
      .select(
        `
        tags (
          id,
          created_at,
          name,
          color,
          user_id
        )
      `,
      )
      .eq("content_id", contentId);

    if (error) {
      console.error("Error fetching tags for content:", error);
      throw new Error(error.message);
    }

    return data?.map((item) => (item as any).tags).filter(Boolean) || [];
  }

  async getTagsForGroup(groupId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from("content_tags")
      .select(
        `
        tags (
          id,
          created_at,
          name,
          color,
          user_id
        ),
        content!inner (
          group_id
        )
      `,
      )
      .eq("content.group_id", groupId);

    if (error) {
      console.error("Error fetching tags for group:", error);
      throw new Error(error.message);
    }

    // Extract unique tags (deduplicate by tag id)
    const tagMap = new Map<string, Tag>();
    data?.forEach((item) => {
      const tag = (item as any).tags;
      if (tag && !tagMap.has(tag.id)) {
        tagMap.set(tag.id, tag);
      }
    });

    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async getTagFiltersForGroup(groupId: string): Promise<Content[]> {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("group_id", groupId)
      .eq("type", "tag-filter")
      .is("parent_content_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tag filters for group:", error);
      throw new Error(error.message);
    }

    return data || [];
  }

  // User methods
  async createOrUpdateUser(id: string, username?: string): Promise<User> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from("users")
          .upsert([{ id, username }], {
            onConflict: "id",
          })
          .select()
          .single();
      });

      if (error) {
        console.error("Error creating/updating user:", error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error("Failed to create/update user after retries:", error);
      throw error;
    }
  }

  // Invite methods for the new graph system
  async createUserInviteCode(
    groupId: string,
    maxUses: number = 50,
    expiresAt?: string,
  ): Promise<UserInviteCode> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc("create_user_invite_code", {
          p_group_id: groupId,
          p_max_uses: maxUses,
          p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        });
      });

      if (error) {
        console.error("Error creating invite code:", error);
        throw new Error("Failed to create invite code");
      }

      if (!data.success) {
        if (data.status === "already_exists") {
          throw new Error(
            "You already have an active invite code for this group",
          );
        }
        throw new Error(data.message || "Failed to create invite code");
      }

      return data.data as UserInviteCode;
    } catch (error) {
      console.error("Failed to create invite code after retries:", error);
      throw error;
    }
  }

  async getUserInviteCodes(groupId?: string): Promise<InviteStats[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc("get_user_invite_stats", {
          p_group_id: groupId || null,
        });
      });

      if (error) {
        console.error("Error fetching invite stats:", error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch invite stats after retries:", error);
      throw error;
    }
  }

  async getInviteGraph(groupId: string): Promise<InviteGraphNode[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc("get_invite_graph", {
          p_group_id: groupId,
        });
      });

      if (error) {
        console.error("Error fetching invite graph:", error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch invite graph after retries:", error);
      throw error;
    }
  }

  async deactivateInviteCode(inviteCodeId: string): Promise<void> {
    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from("user_invite_codes")
          .update({ is_active: false })
          .eq("id", inviteCodeId);
      });

      if (error) {
        console.error("Error deactivating invite code:", error);
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("Failed to deactivate invite code after retries:", error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToGroupContent(groupId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`content:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content",
          filter: `group_id=eq.${groupId}`,
        },
        callback,
      )
      .subscribe();
  }

  subscribeToContentTags(groupId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`content_tags:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_tags",
        },
        callback,
      )
      .subscribe();
  }

  // SEO extraction functionality using consolidated content function
  async extractSEOInformation(
    contentId: string,
    useQueue: boolean = false,
  ): Promise<{
    seo_children: Content[];
    urls_processed: number;
    total_urls_found: number;
    message: string;
    queued?: boolean;
  }> {
    try {
      // Get the content item to extract URLs from
      const contentItem = await this.getContentById(contentId);
      if (!contentItem) {
        throw new Error("Content not found");
      }

      const result = await LambdaClient.invoke({
        action: "seo-extract",
        payload: {
          selectedContent: [contentItem],
        },
        sync: !useQueue,
      });

      if (!result.success) {
        throw new Error(result.error || "SEO extraction failed");
      }

      if (result.queued) {
        return {
          seo_children: [],
          urls_processed: 0,
          total_urls_found: 0,
          message: "SEO extraction queued for processing",
          queued: true,
        };
      }

      // Process the response data for immediate processing
      const data = result.data?.[0];
      if (data) {
        return {
          seo_children: data.seo_children || [],
          urls_processed: data.urls_processed || 0,
          total_urls_found: data.total_urls_found || 0,
          message: `Processed ${data.urls_processed} of ${data.total_urls_found} URLs`,
        };
      }

      return {
        seo_children: [],
        urls_processed: 0,
        total_urls_found: 0,
        message: "No URLs found to process",
      };
    } catch (error) {
      console.error("Failed to extract SEO information:", error);
      throw error;
    }
  }

  // Get SEO children for a piece of content
  async getSEOChildren(contentId: string): Promise<Content[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from("content")
          .select("*")
          .eq("parent_content_id", contentId)
          .eq("type", "seo")
          .order("created_at", { ascending: false });
      });

      if (error) {
        console.error("Error fetching SEO children:", error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch SEO children:", error);
      throw error;
    }
  }

  // YouTube playlist extraction functionality using consolidated content function
  async extractYouTubePlaylist(contentId: string): Promise<{
    content_id: string;
    success: boolean;
    playlists_found: number;
    videos_created: number;
    playlist_children?: Content[];
    errors?: string[];
  }> {
    try {
      // Get the content item to extract playlists from
      const contentItem = await this.getContentById(contentId);
      if (!contentItem) {
        throw new Error("Content not found");
      }

      const result = await LambdaClient.invoke({
        action: "youtube-playlist-extract",
        payload: {
          selectedContent: [contentItem],
        },
      });

      if (!result.success) {
        throw new Error(result.error || "YouTube playlist extraction failed");
      }

      // Process the response data
      const data = result.data?.[0];
      if (data) {
        return {
          content_id: data.content_id || contentId,
          success: data.success || false,
          playlists_found: data.playlists_found || 0,
          videos_created: data.videos_created || 0,
          playlist_children: data.playlist_children || [],
          errors: data.errors || [],
        };
      }

      return {
        content_id: contentId,
        success: true,
        playlists_found: 0,
        videos_created: 0,
        playlist_children: [],
        errors: [],
      };
    } catch (error) {
      console.error("Failed to extract YouTube playlist:", error);
      throw error;
    }
  }

  // YouTube subtitle extraction functionality using consolidated content function
  async extractYouTubeSubtitles(contentId: string): Promise<{
    content_id: string;
    success: boolean;
    video_id?: string;
    tracks_found: number;
    transcript_content_ids?: string[];
    error?: string;
  }> {
    try {
      // Get the content item to extract subtitles from
      const contentItem = await this.getContentById(contentId);
      if (!contentItem) {
        throw new Error("Content not found");
      }

      const result = await LambdaClient.invoke({
        action: "youtube-subtitle-extract",
        payload: {
          selectedContent: [contentItem],
        },
      });

      if (!result.success) {
        throw new Error(result.error || "YouTube subtitle extraction failed");
      }

      // Process the response data
      const data = result.data?.[0];
      if (data) {
        return {
          content_id: data.content_id || contentId,
          success: data.success || false,
          video_id: data.video_id,
          tracks_found: data.tracks_found || 0,
          transcript_content_ids: data.transcript_content_ids || [],
          error: data.error,
        };
      }

      return {
        content_id: contentId,
        success: true,
        tracks_found: 0,
        transcript_content_ids: [],
      };
    } catch (error) {
      console.error("Failed to extract YouTube subtitles:", error);
      throw error;
    }
  }

  /**
   * Extract YouTube transcripts for multiple videos (batch processing with queue support)
   * Creates transcript content items as children of the video content
   */
  async extractYouTubeTranscripts(
    selectedContent: Content[],
    useQueue: boolean = true,
  ): Promise<{
    success: boolean;
    data: Array<{
      content_id: string;
      success: boolean;
      video_id?: string;
      tracks_found?: number;
      transcript_content_ids?: string[];
      error?: string;
    }>;
    error?: string;
    queued?: boolean;
  }> {
    try {
      const result = await LambdaClient.invoke({
        action: "youtube-subtitle-extract",
        payload: {
          selectedContent,
        },
        sync: !useQueue,
      });

      if (!result.success) {
        throw new Error(result.error || "YouTube transcript extraction failed");
      }

      if (result.queued) {
        return {
          success: true,
          data: [],
          queued: true,
        };
      }

      return {
        success: true,
        data: result.data || [],
      };
    } catch (error) {
      console.error("Failed to extract YouTube transcripts:", error);
      return {
        success: false,
        data: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

// Export singleton instance
export const contentRepository = new ContentRepository();
