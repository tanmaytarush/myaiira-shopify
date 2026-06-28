#!/usr/bin/env bash
# Replaces default collection grid with Atelier Collection app block.
set -euo pipefail

cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

STORE="tryitout-dev.myshopify.com"
LIVE_THEME_ID="189132833049"
WORK_DIR=".collection-ui"

echo "→ Pulling collection template from live theme..."
mkdir -p "$WORK_DIR/templates"
npx shopify theme pull \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/collection.json \
  --path "$WORK_DIR"

INDEX="$WORK_DIR/templates/collection.json"
INDEX="$INDEX" node <<'NODE'
const fs = require("fs");
const path = process.env.INDEX;

const blockType =
  "shopify://apps/tryitout/blocks/atelier-collection/019f082c-a6e1-7b66-bcb9-3ee06845e0f0";

const data = JSON.parse(
  fs.readFileSync(path, "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""),
);

// Remove invalid standalone section from a prior failed push.
delete data.sections.atelier_collection;
data.order = data.order.filter((key) => key !== "atelier_collection");

for (const key of Object.keys(data.sections)) {
  const section = data.sections[key];
  if (
    section.type === "main-collection-banner" ||
    section.type === "main-collection-product-grid"
  ) {
    section.disabled = true;
  }
}

const appsKey = "atelier_collection_apps";
data.sections[appsKey] = {
  type: "apps",
  blocks: {
    tryitout_atelier_collection: {
      type: blockType,
      settings: {
        eyebrow: "Curated for you",
        products_per_page: 12,
      },
    },
  },
  block_order: ["tryitout_atelier_collection"],
  settings: { include_margins: false },
};

data.order = [appsKey, ...data.order.filter((key) => key !== appsKey)];

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
console.log("✓ Prepared collection.json with Atelier Collection block (apps section)");
NODE

echo "→ Pushing collection template to live theme..."
npx shopify theme push \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/collection.json \
  --path "$WORK_DIR" \
  --allow-live

echo ""
echo "✓ Done. Refresh https://${STORE}/collections/all (password: detoh)"
