# Setup — steps only the project owner does

In order. Commands run from the repository root on your machine (Node 22+).

## 1. Supabase project

1. Create a new project in the Supabase dashboard. Region: the closest to
   Israel offered at creation (it cannot be changed later). Plan: **Pro** is
   recommended for client sessions (no auto-pause; Realtime 500 messages/s
   instead of 100).
2. Project Settings → Realtime: confirm **Allow public access to channels** is
   enabled (the default). The display depends on public broadcast channels.
3. Note the project ref, the project URL and the **publishable** key
   (Project Settings → API Keys). Never copy the secret / service-role key into
   the repo.

## 2. Database

```bash
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push            # applies supabase/migrations (allowed while heatmap is the only module)
npx supabase test db --linked   # 66 pgTAP tests, all roll back (needs Docker)
#   without Docker: DB_URL="<connection string>" npm run db:test   (needs psql)
```

## 3. Host PIN

```bash
npm run set-host-pin -- --linked
```

Type the PIN twice in the hidden prompt (at least 6 characters; 8+ with letters
and digits recommended). Only a bcrypt hash is sent. Keep the PIN in a password
manager. Run the same command again to change it.

## 4. Local environment

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://<project-ref>.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 5. Hosting (Vercel)

1. Merge the feature branch into `main` (or set it as the production branch).
2. Vercel → Add New → Project → import the repository.
3. **Project Name: `ngg-platform`** — type it explicitly; do not accept the name
   derived from the repository.
4. Framework preset: Vite (auto-detected). Build and output come from
   `vercel.json`.
5. Environment variables (Production and Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_PUBLIC_BASE_URL` = the production origin, e.g.
     `https://ngg-platform.vercel.app` or the custom domain
6. Deploy. Do **not** enable Web Analytics or Speed Insights.
7. Check that the production domain is publicly reachable from a phone on
   cellular data that is not logged in to Vercel (deployment protection must
   not apply to the production domain).
8. Confirm the domain, the QR target and the short link contain no client name.

## 6. Acceptance

Follow `docs/acceptance.md`:

```bash
npx playwright install chromium                 # once, for the rendered-display check
npm run seed:40 -- --app https://<production-domain>
npm run load:60
```

Then the real-phone, projector and text checks (items 7–9).
