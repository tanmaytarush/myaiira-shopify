# Myaiira Virtual Try-On (Shopify app)

A Shopify **public app** that adds a product-page virtual try-on, backed by the existing
`myaiira-ai` service. Shoppers upload a photo on a product page, the app generates a
try-on image, and the result renders inline — all without exposing any secret to the
storefront.

## Two-repo boundary

| Repo | Owns |
| --- | --- |
| `myaiira-ai` (existing, Python/SAM) | The VTO engine, async job endpoints, DynamoDB `vto_jobs`, the background worker, S3 for uploads/results. |
| `myaiira-shopify-app` (this repo, Remix + Polaris) | Theme App Extension (PDP button + lazy widget), the App Proxy, the server-only myaiira client, Polaris admin, billing, lifecycle webhooks. |

This repo treats `myaiira-ai` as a black-box async API.

## Two non-negotiable rules

1. **Secrets stay server-side.** The storefront calls only same-origin App Proxy routes
   under `/apps/myaiira/vto/*`. `MYAIIRA_API_KEY` and AWS credentials never reach Liquid,
   theme assets, or browser JS. All `myaiira-ai` calls happen in Remix server code.
2. **VTO is async.** Job submit returns in under 2s with a `job_id`; a worker processes
   in the background; the storefront polls for status. Job state lives in DynamoDB with a
   72-hour TTL.

See [`DECISIONS.md`](./DECISIONS.md) for the locked decisions and the full async jobs
contract.

## Status

Phase 0 (decisions & environment) complete. Development happens on a Shopify development
store first; production is a later config-only switch.

## Local setup

Copy `.env.example` to `.env` and fill in the values before running anything. The Remix
app is scaffolded in Phase 1.
