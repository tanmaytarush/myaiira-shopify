# myaiira-ai

AI-powered fashion recommendation platform. Hybrid architecture — real-time flows on AWS Lambda, background workflows on n8n.

---

## Architecture

```
Client → API Gateway → Lambda → Pinecone / RDS / OpenRouter / S3 / AWS Personalize
                                      ↑
                           n8n handles enrichment
                           and background workflows
```

### Lambda (this repo)

| Lambda | Route | Purpose | Timeout |
|--------|-------|---------|---------|
| `ingest` | `POST /ingest` | API entry, validation, routing | 180s |
| `recommendation` | `POST /recommend` | Pinecone search + weighted scoring pipeline | 180s |
| `moodboard` | `POST /moodboard` | Accessory matching + Sharp image composition | 180s |
| `virtual-tryon` | `POST /tryon` | Async image generation | 300s |
| `personalize-sync` | `POST /events` | AWS Personalize event ingestion | 180s |

### n8n (not in this repo)

| Workflow | Reason |
|----------|--------|
| Product enrichment | Periodic, batch, not latency-sensitive |
| Background/scheduled jobs | Already working, no migration needed |

### Layers

| Layer | Contents |
|-------|----------|
| `common` | DB (RDS Proxy), Pinecone client, OpenRouter client, Pydantic models |

> Embeddings are API calls via OpenRouter at runtime — no local model needed.

### Custom Domain

| Environment | URL |
|-------------|-----|
| dev | `https://ai-dev.myaiira.com` |
| prod | `https://ai.myaiira.com` |

Custom domain + Route53 DNS are managed in `template.yaml` (auto-created on deploy). Requires ACM certificate — see GETTING_STARTED.md Step 3.

---

## Setup

### Prerequisites
- Python 3.12
- AWS CLI configured — profile `aira-direct` (used by all `make` commands)
- AWS SAM CLI (auto-installed by `make setup`)
- Docker (for local Lambda invocation via SAM)

### First-time setup

```bash
git clone git@github.com:<your-org>/myaiira-ai.git
cd myaiira-ai
python3.12 -m venv .venv
source .venv/bin/activate
make setup
cp .env.example .env.dev
# Fill in .env.dev — DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, PINECONE_API_KEY, OPENROUTER_API_KEY
```

See `GETTING_STARTED.md` for full first-time AWS setup (S3 buckets, ACM cert, GitHub Secrets).

---

## Daily Commands

### Add a new Lambda

```bash
make new-lambda LAMBDA=size-advisor
```

Creates `lambdas/size-advisor/` with handler, requirements, and sample event. Then:
1. Add Lambda block to `template.yaml` (copy an existing entry)
2. Implement logic in `handler.py`
3. Write tests in `tests/unit/test_size_advisor.py`

### Run tests

```bash
make test-unit          # fast, no AWS needed
make test-integration   # requires live .env.dev
make test               # both
```

### Test locally

```bash
make invoke LAMBDA=ingest
make invoke LAMBDA=recommendation ENV=dev
```

### Deploy

```bash
make deploy-dev    # loads .env.dev → unit tests → sam deploy (dev stack)
make deploy-prod   # all tests → sam deploy (prod stack)
```

Both commands use `AWS_PROFILE=aira-direct`. Ensure your `.env.dev` is filled before deploying dev.

### View logs

```bash
make logs LAMBDA=recommendation
make logs LAMBDA=moodboard ENV=prod
```

---

## CI/CD — Branch-based pipeline

| Branch push | What happens |
|-------------|-------------|
| `dev` | Tests run → deploy to dev stack (`myaiira-ai-dev`) |
| `main` | Tests → version bump → CHANGELOG → GitHub Release → deploy to prod stack (`myaiira-ai-prod`) |

### Versioning

Automatic from commit message prefix:

| Prefix | Bump |
|--------|------|
| `fix:`, `chore:`, `refactor:` | Patch → `v1.0.1` |
| `feat:` | Minor → `v1.1.0` |
| `BREAKING CHANGE:` | Major → `v2.0.0` |

Version bumps only happen on `main`. Dev deployments skip versioning.

---

## Project Structure

```
myaiira-ai/
├── lambdas/
│   ├── ingest/
│   │   ├── handler.py          # Lambda entry point
│   │   ├── requirements.txt    # Lambda-specific deps
│   │   └── events/
│   │       └── sample.json     # For local SAM invoke
│   ├── recommendation/
│   │   ├── handler.py
│   │   ├── scoring/            # Internal modules — body type, skin tone, moodboard
│   │   ├── pinecone_search.py
│   │   └── ranker.py
│   ├── moodboard/
│   ├── virtual-tryon/
│   └── personalize-sync/
├── layers/
│   └── common/                 # Shared across all Lambdas
├── tests/
│   ├── unit/                   # No external calls, mock everything
│   └── integration/            # Live AWS, marked @pytest.mark.integration
├── scripts/
│   └── new_lambda.sh           # Lambda scaffold script
├── docs/                       # Business logic reference docs
├── .github/workflows/
│   └── deploy.yml              # CI/CD — test → version → deploy
├── template.yaml               # SAM — all Lambda definitions
├── samconfig.toml              # Dev/prod deploy config
├── Makefile
├── CHANGELOG.md                # Auto-updated on every release
├── CLAUDE.md                   # Claude Code context — read this first
└── .env.example
```

---

## Adding a Lambda — Checklist

- [ ] `make new-lambda LAMBDA=my-workflow`
- [ ] Implement `_process()` in `handler.py`
- [ ] Add deps to `requirements.txt`
- [ ] Add Lambda block to `template.yaml`
- [ ] Write `tests/unit/test_my_workflow.py`
- [ ] `make invoke LAMBDA=my-workflow` to verify locally
- [ ] Commit with `feat: add my-workflow lambda`