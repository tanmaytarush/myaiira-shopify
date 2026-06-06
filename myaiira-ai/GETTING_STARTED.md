# Getting Started with Claude Code — myaiira-ai

Follow these steps exactly. This gets the repo live and Claude Code set up to autonomously build the rest.

---

## Step 1 — Create the GitHub repo

```bash
# On your Mac
git init myaiira-ai
cd myaiira-ai

# Copy all the files from the zip into this folder, then:
git add .
git commit -m "feat: initial monorepo scaffold"
```

Go to GitHub → New Repository → name it `myaiira-ai` → do NOT initialise with README.

```bash
git remote add origin git@github.com:<your-org>/myaiira-ai.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Add GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret.

The pipeline uses the **same secret names for both dev and prod**. Environment is determined purely by branch — `dev` branch deploys to `myaiira-ai-dev`, `main` branch deploys to `myaiira-ai-prod`. No GitHub Environments needed.

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user key with Lambda + API Gateway + SAM + Route53 permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `DB_HOST` | RDS Proxy endpoint |
| `DB_NAME` | Database name (e.g. `aira`) |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `PINECONE_API_KEY` | Pinecone API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

These are repository-level secrets. Both the `deploy-dev` and `deploy-prod` jobs read the exact same secret names — no `_PROD` suffix, no separate environment-scoped secrets.

---

## Step 3 — Configure AWS profile (local)

> **This is required before any `make` command will work.** All Makefile commands (`make deploy-dev`, `make deploy-prod`, `make logs`, etc.) use `AWS_PROFILE=aira-direct`. If this profile doesn't exist, they will fail silently or use the wrong account.

Configure the profile:

```bash
aws configure --profile aira-direct
```

When prompted:

```
AWS Access Key ID:     <your IAM key>
AWS Secret Access Key: <your IAM secret>
Default region name:   ap-south-1
Default output format: json
```

Verify it works:

```bash
aws sts get-caller-identity --profile aira-direct
# Should return your account ID and IAM user/role ARN
```

The profile name `aira-direct` is hardcoded in the Makefile (`AWS_PROFILE ?= aira-direct`). Don't rename it.

---

## Step 4 — One-time AWS setup (15 minutes)

These can't be automated — do them once manually. All commands use the `aira-direct` profile configured above.

```bash
# 1. Create SAM artifacts bucket (SAM needs this to upload Lambda packages)
aws s3 mb s3://myaiira-sam-artifact --region ap-south-1 --profile aira-direct

# 2. Create media buckets
aws s3 mb s3://myaiira-media-dev --region ap-south-1 --profile aira-direct
aws s3 mb s3://myaiira-media-prod --region ap-south-1 --profile aira-direct
```

**RDS Proxy:** In AWS Console → RDS → Create RDS Proxy → point it to your existing RDS instance. Copy the proxy endpoint into `.env.dev` as `DB_HOST`.

**ACM Certificate (required — `template.yaml` won't deploy without this):**

1. AWS Console → Certificate Manager → Request certificate
2. Domain: `ai.myaiira.com` — add SAN `ai-dev.myaiira.com`
3. Validation: DNS validation → follow the CNAME records it gives you
4. Region **must be `ap-south-1`** (same region as the API Gateway)
5. Once issued, the ARN is already pre-filled in `samconfig.toml`

**Route53 Hosted Zone:** Ensure `myaiira.com` has a hosted zone in Route53. The SAM template auto-creates `A` alias records for `ai.myaiira.com` and `ai-dev.myaiira.com` on deploy — no manual DNS changes needed.

**Create the `dev` branch:**

```bash
git checkout -b dev
git push -u origin dev
```

---

## Step 5 — Local setup on your Mac

```bash
cd myaiira-ai
make setup
cp .env.example .env.dev
# Open .env.dev and fill in all values (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, PINECONE_API_KEY, OPENROUTER_API_KEY)
```

Verify everything works:

```bash
make test-unit                  # should pass out of the box
make invoke LAMBDA=ingest       # needs Docker running for SAM local
```

---

## Step 6 — Install Claude Code

```bash
npm install -g @anthropic/claude-code
cd myaiira-ai
claude   # opens Claude Code in this repo
```

Claude Code reads `CLAUDE.md` automatically on startup. That file is the brain — it knows your stack, conventions, and where everything lives.

---

## Step 7 — First real task with Claude Code

Test it by implementing one of the scaffold Lambdas. In the Claude Code terminal:

```
Implement lambdas/recommendation/handler.py — full Pinecone search + scoring pipeline.
Read docs/body_type_scoring_rules_v2.md, docs/skin_tone_scoring_rules.md, and 
docs/moodboard_scoring_rules_v2.md first before writing any scoring logic.
```

It will:
- Implement `lambdas/recommendation/handler.py` and the `scoring/` modules
- Update `requirements.txt`
- Write `tests/unit/test_recommendation.py`

Review the output, then push to dev to trigger a dev deploy:

```bash
git add .
git commit -m "feat: implement recommendation lambda with scoring pipeline"
git push origin dev
```

GitHub Actions triggers on `dev` → tests run → deploys to `myaiira-ai-dev` stack → available at `https://ai-dev.myaiira.com/recommend`.

> **Note:** Product enrichment stays on n8n — do NOT ask Claude Code to convert it to a Lambda.

---

## Step 8 — Adding new Lambdas going forward

Only add Lambdas for real-time, latency-sensitive flows. Background/batch work stays on n8n.

```bash
make new-lambda LAMBDA=my-feature-name
```

Then in Claude Code:
```
Implement lambdas/my-feature-name/handler.py — [describe the feature]
Add the Lambda block to template.yaml and write tests.
```

Push to `dev` to test → merge to `main` to release to prod.

---

## Commit message cheatsheet

| What you're doing | Prefix |
|-------------------|--------|
| New lambda / feature | `feat: add size-advisor lambda` |
| Bug fix | `fix: handle empty pinecone results` |
| Refactor, cleanup | `chore: extract common scoring util` |
| Breaking API change | `BREAKING CHANGE: rename recommendation endpoint` |

---

## Day-to-day workflow

```bash
# Test locally first
make invoke LAMBDA=recommendation

# Push to dev → runs tests → deploys to myaiira-ai-dev → live at ai-dev.myaiira.com
git add . && git commit -m "feat: ..." && git push origin dev

# When ready for prod → push to main → version bump → CHANGELOG → deploys to myaiira-ai-prod → ai.myaiira.com
git push origin main
```

That's it. Claude Code handles the code, GitHub Actions handles the rest.
