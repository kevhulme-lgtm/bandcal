-- delete_group RPC
-- Deletes a group and all its related data.
-- Only the group owner can call this. Raises an exception otherwise.
-- Does NOT touch user_unavailability (those are user-level, not group-level).

create or replace function delete_group(group_id_param uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from members
    where group_id = group_id_param
    and user_id = auth.uid()
    and is_owner = true
  ) then
    raise exception 'Not authorized';
  end if;

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
