#!/bin/zsh
# Opens the local research-only VialGrade preview. Never deploys or pushes.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORT=39571
URL="http://127.0.0.1:$PORT/intelligence"
cd "$REPO"

# Explicit research-only safeguards. The old marketplace is NOT enabled.
export VIALGRADE_PUBLIC_EVIDENCE_ONLY=true
export VIALGRADE_LOCAL_PREVIEW=true
export VIALGRADE_PGLITE_MEMORY=true
export VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS=true
export VIALGRADE_SEED_FIXTURES=true
export VIALGRADE_SEED_DEMO_ACCOUNTS=true
export NEXT_PUBLIC_SITE_URL="http://127.0.0.1:$PORT"
export VIALGRADE_SESSION_SECRET="$(openssl rand -hex 48)"
export VIALGRADE_PRIVACY_HASH_SECRET="$(openssl rand -hex 48)"

if ! [[ -d node_modules/next ]]; then
  echo "Installing local dependencies (one-time setup, no Vercel charges)..."
  if [[ -L node_modules ]]; then rm node_modules; fi
  npm ci --prefer-offline
fi

if ! [[ -f .next/BUILD_ID && -f .vialgrade-local-preview-build ]]; then
  echo "Preparing research-only local build (no deployment)..."
  npm run build
  touch .vialgrade-local-preview-build
fi

if ! curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; then
  echo "Starting local-only research preview on $URL..."
  nohup ./node_modules/.bin/next start --hostname 127.0.0.1 --port "$PORT" \
    > "$REPO/local-preview.log" 2>&1 < /dev/null &
  for i in {1..45}; do
    if curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

if curl -fsS --max-time 4 "$URL" >/dev/null 2>&1; then
  echo "Opening Safari: $URL"
  open -a Safari "$URL"
else
  echo "The local preview did not start. Check local-preview.log in the preview folder."
  exit 1
fi

echo "This is a local research-only preview, not vialgrade.com. No purchases are enabled."
