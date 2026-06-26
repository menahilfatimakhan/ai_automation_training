#!/usr/bin/env bash
# Pull latest, install, build, and reload the app. Run on the VPS:  ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Pulling latest from git…"
git pull origin master

echo "→ Installing dependencies (clean)…"
npm ci

echo "→ Building…"
npm run build

echo "→ Reloading PM2 process…"
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

echo "✅ Deployed."
