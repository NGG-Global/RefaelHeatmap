# NGG Platform — conventions

One web app and one Supabase project for all NGG live-workshop tools. Each tool is
a *module*. The first module is `heatmap` (Live Heatmap). Every session working in
this repo follows the rules below.

## Confidentiality

- The client's name must not appear anywhere: code, UI, commits, seed data, docs,
  file names, hosting project names or URLs. Use `ngg-platform` as the package
  name, app title and any internal identifier. The repository name is outside our
  control; never repeat it.
- The participant-facing URL must not contain the client's name. The hosting
  project is named `ngg-platform` explicitly (never derived from the repo name).

## Front end

- Vite + React + TypeScript, `react-router`, route-level code splitting
  (`React.lazy` per route). Static build, deployed as an SPA (`vercel.json`
  carries the rewrite).
- Folder layout:
  - `src/platform/` — shared pieces only: Supabase/RPC clients, design tokens,
    fonts, Hebrew/RTL layout primitives, QR component, host-PIN session helper,
    CSV helper, device-ID helper.
  - `src/modules/<module>/` — everything specific to one module.
  - `supabase/migrations/` — every schema change, as a migration file.
  - `supabase/tests/` — SQL-level tests (pgTAP).
  - `scripts/` — seed, load-test and admin scripts.
- Participant routes stay light: no `@supabase/supabase-js` import on them. They
  call RPCs with plain `fetch` (`src/platform/rpc.ts`). Only display and host
  screens load supabase-js, and only for Realtime.
- All UI copy for a module lives in one file (`src/modules/<module>/content.ts`).
- Hebrew UI: `dir="rtl"`, right-aligned text on every screen. Charts that carry
  numeric axes force `dir="ltr"` on their container.
- Design: the programme design system (tokens in `src/platform/tokens.css`,
  applied as described in `docs/design.md`). Assistant only, self-hosted woff2,
  preloaded; no runtime call to Google Fonts. Radii are 0, 50 % or stadium —
  never a light 4–8 px rounding. No borders, no shadows, no decorative animation.
- No analytics, tracking pixels or third-party scripts of any kind. Do not enable
  hosting-provider analytics.

## Database

- Schema `platform` — shared tables (events, host credentials).
- Schema `<module>` (e.g. `heatmap`) — module tables.
- Neither schema is exposed through the Data API. The browser reaches the
  database only through functions in `public` named `<module>_<action>`
  (e.g. `heatmap_cast_vote`), created `security definer` with
  `set search_path = ''`. `execute` is revoked from `public` and
  `authenticated`, and granted to `anon` only on functions meant for the
  browser. Internal helpers live in the private schemas.
- RLS is enabled on every table and nothing is granted to `anon` or
  `authenticated` on any table.
- Store no personal data: no names, phone numbers, emails, IP addresses or user
  agents.
- Host functions take the PIN on every call and verify it with
  `platform.verify_host_pin()`. They never raise on a bad PIN; they return
  `{"status": "unauthorized" | "locked" | "not_configured"}` so the failed-attempt
  counter commits.
- Realtime: one public broadcast channel per event, topic `<module>:<event_id>`.
  Database triggers send a payload-free "changed" signal with `realtime.send()`;
  clients refetch through the RPC, so the channel never carries data.

## Migrations

- Every schema change is a migration file in `supabase/migrations/`. Never change
  the database through the dashboard SQL editor.
- Apply locally first (`npx supabase db reset`, then `npm run db:test`).
- **Temporary exception:** while `heatmap` is the only module in the project,
  migrations may be applied to the remote project with `npx supabase db push`
  when local Docker is unavailable. **This exception expires the day a second
  module goes live** in this project; from then on, every migration is tested on
  a local stack first.
- Shared-database discipline (once more than one module is live): no migrations
  within 48 hours of any module's live client session, and no deploys on the day
  of a session.
- Never connect Lovable or any other tool that runs its own migrations to this
  Supabase project.

## Secrets

- `.env.local` is git-ignored. Only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable / anon key) may reach the front
  end.
- The service-role / secret key never enters the repo or the browser.
- The host PIN is never stored in the repo. It is set with
  `npm run set-host-pin`, which hashes it locally (bcrypt `$2a$`) and sends only
  the hash, or by the manual workflow **Supabase: set host PIN** from the
  `HOST_PIN` repository secret.
- Database credentials for CI live only in GitHub repository secrets
  (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`).
  Migrations to the remote project run only through the manual workflow
  **Supabase: apply migrations**, never automatically on push.

## Checks before every commit

- `npm run typecheck`, `npm test`, `npm run build`
- `npm run db:test` against a local stack after any migration change
- `npm run size` after any change to the participant route
