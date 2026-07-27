-- ITEM 14: Atomic increment RPC for mh_items.use_count
-- This allows safe concurrent updates without race conditions.

CREATE OR REPLACE FUNCTION increment_use_count(
  p_item_id UUID,
  p_increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE mh_items
  SET use_count = COALESCE(use_count, 0) + p_increment,
      last_used = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at = NOW()
  WHERE id = p_item_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION increment_use_count(UUID, INTEGER) TO authenticated;
