-- Mercado de Hoje tables (mh_ prefix to avoid conflicts with Secretário Task)

CREATE TABLE IF NOT EXISTS mh_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT DEFAULT NULL,
  qty INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  last_used BIGINT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mh_day_states (
  id TEXT PRIMARY KEY,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mh_sync_queue (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type TEXT NOT NULL,
  day_date TEXT NOT NULL,
  item_id BIGINT DEFAULT NULL,
  item_name TEXT DEFAULT NULL,
  category TEXT DEFAULT NULL,
  device_id TEXT DEFAULT NULL,
  timestamp BIGINT NOT NULL DEFAULT 0,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mh_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_day_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all - app-level auth via anon key)
DROP POLICY IF EXISTS "mh_items_select" ON mh_items;
DROP POLICY IF EXISTS "mh_items_insert" ON mh_items;
DROP POLICY IF EXISTS "mh_items_update" ON mh_items;
DROP POLICY IF EXISTS "mh_items_delete" ON mh_items;
DROP POLICY IF EXISTS "mh_day_states_select" ON mh_day_states;
DROP POLICY IF EXISTS "mh_day_states_insert" ON mh_day_states;
DROP POLICY IF EXISTS "mh_day_states_update" ON mh_day_states;
DROP POLICY IF EXISTS "mh_day_states_delete" ON mh_day_states;
DROP POLICY IF EXISTS "mh_sync_queue_select" ON mh_sync_queue;
DROP POLICY IF EXISTS "mh_sync_queue_insert" ON mh_sync_queue;
DROP POLICY IF EXISTS "mh_sync_queue_update" ON mh_sync_queue;
DROP POLICY IF EXISTS "mh_sync_queue_delete" ON mh_sync_queue;

CREATE POLICY "mh_items_select" ON mh_items FOR SELECT USING (true);
CREATE POLICY "mh_items_insert" ON mh_items FOR INSERT WITH CHECK (true);
CREATE POLICY "mh_items_update" ON mh_items FOR UPDATE USING (true);
CREATE POLICY "mh_items_delete" ON mh_items FOR DELETE USING (true);

CREATE POLICY "mh_day_states_select" ON mh_day_states FOR SELECT USING (true);
CREATE POLICY "mh_day_states_insert" ON mh_day_states FOR INSERT WITH CHECK (true);
CREATE POLICY "mh_day_states_update" ON mh_day_states FOR UPDATE USING (true);
CREATE POLICY "mh_day_states_delete" ON mh_day_states FOR DELETE USING (true);

CREATE POLICY "mh_sync_queue_select" ON mh_sync_queue FOR SELECT USING (true);
CREATE POLICY "mh_sync_queue_insert" ON mh_sync_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "mh_sync_queue_update" ON mh_sync_queue FOR UPDATE USING (true);
CREATE POLICY "mh_sync_queue_delete" ON mh_sync_queue FOR DELETE USING (true);
