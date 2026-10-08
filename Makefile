# Every target is a command, not a file: `deploy` collides with the deploy/
# directory, so without .PHONY `make deploy` sees it as up to date and does nothing.
.PHONY: help build run deploy

RHOST ?=

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

build: ## Clean install from package-lock.json, then type-check + build into dist/
	npm ci --silent
	npm run build --silent

run: ## npm run dev
	npm run dev

deploy: build ## Build and publish to https://numi.asia/admin/ (RHOST=t1..t4 picks HOST1..HOST4)
	@./deploy/deploy.sh $(RHOST)
