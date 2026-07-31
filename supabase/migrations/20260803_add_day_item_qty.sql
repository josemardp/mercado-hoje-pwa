-- Add qty column to mh_day_items — stores the per-day quantity override.
-- Default 1 means "use the catalog's qty"; any value > 1 means the user
-- explicitly wants more of this item for THIS day only.

ALTER TABLE mh_day_items
  ADD COLUMN IF NOT EXISTS qty INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN mh_day_items.qty IS
  'Quantity override for this item on this specific day. Defaults to 1 (use catalog qty).';

-- Update the conditional upsert RPC to include qty in the merge.
CREATE OR REPLACE FUNCTION upsert_day_item_if_newer(
  p_day_key TEXT,
  p_item_id UUID,
  p_checked BOOLEAN,
  p_postponed BOOLEAN,
  p_in_today BOOLEAN,
  p_qty INTEGER,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  INSERT INTO mh_day_items (day_key, item_id, checked, postponed, in_today, qty, updated_at, user_id)
  VALUES (p_day_key, p_item_id, p_checked, p_postponed, p_in_today, p_qty, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, item_id) DO UPDATE SET
    checked = EXCLUDED.checked,
    postponed = EXCLUDED.postponed,
    in_today = EXCLUDED.in_today,
    qty = EXCLUDED.qty,
    updated_at = EXCLUDED.updated_at
  WHERE mh_day_items.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,INTEGER,TIMESTAMPTZ,UUID) TO authenticated;

-- Revoke the old signature (4 booleans, no qty) so stale clients can't call it.
REVOKE EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,TIMESTAMPTZ,UUID) FROM authenticated;
DROP FUNCTION IF EXISTS upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,TIMESTAMPTZ,UUID);
