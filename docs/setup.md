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

### Without a local machine (GitHub only)

1. GitHub → the repository → Settings → Secrets and variables → Actions →
   New repository secret, four times:
   - `SUPABASE_ACCESS_TOKEN`: a personal access token from
     supabase.com → Account → Access Tokens
   - `SUPABASE_DB_PASSWORD`: the database password chosen when the project
     was created (Project Settings → Database lets you reset it)
   - `SUPABASE_PROJECT_ID`: the project ref (the part of the project URL before
     `.supabase.co`)
   - `HOST_PIN`: the host PIN (at least 6 characters; 8+ with letters and digits
     recommended)
2. Actions → **Supabase: apply migrations** → Run workflow → type `migrate` →
   Run. The log lists the migrations, applies them and runs the 66 database
   tests (they roll back).
3. Actions → **Supabase: set host PIN** → Run workflow. The PIN is hashed on the
   runner and only the hash is stored. To change the PIN later, update the
   `HOST_PIN` secret and run this workflow again.

If the retention migration fails on `pg_cron`, enable the **pg_cron** extension
under Database → Extensions in the Supabase dashboard and run the migration
workflow again.

### With a local machine

```bash
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push            # applies supabase/migrations (allowed while heatmap is the only module)
npx supabase test db --linked   # 66 pgTAP tests, all roll back (needs Docker)
#   without Docker: DB_URL="<connection string>" npm run db:test   (needs psql)
```

## 3. Host PIN

GitHub only: the **Supabase: set host PIN** workflow (step 2 above). With a
local machine:

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
