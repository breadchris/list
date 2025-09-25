import { createClient } from '@supabase/supabase-js';
import { TestUserWithInvites, TestGroupWithInvites, TestInviteCode, TestInvitation, InvitationChain } from './invite-test-data';

// Local Supabase configuration for tests
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * Database helper for invite graph system testing
 */
export class DatabaseHelper {
  private supabase;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  /**
   * Create test user in database
   */
  async createTestUser(user: TestUserWithInvites): Promise<string> {
    // Sign up the user
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: user.email,
      password: user.password,
    });

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`);
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('Failed to get user ID after signup');
    }

    // Update user record with username if provided
    if (user.username) {
      const { error: updateError } = await this.supabase
        .from('users')
        .update({ username: user.username })
        .eq('id', userId);

      if (updateError) {
        console.warn('Failed to update username:', updateError);
      }
    }

    return userId;
  }

  /**
   * Create test group in database
   */
  async createTestGroup(group: TestGroupWithInvites, createdBy?: string): Promise<string> {
    const { data, error } = await this.supabase
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

    return data.id;
  }

  /**
   * Add user to group membership
   */
  async addGroupMember(userId: string, groupId: string, role: string = 'member'): Promise<void> {
    const { error } = await this.supabase
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
}