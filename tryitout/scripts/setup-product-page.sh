#!/usr/bin/env bash
# Disables default Horizon product sections; wires Atelier Look app block.
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

const blockType =
  "shopify://apps/tryitout/blocks/look-outfit/019f082c-a6e1-7b66-bcb9-3ee06845e0f0";

const data = JSON.parse(
  fs.readFileSync(path, "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""),
);

if (data.sections.main) data.sections.main.disabled = true;
if (data.sections["related-products"]) data.sections["related-products"].disabled = true;
if (data.sections.product_recommendations_qggXJq) {
  data.sections.product_recommendations_qggXJq.disabled = true;
}

function isLookOutfitBlock(type) {
  return String(type || "").includes("look-outfit");
}

let appsKey = Object.keys(data.sections).find((key) => {
  const section = data.sections[key];
  if (section.type !== "apps" || !section.blocks) return false;
  return Object.values(section.blocks).some((block) =>
    isLookOutfitBlock(block.type),
  );
});

if (!appsKey) {
  appsKey = "atelier_look_apps";
  data.sections[appsKey] = {
    type: "apps",
    blocks: {},
    block_order: [],
    settings: { include_margins: false },
  };
}

const appsSection = data.sections[appsKey];
let blockKey = Object.keys(appsSection.blocks || {}).find((key) =>
  isLookOutfitBlock(appsSection.blocks[key].type),
);
if (!blockKey) {
  blockKey = "tryitout_look_outfit";
}

appsSection.blocks[blockKey] = {
  type: blockType,
  settings: {},
};
appsSection.block_order = [blockKey];
appsSection.settings = { include_margins: false };

for (const key of Object.keys(data.sections)) {
  const section = data.sections[key];
  if (key === appsKey || section.type === "apps") continue;
  if (section.type === "product-information" || section.type === "product-recommendations") {
    section.disabled = true;
  }
}

for (const key of Object.keys(data.sections)) {
  const section = data.sections[key];
  if (section.type !== "apps" || key === appsKey) continue;
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
console.log("✓ Prepared product.json with Atelier Look block (apps section)");
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
