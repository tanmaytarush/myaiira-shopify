# myaiira-ai — Claude Code Context

## What this is
AI-powered fashion recommendation platform for Indian market.
Hybrid architecture — real-time flows on Lambda, background/periodic workflows stay on n8n.

## Architecture split — critical to understand

### Lives on Lambda (this repo)
- `ingest` — API Gateway entry, validation, routing
- `recommendation` — Pinecone search + full scoring pipeline (one Lambda, modular internally)
- `moodboard` — Accessory matching + Sharp-based image composition
- `virtual-tryon` — Async image generation
- `personalize-sync` — AWS Personalize event ingestion

### Stays on n8n — DO NOT migrate these
- Product enrichment — periodic, batch, already working on n8n
- Any other background/scheduled workflows

### NOT in this repo
- Embeddings — API call via OpenRouter at runtime, no local model, no Lambda needed

## Stack
- **Runtime**: Python 3.12
- **Deployment**: AWS SAM (`template.yaml`)
- **DB**: RDS PostgreSQL — ALWAYS via RDS Proxy (`layers/common/db.py`), never direct
- **Vector DB**: Pinecone (`layers/common/pinecone_client.py`)
- **AI Models + Embeddings**: OpenRouter API (`layers/common/openrouter_client.py`)
- **Storage**: S3
- **Recommendations**: AWS Personalize

## Monorepo rules
- Every Lambda → `lambdas/<name>/handler.py` + `requirements.txt`
- Shared code → `layers/common/` (imported as `from common.db import get_connection`)
- Never duplicate shared logic across lambdas
- Every Lambda → test in `tests/unit/test_<name>.py`
- New Lambda → also update `template.yaml`

## Lambda conventions
- Entry point always: `lambda_handler(event, context) -> dict`
- Always return `{"statusCode": int, "body": json.dumps(...)}`
- Always parse body as: `json.loads(event.get("body") or "{}")` — never use `default="{}"` in `.get()`
- Use `asyncio.run(_process(body))` pattern for async work
- Use `asyncio.gather()` for parallel external calls
- Timeout defaults: 180s for most paths, 300s for virtual-tryon (image gen)
- All secrets from env vars (AWS Secrets Manager in prod, `.env.dev` locally)
- Never hardcode credentials or API keys

## Recommendation Lambda — internal structure
Keep as ONE Lambda with clean internal modules. Never split into multiple Lambdas — internal dependencies make chaining too costly on latency and cold starts.

```
lambdas/recommendation/
  handler.py
  scoring/
    body_type.py
    skin_tone.py
    moodboard.py
    size_tier.py
  pinecone_search.py
  ranker.py
```

## Error handling pattern
- Try/except on every external call
- Log with context: `logger.error(f"Error processing product {product_id}: {e}", exc_info=True)`
- Return partial results over failing entirely on batch operations
- Skip failed items in loops, never abort the whole batch

## When asked to build or convert a workflow to Lambda
1. Confirm it belongs on Lambda (not n8n — see architecture split above)
2. Read the workflow JSON or description
3. Create `lambdas/<name>/handler.py` following conventions above
4. Add `lambdas/<name>/requirements.txt` with any new deps
5. Add `lambdas/<name>/events/sample.json` with realistic test payload
6. Write `tests/unit/test_<name>.py` mocking all external calls
7. Add Lambda definition to `template.yaml` following existing pattern
8. Summarize what was created

## Business logic docs — always read before touching scoring/recommendation logic
- `docs/body_type_scoring_rules_v2.md`
- `docs/skin_tone_scoring_rules.md`
- `docs/moodboard_scoring_rules_v2.md`
- `docs/AIRA_Product_Attributes_Complete_Specification.md`

## Versioning — commit message convention
- `fix:` / `chore:` / `refactor:` → patch bump
- `feat:` → minor bump
- `BREAKING CHANGE:` / `major:` → major bump

Always use conventional commit format.
- Always parse body as: `json.loads(event.get("body") or "{}")`  — never use default="{}" in .get()
