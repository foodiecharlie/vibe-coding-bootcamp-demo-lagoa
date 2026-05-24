# Lagoa Q&A

Introvert-friendly webinar Q&A for collecting thoughtful written questions before, during, and after a session.

## What it does

- Opens Q&A 7 or 14 days before a webinar and keeps it open 7 or 14 days after.
- Lets attendees ask written questions, upvote questions, and add follow-ups.
- Separates attendee, speaker, assistant, and organizer workspaces.
- Supports delayed speaker responses, answer upvotes, assistant prep, and organizer triage.
- Provides a mobile-first frontend ready for Vercel.
- Uses a Supabase-ready client and schema draft.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The V1 interface uses local sample state so the full experience works before auth and row-level security policies are added.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add your Supabase project values when connecting live data.

## Build

```bash
npm run build
```

## Deploy

### GitHub

Push this repository to GitHub, then import it into Vercel.

### Supabase

Run `supabase/schema.sql` in your Supabase SQL editor. Add these values to Vercel project environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Vercel

Use the Vite defaults:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
