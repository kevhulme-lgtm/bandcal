-- BandCal Migration: Group Events
-- Run this in your Supabase SQL Editor
-- Safe to run even if you've already run the original schema

-- 1. Add type column to availability (personal vs override)
ALTER TABLE availability 
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'personal';

-- 2. Create group_events table
CREATE TABLE IF NOT EXISTS group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  title text NOT NULL,
  notes text,
  created_by_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, date)
);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_group_events_group_date ON group_events(group_id, date);

-- 4. RLS
ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read group_events" ON group_events FOR SELECT USING (true);
CREATE POLICY "Public insert group_events" ON group_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update group_events" ON group_events FOR UPDATE USING (true);
CREATE POLICY "Public delete group_events" ON group_events FOR DELETE USING (true);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE group_events;

-- 6. Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO anon;
