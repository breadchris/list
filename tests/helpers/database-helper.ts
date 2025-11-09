import { createClient } from '@supabase/supabase-js';
import { TestUserWithInvites, TestGroupWithInvites, TestInviteCode, TestInvitation, InvitationChain } from './invite-test-data';

// Local Supabase configuration for tests
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
// Service role key for admin operations (local development)
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/**
 * Database helper for invite graph system testing
 */
export class DatabaseHelper {
  private supabase;
  private adminClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Create test user in database
   */
  async createTestUser(user: TestUserWithInvites): Promise<string> {
    console.log(`Creating test user: ${user.email}`);
    console.log(`Using password: ${user.password.substring(0, 4)}***`);

    // Use signUp for local Supabase (which has auto-confirm enabled)
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: {
          username: user.username || null
        }
      }
    });

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`);
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('Failed to get user ID after signup');
    }

    console.log(`User created with ID: ${userId}`);

    // Wait for user to be confirmed and ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify user is confirmed via admin API
    const { data: adminUserData, error: adminError } = await this.adminClient.auth.admin.getUserById(userId);
    if (adminError) {
      console.warn('Could not verify user via admin API:', adminError);
    } else {
      console.log(`User email confirmed: ${!!adminUserData.user.email_confirmed_at}`);
    }

    // Test if we can sign in with this user
    const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (signInError) {
      console.warn(`⚠️ Cannot sign in with created user: ${signInError.message}`);
    } else {
      console.log(`✅ Successfully verified sign in for: ${user.email}`);
      // Sign out immediately
      await this.supabase.auth.signOut();
    }

    // Create public.users record using admin client (bypasses RLS)
    const { error: insertError } = await this.adminClient
      .from('users')
      .insert([{
        id: userId,
        username: user.username || null
      }]);

    if (insertError) {
      // Ignore duplicate key errors - record may already exist
      if (!insertError.message.includes('duplicate key')) {
        console.warn('Failed to create public.users record:', insertError);
      }
    } else {
      console.log(`Public users record created for: ${userId}`);
    }

    return userId;
  }

  /**
   * Verify user is ready for authentication
   */
  async verifyUserReadyForAuth(email: string): Promise<boolean> {
    try {
      const { data, error } = await this.adminClient.auth.admin.listUsers();

      if (error) {
        console.warn('Failed to list users for verification:', error);
        return false;
      }

      const user = data.users.find(u => u.email === email);
      if (!user) {
        console.warn(`User not found: ${email}`);
        return false;
      }

      const isEmailConfirmed = !!user.email_confirmed_at;
      console.log(`User ${email} email confirmed: ${isEmailConfirmed}`);

      return isEmailConfirmed;
    } catch (error) {
      console.warn('Error verifying user:', error);
      return false;
    }
  }

  /**
   * Create test group in database
   */
  async createTestGroup(group: TestGroupWithInvites, createdBy?: string): Promise<string> {
    // Use admin client to bypass RLS policies
    const { data, error } = await this.adminClient
      .from('groups')
      .insert([{
        name: group.name,
        created_by: createdBy
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test group: ${error.message}`);
    }

    console.log(`Created test group: ${data.id}`);
    return data.id;
  }

  /**
   * Add user to group membership
   */
  async addGroupMember(userId: string, groupId: string, role: string = 'member'): Promise<void> {
    // Use admin client to bypass RLS policies
    const { error } = await this.adminClient
      .from('group_memberships')
      .insert([{
        user_id: userId,
        group_id: groupId,
        role
      }]);

    if (error) {
      throw new Error(`Failed to add group member: ${error.message}`);
    }
  }

  /**
   * Create invite code in database
   */
  async createInviteCode(inviteCode: TestInviteCode): Promise<string> {
    const { data, error } = await this.supabase
      .from('user_invite_codes')
      .insert([{
        user_id: inviteCode.user_id,
        group_id: inviteCode.group_id,
        invite_code: inviteCode.invite_code,
        max_uses: inviteCode.max_uses || 50,
        current_uses: inviteCode.current_uses || 0,
        is_active: inviteCode.is_active !== false,
        expires_at: inviteCode.expires_at
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invite code: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Create invitation relationship in database
   */
  async createInvitation(invitation: TestInvitation): Promise<string> {
    const { data, error } = await this.supabase
      .from('group_invitations')
      .insert([{
        group_id: invitation.group_id,
        inviter_user_id: invitation.inviter_user_id,
        invitee_user_id: invitation.invitee_user_id,
        invite_code_used: invitation.invite_code_used,
        joined_at: invitation.joined_at || new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Set up complete invitation chain in database
   */
  async setupInvitationChain(chain: InvitationChain): Promise<{
    userIds: string[];
    groupId: string;
    inviteCodeIds: string[];
    invitationIds: string[];
  }> {
    const userIds: string[] = [];
    const inviteCodeIds: string[] = [];
    const invitationIds: string[] = [];

    // Create users
    for (const user of chain.users) {
      const userId = await this.createTestUser(user);
      userIds.push(userId);
      user.id = userId; // Update the object with actual ID
    }

    // Create group
    const groupId = await this.createTestGroup(chain.group, chain.users[0]?.id);
    chain.group.id = groupId;

    // Add all users to group
    for (let i = 0; i < userIds.length; i++) {
      const role = i === 0 ? 'admin' : 'member'; // First user is admin (creator)
      await this.addGroupMember(userIds[i], groupId, role);
    }

    // Create invite codes
    for (const user of chain.users) {
      if (user.inviteCodes && user.inviteCodes.length > 0) {
        for (const code of user.inviteCodes) {
          code.user_id = user.id!;
          code.group_id = groupId;
          const codeId = await this.createInviteCode(code);
          inviteCodeIds.push(codeId);
        }
      }
    }

    // Create invitations
    for (const invitation of chain.invitations) {
      invitation.group_id = groupId;
      // Find user IDs based on the chain setup
      const inviterIndex = chain.users.findIndex(u => u.id === invitation.inviter_user_id);
      const inviteeIndex = chain.users.findIndex(u => u.id === invitation.invitee_user_id);

      if (inviterIndex >= 0 && inviteeIndex >= 0) {
        invitation.inviter_user_id = userIds[inviterIndex];
        invitation.invitee_user_id = userIds[inviteeIndex];
        const invitationId = await this.createInvitation(invitation);
        invitationIds.push(invitationId);
      }
    }

    return {
      userIds,
      groupId,
      inviteCodeIds,
      invitationIds
    };
  }

  /**
   * Verify invite code exists and has correct properties
   */
  async verifyInviteCode(inviteCode: string, expectedProperties: Partial<TestInviteCode>): Promise<void> {
    const { data, error } = await this.supabase
      .from('user_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (error) {
      throw new Error(`Failed to find invite code: ${error.message}`);
    }

    if (expectedProperties.current_uses !== undefined && data.current_uses !== expectedProperties.current_uses) {
      throw new Error(`Expected current_uses ${expectedProperties.current_uses}, got ${data.current_uses}`);
    }

    if (expectedProperties.is_active !== undefined && data.is_active !== expectedProperties.is_active) {
      throw new Error(`Expected is_active ${expectedProperties.is_active}, got ${data.is_active}`);
    }

    if (expectedProperties.max_uses !== undefined && data.max_uses !== expectedProperties.max_uses) {
      throw new Error(`Expected max_uses ${expectedProperties.max_uses}, got ${data.max_uses}`);
    }
  }

  /**
   * Verify invitation relationship exists
   */
  async verifyInvitation(inviterUserId: string, inviteeUserId: string, groupId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('group_invitations')
      .select('*')
      .eq('inviter_user_id', inviterUserId)
      .eq('invitee_user_id', inviteeUserId)
      .eq('group_id', groupId)
      .single();

    if (error) {
      throw new Error(`Failed to find invitation relationship: ${error.message}`);
    }

    if (!data) {
      throw new Error('Invitation relationship not found');
    }
  }

  /**
   * Get invite graph for group
   */
  async getInviteGraph(groupId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('get_invite_graph', { p_group_id: groupId });

    if (error) {
      throw new Error(`Failed to get invite graph: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user invite stats
   */
  async getUserInviteStats(userId: string, groupId?: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('get_user_invite_stats', {
        p_user_id: userId,
        p_group_id: groupId || null
      });

    if (error) {
      throw new Error(`Failed to get user invite stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(testIds: {
    userIds?: string[];
    groupIds?: string[];
    inviteCodeIds?: string[];
    invitationIds?: string[];
  }): Promise<void> {
    try {
      // Clean up invitations first (due to foreign key constraints)
      if (testIds.invitationIds && testIds.invitationIds.length > 0) {
        await this.supabase
          .from('group_invitations')
          .delete()
          .in('id', testIds.invitationIds);
      }

      // Clean up invite codes
      if (testIds.inviteCodeIds && testIds.inviteCodeIds.length > 0) {
        await this.supabase
          .from('user_invite_codes')
          .delete()
          .in('id', testIds.inviteCodeIds);
      }

      // Clean up group memberships (will be cascade deleted with groups)

      // Clean up groups
      if (testIds.groupIds && testIds.groupIds.length > 0) {
        await this.supabase
          .from('groups')
          .delete()
          .in('id', testIds.groupIds);
      }

      // Note: Users are typically cleaned up by auth system, but we can attempt cleanup
      if (testIds.userIds && testIds.userIds.length > 0) {
        await this.supabase
          .from('users')
          .delete()
          .in('id', testIds.userIds);
      }
    } catch (error) {
      console.warn('Error during test cleanup:', error);
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Count group members
   */
  async countGroupMembers(groupId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('group_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (error) {
      throw new Error(`Failed to count group members: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Verify user is group member
   */
  async verifyGroupMembership(userId: string, groupId: string, expectedRole?: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('group_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (error) {
      throw new Error(`Failed to verify group membership: ${error.message}`);
    }

    if (!data) {
      throw new Error('User is not a member of the group');
    }

    if (expectedRole && data.role !== expectedRole) {
      throw new Error(`Expected role ${expectedRole}, got ${data.role}`);
    }
  }

  /**
   * Update invite code usage
   */
  async updateInviteCodeUsage(inviteCode: string, newUsageCount: number): Promise<void> {
    const { error } = await this.supabase
      .from('user_invite_codes')
      .update({ current_uses: newUsageCount })
      .eq('invite_code', inviteCode);

    if (error) {
      throw new Error(`Failed to update invite code usage: ${error.message}`);
    }
  }

  /**
   * Deactivate invite code
   */
  async deactivateInviteCode(inviteCode: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_invite_codes')
      .update({ is_active: false })
      .eq('invite_code', inviteCode);

    if (error) {
      throw new Error(`Failed to deactivate invite code: ${error.message}`);
    }
  }

  /**
   * Create test content in database
   */
  async createTestContent(content: {
    type: string;
    data: string;
    group_id: string;
    user_id: string;
    parent_content_id: string | null;
    metadata?: any;
  }): Promise<string> {
    const { data, error } = await this.adminClient
      .from('content')
      .insert([content])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test content: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Delete test content from database
   */
  async deleteTestContent(contentId: string): Promise<void> {
    // First delete child content
    const { error: childError } = await this.adminClient
      .from('content')
      .delete()
      .eq('parent_content_id', contentId);

    if (childError) {
      console.warn('Failed to delete child content:', childError);
    }

    // Then delete the content itself
    const { error } = await this.adminClient
      .from('content')
      .delete()
      .eq('id', contentId);

    if (error) {
      throw new Error(`Failed to delete test content: ${error.message}`);
    }
  }

  /**
   * Get content by parent ID
   */
  async getContentByParentId(parentContentId: string): Promise<any[]> {
    const { data, error } = await this.adminClient
      .from('content')
      .select('*')
      .eq('parent_content_id', parentContentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get content by parent ID: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get Claude Code session metadata for content
   */
  async getClaudeCodeSession(contentId: string): Promise<{
    session_id: string;
    s3_url?: string;
    initial_prompt: string;
    created_at: string;
    last_updated_at?: string;
  } | null> {
    const { data, error } = await this.adminClient
      .from('content')
      .select('metadata')
      .eq('id', contentId)
      .single();

    if (error) {
      console.warn('Failed to get Claude Code session:', error);
      return null;
    }

    return data?.metadata?.claude_code_session || null;
  }

  /**
   * Delete test user from auth system
   */
  async deleteTestUser(userId: string): Promise<void> {
    try {
      // Use admin client to delete user from auth
      const { error } = await this.adminClient.auth.admin.deleteUser(userId);

      if (error) {
        console.warn('Failed to delete test user from auth:', error);
      }

      // Also clean up from users table
      await this.adminClient
        .from('users')
        .delete()
        .eq('id', userId);
    } catch (error) {
      console.warn('Error during test user deletion:', error);
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Delete test group from database
   */
  async deleteTestGroup(groupId: string): Promise<void> {
    try {
      // Delete group memberships first
      await this.adminClient
        .from('group_memberships')
        .delete()
        .eq('group_id', groupId);

      // Delete the group
      const { error } = await this.adminClient
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) {
        console.warn('Failed to delete test group:', error);
      }
    } catch (error) {
      console.warn('Error during test group deletion:', error);
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(contentId: string): Promise<any | null> {
    const { data, error } = await this.adminClient
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error) {
      console.warn('Failed to get content by ID:', error);
      return null;
    }

    return data;
  }

  /**
   * Get chat messages (content with role metadata) for a chat container
   */
  async getChatMessages(chatId: string): Promise<any[]> {
    const { data, error} = await this.adminClient
      .from('content')
      .select('*')
      .eq('parent_content_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get chat messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get the last assistant message in a chat
   */
  async getLastAssistantMessage(chatId: string): Promise<any | null> {
    const messages = await this.getChatMessages(chatId);
    const assistantMessages = messages.filter(m => m.metadata?.role === 'assistant');

    if (assistantMessages.length === 0) {
      return null;
    }

    return assistantMessages[assistantMessages.length - 1];
  }

  /**
   * Count messages with a specific role in a chat
   */
  async countMessagesByRole(chatId: string, role: 'user' | 'assistant'): Promise<number> {
    const messages = await this.getChatMessages(chatId);
    return messages.filter(m => m.metadata?.role === role).length;
  }

  /**
   * Wait for assistant message to be created and contain content
   * Polls the database until a non-empty assistant message appears
   */
  async waitForAssistantResponse(
    chatId: string,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const assistantMessage = await this.getLastAssistantMessage(chatId);

      if (assistantMessage && assistantMessage.data && assistantMessage.data.length > 0) {
        // Found a non-empty assistant message
        return assistantMessage;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Timeout waiting for assistant response in chat ${chatId}`);
  }

  /**
   * Verify chat structure is correct
   */
  async verifyChatStructure(chatId: string): Promise<{
    isValid: boolean;
    errors: string[];
    chatContainer: any;
    messages: any[];
    userMessages: any[];
    assistantMessages: any[];
  }> {
    const errors: string[] = [];

    // Get chat container
    const chatContainer = await this.getContentById(chatId);
    if (!chatContainer) {
      errors.push('Chat container not found');
      return {
        isValid: false,
        errors,
        chatContainer: null,
        messages: [],
        userMessages: [],
        assistantMessages: []
      };
    }

    if (chatContainer.type !== 'chat') {
      errors.push(`Expected type 'chat', got '${chatContainer.type}'`);
    }

    // Get messages
    const messages = await this.getChatMessages(chatId);
    const userMessages = messages.filter(m => m.metadata?.role === 'user');
    const assistantMessages = messages.filter(m => m.metadata?.role === 'assistant');

    // Validation
    if (messages.length === 0) {
      errors.push('No messages found in chat');
    }

    if (userMessages.length === 0) {
      errors.push('No user messages found');
    }

    if (assistantMessages.length === 0) {
      errors.push('No assistant messages found');
    }

    // Check metadata
    for (const msg of messages) {
      if (!msg.metadata || !msg.metadata.role) {
        errors.push(`Message ${msg.id} missing role in metadata`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      chatContainer,
      messages,
      userMessages,
      assistantMessages
    };
  }
}