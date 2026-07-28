-- The app treats item names as case-insensitive locally (Dexie
-- .equalsIgnoreCase), but the unique index on mh_items was case-sensitive,
-- so "Arroz" and "arroz" could exist as two separate rows and the name
-- collision reconciliation (upsert_item_reconcile_name) would never
-- trigger for that pair. Normalize the uniqueness constraint to match.
--
-- NOTE: if two rows with the same name in different casing already exist
-- for the same user, this index creation will fail with a unique
-- violation — reconcile those rows manually before re-running this file.

DROP INDEX IF EXISTS mh_items_name_user_id_idx;
CREATE UNIQUE INDEX mh_items_name_lower_user_id_idx ON mh_items (lower(name), user_id);

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
    UPDATE mh_items
    SET name = p_name, category = p_category, emoji = p_emoji, qty = p_qty,
        use_count = p_use_count, last_used = p_last_used, updated_at = p_updated_at
    WHERE id = p_id AND user_id = p_user_id AND updated_at < p_updated_at;

    IF FOUND THEN
      RETURN p_id;
    END IF;

    SELECT id INTO canonical_id FROM mh_items WHERE id = p_id AND user_id = p_user_id;
    IF canonical_id IS NOT NULL THEN
      RETURN p_id;
    END IF;

    -- Real name collision with a different id: hand back the existing owner
    -- of that name, matched case-insensitively.
    SELECT id INTO canonical_id FROM mh_items WHERE lower(name) = lower(p_name) AND user_id = p_user_id;
    RETURN canonical_id;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_item_reconcile_name(UUID,TEXT,TEXT,TEXT,INTEGER,INTEGER,BIGINT,TIMESTAMPTZ,UUID) TO authenticated;
