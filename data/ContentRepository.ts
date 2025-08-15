import { supabase } from './SupabaseClient';

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
  reply_count: number;
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

  async getContentByGroup(groupId: string, offset = 0, limit = 20): Promise<Content[]> {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('group_id', groupId)
      .is('parent_content_id', null) // Only top-level content
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching content:', error);
      throw new Error(error.message);
    }

    return data || [];
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
    // Generate a unique join code
    const joinCode = await this.generateJoinCode();
    
    const { data, error } = await supabase
      .from('groups')
      .insert([{ name, join_code: joinCode }])
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      throw new Error(error.message);
    }

    // Automatically add the creator as a member
    await this.joinGroupByCode(joinCode);

    return data;
  }

  async joinGroupByCode(joinCode: string): Promise<Group> {
    // First find the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .single();

    if (groupError) {
      console.error('Error finding group:', groupError);
      throw new Error('Invalid join code');
    }

    // Add user to group if not already a member
    const { error: membershipError } = await supabase
      .from('group_memberships')
      .upsert([{ 
        group_id: group.id,
        role: 'member'
      }], {
        onConflict: 'user_id,group_id'
      });

    if (membershipError) {
      console.error('Error joining group:', membershipError);
      throw new Error(membershipError.message);
    }

    return group;
  }

  async getUserGroups(): Promise<Group[]> {
    const { data, error } = await supabase
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

    if (error) {
      console.error('Error fetching user groups:', error);
      throw new Error(error.message);
    }

    return data?.map(item => (item as any).groups).filter(Boolean) || [];
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

  // User methods
  async createOrUpdateUser(id: string, username?: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .upsert([{ id, username }], {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating user:', error);
      throw new Error(error.message);
    }

    return data;
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
}

// Export singleton instance
export const contentRepository = new ContentRepository();