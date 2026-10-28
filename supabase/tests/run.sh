#!/usr/bin/env bash
# Runs the pgTAP tests with psql and fails on any "not ok" or plan mismatch.
# Every test file rolls back, so this is safe against any database.
#   npm run db:test                      # local stack (npx supabase start)
#   DB_URL=postgresql://... npm run db:test
# Equivalent with the Supabase CLI: npx supabase test db
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
dir="$(cd "$(dirname "$0")" && pwd)/database"
status=0
for f in "$dir"/*.test.sql; do
  echo "# $(basename "$f")"
  out="$(psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 -f "$f" 2>&1)" || status=1
  echo "$out"
  if grep -q -E '^not ok|^# Looks like|ERROR' <<<"$out"; then status=1; fi
done
if [ "$status" -ne 0 ]; then echo "FAILED"; else echo "ALL PASSED"; fi
exit "$status"
