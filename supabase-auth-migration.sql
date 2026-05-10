-- ============================================================
-- BandCal auth migration — run this fresh in Supabase SQL editor
-- Drops all existing tables and rebuilds with Supabase Auth
-- ============================================================

-- Drop old tables (order matters for FK constraints)
drop table if exists push_subscriptions cascade;
drop table if exists availability cascade;
drop table if exists group_events cascade;
drop table if exists members cascade;
drop table if exists groups cascade;

-- ============================================================
-- Core tables
-- ============================================================

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token uuid not null default gen_random_uuid(), -- for /g/:token owner management URL
  threshold_type text not null default 'all',     -- 'all' | 'count' | 'required'
  threshold_value int,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text,
  is_owner bool not null default false,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Single reusable invite link per group, 24hr expiry, regeneratable
create table group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_by uuid references auth.users on delete set null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  unique (group_id) -- one active invite per group
);

-- User-level unavailability — applies across all groups
create table user_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  unique (user_id, date)
);

-- Personal events — private, only the unavailability propagates
create table personal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Group events
create table group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  title text not null,
  notes text,
  start_date date not null,
  end_date date not null,
  is_timed bool not null default false,
  start_time time,
  end_time time,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- RSVP for group events: accepted | declined | maybe
create table event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references group_events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null check (status in ('accepted', 'declined', 'maybe')),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Override: user marks themselves free in a specific group despite accepted event elsewhere
create table group_event_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  group_id uuid not null references groups on delete cascade,
  date date not null,
  unique (user_id, group_id, date)
);

-- Push subscriptions
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subscription_json jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table groups enable row level security;
alter table members enable row level security;
alter table group_invites enable row level security;
alter table user_unavailability enable row level security;
alter table personal_events enable row level security;
alter table group_events enable row level security;
alter table event_rsvps enable row level security;
alter table group_event_overrides enable row level security;
alter table push_subscriptions enable row level security;

-- groups: members can read, owner can update
create policy "group members can read" on groups
  for select using (
    exists (select 1 from members where members.group_id = groups.id and members.user_id = auth.uid())
  );

create policy "group owner can update" on groups
  for update using (
    exists (select 1 from members where members.group_id = groups.id and members.user_id = auth.uid() and members.is_owner = true)
  );

create policy "authenticated users can create groups" on groups
  for insert with check (auth.uid() is not null);

-- members: members of the group can read; users can insert themselves (when joining); owner can delete
create policy "group members can read members" on members
  for select using (
    exists (select 1 from members m2 where m2.group_id = members.group_id and m2.user_id = auth.uid())
  );

create policy "users can join groups" on members
  for insert with check (auth.uid() = user_id);

create policy "owner can remove members" on members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from members m2 where m2.group_id = members.group_id and m2.user_id = auth.uid() and m2.is_owner = true)
  );

create policy "members can update own display name" on members
  for update using (user_id = auth.uid());

-- group_invites: anyone authenticated can read (to validate join links); owner can insert/update/delete
create policy "authenticated can read invites" on group_invites
  for select using (auth.uid() is not null);

create policy "owner can manage invites" on group_invites
  for all using (
    exists (select 1 from members where members.group_id = group_invites.group_id and members.user_id = auth.uid() and members.is_owner = true)
  );

-- user_unavailability: own rows only
create policy "users manage own unavailability" on user_unavailability
  for all using (user_id = auth.uid());

-- but group members can read each other's unavailability
create policy "group members can read unavailability" on user_unavailability
  for select using (
    exists (
      select 1 from members m1
      join members m2 on m1.group_id = m2.group_id
      where m1.user_id = auth.uid()
      and m2.user_id = user_unavailability.user_id
    )
  );

-- personal_events: own rows only, never readable by others
create policy "users manage own personal events" on personal_events
  for all using (user_id = auth.uid());

-- group_events: group members can read; members can insert/update/delete
create policy "group members can read events" on group_events
  for select using (
    exists (select 1 from members where members.group_id = group_events.group_id and members.user_id = auth.uid())
  );

create policy "group members can manage events" on group_events
  for all using (
    exists (select 1 from members where members.group_id = group_events.group_id and members.user_id = auth.uid())
  );

-- event_rsvps: group members can read all RSVPs for events in their groups; own rows to write
create policy "group members can read rsvps" on event_rsvps
  for select using (
    exists (
      select 1 from group_events ge
      join members m on m.group_id = ge.group_id
      where ge.id = event_rsvps.event_id and m.user_id = auth.uid()
    )
  );

create policy "users manage own rsvps" on event_rsvps
  for all using (user_id = auth.uid());

-- group_event_overrides: own rows; group members can read
create policy "group members can read overrides" on group_event_overrides
  for select using (
    exists (select 1 from members where members.group_id = group_event_overrides.group_id and members.user_id = auth.uid())
  );

create policy "users manage own overrides" on group_event_overrides
  for all using (user_id = auth.uid());

-- push_subscriptions: own rows only
create policy "users manage own push subs" on push_subscriptions
  for all using (user_id = auth.uid());
