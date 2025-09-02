-- Create a safe group join function that checks for existing membership
CREATE OR REPLACE FUNCTION join_group_safe(
  p_join_code TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_id UUID;
  v_group_name TEXT;
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

  -- Find the group by join code (case-insensitive)
  SELECT id, name INTO v_group_id, v_group_name
  FROM groups
  WHERE UPPER(join_code) = UPPER(p_join_code);

  -- Check if group exists
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_code',
      'message', 'Invalid join code'
    );
  END IF;

  -- Check if user is already a member
  SELECT * INTO v_existing_membership
  FROM group_memberships
  WHERE user_id = p_user_id AND group_id = v_group_id;

  IF v_existing_membership.id IS NOT NULL THEN
    -- User is already a member
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_member',
      'message', 'You are already a member of this group',
      'group', jsonb_build_object(
        'id', v_group_id,
        'name', v_group_name,
        'joined_at', v_existing_membership.created_at,
        'role', v_existing_membership.role
      )
    );
  END IF;

  -- Add user to the group
  INSERT INTO group_memberships (user_id, group_id, role)
  VALUES (p_user_id, v_group_id, 'member')
  RETURNING * INTO v_new_membership;

  -- Return success with group details
  RETURN jsonb_build_object(
    'success', true,
    'status', 'joined',
    'message', 'Successfully joined the group',
    'group', jsonb_build_object(
      'id', v_group_id,
      'name', v_group_name,
      'joined_at', v_new_membership.created_at,
      'role', v_new_membership.role
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
        'id', v_group_id,
        'name', v_group_name
      )
    );
  WHEN OTHERS THEN
    -- Handle any other errors
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'message', 'An error occurred while joining the group: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION join_group_safe(TEXT, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION join_group_safe(TEXT, UUID) IS 
'Safely joins a user to a group, checking for existing membership and providing appropriate feedback';