# myaiira-ai — Changelog

## v0.1.3 — 2026-03-20

- fix: add --no-fail-on-empty-changeset to prevent false pipeline failures (77f89fd)


## v0.1.2 — 2026-03-20

- fix: pass secret params to prod sam deploy in samconfig.toml (2c9e6d6)


## v0.1.1 — 2026-03-20

- fix: correct prod deploy secret names and align docs with actual configuration (4f02d9d)


## v0.1.0 — 2026-03-20

- feat: scaffold Lambda handlers, add custom domain, and split dev/prod CI pipeline (fb892e6)
- chore: add ACM certificate ARN for ai.myaiira.com (4a61ff1)
- feat: wire API routes for all Lambdas and align SAM template with hybrid architecture (51182b3)
- refactor: establish hybrid Lambda/n8n architecture and clean up removed services (726f1cf)
- chore: add gitignore (daa4206)


## v0.1.0 — Initial release

- Initial monorepo structure
- Lambda boilerplate: ingest, recommendation, enrichment, moodboard, virtual-tryon, personalize-sync
- Common layer: db, pinecone, openrouter clients
- Embeddings layer: local sentence-transformers (no OpenAI hop)
- CI/CD: GitHub Actions → SAM deploy
- Automatic semantic versioning from commit messages
- `make new-lambda` scaffolding command
