# NGG Platform

One web app and one Supabase project for NGG's live workshop tools.

| Module | Routes | Status |
|---|---|---|
| Live Heatmap (`heatmap`) | `/v/:shortCode` (participants), `/heatmap/display/:eventId` (projector), `/heatmap/host` (host console) | first module |

- Conventions for every contributor and coding session: [`CLAUDE.md`](CLAUDE.md)
- Build plan and decisions: [`PLAN.md`](PLAN.md)
- Design system application: [`docs/design.md`](docs/design.md)
- Acceptance checklist: [`docs/acceptance.md`](docs/acceptance.md)

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

`npx supabase status` prints the local URL and publishable key.
