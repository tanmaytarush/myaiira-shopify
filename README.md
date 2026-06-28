# myaiira-shopify

Monorepo for the **Myaiira Virtual Try-On** Shopify app and its AI backend.

## Product

**[app.myaiira.com](https://app.myaiira.com)** — install and manage Myaiira on your Shopify store (admin UI, look builder, billing, theme extension setup).

---

## Repository layout

| Folder | Purpose |
| --- | --- |
| [`tryitout/`](./tryitout/) | Shopify Remix app — Polaris admin, App Proxy, Theme Extension |
| [`myaiira-ai/`](./myaiira-ai/) | Python/SAM VTO engine and async jobs API |

### What lives where

**`tryitout/`** — everything merchants and shoppers touch in Shopify:

- Theme App Extension (Atelier Home, Collection, Look + VTO modal)
- App Proxy routes (`/apps/myaiira/vto/*`) — secrets never reach the storefront
- Admin: Look builder, product metafields, job status
- Connects to the AI backend for async try-on jobs

**`myaiira-ai/`** — the inference and job pipeline:

- `virtual-tryon` Lambda — async image generation
- Job storage, S3 uploads, worker orchestration
- Prod API: [ai.myaiira.com](https://ai.myaiira.com) · Dev: [ai-dev.myaiira.com](https://ai-dev.myaiira.com)

```
Shopper (storefront) → App Proxy (tryitout) → AI API (myaiira-ai) → result image
Merchant (Admin)     → app.myaiira.com (tryitout) → Products / metafields / looks
```

---

## Getting started

| Package | Docs |
| --- | --- |
| Shopify app | [`tryitout/PROJECT.md`](./tryitout/PROJECT.md) · [`tryitout/README.md`](./tryitout/README.md) |
| AI backend | [`myaiira-ai/README.md`](./myaiira-ai/README.md) · [`myaiira-ai/GETTING_STARTED.md`](./myaiira-ai/GETTING_STARTED.md) |

**Shopify app (local dev):**

```bash
cd tryitout
nvm use
cp .env.example .env
shopify app config link
npm run dev
```

**AI backend (local dev):**

```bash
cd myaiira-ai
python3.12 -m venv .venv && source .venv/bin/activate
make setup
cp .env.example .env.dev
```
