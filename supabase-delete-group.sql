-- delete_group RPC
-- Deletes a group and all its related data.
-- Only the group owner can call this. Raises an exception otherwise.
-- Cleans up user_unavailability rows written for group events (same logic
-- as single-event deletion in the UI), then removes everything else.

create or replace function delete_group(group_id_param uuid)
returns void language plpgsql security definer as $$
declare
  ev record;
  mem record;
begin
  if not exists (
    select 1 from members
    where group_id = group_id_param
    and user_id = auth.uid()
    and is_owner = true
  ) then
    raise exception 'Not authorized';
  end if;

  -- For each group event, remove the unavailability rows that were written
  -- for all members when the event was created (mirrors handleDeleteGroupEvent)
  for ev in
    select start_date, coalesce(end_date, start_date) as end_date
    from group_events
    where group_id = group_id_param
  loop
    for mem in
      select user_id from members where group_id = group_id_param
    loop
      delete from user_unavailability
        where user_id = mem.user_id
        and date >= ev.start_date
        and date <= ev.end_date;
    end loop;
  end loop;

  delete from event_rsvps
    where event_id in (select id from group_events where group_id = group_id_param);
  delete from group_event_overrides where group_id = group_id_param;
  delete from group_events where group_id = group_id_param;
  delete from group_invites where group_id = group_id_param;
  delete from members where group_id = group_id_param;
  delete from groups where id = group_id_param;
end;
$$;

grant execute on function delete_group(uuid) to authenticated;
