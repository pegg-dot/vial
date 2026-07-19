#!/usr/bin/env bash
set -euo pipefail
for file in tests/integration/*.test.ts; do
  echo "[integration] $file"
  VIAL_PGLITE_MEMORY=true \
  VIAL_SEED_FIXTURES=true \
  VIAL_SEED_DEMO_ACCOUNTS=true \
  VIAL_SESSION_SECRET=integration-session-secret-at-least-32-characters \
  VIAL_PRIVACY_HASH_SECRET=integration-privacy-secret-at-least-32-characters \
  npx vitest run "$file" --maxWorkers=1 --no-file-parallelism
 done
