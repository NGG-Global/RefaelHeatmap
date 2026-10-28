# Acceptance checklist — Live Heatmap

Run in this order against the **cloud** project (the test version), then again
at the dry run. Tests 1–6 are scripted; 7–9 need people, phones and the
projector. Record the date, who ran it and the result next to each item.

Setup for the scripted tests: `.env.local` holds the cloud URL and publishable
key; you type the host PIN when prompted (never put it in a file).

## Scripted

### 1. Seed of 40 votes — `npm run seed:40 -- --app https://<production-domain>`

- [ ] Prints `ALL CHECKS PASSED`.
- [ ] Covers: cell counts, voter counter (40), mean (6.05, 6.50), every bubble's
      position, printed count and diameter (√count, 90 % cap, floor of 5,
      46 px minimum), no overlap next to the maximum (8 votes at (7,8) beside
      (8,8) and (7,7)), midlines at 5.5, mean marker, export rows and CSV
      (BOM, header, Israel time, no device id).
- [ ] The rendered-display part needs Playwright once:
      `npx playwright install chromium` (without it the script skips that part
      and says so).
- [ ] Open `test-results/seed-40-display.png` and compare with the expected
      table the script prints.
- [ ] The event is kept for a look on the projector; delete it from the host
      console afterwards (or run with `--cleanup`).

### 2. Load of 60 voters — `npm run load:60`

- [ ] Prints `ALL CHECKS PASSED`: 60 concurrent votes, 30 changes and 20
      duplicate submissions accepted; exactly 60 rows; the simulated display
      reflects the final state within 2 s of the last vote.
- [ ] Note the printed median / p95 vote latency (from your network).

### 3–6. Database rules — `npm run db:test` (local) or `npx supabase test db --linked`

- [ ] 66 pgTAP tests pass. They cover:
  - 3: no cells or mean before reveal, including a direct `heatmap_display`
    call as `anon`; hidden again after hide.
  - 4: after close, new votes and vote changes are refused and nothing is
    stored.
  - 5: a new event starts empty; reset removes every vote, hides results and
    reopens voting; delete removes the event.
  - 6: every host function fails with a wrong, empty or missing PIN and changes
    nothing; lockout after five wrong PINs; `anon` cannot read any table or call
    internal helpers; `authenticated` cannot call host functions.
- [ ] Spot check 3 by hand with the publishable key (before reveal):

  ```bash
  curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/heatmap_display" \
    -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
    -d '{"p_event_id":"<event id>"}'
  # expect "cells": null and "mean": null
  ```

## Manual

### 7. Two real phones on cellular data (Wi-Fi off)

One iPhone (Safari) and one Android phone (Chrome).

- [ ] Scan the QR from the projected lobby; the page opens without a login.
- [ ] Opening line and both questions match section 7; Hebrew is right-aligned.
- [ ] Choosing a score highlights its band; "שליחה" stays disabled until both
      questions are answered.
- [ ] Submit shows "תודה, ההצבעה נקלטה"; the projector counter goes up.
- [ ] Change one answer → "עדכון ההצבעה" → submit again; the counter does not
      go up, the bubble moves after the reveal.
- [ ] Close voting from the host console; the next submit shows
      "ההצבעה הסתיימה". Reload: the closed message appears instead of the form.
- [ ] Airplane mode on, submit: a connection message appears and nothing breaks;
      airplane mode off, submit again: confirmation.

### 8. Projector at 1920 × 1080

- [ ] Browser full screen (F11) on the projector laptop; the stage fills the
      screen without scrollbars.
- [ ] QR scans from about 5 m with both phones (also from the side seats).
- [ ] Event name, short link, counter, tick numbers, quadrant names, bubble
      counts and "ממוצע" are readable from the back row.
- [ ] Host control bar appears on mouse movement and disappears, with the
      cursor, about 3 s later.
- [ ] Grid lines and midlines stay visible through the bubbles.
- [ ] Check the short link and QR target: the domain must be the production
      domain and must not contain the client's name.

### 9. Texts and direction

- [ ] Every text in `src/modules/heatmap/content.ts` section A matches section 7
      of the brief character by character (opening line, questions, axis labels,
      ten band texts, four quadrant names, two messages).
- [ ] Section B (UI microcopy) has had a Hebrew read-through.
- [ ] Hebrew is right-aligned on the participant page, display and host console.
- [ ] Matrix axes are not mirrored: X 1 → 10 left to right, Y 1 → 10 bottom to
      top; "מובילים מהחזית" is top right.

## Before the live session (2 November)

- [ ] No deploys on the day; no migrations within 48 h once a second module is
      live.
- [ ] Create the real event in the host console the day before; open its display
      on the projector laptop from the host console (the control bar needs the
      PIN in that window).
- [ ] Printed sticker poster packed as the backup.
- [ ] After the session: export CSV, then delete or let the 30-day retention
      remove the event.
