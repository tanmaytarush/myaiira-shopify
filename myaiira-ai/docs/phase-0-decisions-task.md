# Phase 0 — Decisions & Environment

> Paste this whole file into Claude Code as the task. It is self-contained.

## Context

We are building **Myaiira Virtual Try-On**, a Shopify *public* app that adds a product-page (PDP) virtual try-on, backed by the existing `myaiira-ai` service. There are two repositories:

- `myaiira-ai/` (existing): Python Lambda/SAM VTO engine. Async job endpoints get added in a later phase.
- `myaiira-shopify-app/` (new): Remix + Polaris app + a Theme App Extension.

Two rules are non-negotiable and every later phase must honor them:

1. **Secrets stay server-side.** The storefront calls only same-origin App Proxy routes under `/apps/myaiira/vto/*`. `MYAIIRA_API_KEY` and AWS credentials must never appear in Liquid, theme assets, or any browser-delivered JS. All `myaiira-ai` calls happen in Remix server code.
2. **VTO is async.** Submitting a job returns in under 2 seconds with a `job_id`. A background worker processes the job. The storefront polls for status. Job state lives in DynamoDB with a 72-hour TTL.

**This phase is DOCS ONLY.** Do not scaffold the Remix app, install dependencies, write application code, or create any AWS resources. Produce exactly the files listed under Deliverables and nothing else.

## Locked decisions (write these into `DECISIONS.md`)

1. **Hosting (Remix app):** Fly.io. *(Default — change this one line to "AWS App Runner / ECS" for single-cloud consolidation with `myaiira-ai`, or "Railway" for simplest DX.)*
2. **Worker trigger (`myaiira-ai`):** SQS queue + a dedicated worker Lambda. Gives built-in retries, a dead-letter queue, and backpressure. *(Default — change to "async Lambda self-invoke" if you prefer less infrastructure and will own retries yourself.)*
3. **Job store:** DynamoDB table `vto_jobs`.
4. **Data retention:** 72 hours, expressed as a single shared constant `VTO_JOBS_TTL_HOURS=72`, applied identically to the DynamoDB TTL and the S3 lifecycle rule. The public privacy page must quote this same value.
5. **Scopes (v1):** `read_products`, `write_app_proxy`.
6. **Billing:** Shopify Billing API — 7-day free trial plus tiers gated on monthly try-on count (e.g. 100 / 500 / 2000). The test/live flag is **environment-driven** (`BILLING_TEST`), never hardcoded.
7. **Database:** PostgreSQL in **both** dev and prod. (We deliberately override "SQLite for dev" to avoid migration drift between engines.)
8. **Environment separation:** distinct Shopify app registration and distinct AWS buckets/tables for dev vs prod. Development happens on a Shopify development store first; production is a later config-only switch.
9. **`sub_type` mapping baseline (20 categories + default):** kurta, kurti, saree, lehenga, salwar_kameez, churidar, anarkali, sherwani, nehru_jacket, dhoti, dupatta, blouse, palazzo, sharara, indo_western, shirt, tshirt, dress, top, bottom — with a `default` fallback for unmapped products.

## Async jobs contract (document verbatim in both repos' docs)

```
POST /virtual-tryon/jobs
  -> 202 Accepted
     { "job_id": "<uuid>", "status": "queued" }

GET /virtual-tryon/jobs/{job_id}
  -> 200 OK
     {
       "job_id": "<uuid>",
       "status": "queued | processing | completed | failed",
       "progress": 0-100,
       "image_url": "<present only when completed>",
       "error": "<present only when failed>",
       "created_at": "<iso8601>"
     }

POST /virtual-tryon  (legacy, synchronous)
  -> kept working for debug/back-compat; deprecated for storefront use.
```

The storefront → backend path, documented as the boundary:

```
Storefront widget  --(same-origin, HMAC-signed)-->  App Proxy (Remix server)
App Proxy          --(server-side, holds API key)-->  myaiira-ai jobs API
myaiira-ai         -->  DynamoDB (vto_jobs, 72h TTL)  +  S3 (uploads, results)
```

## Deliverables

### In `myaiira-shopify-app/` (new repo)

- `README.md` — one paragraph on what the app is, the two-repo boundary, and the two non-negotiable rules above.
- `DECISIONS.md` — the nine locked decisions, the async jobs contract, and the boundary diagram (the two code blocks above).
- `.env.example` — every environment-specific value, with placeholder values and a one-line comment each:
  - `SHOPIFY_API_KEY`
  - `SHOPIFY_API_SECRET`
  - `SHOPIFY_APP_URL`
  - `SCOPES=read_products,write_app_proxy`
  - `MYAIIRA_API_BASE`
  - `MYAIIRA_API_KEY`
  - `S3_UPLOAD_BUCKET`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `DATABASE_URL` (Postgres)
  - `VTO_JOBS_TTL_HOURS=72`
  - `BILLING_TEST=true`
  - `SESSION_SECRET`
- `docs/.gitkeep` — placeholder so the docs folder exists for later phases.

### In `myaiira-ai/` (existing repo)

- Append a new section titled **"Shopify Integration"** to `docs/ARCHITECTURE.md` containing: the boundary description, the async jobs contract (verbatim from above), the `vto_jobs` table fields (`job_id` PK, `status`, `progress`, `image_url`, `error`, `created_at`, `ttl`), and the retention rule (72h via TTL + S3 lifecycle). Do not modify any code or `template.yaml` in this phase.

## Acceptance

- `DECISIONS.md` exists in `myaiira-shopify-app/` and records all nine decisions plus the async jobs contract.
- `.env.example` enumerates every required variable; no secrets contain real values.
- `docs/ARCHITECTURE.md` in `myaiira-ai/` has a Shopify Integration section describing the boundary and the async jobs contract.
- No application code, dependencies, or AWS resources were created.

## Note on the two repos

Phase 0 touches both repos. If they are sibling directories, run this task once from their shared parent. Otherwise, complete the `myaiira-shopify-app/` deliverables first, then run a second pass for the single `myaiira-ai/` documentation change.
