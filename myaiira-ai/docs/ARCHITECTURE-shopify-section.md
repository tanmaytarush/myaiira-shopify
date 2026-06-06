<!--
  PLACEMENT: append this section to `myaiira-ai/docs/ARCHITECTURE.md`.
  If that file doesn't exist yet, create it with a top-level "# Architecture" heading
  and add this as a section beneath it. Phase 0 changes docs only — no code edits.
-->

## Shopify integration

The `myaiira-shopify-app` (Remix) consumes this service as a black-box async API. This
section defines the boundary and the contract; it does not change any engine behavior.

### Trust boundary

```
Shopify storefront  --(same-origin, HMAC-signed)-->  App Proxy (Remix server)
App Proxy           --(server-side, holds API key)-->  myaiira-ai jobs API
myaiira-ai          -->  DynamoDB (vto_jobs, 72h TTL)  +  S3 (uploads, results)
```

The storefront never calls `myaiira-ai` directly and never holds `MYAIIRA_API_KEY`. Only
the Remix server does. All requests into `myaiira-ai` originate server-side.

### Async jobs contract

VTO inference takes 60–120s, so the storefront-facing path is asynchronous. Two new
endpoints are introduced (in a later phase); the existing synchronous endpoint is kept
for debug and back-compat but is deprecated for storefront use.

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

POST /virtual-tryon   (legacy, synchronous — deprecated for storefront)
```

The worker wraps the existing processing path: validate the payload, create the job as
`queued`, hand off to the worker (SQS + worker Lambda), set `processing`, run the existing
engine, then write the final `image_url` (or `error`) and mark `completed` / `failed`,
updating `progress` along the way.

### `vto_jobs` table (DynamoDB)

| Attribute | Notes |
| --- | --- |
| `job_id` | partition key (uuid) |
| `status` | `queued` / `processing` / `completed` / `failed` |
| `progress` | integer 0–100 |
| `image_url` | set on completion |
| `error` | set on failure |
| `created_at` | iso8601 timestamp |
| `ttl` | epoch seconds; expires the item ~72h after creation |

### Retention

72 hours, as a single shared constant (`VTO_JOBS_TTL_HOURS=72`). Applied identically to
the DynamoDB TTL and the S3 lifecycle rule for uploads and results. The app's public
privacy page must quote the same value: photos auto-deleted after 72h, not used for
training.
