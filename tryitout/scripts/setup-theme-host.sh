#!/usr/bin/env bash
# One-time setup: create a development host theme for theme app extension preview.
# Run from tryitout/ in your terminal (interactive — needs Shopify auth + store password).
set -euo pipefail

cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

STORE="tryitout-dev.myshopify.com"
HORIZON_ID="189132800281"

echo "→ Pulling Horizon (#${HORIZON_ID}) into .theme-host/ (if missing)..."
if [ ! -f .theme-host/layout/theme.liquid ]; then
  mkdir -p .theme-host
  npx shopify theme pull --theme "$HORIZON_ID" --store "$STORE" --path .theme-host
fi

echo "→ Creating development theme (context: tryitout-vto)..."
cd .theme-host
npx shopify theme push --development-context tryitout-vto --store "$STORE"

echo ""
echo "→ Development theme info:"
npx shopify theme info --store "$STORE"

DEV_ID=$(npx shopify theme info --store "$STORE" 2>/dev/null | grep -oE 'Development Theme ID[^0-9]*[0-9]+' | grep -oE '[0-9]+$' || true)
if [ -n "$DEV_ID" ]; then
  echo ""
  echo "✓ Development theme ID: $DEV_ID"
  echo "  Run: npm run dev"
else
  echo ""
  echo "⚠ Development theme ID not set. Try: npm run dev -- --theme $HORIZON_ID"
fi
