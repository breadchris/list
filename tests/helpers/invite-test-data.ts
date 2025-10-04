/**
 * Test data helpers for invite graph system testing
 */

export interface TestUserWithInvites {
  email: string;
  password: string;
  id?: string;
  username?: string;
  inviteCodes?: TestInviteCode[];
}

export interface TestInviteCode {
  id?: string;
  invite_code: string;
  group_id: string;
  user_id: string;
  max_uses?: number;
  current_uses?: number;
  is_active?: boolean;
  expires_at?: string;
}

export interface TestGroupWithInvites {
  id?: string;
  name: string;
  created_by?: string;
  inviteCodes?: TestInviteCode[];
  invitations?: TestInvitation[];
}

export interface TestInvitation {
  id?: string;
  group_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  invite_code_used: string;
  joined_at?: string;
}

export interface InvitationChain {
  users: TestUserWithInvites[];
  group: TestGroupWithInvites;
  invitations: TestInvitation[];
}

/**
 * Generate unique test email for invite testing
 */
export function generateInviteTestEmail(prefix: string = 'inviteuser'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}@invite.test.dev`;
}

/**
 * Generate test invite code
 */
export function generateTestInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create test user with invite capabilities
 */
export function createTestUserWithInvites(prefix: string = 'inviteuser'): TestUserWithInvites {
  return {
    email: generateInviteTestEmail(prefix),
    password: 'InviteTest123',
    username: `${prefix}_${Date.now()}`,
    inviteCodes: []
  };
}

/**
 * Create test group for invite testing
 */
export function createTestGroupWithInvites(name: string = 'Invite Test Group'): TestGroupWithInvites {
  const timestamp = Date.now();
  return {
    name: `${name} ${timestamp}`,
    inviteCodes: [],
    invitations: []
  };
}

/**
 * Create a simple invitation chain: A → B → C
 */
export function createSimpleInvitationChain(): InvitationChain {
  const userA = createTestUserWithInvites('creator');
  const userB = createTestUserWithInvites('invitee1');
  const userC = createTestUserWithInvites('invitee2');

  const group = createTestGroupWithInvites('Chain Test Group');

  const inviteCodeA = generateTestInviteCode();
  const inviteCodeB = generateTestInviteCode();

  // User A creates the group and gets an invite code
  userA.inviteCodes = [{
    invite_code: inviteCodeA,
    group_id: group.id || '',
    user_id: userA.id || '',
    max_uses: 50,
    current_uses: 1,
    is_active: true
  }];

  // User B gets invited by A and creates their own invite code
  userB.inviteCodes = [{
    invite_code: inviteCodeB,
    group_id: group.id || '',
    user_id: userB.id || '',
    max_uses: 50,
    current_uses: 1,
    is_active: true
  }];

  const invitations: TestInvitation[] = [
    {
      group_id: group.id || '',
      inviter_user_id: userA.id || '',
      invitee_user_id: userB.id || '',
      invite_code_used: inviteCodeA
    },
    {
      group_id: group.id || '',
      inviter_user_id: userB.id || '',
      invitee_user_id: userC.id || '',
      invite_code_used: inviteCodeB
    }
  ];

  return {
    users: [userA, userB, userC],
    group,
    invitations
  };
}

/**
 * Create a complex invitation tree: A → B, A → C, B → D, C → E
 */
export function createComplexInvitationTree(): InvitationChain {
  const userA = createTestUserWithInvites('root');
  const userB = createTestUserWithInvites('branch1');
  const userC = createTestUserWithInvites('branch2');
  const userD = createTestUserWithInvites('leaf1');
  const userE = createTestUserWithInvites('leaf2');

  const group = createTestGroupWithInvites('Tree Test Group');

  const inviteCodeA = generateTestInviteCode();
  const inviteCodeB = generateTestInviteCode();
  const inviteCodeC = generateTestInviteCode();

  // Assign invite codes
  userA.inviteCodes = [{
    invite_code: inviteCodeA,
    group_id: group.id || '',
    user_id: userA.id || '',
    max_uses: 50,
    current_uses: 2,
    is_active: true
  }];

  userB.inviteCodes = [{
    invite_code: inviteCodeB,
    group_id: group.id || '',
    user_id: userB.id || '',
    max_uses: 50,
    current_uses: 1,
    is_active: true
  }];

  userC.inviteCodes = [{
    invite_code: inviteCodeC,
    group_id: group.id || '',
    user_id: userC.id || '',
    max_uses: 50,
    current_uses: 1,
    is_active: true
  }];

  const invitations: TestInvitation[] = [
    {
      group_id: group.id || '',
      inviter_user_id: userA.id || '',
      invitee_user_id: userB.id || '',
      invite_code_used: inviteCodeA
    },
    {
      group_id: group.id || '',
      inviter_user_id: userA.id || '',
      invitee_user_id: userC.id || '',
      invite_code_used: inviteCodeA
    },
    {
      group_id: group.id || '',
      inviter_user_id: userB.id || '',
      invitee_user_id: userD.id || '',
      invite_code_used: inviteCodeB
    },
    {
      group_id: group.id || '',
      inviter_user_id: userC.id || '',
      invitee_user_id: userE.id || '',
      invite_code_used: inviteCodeC
    }
  ];

  return {
    users: [userA, userB, userC, userD, userE],
    group,
    invitations
  };
}

/**
 * Test scenarios for invite code validation
 */
export const INVITE_TEST_SCENARIOS = {
  VALID_CODE: generateTestInviteCode(),
  INVALID_CODE: 'INVALID',
  EXPIRED_CODE: 'EXPIRE',
  MAXED_OUT_CODE: 'MAXOUT',
  SELF_CODE: 'SELFCD',
  DEACTIVATED_CODE: 'DEACTV'
} as const;

/**
 * Predefined test users for invite system
 */
export const INVITE_TEST_USERS = {
  GROUP_CREATOR: createTestUserWithInvites('creator'),
  ACTIVE_INVITER: createTestUserWithInvites('inviter'),
  NEW_JOINEE: createTestUserWithInvites('joinee'),
  CHAIN_USER_1: createTestUserWithInvites('chain1'),
  CHAIN_USER_2: createTestUserWithInvites('chain2'),
  CHAIN_USER_3: createTestUserWithInvites('chain3')
} as const;

/**
 * Test groups for invite scenarios
 */
export const INVITE_TEST_GROUPS = {
  SIMPLE_GROUP: createTestGroupWithInvites('Simple Test Group'),
  CHAIN_GROUP: createTestGroupWithInvites('Chain Test Group'),
  TREE_GROUP: createTestGroupWithInvites('Tree Test Group'),
  EMPTY_GROUP: createTestGroupWithInvites('Empty Test Group')
} as const;

/**
 * Helper to create expired invite code
 */
export function createExpiredInviteCode(userId: string, groupId: string): TestInviteCode {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    invite_code: generateTestInviteCode(),
    group_id: groupId,
    user_id: userId,
    max_uses: 50,
    current_uses: 0,
    is_active: true,
    expires_at: yesterday.toISOString()
  };
}

/**
 * Helper to create maxed out invite code
 */
export function createMaxedOutInviteCode(userId: string, groupId: string): TestInviteCode {
  return {
    invite_code: generateTestInviteCode(),
    group_id: groupId,
    user_id: userId,
    max_uses: 1,
    current_uses: 1,
    is_active: true
  };
}

/**
 * Helper to create deactivated invite code
 */
export function createDeactivatedInviteCode(userId: string, groupId: string): TestInviteCode {
  return {
    invite_code: generateTestInviteCode(),
    group_id: groupId,
    user_id: userId,
    max_uses: 50,
    current_uses: 0,
    is_active: false
  };
}