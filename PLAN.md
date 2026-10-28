# NGG Platform — plan: foundation + Live Heatmap

Target dates: test version 29 Oct 2026, first live use 2 Nov 2026. A printed
sticker poster is the backup, so the plan favours correctness and stability over
features.

## Milestones (one commit each)

| # | Scope | Done when |
|---|---|---|
| M1 | Database: schemas, tables, RPC functions, PIN lockout, broadcast triggers, retention cron, pgTAP tests for acceptance rules 3–6 | `npx supabase db reset` + `npm run db:test` pass on a local stack |
| M2 | App scaffold, platform primitives, participant page `/v/:shortCode` | typecheck + build pass; participant route measured |
| M3 | Display `/heatmap/display/:eventId`, host console `/heatmap/host`, Realtime + throttled refetch + fallback poll | end-to-end run against the local stack |
| M4 | Vercel config, `scripts/seed-40.ts`, `scripts/load-60.ts`, `docs/acceptance.md`, bundle-size report, manual steps | seed and load scripts pass locally |

## Files

```
CLAUDE.md, PLAN.md, README.md
index.html                       font preload, noindex, app title "NGG Platform"
vercel.json                      SPA rewrite, security headers, no analytics
public/fonts/                    Assistant woff2 (Hebrew + Latin subsets, variable 200–800)
src/main.tsx, src/App.tsx        router, lazy routes
src/platform/
  env.ts                         VITE_* config
  rpc.ts                         plain-fetch PostgREST RPC client (participant-safe)
  realtime.ts                    supabase-js Realtime subscription (display/host only)
  tokens.css, base.css           design-system tokens and base styles
  layout.tsx                     RTL page primitives
  QrCode.tsx                     SVG QR (qrcode-generator)
  hostSession.ts                 host PIN in sessionStorage
  deviceId.ts                    per-browser UUID in localStorage, memory fallback
  csv.ts                         CSV with UTF-8 BOM
  time.ts                        Israel-time formatting
src/modules/heatmap/
  content.ts                     every text of the module
  api.ts                         typed RPC wrappers
  density.ts                     heatmap maths: Gaussian density, YlOrRd ramp, dot offsets
  scale.ts                       backup bubble matrix (?view=matrix): geometry + √count sizing
  useDisplayData.ts              realtime signal → coalesced refetch, 5 s poll
  participant/ display/ host/    screens and their components
supabase/
  config.toml                    project_id = "ngg-platform"
  migrations/                    platform, heatmap, retention, show_dots
  tests/                         pgTAP tests (acceptance 3–6)
scripts/
  set-host-pin.ts                hashes the PIN locally and stores only the hash
  seed-40.ts                     40 votes, known distribution, exact checks
  load-60.ts                     60 concurrent voters incl. changes
  bundle-size.mjs                gzipped JS per route
docs/
  acceptance.md                  manual checklist (acceptance 3–9)
  design.md                      how the design system is applied
```

## Migrations

1. `…_platform.sql` — schema `platform`; `events`, `host_credentials`
   (+ `failed_attempts`, `locked_until` for the lockout); `verify_host_pin`,
   `set_host_pin_hash`, `new_short_code`.
2. `…_heatmap.sql` — schema `heatmap`; `event_state`, `votes`; broadcast helper
   and triggers; the nine `public.heatmap_*` functions with grants.
3. `…_heatmap_retention.sql` — `pg_cron`, `heatmap.purge_expired_events()`,
   daily job `heatmap-retention` at 03:17 UTC.
4. `…_heatmap_show_dots.sql` (brief V5) — `event_state.show_dots` (default
   true); `heatmap_display` and `heatmap_host_list_events` return it;
   `heatmap_host_set_state` gains an optional `p_show_dots` (old signature
   dropped, grants restated).

## Decisions taken (please confirm or overrule)

The brief asks to raise ambiguities instead of guessing. The request for this
session was to build through to the manual steps, so I took the defaults below
and kept each one easy to change.

1. **Function return shape.** Every `heatmap_*` function returns one `jsonb`
   object with a `status` field (`ok`, `closed`, `not_found`, `invalid`,
   `unauthorized`, `locked`, `not_configured`). Host functions must not raise on
   a bad PIN, because a raised error would roll back the failed-attempt counter.
2. **PIN brute-force protection.** Five consecutive wrong PINs lock all host
   functions for 60 seconds (no `pg_sleep`, which would tie up API connections).
   Trade-off: someone in the room who scripts wrong guesses can keep the host
   locked out in 60-second windows. Storing IPs to limit per caller is forbidden
   by the brief. Choose a PIN of 8+ characters with letters and digits.
3. **Lockout columns** live on `platform.host_credentials` (`failed_attempts`,
   `locked_until`). No personal data.
4. **Short codes** use 32 symbols `A–Z` minus `I`, `O`, plus `2–9`; 5 characters
   (33.5 M combinations), 6 after repeated collisions. Input is upper-cased, so a
   typed lower-case `l` is read as `L`.
5. **Reset** follows the brief literally: deletes votes, `revealed = false`,
   `voting_open = true`; `show_mean` and `show_dots` keep their values. It is on
   the host console (modal confirmation, with a reminder to export CSV first)
   and, since V5, on the projector's control bar (asks "לאשר איפוס?" in place
   and gives up after 5 s). For a different group on the next day: reset keeps
   the same QR and link; "אירוע חדש" gives a new QR and keeps the first group's
   data for export.
6. **Mean** is returned whenever `revealed = true` (as the brief says) and drawn
   only when `show_mean = true`.
7. **Broadcast triggers.** Statement-level on `heatmap.votes` (one signal per
   statement per event, so a reset sends one, not sixty) and row-level on
   `heatmap.event_state`. A failed `realtime.send()` is logged as a warning and
   never blocks a vote.
8. **CSV headers** in Hebrew (`מזהה אירוע`, `ציון X`, `ציון Y`,
   `זמן (שעון ישראל)`), which is what the BOM requirement implies. File name uses
   the short code, not the event name.
9. **Heatmap (brief V5, alternative B)**, all in `src/modules/heatmap/density.ts`:
   Gaussian density on a 140 × 140 raster, bandwidth 0.9 score units, each
   respondent a kernel with peak 1, normalised to max(peak, 2.5); ColorBrewer
   YlOrRd (9 classes, to dark red #800026), transparent below 3 % intensity.
   The map's scale runs 0–11 rather than 0.5–10.5, so the corner quadrant names
   sit clear of scores 1 and 10; 5.5 stays the exact centre.
10. **Dots and quadrant names.** One dark-blue dot with a white border per
    respondent, spread on a sunflower spiral (14 px) around its score point.
    The brief keys the offset to the device id; the public display function
    never returns device ids, so the offset is keyed to the dot's index within
    the point (fixed: a new dot never moves the others). Quadrant names sit in
    the corners on 78 % white. The backup bubble matrix (alternative A) stays
    available at `/heatmap/display/<id>?view=matrix`.
11. **Participant extras** needed for weak reception: automatic retry (votes are
    idempotent upserts), an offline/error message, and the last submitted vote
    remembered in `localStorage` so a reload shows the confirmation. All copy is
    in `content.ts` under "UI microcopy" for review.
12. **QR target.** `VITE_PUBLIC_BASE_URL` (optional) fixes the domain printed in
    the QR and short link; otherwise the current origin is used.
13. **Gauge instead of ten buttons** (owner's decision, 28 Oct, replacing the
    brief's "no slider"). The handle idles on 5 with animated arrows as a cue
    (owner's request), but to avoid the default-position bias a slider brings,
    a score counts only after a tap or drag (tapping the idle handle records 5); touch input
    tells taps, sideways drags and page scrolls apart, so scrolling never changes
    an answer.
14. **Co-brand footer** (owner's decision, 28 Oct): the client wordmark beside the
    NGG mark on the projector. Kept in `src/brand/` only.

## Open questions for Dor

- Supabase plan: Realtime on Free allows 100 messages/s and disconnects above
  that. Sixty votes in the same second with two open screens is ~120 messages/s;
  the fallback poll covers a disconnect, but **Pro (500/s) is recommended for
  2 November** — it also avoids auto-pause.
- Hosting domain: `ngg-platform.vercel.app` if free on Vercel, or a custom
  domain. Either way, set `VITE_PUBLIC_BASE_URL` to it.
- Copy review: the microcopy that is not in section 7 of the brief (buttons,
  errors, host console) needs a Hebrew read-through.

## Risks

- Anonymous voting cannot stop one person from voting from several browsers.
  Accepted by design (no identity, no IP storage).
- Public Realtime connections are capped at 24 h by Supabase; the display
  reconnects and the 5 s poll covers the gap.
- The QR size for 5 m is an estimate; it must be checked on the real projector.
