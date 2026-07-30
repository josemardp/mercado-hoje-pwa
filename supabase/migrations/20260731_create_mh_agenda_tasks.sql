-- Agenda mode inside the Rotina tab: ad-hoc, day-scoped tasks the user
-- schedules into an available time window. Unlike mh_items (growable named
-- catalog) or mh_rotina_state (fixed step slugs), a task here is a single
-- self-contained per-day row that only ever needs upsert/soft-delete —
-- deletion is modeled as just another field (`deleted`) synced through the
-- same conditional "newer wins" RPC as every other edit, so a delete can
-- never race-resurrect a newer edit (or vice versa) without extra machinery.

CREATE TABLE mh_agenda_tasks (
  id UUID PRIMARY KEY,
  day_key TEXT NOT NULL,
  title TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  fixed BOOLEAN NOT NULL DEFAULT FALSE,
  fixed_start TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  scheduled_start TEXT,
  scheduled_end TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

CREATE INDEX mh_agenda_tasks_user_day_idx ON mh_agenda_tasks (user_id, day_key);

ALTER TABLE mh_agenda_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated owners on mh_agenda_tasks" ON mh_agenda_tasks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION upsert_agenda_task_if_newer(
  p_id UUID,
  p_day_key TEXT,
  p_title TEXT,
  p_estimated_minutes INTEGER,
  p_fixed BOOLEAN,
  p_fixed_start TEXT,
  p_order INTEGER,
  p_scheduled_start TEXT,
  p_scheduled_end TEXT,
  p_done BOOLEAN,
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
  INSERT INTO mh_agenda_tasks (id, day_key, title, estimated_minutes, fixed, fixed_start,
    "order", scheduled_start, scheduled_end, done, deleted, updated_at, user_id)
  VALUES (p_id, p_day_key, p_title, p_estimated_minutes, p_fixed, p_fixed_start,
    p_order, p_scheduled_start, p_scheduled_end, p_done, p_deleted, p_updated_at, p_user_id)
  ON CONFLICT (id) DO UPDATE SET
    day_key = EXCLUDED.day_key,
    title = EXCLUDED.title,
    estimated_minutes = EXCLUDED.estimated_minutes,
    fixed = EXCLUDED.fixed,
    fixed_start = EXCLUDED.fixed_start,
    "order" = EXCLUDED."order",
    scheduled_start = EXCLUDED.scheduled_start,
    scheduled_end = EXCLUDED.scheduled_end,
    done = EXCLUDED.done,
    deleted = EXCLUDED.deleted,
    updated_at = EXCLUDED.updated_at
  WHERE mh_agenda_tasks.updated_at < EXCLUDED.updated_at
  RETURNING TRUE INTO applied;

  RETURN COALESCE(applied, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_agenda_task_if_newer(
  UUID, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID
) TO authenticated;
