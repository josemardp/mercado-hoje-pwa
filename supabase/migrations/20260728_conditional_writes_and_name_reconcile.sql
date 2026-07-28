-- ITEM 2: reconcile name collisions on catalog item creation instead of
-- failing forever. If the (name, user_id) unique index is violated by a
-- fresh id, return the existing remote id so the client can remap.
--
-- ITEM 3: never let a stale write overwrite a newer one. Every remote
-- write now compares updated_at server-side (INSERT ... ON CONFLICT ...
-- WHERE table.updated_at < EXCLUDED.updated_at) and silently no-ops if
-- the incoming data is older than what's already stored.

CREATE OR REPLACE FUNCTION upsert_item_reconcile_name(
  p_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_emoji TEXT,
  p_qty INTEGER,
  p_use_count INTEGER,
  p_last_used BIGINT,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_id UUID;
BEGIN
  BEGIN
    INSERT INTO mh_items (id, name, category, emoji, qty, use_count, last_used, updated_at, user_id)
    VALUES (p_id, p_name, p_category, p_emoji, p_qty, p_use_count, p_last_used, p_updated_at, p_user_id);
    RETURN p_id;
  EXCEPTION WHEN unique_violation THEN
    -- Same id already exists (retry of the same op): update if newer, keep the id.
    UPDATE mh_items
    SET name = p_name, category = p_category, emoji = p_emoji, qty = p_qty,
        use_count = p_use_count, last_used = p_last_used, updated_at = p_updated_at
    WHERE id = p_id AND user_id = p_user_id AND updated_at < p_updated_at;

    IF FOUND THEN
      RETURN p_id;
    END IF;

    SELECT id INTO canonical_id FROM mh_items WHERE id = p_id AND user_id = p_user_id;
    IF canonical_id IS NOT NULL THEN
      -- Same id exists but incoming data is older/equal: keep as-is.
      RETURN p_id;
    END IF;

    -- Real name collision with a different id: hand back the existing owner of that name.
    SELECT id INTO canonical_id FROM mh_items WHERE name = p_name AND user_id = p_user_id;
    RETURN canonical_id;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_item_reconcile_name(UUID,TEXT,TEXT,TEXT,INTEGER,INTEGER,BIGINT,TIMESTAMPTZ,UUID) TO authenticated;

-- Conditional field updates on mh_items (used for use_count bumps and category
-- corrections coming from the offline queue) — reject if stale.

CREATE OR REPLACE FUNCTION update_item_use_count_if_newer(
  p_id UUID,
  p_user_id UUID,
  p_use_count INTEGER,
  p_last_used BIGINT,
  p_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  UPDATE mh_items
  SET use_count = p_use_count, last_used = p_last_used, updated_at = p_updated_at
  WHERE id = p_id AND user_id = p_user_id AND updated_at < p_updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION update_item_use_count_if_newer(UUID,UUID,INTEGER,BIGINT,TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION update_item_category_if_newer(
  p_id UUID,
  p_user_id UUID,
  p_category TEXT,
  p_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  UPDATE mh_items
  SET category = p_category, updated_at = p_updated_at
  WHERE id = p_id AND user_id = p_user_id AND updated_at < p_updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION update_item_category_if_newer(UUID,UUID,TEXT,TIMESTAMPTZ) TO authenticated;

-- Conditional upsert on mh_day_items — same "reject older write" guarantee,
-- used by every day-item write path (direct save and offline queue alike).

CREATE OR REPLACE FUNCTION upsert_day_item_if_newer(
  p_day_key TEXT,
  p_item_id UUID,
  p_checked BOOLEAN,
  p_postponed BOOLEAN,
  p_in_today BOOLEAN,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  INSERT INTO mh_day_items (day_key, item_id, checked, postponed, in_today, updated_at, user_id)
  VALUES (p_day_key, p_item_id, p_checked, p_postponed, p_in_today, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, item_id) DO UPDATE SET
    checked = EXCLUDED.checked,
    postponed = EXCLUDED.postponed,
    in_today = EXCLUDED.in_today,
    updated_at = EXCLUDED.updated_at
  WHERE mh_day_items.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_day_item_if_newer(TEXT,UUID,BOOLEAN,BOOLEAN,BOOLEAN,TIMESTAMPTZ,UUID) TO authenticated;
