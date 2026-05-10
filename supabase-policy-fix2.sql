-- Fix INSERT policy for groups and allow creator to read their new group
-- before they're added as a member

drop policy if exists "authenticated users can create groups" on groups;
create policy "authenticated users can create groups" on groups
  for insert with check (auth.uid() is not null);

-- Also allow the group creator to see their group (needed right after creation,
-- before the member row exists)
drop policy if exists "group members can read" on groups;
create policy "group members can read" on groups
  for select using (
    created_by = auth.uid()
    or id in (select get_my_group_ids())
  );
