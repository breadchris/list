import { supabase, withRetry } from './SupabaseClient';

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
  join_code: string;
  created_by?: string;
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

  async getContentByParent(groupId: string, parentId: string | null, offset = 0, limit = 20): Promise<Content[]> {
    const query = supabase
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
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Use different filter based on whether parentId is null
    if (parentId === null) {
      query.is('parent_content_id', null);
    } else {
      query.eq('parent_content_id', parentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching content:', error);
      throw new Error(error.message);
    }

    // Transform the data to include tags properly
    const contentWithTags = data?.map(item => ({
      ...item,
      tags: (item as any).content_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
    })) || [];

    return contentWithTags;
  }

  async getContentById(id: string): Promise<Content | null> {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching content:', error);
      throw new Error(error.message);
    }

    return data;
  }

  async searchContent(groupId: string, searchQuery: string, parentId: string | null = null, offset = 0, limit = 20): Promise<Content[]> {
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

  // Group methods
  async createGroup(name: string): Promise<Group> {
    try {
      // Generate a unique join code
      const joinCode = await this.generateJoinCode();
      
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('groups')
          .insert([{ name, join_code: joinCode }])
          .select()
          .single();
      });

      if (error) {
        console.error('Error creating group:', error);
        throw new Error(error.message);
      }

      // Automatically add the creator as a member
      await this.joinGroupByCode(joinCode);

      return data;
    } catch (error) {
      console.error('Failed to create group after retries:', error);
      throw error;
    }
  }

  async joinGroupByCode(joinCode: string): Promise<Group> {
    try {
      // Use the safe join function that checks for existing membership
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('join_group_safe', {
          p_join_code: joinCode
        });
      });

      if (error) {
        console.error('Error joining group:', error);
        throw new Error('Failed to join group');
      }

      if (!data.success) {
        // Handle specific error cases
        if (data.status === 'invalid_code') {
          throw new Error('Invalid join code');
        }
        throw new Error(data.message || 'Failed to join group');
      }

      // Check if user was already a member
      if (data.status === 'already_member') {
        // Still fetch and return the group, but the caller can check the status
        const { data: group, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', data.group.id)
          .single();
        
        if (groupError) {
          console.error('Error fetching group details:', groupError);
          throw new Error('Failed to fetch group details');
        }

        // Add a flag to indicate the user was already a member
        return { ...group, alreadyMember: true } as Group & { alreadyMember?: boolean };
      }

      // Fetch the full group details for newly joined members
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', data.group.id)
        .single();
      
      if (groupError) {
        console.error('Error fetching group details:', groupError);
        throw new Error('Failed to fetch group details');
      }

      return group;
    } catch (error) {
      console.error('Failed to join group after retries:', error);
      throw error;
    }
  }

  async getUserGroups(): Promise<Group[]> {
    try {
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
          `);
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

  // Tag methods
  async createTag(name: string, color?: string): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .insert([{ name: name.toLowerCase(), color }])
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

  // Utility methods
  private async generateJoinCode(): Promise<string> {
    // Generate a 6-character random code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists
    const { data } = await supabase
      .from('groups')
      .select('id')
      .eq('join_code', result)
      .single();

    // If code exists, generate a new one
    if (data) {
      return this.generateJoinCode();
    }

    return result;
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

  // SEO extraction functionality
  async extractSEOInformation(contentId: string): Promise<{
    seo_children: Content[],
    urls_processed: number,
    total_urls_found: number,
    message: string
  }> {
    try {
      // Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/extract-seo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content_id: contentId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result;
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
        parent_content_id: null, // Simplified for public view
        tags: [] // Tags not exposed for public content
      };
    } catch (error) {
      console.error('Failed to fetch public content:', error);
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
}

// Export singleton instance
export const contentRepository = new ContentRepository();