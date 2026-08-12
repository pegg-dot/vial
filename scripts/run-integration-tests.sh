#!/usr/bin/env bash
set -euo pipefail
for file in tests/integration/*.test.ts; do
  echo "[integration] $file"
  VIALGRADE_PGLITE_MEMORY=true \
  VIALGRADE_SEED_FIXTURES=true \
  VIALGRADE_SEED_DEMO_ACCOUNTS=true \
  VIALGRADE_SESSION_SECRET=integration-session-secret-at-least-32-characters \
  VIALGRADE_PRIVACY_HASH_SECRET=integration-privacy-secret-at-least-32-characters \
  npx vitest run "$file" --maxWorkers=1 --no-file-parallelism
 done
