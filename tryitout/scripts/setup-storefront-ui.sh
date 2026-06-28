#!/usr/bin/env bash
# Adds Atelier Home block to the live storefront homepage and hides the default hero.
# Run from tryitout/ (needs Shopify CLI auth + write_themes scope).
set -euo pipefail

cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

STORE="tryitout-dev.myshopify.com"
LIVE_THEME_ID="189132833049"
WORK_DIR=".storefront-ui"

echo "→ Pulling live theme homepage (test-data #${LIVE_THEME_ID})..."
mkdir -p "$WORK_DIR"
npx shopify theme pull \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/index.json \
  --path "$WORK_DIR"

INDEX="$WORK_DIR/templates/index.json"
INDEX="$INDEX" node <<'NODE'
const fs = require("fs");
const path = process.env.INDEX;

// Installed app handle on the dev store (see product.json — not vto-widget extension folder name).
const blockType =
  "shopify://apps/tryitout/blocks/aiira-home/019f082c-a6e1-7b66-bcb9-3ee06845e0f0";

const stylingProductUrl = "/products/chick-minimal";

const homeSettings = {
  hero_eyebrow: "Curation 01",
  heading: "Seasonal Poetry:",
  heading_em: "The Modern Heritage",
  tagline: "Defining the future of luxury fitting.",
  trends_heading: "Top Trends",
  cta_label: "Click to begin styling",
  cta_link: stylingProductUrl,
  look_1_link: stylingProductUrl,
  look_2_link: stylingProductUrl,
  look_3_link: stylingProductUrl,
  consult_label: "Book Consultation",
  bespoke_eyebrow: "The Atelier Experience",
};

const data = JSON.parse(
  fs.readFileSync(path, "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""),
);

// Remove invalid standalone app-block section from a prior failed push.
delete data.sections.aiira_home;
data.order = data.order.filter((key) => key !== "aiira_home");

function isAiiraHomeBlock(type) {
  return String(type || "").includes("aiira-home");
}

let appsKey = Object.keys(data.sections).find((key) => {
  const section = data.sections[key];
  if (section.type !== "apps" || !section.blocks) return false;
  return Object.values(section.blocks).some((block) =>
    isAiiraHomeBlock(block.type),
  );
});

if (!appsKey) {
  appsKey = "atelier_home_apps";
  data.sections[appsKey] = {
    type: "apps",
    blocks: {},
    block_order: [],
    settings: { include_margins: false },
  };
}

const appsSection = data.sections[appsKey];
let blockKey = Object.keys(appsSection.blocks || {}).find((key) =>
  isAiiraHomeBlock(appsSection.blocks[key].type),
);
if (!blockKey) {
  blockKey = "tryitout_aiira_home";
}

appsSection.blocks[blockKey] = {
  type: blockType,
  settings: homeSettings,
};
appsSection.block_order = [blockKey];
appsSection.settings = { include_margins: false };

const heroKey = Object.keys(data.sections).find(
  (key) => data.sections[key].type === "image-banner",
);
if (heroKey) {
  data.sections[heroKey].disabled = true;
}

for (const key of ["featured_collection", "f1552b18-6017-4231-810d-74e61da22c37", "38cdf60f-e431-43b5-aac3-7e6215447d67"]) {
  if (data.sections[key]) {
    data.sections[key].disabled = true;
  }
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
console.log("✓ Prepared index.json with Atelier Home block (apps section)");
NODE

echo "→ Pushing homepage to live theme..."
npx shopify theme push \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only templates/index.json \
  --path "$WORK_DIR" \
  --allow-live

echo ""
echo "✓ Done. Refresh https://${STORE}/ (password: detoh)"
