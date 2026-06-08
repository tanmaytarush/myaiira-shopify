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
nvm use          # Node 20 (see .nvmrc)
cp .env.example .env   # fill in values
shopify app config link   # link to "tryitout" in Partner Dashboard
npm run dev        # uses --theme Dawn on tryitout-dev
```

If `themeCreate` 401 appears, follow [`docs/DEV-STORE-SETUP.md`](./docs/DEV-STORE-SETUP.md).
