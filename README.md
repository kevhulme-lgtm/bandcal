# BandCal

Band availability tracking. Zero accounts, zero passwords, zero noise.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Hosting:** Netlify (static site + serverless functions)
- **Push notifications:** Web Push API via Netlify Function

## Features

- Token-based auth — unique link per member, no passwords
- Personal calendar — tap to mark unavailable, long press to add personal event
- Group calendar — see all members' availability at a glance
- Group events — multi-day support, timed events (amber), full-day (blue)
- In-app event banner + push notifications when events are added
- Group switcher — tap group name to switch between groups
- PWA — installable on iOS and Android home screen

## Colour coding

- 🔵 Blue — group event (full day)
- 🟡 Amber — timed event (partial day)
- 🟢 Green — all members available
- 🔴 Red — unavailable / not enough members free
- 🟡 Amber — some members unavailable (tap for detail)

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
SUPABASE_SERVICE_KEY=
```

## Local development

```bash
npm install
npm run dev
```

## Database

Run SQL files in this order in Supabase SQL Editor:
1. `supabase-schema.sql` — initial schema
2. `supabase-migration-events.sql` — group events
3. `supabase-migration-2.sql` — multi-day events, push subscriptions

## Deploy

Netlify auto-deploys on push to `main`. Build command: `npm run build`, publish directory: `dist`.
