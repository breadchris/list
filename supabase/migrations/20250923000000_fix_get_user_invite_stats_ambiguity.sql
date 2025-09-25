-- Fix ambiguous column reference in get_user_invite_stats function
--
-- Problem: The function returns a column named 'group_id' but also references
-- 'group_id' columns from tables in the JOIN clause, causing PostgreSQL to be
-- unable to determine which 'group_id' is being referenced.
--
-- Solution: Add explicit table alias 'gi' to the group_invitations table in
-- the subquery to disambiguate column references.

CREATE OR REPLACE FUNCTION public.get_user_invite_stats(p_user_id uuid DEFAULT auth.uid(), p_group_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(group_id uuid, group_name text, invite_code text, created_at timestamp with time zone, expires_at timestamp with time zone, max_uses integer, current_uses integer, successful_invites bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    -- Fix: Add explicit table alias 'gi' to disambiguate column references
    SELECT gi.inviter_user_id, gi.group_id, COUNT(*) as count
    FROM group_invitations gi
    GROUP BY gi.inviter_user_id, gi.group_id
  ) invite_count ON invite_count.inviter_user_id = uic.user_id AND invite_count.group_id = uic.group_id
  WHERE uic.user_id = p_user_id
  AND (p_group_id IS NULL OR uic.group_id = p_group_id)
  AND uic.is_active = true
  ORDER BY uic.created_at DESC;
END;
$function$;