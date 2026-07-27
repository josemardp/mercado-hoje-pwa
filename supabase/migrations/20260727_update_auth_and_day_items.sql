-- Drop old tables and dependencies
DROP TABLE IF EXISTS mh_sync_queue;
DROP TABLE IF EXISTS mh_day_states;
DROP TABLE IF EXISTS mh_items CASCADE;

-- Create mh_items with UUID primary key and user association
CREATE TABLE mh_items (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT DEFAULT NULL,
  qty INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  last_used BIGINT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Unique index to prevent duplicate names per user
CREATE UNIQUE INDEX mh_items_name_user_id_idx ON mh_items(name, user_id);

-- Enable RLS on mh_items
ALTER TABLE mh_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated owners on mh_items" ON mh_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create mh_day_items with composite keys for fine-grained updates
CREATE TABLE mh_day_items (
  day_key TEXT NOT NULL,
  item_id UUID REFERENCES mh_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  postponed BOOLEAN NOT NULL DEFAULT FALSE,
  in_today BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (user_id, day_key, item_id)
);

-- Enable RLS on mh_day_items
ALTER TABLE mh_day_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated owners on mh_day_items" ON mh_day_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
