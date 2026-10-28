# NGG Platform

One web app and one Supabase project for NGG's live workshop tools.

| Module | Routes | Status |
|---|---|---|
| Live Heatmap (`heatmap`) | `/v/:shortCode` (participants), `/heatmap/display/:eventId` (projector), `/heatmap/host` (host console) | first module |

- Conventions for every contributor and coding session: [`CLAUDE.md`](CLAUDE.md)
- Build plan and decisions: [`PLAN.md`](PLAN.md)
- Design system application: [`docs/design.md`](docs/design.md)
- Acceptance checklist: [`docs/acceptance.md`](docs/acceptance.md)
- Bundle size report: [`docs/bundle-size.md`](docs/bundle-size.md)

## Local development

```bash
npm install
npx supabase start            # local Postgres, PostgREST, Realtime (Docker)
npx supabase db reset         # apply supabase/migrations
npm run db:test               # pgTAP tests
npm run set-host-pin -- --local
cp .env.example .env.local    # then fill in the local URL and publishable key
npm run dev
```

`npx supabase status` prints the local URL and publishable key. Node 22 or
later is required (the load test uses the built-in WebSocket).

## Scripts

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm test` / `npm run build` | type check, unit tests, production build |
| `npm run db:test` | pgTAP tests (acceptance 3–6) against the local stack, or `DB_URL=…` |
| `npm run set-host-pin -- --linked` | set the host PIN on the linked project (hashed locally) |
| `npm run seed:40 -- --app <url>` | acceptance test 1: 40 known votes, exact checks |
| `npm run load:60` | acceptance test 2: 60 concurrent voters with changes |
| `npm run size -- --write` | gzipped size per route → `docs/bundle-size.md` |

## Deployment

Static SPA on Vercel (`vercel.json`: SPA rewrite, CSP and security headers,
long-term caching for hashed assets and fonts). The Vercel project must be
named `ngg-platform`. Environment variables: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_PUBLIC_BASE_URL` (the production
origin printed in QR codes).
