-- Fix infinite recursion in RLS policies caused by members table referencing itself
-- Run this in Supabase SQL Editor

-- Security definer functions bypass RLS, breaking the recursion
create or replace function get_my_group_ids()
returns setof uuid language sql security definer stable as $$
  select group_id from members where user_id = auth.uid()
$$;

create or replace function get_my_owned_group_ids()
returns setof uuid language sql security definer stable as $$
  select group_id from members where user_id = auth.uid() and is_owner = true
$$;

-- ── groups ──────────────────────────────────────────────────
drop policy if exists "group members can read" on groups;
create policy "group members can read" on groups
  for select using (id in (select get_my_group_ids()));

drop policy if exists "group owner can update" on groups;
create policy "group owner can update" on groups
  for update using (id in (select get_my_owned_group_ids()));

-- ── members ─────────────────────────────────────────────────
drop policy if exists "group members can read members" on members;
create policy "group members can read members" on members
  for select using (group_id in (select get_my_group_ids()));

drop policy if exists "owner can remove members" on members;
create policy "owner can remove members" on members
  for delete using (
    user_id = auth.uid()
    or group_id in (select get_my_owned_group_ids())
  );

-- ── group_invites ────────────────────────────────────────────
drop policy if exists "owner can manage invites" on group_invites;
create policy "owner can manage invites" on group_invites
  for all using (group_id in (select get_my_owned_group_ids()));

-- ── user_unavailability ──────────────────────────────────────
drop policy if exists "group members can read unavailability" on user_unavailability;
create policy "group members can read unavailability" on user_unavailability
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from members m1
      where m1.user_id = user_unavailability.user_id
      and m1.group_id in (select get_my_group_ids())
    )
  );

-- ── group_events ─────────────────────────────────────────────
drop policy if exists "group members can read events" on group_events;
drop policy if exists "group members can manage events" on group_events;
create policy "group members can read events" on group_events
  for select using (group_id in (select get_my_group_ids()));
create policy "group members can manage events" on group_events
  for all using (group_id in (select get_my_group_ids()));

-- ── event_rsvps ──────────────────────────────────────────────
drop policy if exists "group members can read rsvps" on event_rsvps;
create policy "group members can read rsvps" on event_rsvps
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from group_events ge
      where ge.id = event_rsvps.event_id
      and ge.group_id in (select get_my_group_ids())
    )
  );

-- ── group_event_overrides ────────────────────────────────────
drop policy if exists "group members can read overrides" on group_event_overrides;
create policy "group members can read overrides" on group_event_overrides
  for select using (group_id in (select get_my_group_ids()));
