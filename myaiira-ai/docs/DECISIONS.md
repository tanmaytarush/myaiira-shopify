# Decisions

Status: locked for v1 · Last updated: 2026-06-06

This document records the foundational decisions for **Myaiira Virtual Try-On**. Later
phases must honor these. To change a decision, edit it here first.

## Architecture decisions

1. **Hosting (Remix app):** Fly.io.
   _Swap this single line to "AWS App Runner / ECS" for single-cloud consolidation with
   `myaiira-ai`, or "Railway" for simplest DX._

2. **Worker trigger (`myaiira-ai`):** SQS queue + a dedicated worker Lambda.
   Chosen for built-in retries, a dead-letter queue, and backpressure.
   _Swap to "async Lambda self-invoke" if you prefer less infrastructure and will own
   retries yourself._

3. **Job store:** DynamoDB table `vto_jobs`.

4. **Data retention:** 72 hours, expressed as a single shared constant
   `VTO_JOBS_TTL_HOURS=72`, applied identically to the DynamoDB TTL and the S3 lifecycle
   rule. The public privacy page quotes this same value.

5. **Scopes (v1):** `read_products`, `write_app_proxy`.

6. **Billing:** Shopify Billing API — 7-day free trial plus tiers gated on monthly
   try-on count (e.g. 100 / 500 / 2000). The test/live flag is environment-driven
   (`BILLING_TEST`), never hardcoded.

7. **Database:** PostgreSQL in **both** dev and prod. We deliberately override
   "SQLite for dev" to avoid migration drift between engines.

8. **Environment separation:** distinct Shopify app registration and distinct AWS
   buckets/tables for dev vs prod. Development happens on a Shopify development store
   first; production is a later config-only switch.

## Async jobs contract

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

POST /virtual-tryon   (legacy, synchronous)
  -> kept working for debug / back-compat; deprecated for storefront use.
```

## Trust boundary (non-negotiable)

```
Storefront widget  --(same-origin, HMAC-signed)-->  App Proxy (Remix server)
App Proxy          --(server-side, holds API key)-->  myaiira-ai jobs API
myaiira-ai         -->  DynamoDB (vto_jobs, 72h TTL)  +  S3 (uploads, results)
```

Rule 1 — **Secrets stay server-side.** The storefront calls only same-origin App Proxy
routes under `/apps/myaiira/vto/*`. `MYAIIRA_API_KEY` and AWS credentials never appear in
Liquid, theme assets, or browser-delivered JS. All `myaiira-ai` calls happen in Remix
server code.

Rule 2 — **VTO is async.** Submitting a job returns in under 2 seconds with a `job_id`.
A background worker processes the job. The storefront polls for status.

## `sub_type` mapping baseline (20 categories + default)

kurta, kurti, saree, lehenga, salwar_kameez, churidar, anarkali, sherwani, nehru_jacket,
dhoti, dupatta, blouse, palazzo, sharara, indo_western, shirt, tshirt, dress, top, bottom
— with a `default` fallback for unmapped products.
