# tryitout — Myaiira Virtual Try-On (Shopify app)

A Shopify **public app** that adds a product-page virtual try-on, backed by the existing
`myaiira-ai` service. Shoppers upload a photo on a product page, the app generates a
try-on image, and the result renders inline — all without exposing any secret to the
storefront.

## Two-repo boundary

| Repo | Owns |
| --- | --- |
| `myaiira-ai` (Python/SAM) | VTO engine, async job endpoints, DynamoDB `vto_jobs`, worker, S3 |
| `tryitout` (this folder, Remix + Polaris) | Theme App Extension, App Proxy, myaiira client, admin, billing |

## Two non-negotiable rules

1. **Secrets stay server-side.** Storefront calls only `/apps/myaiira/vto/*` via App Proxy.
2. **VTO is async.** Submit returns `job_id` in under 2s; storefront polls for status.

See [`DECISIONS.md`](./DECISIONS.md) for locked decisions.

## Local setup

```bash
nvm use
cp .env.example .env
shopify app config link
npm run setup:theme-host   # once
npm run dev
```

### Add Atelier UI blocks (theme editor)

| Block | Where | Matches reference |
|-------|--------|-------------------|
| **Atelier Home** | Home page | Hero, trends carousel, bespoke section |
| **Atelier Collection** | Collection page | Editorial product grid |
| **Atelier Look** | Product page | PDP + try-on modal |

### Wire the full Atelier flow (run once after deploy)

```bash
npm run setup:storefront-ui   # homepage
npm run setup:collection-ui   # /collections/all styling
npm run setup:product-page    # product PDP (e.g. chick-minimal)
```

**Intended shopper path:** Home → **Start Virtual Try-On** → Atelier product page → **Try this look** → VTO modal.

Set **Primary styling product** in the Atelier Home block to `chick-minimal` so the CTA skips the default Dawn catalog.

**Online Store → Themes → Customize** → add blocks from **Apps**.

If host theme errors appear, see [`docs/DEV-STORE-SETUP.md`](./docs/DEV-STORE-SETUP.md).
