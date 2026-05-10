-- BandCal Migration 2: Multi-day events, times, push subscriptions
-- Run in Supabase SQL Editor

-- 1. Add new columns to group_events
ALTER TABLE group_events
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS is_timed boolean NOT NULL DEFAULT false;

-- 2. Copy existing date -> start_date, end_date
UPDATE group_events SET start_date = date, end_date = date WHERE start_date IS NULL;

-- 3. Make start_date NOT NULL now it's populated
ALTER TABLE group_events ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE group_events ALTER COLUMN end_date SET NOT NULL;

-- 4. Drop old unique constraint on (group_id, date) and old date column
ALTER TABLE group_events DROP CONSTRAINT IF EXISTS group_events_group_id_date_key;
ALTER TABLE group_events DROP COLUMN IF EXISTS date;

-- 5. Add unique constraint on (group_id, start_date) - one event per group per start date
ALTER TABLE group_events ADD CONSTRAINT group_events_group_id_start_date_key UNIQUE (group_id, start_date);

-- 6. Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, subscription_json)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member_id ON push_subscriptions(member_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read push_subscriptions" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Public insert push_subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete push_subscriptions" ON push_subscriptions FOR DELETE USING (true);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO anon;

-- 7. Notification log (tracks what's been seen per member)
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
  seen_at timestamptz DEFAULT now(),
  UNIQUE(member_id, event_id)
);

GRANT SELECT, INSERT ON public.notification_log TO anon;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read notification_log" ON notification_log FOR SELECT USING (true);
CREATE POLICY "Public insert notification_log" ON notification_log FOR INSERT WITH CHECK (true);
