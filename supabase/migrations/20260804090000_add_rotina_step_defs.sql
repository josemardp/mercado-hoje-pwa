-- Rotina tab: user-editable step DEFINITIONS (title/emoji/period/order), as
-- opposed to mh_rotina_state which only ever held per-day completion state
-- for a step list that used to be fixed in client code (rotinaSteps.ts).
-- One row per step, not one JSONB blob per user — so two devices editing
-- offline at the same time (one renaming a step, another reordering) merge
-- field-by-field via LWW instead of one whole-list write clobbering the
-- other's edit outright.
--
-- Primary key is (user_id, id) instead of just (id): step ids are stable
-- human slugs ('xixi', 'pesar-se', ...), not UUIDs, so a global PK would
-- collide the moment two accounts share a browser and both seed the same
-- default slug — see AUD-009's identical fix for mh_rotina_state's
-- predecessor (rotinaStepState) in db.ts for the incident this avoids.
--
-- `deleted` is a tombstone (soft delete), same convention as
-- mh_agenda_tasks: a hard DELETE has no LWW-safe way to tell an offline
-- device "this is gone on purpose" vs "never synced here yet".

CREATE TABLE mh_rotina_steps (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✅',
  period TEXT NOT NULL DEFAULT 'morning',
  step_order INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE mh_rotina_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated owners on mh_rotina_steps" ON mh_rotina_steps
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conditional upsert — same "reject older write" guarantee as
-- upsert_agenda_task_if_newer/upsert_rotina_step_if_newer.
CREATE OR REPLACE FUNCTION upsert_rotina_step_def_if_newer(
  p_id TEXT,
  p_title TEXT,
  p_emoji TEXT,
  p_period TEXT,
  p_order INTEGER,
  p_deleted BOOLEAN,
  p_updated_at TIMESTAMPTZ,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  INSERT INTO mh_rotina_steps (id, user_id, title, emoji, period, step_order, deleted, updated_at)
  VALUES (p_id, p_user_id, p_title, p_emoji, p_period, p_order, p_deleted, p_updated_at)
  ON CONFLICT (user_id, id) DO UPDATE SET
    title = EXCLUDED.title,
    emoji = EXCLUDED.emoji,
    period = EXCLUDED.period,
    step_order = EXCLUDED.step_order,
    deleted = EXCLUDED.deleted,
    updated_at = EXCLUDED.updated_at
  WHERE mh_rotina_steps.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_rotina_step_def_if_newer(TEXT,TEXT,TEXT,TEXT,INTEGER,BOOLEAN,TIMESTAMPTZ,UUID) TO authenticated;
