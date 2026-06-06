.PHONY: help setup install build test test-unit test-integration invoke deploy-dev deploy-prod new-lambda clean

ENV ?= dev
LAMBDA ?=
AWS_PROFILE ?= aira-direct

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## One-time setup: install all tools and dependencies
	@echo "→ Checking dependencies..."
	@command -v python3 >/dev/null || (echo "❌ python3 required" && exit 1)
	@command -v pip >/dev/null || (echo "❌ pip required" && exit 1)
	@command -v sam >/dev/null || (echo "Installing AWS SAM CLI..." && pip install aws-sam-cli)
	@command -v aws >/dev/null || (echo "Installing AWS CLI..." && pip install awscli)
	@echo "→ Installing Python dependencies..."
	@pip install -r layers/common/requirements.txt
	@pip install -r layers/embeddings/requirements.txt
	@pip install pytest pytest-asyncio pytest-cov python-dotenv moto boto3
	@echo "→ Setting up pre-commit hooks..."
	@cp scripts/pre-commit .git/hooks/pre-commit 2>/dev/null || true
	@chmod +x .git/hooks/pre-commit 2>/dev/null || true
	@echo "✅ Setup complete. Copy .env.example to .env.dev and .env.prod and fill values."

install: ## Install/sync all lambda + layer dependencies
	@for dir in lambdas/*/; do \
		if [ -f "$$dir/requirements.txt" ]; then \
			echo "→ Installing $$dir deps..."; \
			pip install -r $$dir/requirements.txt -q; \
		fi; \
	done
	@pip install -r layers/common/requirements.txt -q
	@echo "✅ All dependencies installed"

build: ## Build all Lambdas with SAM
	sam build

test: test-unit test-integration ## Run all tests

test-unit: ## Run unit tests only
	@echo "→ Running unit tests..."
	ENV=test pytest tests/unit/ -v --cov=lambdas --cov=layers --cov-report=term-missing

test-integration: ## Run integration tests (requires .env.dev)
	@echo "→ Running integration tests..."
	ENV=test pytest tests/integration/ -v -m integration

invoke: ## Invoke a lambda locally. Usage: make invoke LAMBDA=ingest
	@if [ -z "$(LAMBDA)" ]; then echo "Usage: make invoke LAMBDA=<name>"; exit 1; fi
	@echo "→ Invoking $(LAMBDA) locally with ENV=$(ENV)..."
	sam local invoke $(shell echo $(LAMBDA) | sed 's/-\([a-z]\)/\U\1/g; s/^./\u&/')Function \
		--env-vars lambdas/$(LAMBDA)/env.json \
		--event lambdas/$(LAMBDA)/events/sample.json \
		--env-vars-file .env.$(ENV).json 2>/dev/null || \
	sam local invoke $(shell echo $(LAMBDA) | sed 's/-\([a-z]\)/\U\1/g; s/^./\u&/')Function \
		--env-vars lambdas/$(LAMBDA)/env.json

new-lambda: ## Create new lambda boilerplate. Usage: make new-lambda LAMBDA=my-workflow
	@if [ -z "$(LAMBDA)" ]; then echo "Usage: make new-lambda LAMBDA=<name>"; exit 1; fi
	@bash scripts/new_lambda.sh $(LAMBDA)

deploy-dev: build test-unit ## Deploy to dev environment
	@echo "→ Deploying to DEV..."
	@export $$(grep -v '^#' .env.dev | xargs) && AWS_PROFILE=$(AWS_PROFILE) sam deploy --config-env dev --no-confirm-changeset

deploy-prod: build test ## Deploy to prod (runs ALL tests first)
	@echo "→ Deploying to PROD..."
	AWS_PROFILE=$(AWS_PROFILE) sam deploy --config-env prod --no-confirm-changeset

clean: ## Clean build artifacts
	rm -rf .aws-sam/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleaned"

logs: ## Tail logs for a lambda. Usage: make logs LAMBDA=ingest
	@if [ -z "$(LAMBDA)" ]; then echo "Usage: make logs LAMBDA=<name>"; exit 1; fi
	AWS_PROFILE=$(AWS_PROFILE) aws logs tail /aws/lambda/myaiira-$(LAMBDA)-$(ENV) --follow --region ap-south-1