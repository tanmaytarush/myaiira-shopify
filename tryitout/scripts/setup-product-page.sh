#!/usr/bin/env bash
# Hides default product section; keeps Atelier Look as the product page.
set -euo pipefail

cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

STORE="tryitout-dev.myshopify.com"
LIVE_THEME_ID="189132833049"
WORK_DIR=".product-page-ui"

echo "→ Pulling product template from live theme..."
mkdir -p "$WORK_DIR"
npx shopify theme pull \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/product.json \
  --path "$WORK_DIR"

INDEX="$WORK_DIR/templates/product.json"
INDEX="$INDEX" node <<'NODE'
const fs = require("fs");
const path = process.env.INDEX;

const data = JSON.parse(
  fs.readFileSync(path, "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""),
);

if (data.sections.main) data.sections.main.disabled = true;
if (data.sections["related-products"]) data.sections["related-products"].disabled = true;

for (const key of Object.keys(data.sections)) {
  const section = data.sections[key];
  if (section.type === "apps") {
    section.settings = section.settings || {};
    section.settings.include_margins = false;
  }
  if (section.type !== "apps") continue;
  const blocks = section.blocks || {};
  for (const blockKey of Object.keys(blocks)) {
    if (String(blocks[blockKey].type || "").includes("try-on-button")) {
      delete blocks[blockKey];
    }
  }
  section.blocks = blocks;
  section.block_order = (section.block_order || []).filter((id) => blocks[id]);
  if (Object.keys(blocks).length === 0) section.disabled = true;
}

data.order = data.order.filter((key) => {
  const section = data.sections[key];
  return section && !section.disabled;
});

const header = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

fs.writeFileSync(path, header + JSON.stringify(data, null, 2) + "\n");
console.log("✓ Atelier Look only on product page");
NODE

echo "→ Pushing product template to live theme..."
npx shopify theme push \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/product.json \
  --path "$WORK_DIR" \
  --allow-live

echo ""
echo "✓ Product page updated."
