-- Grant table-level permissions to authenticated users
grant usage on schema public to authenticated;

grant all on groups to authenticated;
grant all on members to authenticated;
grant all on group_invites to authenticated;
grant all on user_unavailability to authenticated;
grant all on personal_events to authenticated;
grant all on group_events to authenticated;
grant all on event_rsvps to authenticated;
grant all on group_event_overrides to authenticated;
grant all on push_subscriptions to authenticated;
