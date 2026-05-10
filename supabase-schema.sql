-- BandCal Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- Groups table
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  name text not null,
  owner_token uuid not null,
  threshold_type text not null default 'all', -- 'all' | 'count' | 'required'
  threshold_value integer,                     -- used when threshold_type = 'count'
  created_at timestamptz default now()
);

-- Members table
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  nickname text,
  is_owner boolean not null default false,
  created_at timestamptz default now()
);

-- Availability table (a row = that member is UNAVAILABLE on that date)
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique(member_id, date)
);

-- Indexes
create index if not exists idx_members_group_id on members(group_id);
create index if not exists idx_availability_member_id on availability(member_id);
create index if not exists idx_availability_date on availability(date);

-- Row Level Security
alter table groups enable row level security;
alter table members enable row level security;
alter table availability enable row level security;

-- Open policies (token-based auth = app handles security via UUID tokens)
-- Anyone with the anon key can read/write. The UUID tokens are the "password".
create policy "Public read groups" on groups for select using (true);
create policy "Public insert groups" on groups for insert with check (true);
create policy "Public update groups" on groups for update using (true);

create policy "Public read members" on members for select using (true);
create policy "Public insert members" on members for insert with check (true);
create policy "Public update members" on members for update using (true);
create policy "Public delete members" on members for delete using (true);

create policy "Public read availability" on availability for select using (true);
create policy "Public insert availability" on availability for insert with check (true);
create policy "Public delete availability" on availability for delete using (true);

-- Enable realtime for availability updates
alter publication supabase_realtime add table availability;
