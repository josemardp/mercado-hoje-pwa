-- Rotina tab: per-day, per-step completion state (mh_ prefix, same convention
-- as mh_items/mh_day_items). No catalog table — the step list is fixed in
-- client code (src/lib/rotinaSteps.ts), not user-growable like mh_items.

CREATE TABLE mh_rotina_state (
  day_key TEXT NOT NULL,
  step_id TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (user_id, day_key, step_id)
);

ALTER TABLE mh_rotina_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated owners on mh_rotina_state" ON mh_rotina_state
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conditional upsert — same "reject older write" guarantee as
-- upsert_day_item_if_newer, so a stale queued write can never clobber a
-- more recent one from another device.
CREATE OR REPLACE FUNCTION upsert_rotina_step_if_newer(
  p_day_key TEXT,
  p_step_id TEXT,
  p_done BOOLEAN,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  INSERT INTO mh_rotina_state (day_key, step_id, done, updated_at, user_id)
  VALUES (p_day_key, p_step_id, p_done, p_updated_at, p_user_id)
  ON CONFLICT (user_id, day_key, step_id) DO UPDATE SET
    done = EXCLUDED.done,
    updated_at = EXCLUDED.updated_at
  WHERE mh_rotina_state.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_rotina_step_if_newer(TEXT,TEXT,BOOLEAN,TIMESTAMPTZ,UUID) TO authenticated;
