import { supabase, withRetry } from './SupabaseClient';
import { LambdaClient } from './LambdaClient';

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

export interface ContentTag {
  content_id: string;
  tag_id: string;
  created_at: string;
}

// Content Repository class for data access
export class ContentRepository {
  // Content methods
  async createContent(content: {
    type: string;
    data: string;
    group_id: string;
    parent_content_id?: string;
  }): Promise<Content> {
    const { data, error } = await supabase
      .from('content')
      .insert([content])
      .select()
      .single();

    if (error) {
      console.error('Error creating content:', error);
      throw new Error(error.message);
    }

    return data;
  }

  async getContentByParent(
    groupId: string,
    parentId: string | null,
    offset = 0,
    limit = 20,
    viewMode: 'chronological' | 'random' | 'alphabetical' | 'oldest' = 'chronological'
  ): Promise<Content[]> {
    // First, get the content items with tags
    let query = supabase
      .from('content')
      .select(`
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
      `)
      .eq('group_id', groupId);

    // Use different filter based on whether parentId is null
    if (parentId === null) {
      query.is('parent_content_id', null);
    } else {
      query.eq('parent_content_id', parentId);
    }

    // Apply ordering based on view mode
    switch (viewMode) {
      case 'chronological':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'alphabetical':
        query = query.order('data', { ascending: true });
        break;
      case 'random':
        // For random mode, we'll fetch more items and shuffle client-side
        // This ensures pagination works consistently
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching content:', error);
      throw new Error(error.message);
    }

    // Transform the data to include tags properly
    let contentWithTags = data?.map(item => ({
      ...item,
      tags: (item as any).content_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
    })) || [];

    // Fetch child counts for all content items in a single query
    if (contentWithTags.length > 0) {
      const contentIds = contentWithTags.map(item => item.id);
      const { data: childCounts, error: countError } = await supabase
        .from('content')
        .select('parent_content_id')
        .in('parent_content_id', contentIds);

      if (!countError && childCounts) {
        // Create a map of parent_id -> child_count
        const countMap = new Map<string, number>();
        childCounts.forEach(child => {
          const parentId = child.parent_content_id;
          if (parentId) {
            countMap.set(parentId, (countMap.get(parentId) || 0) + 1);
          }
        });

        // Add child_count to each content item
        contentWithTags = contentWithTags.map(item => ({
          ...item,
          child_count: countMap.get(item.id) || 0
        }));
      }
    }

    // Apply random shuffle if in random mode
    if (viewMode === 'random' && contentWithTags.length > 0) {
      // Use seeded random based on group ID for consistent randomization within session
      const seed = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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

  async getContentById(id: string): Promise<Content | null> {
    const { data, error } = await supabase
      .from('content')
      .select(`
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
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching content:', error);
      throw new Error(error.message);
    }

    // Transform the data to include tags properly
    const contentWithTags = {
      ...data,
      tags: (data as any).content_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
    };

    return contentWithTags;
  }

  async searchContent(
    groupId: string,
    searchQuery: string,
    parentId: string | null = null,
    offset = 0,
    limit = 20,
    viewMode: 'chronological' | 'random' | 'alphabetical' | 'oldest' = 'chronological'
  ): Promise<Content[]> {
    // Use the new fuzzy search function for more forgiving search results
    // Falls back to the original search_content if fuzzy search is not available
    let data, error;

    try {
      // Try fuzzy search first (requires migration 20250826195340_improve_fuzzy_search.sql)
      const fuzzyResult = await supabase.rpc('search_content_fuzzy', {
        search_query: searchQuery,
        group_uuid: groupId,
        result_limit: limit + offset // Get all results up to the desired page
      });

      data = fuzzyResult.data;
      error = fuzzyResult.error;
    } catch (fuzzyError) {
      console.warn('Fuzzy search not available, falling back to exact search:', fuzzyError);

      // Fallback to original search function
      const exactResult = await supabase.rpc('search_content', {
        search_query: searchQuery,
        group_uuid: groupId,
        result_limit: limit + offset // Get all results up to the desired page
      });

      data = exactResult.data;
      error = exactResult.error;
    }

    if (error) {
      console.error('Error searching content:', error);
      throw new Error(error.message);
    }

    let results = data || [];

    // If we have a parent context, filter results to only show children of that parent
    if (parentId !== null) {
      results = results.filter((item: Content) => item.parent_content_id === parentId);
    } else {
      // If no parent context, only show top-level items
      results = results.filter((item: Content) => item.parent_content_id === null);
    }

    // Apply ordering based on view mode (search results are pre-ranked by relevance)
    switch (viewMode) {
      case 'chronological':
        results.sort((a: Content, b: Content) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'oldest':
        results.sort((a: Content, b: Content) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case 'alphabetical':
        results.sort((a: Content, b: Content) => a.data.localeCompare(b.data));
        break;
      case 'random':
        // Use seeded random for consistent results
        const seed = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
          console.warn('Error fetching tags for content:', error);
          return { ...item, tags: [] };
        }
      })
    );

    return contentWithTags;
  }

  async updateContent(id: string, updates: Partial<Content>): Promise<Content> {
    const { data, error } = await supabase
      .from('content')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating content:', error);
      throw new Error(error.message);
    }

    return data;
  }

  async deleteContent(id: string): Promise<void> {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting content:', error);
      throw new Error(error.message);
    }
  }

  async bulkDeleteContent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('content')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error bulk deleting content:', error);
      throw new Error(error.message);
    }
  }

  async copyContentToGroup(
    contentIds: string[],
    targetGroupId: string,
    copyTags: boolean = true
  ): Promise<Content[]> {
    if (contentIds.length === 0) return [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
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
          copied_at: new Date().toISOString()
        };

        // Create the content copy
        const { data: newContent, error: createError } = await supabase
          .from('content')
          .insert([{
            type: content.type,
            data: content.data,
            group_id: targetGroupId,
            parent_content_id: null, // Always create as top-level item
            metadata: copyMetadata
          }])
          .select()
          .single();

        if (createError) {
          console.error(`Error copying content ${contentId}:`, createError);
          throw new Error(`Failed to copy content: ${createError.message}`);
        }

        // Copy tags if requested
        if (copyTags && content.tags && content.tags.length > 0) {
          const tagInserts = content.tags.map(tag => ({
            content_id: newContent.id,
            tag_id: tag.id
          }));

          const { error: tagError } = await supabase
            .from('content_tags')
            .insert(tagInserts);

          if (tagError) {
            console.warn(`Error copying tags for content ${contentId}:`, tagError);
            // Don't fail the entire operation if tag copying fails
          }
        }

        copiedContent.push(newContent);
      }

      return copiedContent;
    } catch (error) {
      console.error('Error copying content to group:', error);
      throw error;
    }
  }

  // Group methods
  async createGroup(name: string): Promise<Group> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('groups')
          .insert([{ name }])
          .select()
          .single();
      });

      if (error) {
        console.error('Error creating group:', error);
        throw new Error(error.message);
      }

      // Automatically add the creator as a member
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('group_memberships')
          .insert([{ user_id: user.id, group_id: data.id, role: 'admin' }]);

        // Create the first invite code for the group creator
        await this.createUserInviteCode(data.id);
      }

      return data;
    } catch (error) {
      console.error('Failed to create group after retries:', error);
      throw error;
    }
  }

  async joinGroupWithUserCode(inviteCode: string): Promise<Group & { inviter?: { user_id: string } }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('join_group_with_user_code', {
          p_invite_code: inviteCode
        });
      });

      if (error) {
        console.error('Error joining group:', error);
        throw new Error('Failed to join group');
      }

      if (!data.success) {
        if (data.status === 'invalid_code') {
          throw new Error('Invalid or expired invite code');
        }
        if (data.status === 'own_code') {
          throw new Error('You cannot use your own invite code');
        }
        throw new Error(data.message || 'Failed to join group');
      }

      // Fetch the full group details
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', data.group.id)
        .single();

      if (groupError) {
        console.error('Error fetching group details:', groupError);
        throw new Error('Failed to fetch group details');
      }

      return {
        ...group,
        alreadyMember: data.status === 'already_member',
        inviter: data.inviter
      } as Group & { alreadyMember?: boolean; inviter?: { user_id: string } };
    } catch (error) {
      console.error('Failed to join group after retries:', error);
      throw error;
    }
  }

  async getUserGroups(): Promise<Group[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('group_memberships')
          .select(`
            group_id,
            groups (
              id,
              created_at,
              name,
              join_code,
              created_by
            )
          `)
          .eq('user_id', user.id);
      });

      if (error) {
        console.error('Error fetching user groups:', error);
        throw new Error(error.message);
      }

      return data?.map(item => (item as any).groups).filter(Boolean) || [];
    } catch (error) {
      console.error('Failed to fetch groups after retries:', error);
      throw error;
    }
  }

  async getGroupById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching group:', error);
      throw new Error(error.message);
    }

    return data;
  }

  async leaveGroup(groupId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await withRetry(async () => {
        return await supabase
          .from('group_memberships')
          .delete()
          .eq('user_id', user.id)
          .eq('group_id', groupId);
      });

      if (error) {
        console.error('Error leaving group:', error);
        throw new Error('Failed to leave group');
      }
    } catch (error) {
      console.error('Failed to leave group after retries:', error);
      throw error;
    }
  }

  // Tag methods
  async createTag(name: string, color?: string): Promise<Tag> {
    // Get current user ID for RLS policy
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to create tags');
    }

    const { data, error } = await supabase
      .from('tags')
      .insert([{ name: name.toLowerCase(), color, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error creating tag:', error);
      throw new Error(error.message);
    }

    return data;
  }

  async searchTags(query: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query.toLowerCase()}%`)
      .limit(10);

    if (error) {
      console.error('Error searching tags:', error);
      throw new Error(error.message);
    }

    return data || [];
  }

  async addTagToContent(contentId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('content_tags')
      .upsert([{ content_id: contentId, tag_id: tagId }], {
        onConflict: 'content_id,tag_id'
      });

    if (error) {
      console.error('Error adding tag to content:', error);
      throw new Error(error.message);
    }
  }

  async removeTagFromContent(contentId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('content_tags')
      .delete()
      .eq('content_id', contentId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Error removing tag from content:', error);
      throw new Error(error.message);
    }
  }

  async getTagsForContent(contentId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('content_tags')
      .select(`
        tags (
          id,
          created_at,
          name,
          color,
          user_id
        )
      `)
      .eq('content_id', contentId);

    if (error) {
      console.error('Error fetching tags for content:', error);
      throw new Error(error.message);
    }

    return data?.map(item => (item as any).tags).filter(Boolean) || [];
  }

  // User methods
  async createOrUpdateUser(id: string, username?: string): Promise<User> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('users')
          .upsert([{ id, username }], {
            onConflict: 'id'
          })
          .select()
          .single();
      });

      if (error) {
        console.error('Error creating/updating user:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to create/update user after retries:', error);
      throw error;
    }
  }

  // Invite methods for the new graph system
  async createUserInviteCode(groupId: string, maxUses: number = 50, expiresAt?: string): Promise<UserInviteCode> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('create_user_invite_code', {
          p_group_id: groupId,
          p_max_uses: maxUses,
          p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
        });
      });

      if (error) {
        console.error('Error creating invite code:', error);
        throw new Error('Failed to create invite code');
      }

      if (!data.success) {
        if (data.status === 'already_exists') {
          throw new Error('You already have an active invite code for this group');
        }
        throw new Error(data.message || 'Failed to create invite code');
      }

      return data.data as UserInviteCode;
    } catch (error) {
      console.error('Failed to create invite code after retries:', error);
      throw error;
    }
  }

  async getUserInviteCodes(groupId?: string): Promise<InviteStats[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_user_invite_stats', {
          p_group_id: groupId || null
        });
      });

      if (error) {
        console.error('Error fetching invite stats:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch invite stats after retries:', error);
      throw error;
    }
  }

  async getInviteGraph(groupId: string): Promise<InviteGraphNode[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_invite_graph', {
          p_group_id: groupId
        });
      });

      if (error) {
        console.error('Error fetching invite graph:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch invite graph after retries:', error);
      throw error;
    }
  }

  async deactivateInviteCode(inviteCodeId: string): Promise<void> {
    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('user_invite_codes')
          .update({ is_active: false })
          .eq('id', inviteCodeId);
      });

      if (error) {
        console.error('Error deactivating invite code:', error);
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to deactivate invite code after retries:', error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToGroupContent(groupId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`content:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
          filter: `group_id=eq.${groupId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToContentTags(groupId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`content_tags:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_tags',
        },
        callback
      )
      .subscribe();
  }

  // SEO extraction functionality using consolidated content function
  async extractSEOInformation(contentId: string, useQueue: boolean = false): Promise<{
    seo_children: Content[],
    urls_processed: number,
    total_urls_found: number,
    message: string,
    queued?: boolean
  }> {
    try {
      // Get the content item to extract URLs from
      const contentItem = await this.getContentById(contentId);
      if (!contentItem) {
        throw new Error('Content not found');
      }

      const result = await LambdaClient.invoke({
        action: 'seo-extract',
        payload: {
          selectedContent: [contentItem]
        },
        useQueue
      });

      if (!result.success) {
        throw new Error(result.error || 'SEO extraction failed');
      }

      if (result.queued) {
        return {
          seo_children: [],
          urls_processed: 0,
          total_urls_found: 0,
          message: 'SEO extraction queued for processing',
          queued: true
        };
      }

      // Process the response data for immediate processing
      const data = result.data?.[0];
      if (data) {
        return {
          seo_children: data.seo_children || [],
          urls_processed: data.urls_processed || 0,
          total_urls_found: data.total_urls_found || 0,
          message: `Processed ${data.urls_processed} of ${data.total_urls_found} URLs`
        };
      }

      return {
        seo_children: [],
        urls_processed: 0,
        total_urls_found: 0,
        message: 'No URLs found to process'
      };
    } catch (error) {
      console.error('Failed to extract SEO information:', error);
      throw error;
    }
  }

  // Get SEO children for a piece of content
  async getSEOChildren(contentId: string): Promise<Content[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('content')
          .select('*')
          .eq('parent_content_id', contentId)
          .eq('type', 'seo')
          .order('created_at', { ascending: false });
      });

      if (error) {
        console.error('Error fetching SEO children:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch SEO children:', error);
      throw error;
    }
  }

  // YouTube playlist extraction functionality using consolidated content function
  async extractYouTubePlaylist(contentId: string): Promise<{
    content_id: string,
    success: boolean,
    playlists_found: number,
    videos_created: number,
    playlist_children?: Content[],
    errors?: string[]
  }> {
    try {
      // Get the content item to extract playlists from
      const contentItem = await this.getContentById(contentId);
      if (!contentItem) {
        throw new Error('Content not found');
      }

      const result = await LambdaClient.invoke({
        action: 'youtube-playlist-extract',
        payload: {
          selectedContent: [contentItem]
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'YouTube playlist extraction failed');
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
          errors: data.errors || []
        };
      }

      return {
        content_id: contentId,
        success: true,
        playlists_found: 0,
        videos_created: 0,
        playlist_children: [],
        errors: []
      };
    } catch (error) {
      console.error('Failed to extract YouTube playlist:', error);
      throw error;
    }
  }

  // TMDb search functionality (search-only mode)
  async searchTMDb(contentId: string, searchType: 'movie' | 'tv' | 'multi' = 'multi', searchQuery?: string): Promise<{
    content_id: string,
    success: boolean,
    results: Array<{
      tmdb_id: number,
      media_type: string,
      title: string,
      year: string,
      overview: string,
      poster_url: string | null,
      backdrop_url: string | null,
      vote_average: number,
      vote_count: number,
      popularity: number
    }>,
    total_results: number,
    errors?: string[]
  }> {
    try {
      let contentItem: Content;

      if (searchQuery) {
        // Create temp content object with search query
        contentItem = {
          id: contentId,
          data: searchQuery,
          type: 'text',
          group_id: '', // Not needed for search-only mode
          user_id: '', // Not needed for search-only mode
          parent_content_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          has_children: false,
          is_public: false
        };
      } else {
        // Fetch from database as before
        contentItem = await this.getContentById(contentId);
        if (!contentItem) {
          throw new Error('Content not found');
        }
      }

      const result = await LambdaClient.invoke({
        action: 'tmdb-search',
        payload: {
          selectedContent: [contentItem],
          searchType,
          mode: 'search-only'
        },
        sync: true  // Execute immediately and return search results
      });

      if (!result.success) {
        throw new Error(result.error || 'TMDb search failed');
      }

      const data = result.data?.[0];
      if (data) {
        return {
          content_id: data.content_id || contentId,
          success: data.success || false,
          results: data.tmdb_results || [],
          total_results: data.total_results || 0,
          errors: data.errors || []
        };
      }

      return {
        content_id: contentId,
        success: true,
        results: [],
        total_results: 0,
        errors: []
      };
    } catch (error) {
      console.error('Failed to search TMDb:', error);
      throw error;
    }
  }

  // TMDb add selected results functionality (add-selected mode)
  async addTMDbResults(groupId: string, tmdbIds: number[], searchType: 'movie' | 'tv' | 'multi' = 'multi'): Promise<{
    content_id: string,
    success: boolean,
    results_created: number,
    tmdb_children?: Content[],
    errors?: string[]
  }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create a minimal content object representing the group context
      // The Lambda will create new content items in this group
      const contentItem: Content = {
        id: '', // Not used - Lambda will create new UUIDs
        data: '', // Not used for add-selected mode
        type: 'text',
        group_id: groupId,
        user_id: user.id,
        parent_content_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_children: false,
        is_public: false
      };

      const result = await LambdaClient.invoke({
        action: 'tmdb-search',
        payload: {
          selectedContent: [contentItem],
          searchType,
          mode: 'add-selected',
          selectedResults: tmdbIds
        },
        sync: true  // Execute immediately for user feedback
      });

      if (!result.success) {
        throw new Error(result.error || 'TMDb add results failed');
      }

      const data = result.data?.[0];
      if (data) {
        return {
          content_id: data.content_id || '',
          success: data.success || false,
          results_created: data.results_created || 0,
          tmdb_children: data.tmdb_children || [],
          errors: data.errors || []
        };
      }

      return {
        content_id: '',
        success: true,
        results_created: 0,
        tmdb_children: [],
        errors: []
      };
    } catch (error) {
      console.error('Failed to add TMDb results:', error);
      throw error;
    }
  }

  // Libgen Book Search
  async searchLibgen(
    selectedContent: Content[],
    searchType?: 'default' | 'title' | 'author',
    topics?: string[],
    filters?: Record<string, string>,
    maxResults?: number
  ): Promise<{
    success: boolean;
    data: Array<{
      content_id: string;
      success: boolean;
      books_found: number;
      books_created: number;
      error?: string;
    }>;
  }> {
    try {
      // Call Lambda content endpoint
      const response = await LambdaClient.invoke({
        action: 'libgen-search',
        payload: {
          selectedContent,
          searchType: searchType || 'default',
          topics: topics || ['libgen'],
          filters,
          maxResults: maxResults || 10
        },
        sync: true  // Execute immediately for user feedback
      });

      if (!response.success) {
        throw new Error(response.error || 'Libgen search failed');
      }

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to search Libgen:', error);
      throw error;
    }
  }

  // Public Content Sharing Methods

  // Toggle content public sharing
  async toggleContentSharing(contentId: string, isPublic: boolean): Promise<SharingResponse> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('toggle_content_sharing', {
        content_id: contentId,
        is_public: isPublic,
        user_id: user.id
      });

      if (error) {
        console.error('Error toggling content sharing:', error);
        throw new Error(error.message);
      }

      return data as SharingResponse;
    } catch (error) {
      console.error('Failed to toggle content sharing:', error);
      throw error;
    }
  }

  // Get public content by ID (accessible to anonymous users)
  async getPublicContent(contentId: string): Promise<Content | null> {
    try {
      const { data, error } = await supabase
        .from('public_content')
        .select(`
          id,
          created_at,
          updated_at,
          type,
          data,
          metadata,
          parent_content_id,
          shared_at,
          shared_by
        `)
        .eq('id', contentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found or not public
          return null;
        }
        console.error('Error fetching public content:', error);
        throw new Error(error.message);
      }

      return {
        ...data,
        group_id: '', // Not exposed for public content
        user_id: data.shared_by || '', // Use shared_by as user_id
        parent_content_id: data.parent_content_id || null,
        tags: [] // Tags not exposed for public content
      };
    } catch (error) {
      console.error('Failed to fetch public content:', error);
      throw error;
    }
  }

  // Get public content children (accessible to anonymous users)
  async getPublicContentChildren(parentId: string): Promise<Content[]> {
    try {
      const { data, error } = await supabase
        .from('public_content')
        .select(`
          id,
          created_at,
          updated_at,
          type,
          data,
          metadata,
          parent_content_id,
          shared_at,
          shared_by
        `)
        .eq('parent_content_id', parentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching public content children:', error);
        throw new Error(error.message);
      }

      return (data || []).map(item => ({
        ...item,
        group_id: '', // Not exposed for public content
        user_id: item.shared_by || '', // Use shared_by as user_id
        parent_content_id: item.parent_content_id || null,
        tags: [] // Tags not exposed for public content
      }));
    } catch (error) {
      console.error('Failed to fetch public content children:', error);
      throw error;
    }
  }

  // Get sharing status for content
  async getContentSharingStatus(contentId: string): Promise<{ isPublic: boolean; publicUrl?: string }> {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('metadata')
        .eq('id', contentId)
        .single();

      if (error) {
        console.error('Error fetching content sharing status:', error);
        throw new Error(error.message);
      }

      const sharingData = data.metadata?.sharing as SharingMetadata;
      const isPublic = sharingData?.isPublic || false;
      
      let publicUrl: string | undefined;
      if (isPublic) {
        // Generate public URL
        publicUrl = `${window.location.origin}/public/content/${contentId}`;
      }

      return {
        isPublic,
        publicUrl
      };
    } catch (error) {
      console.error('Failed to fetch content sharing status:', error);
      throw error;
    }
  }

  // Check if user can modify content sharing (must be owner)
  async canModifyContentSharing(contentId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      const { data, error } = await supabase
        .from('content')
        .select('user_id')
        .eq('id', contentId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.user_id === user.id;
    } catch (error) {
      console.error('Failed to check content sharing permissions:', error);
      return false;
    }
  }

  // URL Preview / Screenshot functionality using consolidated content function
  async generateUrlPreview(contentId: string, url: string, useQueue: boolean = true): Promise<{ success: boolean; screenshot_url?: string; error?: string; queued?: boolean; job_id?: string; status?: string }> {
    try {
      console.log(`Generating URL preview for content ${contentId} with URL: ${url}`);

      const result = await LambdaClient.invoke({
        action: 'screenshot-queue',
        payload: {
          jobs: [{
            contentId: contentId,
            url: url
          }]
        }
      });

      if (!result.success && !result.job_id) {
        console.error('Screenshot generation failed:', result.error);
        return {
          success: false,
          error: result.error || 'Screenshot generation failed'
        };
      }

      // Job was queued successfully
      if (result.job_id) {
        console.log(`Screenshot job queued for content ${contentId}: ${result.job_id}`);
        return {
          success: true,
          queued: true,
          job_id: result.job_id,
          status: result.status || 'pending'
        };
      }

      if (result.queued) {
        console.log(`Screenshot job queued for content ${contentId}`);
        return {
          success: true,
          queued: true
        };
      }

      // For immediate processing (if useQueue was false), we'd get the result here
      console.log(`Screenshot processing initiated for content ${contentId}`);
      return {
        success: true,
        queued: result.queued || false
      };
    } catch (error) {
      console.error('Failed to generate URL preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Batch screenshot generation for multiple URLs
  async generateBatchUrlPreviews(jobs: Array<{ contentId: string; url: string }>): Promise<{ success: boolean; error?: string; queued?: boolean; jobCount?: number }> {
    try {
      console.log(`Generating batch URL previews for ${jobs.length} jobs`);

      const result = await LambdaClient.invoke({
        action: 'screenshot-queue',
        payload: {
          jobs: jobs
        }
      });

      if (!result.success) {
        console.error('Batch screenshot generation failed:', result.error);
        return {
          success: false,
          error: result.error || 'Batch screenshot generation failed'
        };
      }

      console.log(`${jobs.length} screenshot jobs queued successfully`);
      return {
        success: true,
        queued: true,
        jobCount: jobs.length
      };
    } catch (error) {
      console.error('Failed to generate batch URL previews:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Update content metadata with URL preview
  async updateContentUrlPreview(contentId: string, screenshotUrl: string): Promise<void> {
    try {
      // First get current metadata
      const { data: content, error: fetchError } = await supabase
        .from('content')
        .select('metadata')
        .eq('id', contentId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch content: ${fetchError.message}`);
      }

      // Update metadata with url_preview
      const updatedMetadata = {
        ...content.metadata,
        url_preview: screenshotUrl
      };

      const { error: updateError } = await supabase
        .from('content')
        .update({ metadata: updatedMetadata })
        .eq('id', contentId);

      if (updateError) {
        throw new Error(`Failed to update metadata: ${updateError.message}`);
      }

      console.log(`Updated content ${contentId} with url_preview: ${screenshotUrl}`);
    } catch (error) {
      console.error('Failed to update content URL preview:', error);
      throw error;
    }
  }

  // Job Status Query Methods

  /**
   * Get all active jobs for a group (optimized - single query)
   * More efficient than querying per content item
   */
  async getActiveJobsForGroup(groupId: string, statusFilter?: string[]): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('content_processing_jobs')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching active jobs for group:', error);
      return [];
    }
  }

  /**
   * Get all jobs related to a specific content item
   */
  async getJobsForContent(contentId: string, statusFilter?: string[]): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('content_processing_jobs')
        .select('*')
        .contains('content_ids', [contentId])
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching jobs for content:', error);
      return [];
    }
  }

  /**
   * Subscribe to job status updates for a specific content item
   * Returns unsubscribe function
   */
  subscribeToContentJobs(
    contentId: string,
    callback: (job: any) => void
  ): () => void {
    const channel = supabase
      .channel(`content-jobs-${contentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_processing_jobs'
        },
        (payload) => {
          // Client-side filter for this specific content
          const job = payload.new as any;
          if (job.content_ids && Array.isArray(job.content_ids) && job.content_ids.includes(contentId)) {
            callback(job);
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Claude Code Session Management Methods

  /**
   * Store Claude Code session metadata in content
   */
  async storeClaudeCodeSession(
    contentId: string,
    sessionData: {
      session_id: string;
      s3_url?: string;
      r2_url?: string; // Deprecated - kept for backward compatibility
      initial_prompt: string;
      last_updated_at?: string;
    }
  ): Promise<void> {
    try {
      // First get current metadata
      const { data: content, error: fetchError } = await supabase
        .from('content')
        .select('metadata')
        .eq('id', contentId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch content: ${fetchError.message}`);
      }

      // Update metadata with Claude Code session
      const updatedMetadata = {
        ...content.metadata,
        claude_code_session: {
          session_id: sessionData.session_id,
          s3_url: sessionData.s3_url,
          r2_url: sessionData.r2_url, // Keep for backward compatibility
          initial_prompt: sessionData.initial_prompt,
          created_at: content.metadata?.claude_code_session?.created_at || new Date().toISOString(),
          last_updated_at: sessionData.last_updated_at || new Date().toISOString()
        }
      };

      const { error: updateError } = await supabase
        .from('content')
        .update({ metadata: updatedMetadata })
        .eq('id', contentId);

      if (updateError) {
        throw new Error(`Failed to update metadata: ${updateError.message}`);
      }

      console.log(`Stored Claude Code session for content ${contentId}:`, sessionData.session_id);
    } catch (error) {
      console.error('Failed to store Claude Code session:', error);
      throw error;
    }
  }

  /**
   * Get Claude Code session from content or traverse up to parent
   */
  async getClaudeCodeSession(contentId: string): Promise<{
    session_id: string;
    s3_url?: string;
    r2_url?: string; // Deprecated - kept for backward compatibility
    initial_prompt: string;
    created_at: string;
    last_updated_at?: string;
  } | null> {
    try {
      let currentContentId: string | null = contentId;
      let depth = 0;
      const maxDepth = 10; // Prevent infinite loops

      while (currentContentId && depth < maxDepth) {
        const content = await this.getContentById(currentContentId);

        if (!content) {
          return null;
        }

        // Check if this content has a Claude Code session
        if (content.metadata?.claude_code_session) {
          const session = content.metadata.claude_code_session;

          // Validate session has required fields - support both s3_url (new) and r2_url (legacy)
          if (session.session_id && (session.s3_url || session.r2_url)) {
            return {
              session_id: session.session_id,
              s3_url: session.s3_url,
              r2_url: session.r2_url, // Keep for backward compatibility
              initial_prompt: session.initial_prompt || '',
              created_at: session.created_at || new Date().toISOString(),
              last_updated_at: session.last_updated_at
            };
          }
        }

        // Move up to parent
        currentContentId = content.parent_content_id || null;
        depth++;
      }

      return null;
    } catch (error) {
      console.error('Failed to get Claude Code session:', error);
      return null;
    }
  }

  /**
   * Check if content or its ancestors have a Claude Code session
   */
  async hasClaudeCodeSession(contentId: string): Promise<boolean> {
    const session = await this.getClaudeCodeSession(contentId);
    return session !== null;
  }

  // Image Upload Methods

  /**
   * Upload an image to Supabase storage with content UUID prefix
   * Path pattern: <content-uuid>/<filename>
   * Returns the public URL of the uploaded image
   */
  async uploadImage(file: File, contentId: string): Promise<string> {
    try {
      // Generate filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}.${fileExtension}`;

      // Path pattern: <content-uuid>/<filename>
      const filePath = `${contentId}/${fileName}`;

      console.log(`Uploading image to: ${filePath}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('content')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('content')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Image uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Supabase storage
   * Extracts the path from the public URL and deletes the file
   */
  async deleteImage(publicUrl: string): Promise<void> {
    try {
      // Extract the path from the public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/content/<path>
      const urlParts = publicUrl.split('/content/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid image URL format');
      }

      const filePath = urlParts[1];

      const { error } = await supabase
        .storage
        .from('content')
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete image: ${error.message}`);
      }

      console.log(`Image deleted successfully: ${filePath}`);
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  }

  /**
   * Upload an epub file to Supabase storage
   * Path pattern: <content-uuid>/book.epub
   * Returns the public URL of the uploaded epub
   */
  async uploadEpub(file: File, contentId: string): Promise<string> {
    try {
      // Path pattern: <content-uuid>/book.epub
      const filePath = `${contentId}/book.epub`;

      console.log(`Uploading epub to: ${filePath}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('content')
        .upload(filePath, file, {
          contentType: 'application/epub+zip',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload epub: ${uploadError.message}`);
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('content')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Epub uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload epub:', error);
      throw error;
    }
  }

  /**
   * Upload an audio file to Supabase storage
   * Path pattern: <content-uuid>/<timestamp>.<ext>
   * Returns the public URL of the uploaded audio
   */
  async uploadAudio(file: File, contentId: string): Promise<string> {
    try {
      // Generate filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'mp3';
      const fileName = `${timestamp}.${fileExtension}`;

      // Path pattern: <content-uuid>/<filename>
      const filePath = `${contentId}/${fileName}`;

      console.log(`Uploading audio to: ${filePath}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('content')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload audio: ${uploadError.message}`);
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('content')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Audio uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload audio:', error);
      throw error;
    }
  }

  // Job Management Methods

  /**
   * Get a specific job by ID
   */
  async getJob(job_id: string): Promise<any> {
    try {
      const result = await LambdaClient.invoke({
        action: 'get-job',
        payload: {
          job_id
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to get job');
      }

      return result.job;
    } catch (error) {
      console.error('Failed to get job:', error);
      throw error;
    }
  }

  /**
   * List jobs for the current user
   */
  async listJobs(params?: {
    status?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const result = await LambdaClient.invoke({
        action: 'list-jobs',
        payload: {
          user_id: user.id,
          ...params
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to list jobs');
      }

      return result.jobs || [];
    } catch (error) {
      console.error('Failed to list jobs:', error);
      throw error;
    }
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(job_id: string): Promise<boolean> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const result = await LambdaClient.invoke({
        action: 'cancel-job',
        payload: {
          job_id,
          user_id: user.id
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel job');
      }

      return result.cancelled;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  }

  /**
   * Subscribe to job updates for realtime notifications
   */
  subscribeToJobs(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`jobs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_processing_jobs',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
}

// Export singleton instance
export const contentRepository = new ContentRepository();