-- Add is_tentative flag to personal_events
-- When true, marks the user's days as tentative (amber) rather than
-- unavailable (red) for all their groups.

alter table personal_events
  add column if not exists is_tentative boolean not null default false;
