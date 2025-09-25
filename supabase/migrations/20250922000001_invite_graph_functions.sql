-- Database functions for the invite graph system

-- Function to generate unique user invite codes
CREATE OR REPLACE FUNCTION public.generate_user_invite_code(
  p_user_id UUID,
  p_group_id UUID
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
  attempt_count INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_group_id IS NULL THEN
    RAISE EXCEPTION 'User ID and Group ID cannot be null';
  END IF;

  -- Check if user is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE user_id = p_user_id AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Generate unique code
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;

    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM user_invite_codes WHERE invite_code = result) THEN
      EXIT;
    END IF;

    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique invite code after % attempts', max_attempts;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- Function to create a user invite code
CREATE OR REPLACE FUNCTION public.create_user_invite_code(
  p_user_id UUID DEFAULT auth.uid(),
  p_group_id UUID DEFAULT NULL,
  p_max_uses INTEGER DEFAULT 50,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_code TEXT;
  v_new_code RECORD;
BEGIN
  -- Validate user is authenticated
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'User not authenticated'
    );
  END IF;

  -- Validate group_id is provided
  IF p_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'Group ID is required'
    );
  END IF;

  -- Check if user already has an active invite code for this group
  IF EXISTS (
    SELECT 1 FROM user_invite_codes
    WHERE user_id = p_user_id
    AND group_id = p_group_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'already_exists',
      'message', 'User already has an active invite code for this group'
    );
  END IF;

  -- Generate the invite code
  v_invite_code := generate_user_invite_code(p_user_id, p_group_id);

  -- Insert the new invite code
  INSERT INTO user_invite_codes (user_id, group_id, invite_code, max_uses, expires_at)
  VALUES (p_user_id, p_group_id, v_invite_code, p_max_uses, p_expires_at)
  RETURNING * INTO v_new_code;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'created',
    'invite_code', v_new_code.invite_code,
    'data', row_to_json(v_new_code)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'Failed to create invite code: ' || SQLERRM
    );
END;
$$;

-- Function to join group with user invite code
CREATE OR REPLACE FUNCTION public.join_group_with_user_code(
  p_invite_code TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_record RECORD;
  v_group_record RECORD;
  v_existing_membership RECORD;
  v_new_membership RECORD;
BEGIN
  -- Validate user is authenticated
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'User not authenticated'
    );
  END IF;

  -- Find the invite code
  SELECT uic.*, g.name as group_name
  INTO v_invite_record
  FROM user_invite_codes uic
  JOIN groups g ON g.id = uic.group_id
  WHERE uic.invite_code = UPPER(p_invite_code)
  AND uic.is_active = true
  AND (uic.expires_at IS NULL OR uic.expires_at > now())
  AND (uic.max_uses IS NULL OR uic.current_uses < uic.max_uses);

  -- Check if invite code exists and is valid
  IF v_invite_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_code',
      'message', 'Invalid or expired invite code'
    );
  END IF;

  -- Prevent users from using their own invite codes
  IF v_invite_record.user_id = p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'own_code',
      'message', 'You cannot use your own invite code'
    );
  END IF;

  -- Check if user is already a member
  SELECT * INTO v_existing_membership
  FROM group_memberships
  WHERE user_id = p_user_id AND group_id = v_invite_record.group_id;

  IF v_existing_membership.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_member',
      'message', 'You are already a member of this group',
      'group', jsonb_build_object(
        'id', v_invite_record.group_id,
        'name', v_invite_record.group_name,
        'joined_at', v_existing_membership.created_at,
        'role', v_existing_membership.role
      )
    );
  END IF;

  -- Add user to the group
  INSERT INTO group_memberships (user_id, group_id, role)
  VALUES (p_user_id, v_invite_record.group_id, 'member')
  RETURNING * INTO v_new_membership;

  -- Record the invitation relationship
  INSERT INTO group_invitations (group_id, inviter_user_id, invitee_user_id, invite_code_used)
  VALUES (v_invite_record.group_id, v_invite_record.user_id, p_user_id, p_invite_code);

  -- Increment the invite code usage count
  UPDATE user_invite_codes
  SET current_uses = current_uses + 1
  WHERE id = v_invite_record.id;

  -- Return success with group details
  RETURN jsonb_build_object(
    'success', true,
    'status', 'joined',
    'message', 'Successfully joined the group',
    'group', jsonb_build_object(
      'id', v_invite_record.group_id,
      'name', v_invite_record.group_name,
      'joined_at', v_new_membership.created_at,
      'role', v_new_membership.role
    ),
    'inviter', jsonb_build_object(
      'user_id', v_invite_record.user_id
    )
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where membership was created between check and insert
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_member',
      'message', 'You are already a member of this group',
      'group', jsonb_build_object(
        'id', v_invite_record.group_id,
        'name', v_invite_record.group_name
      )
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'An error occurred while joining the group: ' || SQLERRM
    );
END;
$$;

-- Function to get invite graph for a group
CREATE OR REPLACE FUNCTION public.get_invite_graph(
  p_group_id UUID
)
RETURNS TABLE(
  inviter_user_id UUID,
  inviter_username TEXT,
  invitee_user_id UUID,
  invitee_username TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  invite_code_used TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this group
  IF NOT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'User does not have access to this group';
  END IF;

  RETURN QUERY
  SELECT
    gi.inviter_user_id,
    u1.username as inviter_username,
    gi.invitee_user_id,
    u2.username as invitee_username,
    gi.joined_at,
    gi.invite_code_used
  FROM group_invitations gi
  LEFT JOIN users u1 ON u1.id = gi.inviter_user_id
  LEFT JOIN users u2 ON u2.id = gi.invitee_user_id
  WHERE gi.group_id = p_group_id
  ORDER BY gi.joined_at ASC;
END;
$$;

-- Function to get user invite statistics
CREATE OR REPLACE FUNCTION public.get_user_invite_stats(
  p_user_id UUID DEFAULT auth.uid(),
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE(
  group_id UUID,
  group_name TEXT,
  invite_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  current_uses INTEGER,
  successful_invites BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate user is authenticated
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    uic.group_id,
    g.name as group_name,
    uic.invite_code,
    uic.created_at,
    uic.expires_at,
    uic.max_uses,
    uic.current_uses,
    COALESCE(invite_count.count, 0) as successful_invites
  FROM user_invite_codes uic
  JOIN groups g ON g.id = uic.group_id
  LEFT JOIN (
    SELECT inviter_user_id, group_id, COUNT(*) as count
    FROM group_invitations
    GROUP BY inviter_user_id, group_id
  ) invite_count ON invite_count.inviter_user_id = uic.user_id AND invite_count.group_id = uic.group_id
  WHERE uic.user_id = p_user_id
  AND (p_group_id IS NULL OR uic.group_id = p_group_id)
  AND uic.is_active = true
  ORDER BY uic.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_user_invite_code(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_invite_code(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION join_group_with_user_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invite_graph(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_invite_stats(UUID, UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION generate_user_invite_code(UUID, UUID) IS 'Generates a unique 6-character invite code for a user in a specific group';
COMMENT ON FUNCTION create_user_invite_code(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE) IS 'Creates a new invite code for a user with usage limits and expiration';
COMMENT ON FUNCTION join_group_with_user_code(TEXT, UUID) IS 'Joins a user to a group using another user''s invite code, tracking the invitation relationship';
COMMENT ON FUNCTION get_invite_graph(UUID) IS 'Returns the invitation graph for a group showing who invited whom';
COMMENT ON FUNCTION get_user_invite_stats(UUID, UUID) IS 'Returns statistics about a user''s invite codes and their usage';