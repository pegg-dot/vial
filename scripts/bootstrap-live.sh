#!/usr/bin/env bash
# Populate a FRESH database with 100% live data — no demos. This is the reproducible "everything is
# in there" step for a deploy: point it at the target DB and it runs the full live-data pipeline in
# dependency order. Idempotent (every ingest upserts), so it's safe to re-run.
#
# Usage:
#   # Production (managed Postgres):
#   DATABASE_URL=postgres://…  VIAL_LIVE_INGEST_APPROVED=true  ./scripts/bootstrap-live.sh
#   # Local dev (file-backed PGlite): just VIAL_LIVE_INGEST_APPROVED=true ./scripts/bootstrap-live.sh
#
# Requires: VIAL_LIVE_INGEST_APPROVED=true (live network + writes are gated). Never seeds demos
# (each script self-guards VIAL_SEED_FIXTURES=false). Run with the dev server STOPPED locally
# (file-backed PGlite is single-writer); on managed Postgres that doesn't apply.
set -euo pipefail
export VIAL_SEED_FIXTURES=false

if [ "${VIAL_LIVE_INGEST_APPROVED:-}" != "true" ]; then
  echo "Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true (live network + writes are gated)."; exit 1
fi

run() { echo; echo "▶ $*"; node --import tsx "$@"; }

echo "== VIAL live-data bootstrap =="
echo "Target: ${DATABASE_URL:+managed Postgres}${DATABASE_URL:-local PGlite}"

# 1) Compounds + vendor profiles + live Shopify/WooCommerce catalogs + Janoshik feed COAs + flags +
#    prices + community reviews + linkage. (Live network: re-fetches current vendor catalogs.)
run scripts/ingest-market.mjs

# 2) Vendor-published independent-lab COAs + self-published COAs + registry lab reconcile +
#    buyer-reputation records + REAL batch passports + registry IDs.
run scripts/ingest-vendor-coas.mjs

# 3) Newest Janoshik tests + analysis-type/blind annotation + liveness (offline uses the committed
#    snapshot; drop --offline to refresh from the live portal).
run scripts/collect-janoshik-discover.mjs --offline

echo
echo "== Bootstrap complete. The database now holds only live data. =="
