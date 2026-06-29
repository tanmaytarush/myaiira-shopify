#!/usr/bin/env bash
# Push Atelier header branding (wordmark, nav styling, hide localization) to the live dev theme.
# Run from tryitout/ (needs Shopify CLI auth + write_themes scope).
set -euo pipefail

cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

STORE="tryitout-dev.myshopify.com"
LIVE_THEME_ID="189132833049"
WORK_DIR=".header-branding"
BRAND_DIR="theme-branding"

echo "→ Pulling header files from live theme (test-data #${LIVE_THEME_ID})..."
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
npx shopify theme pull \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only layout/theme.liquid \
  --only sections/header-group.json \
  --path "$WORK_DIR"

echo "→ Copying Atelier branding assets..."
mkdir -p "$WORK_DIR/assets" "$WORK_DIR/snippets" "$WORK_DIR/blocks" "$WORK_DIR/layout" "$WORK_DIR/sections"
cp "$BRAND_DIR/assets/aiira-header.css" "$WORK_DIR/assets/"
cp extensions/vto-widget/assets/vto-widget.js "$WORK_DIR/assets/aiira-vto-widget.js"
cp extensions/vto-widget/assets/aiira.css "$BRAND_DIR/assets/aiira-vto.css"
cp "$BRAND_DIR/assets/aiira-vto.css" "$WORK_DIR/assets/"
cp "$BRAND_DIR/snippets/aiira-header-styles.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/snippets/aiira-header-nav.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/blocks/_header-logo.liquid" "$WORK_DIR/blocks/"
cp "$BRAND_DIR/blocks/_header-menu.liquid" "$WORK_DIR/blocks/"
cp "$BRAND_DIR/snippets/aiira-vto-only-redirect.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/snippets/aiira-vto-hash-bridge.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/snippets/aiira-vto-defaults.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/snippets/aiira-storefront-catalog.liquid" "$WORK_DIR/snippets/"
cp "$BRAND_DIR/snippets/fonts.liquid" "$WORK_DIR/snippets/"

if [ ! -f "$WORK_DIR/layout/theme.liquid" ]; then
  cp .theme-host/layout/theme.liquid "$WORK_DIR/layout/theme.liquid"
  echo "✓ Seeded layout/theme.liquid from .theme-host"
fi
if [ ! -f "$WORK_DIR/sections/header-group.json" ]; then
  cp .theme-host/sections/header-group.json "$WORK_DIR/sections/header-group.json"
  echo "✓ Seeded sections/header-group.json from .theme-host"
fi

THEME_LIQUID="$WORK_DIR/layout/theme.liquid"
if ! grep -q "aiira-header-styles" "$THEME_LIQUID"; then
  sed -i '' '/{%- render '\''fonts'\'' -%}/a\
    {%- render '\''aiira-header-styles'\'' -%}
' "$THEME_LIQUID"
  echo "✓ Injected aiira-header-styles into layout/theme.liquid"
else
  echo "✓ layout/theme.liquid already loads aiira-header-styles"
fi

if ! grep -q "aiira-vto-only-redirect" "$THEME_LIQUID"; then
  sed -i '' '/{%- render '\''aiira-header-styles'\'' -%}/a\
    {%- render '\''aiira-vto-only-redirect'\'' -%}
' "$THEME_LIQUID"
  echo "✓ Injected aiira-vto-only-redirect into layout/theme.liquid"
else
  echo "✓ layout/theme.liquid already loads aiira-vto-only-redirect"
fi

if ! grep -q "aiira-vto-hash-bridge" "$THEME_LIQUID"; then
  sed -i '' '/{%- render '\''aiira-vto-only-redirect'\'' -%}/a\
    {%- render '\''aiira-vto-hash-bridge'\'' -%}
' "$THEME_LIQUID"
  echo "✓ Injected aiira-vto-hash-bridge into layout/theme.liquid"
else
  echo "✓ layout/theme.liquid already loads aiira-vto-hash-bridge"
fi

HEADER_GROUP="$WORK_DIR/sections/header-group.json"
HEADER_GROUP="$HEADER_GROUP" node <<'NODE'
const fs = require("fs");
const path = process.env.HEADER_GROUP;

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

const data = JSON.parse(
  fs.readFileSync(path, "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, ""),
);

for (const key of Object.keys(data.sections || {})) {
  if (key.startsWith("header_announcements") || data.sections[key]?.type === "header-announcements") {
    data.sections[key].disabled = true;
  }
}

const section = data.sections?.header_section;
if (!section) {
  console.error("header_section not found in header-group.json");
  process.exit(1);
}

section.settings = {
  ...section.settings,
  logo_position: "left",
  menu_position: "left",
  menu_row: "top",
  show_search: false,
  show_country: false,
  show_language: false,
  section_width: "page-width",
  section_height: "standard",
  enable_sticky_header: "always",
  divider_width: 0,
  border_width: 1,
  actions_display_style: "icon",
};

const menuBlock = section.blocks?.["header-menu"];
if (menuBlock?.settings) {
  menuBlock.settings = {
    ...menuBlock.settings,
    menu: "main-menu",
    menu_style: "text",
    menu_font_style: "regular",
    type_font_primary_link: "body",
    type_case_primary_link: "none",
    type_font_primary_size: "0.8125rem",
    navigation_bar: false,
  };
}

fs.writeFileSync(path, header + JSON.stringify(data, null, 2) + "\n");
console.log("✓ Updated header-group.json (Atelier nav, no announcement bar)");
NODE

echo "→ Pushing header branding to live theme..."
npx shopify theme push \
  --theme "$LIVE_THEME_ID" \
  --store "$STORE" \
  --only layout/theme.liquid \
  --only sections/header-group.json \
  --only assets/aiira-header.css \
  --only assets/aiira-vto-widget.js \
  --only assets/aiira-vto.css \
  --only snippets/aiira-header-styles.liquid \
  --only snippets/aiira-header-nav.liquid \
  --only snippets/aiira-vto-only-redirect.liquid \
  --only snippets/aiira-vto-hash-bridge.liquid \
  --only snippets/aiira-vto-defaults.liquid \
  --only snippets/fonts.liquid \
  --only blocks/_header-logo.liquid \
  --only blocks/_header-menu.liquid \
  --path "$WORK_DIR" \
  --allow-live

echo ""
echo "✓ Header branding deployed (Home + Atelier AI nav only)."
echo ""
echo "Refresh https://${STORE}/ (password: detoh)"
