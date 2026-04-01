# =============================================================================
# @bridge-ai/cli — Makefile
#
# Targets
# -------
#   make build       Compile TypeScript → dist/
#   make link        Register `bridgeai` globally via npm link
#   make unlink      Remove the global `bridgeai` symlink
#   make install     build + link in one step
#   make reinstall   unlink + build + link (full reset)
#   make clean       Delete the dist/ directory
#   make dev         Run the CLI directly from source via tsx (no build needed)
#
# Prerequisites
# -------------
#   Node.js ≥ 18, npm, and either bun or tsup installed.
#   Run from the packages/cli/ directory or from the monorepo root:
#     make -C packages/cli <target>
# =============================================================================

.PHONY: build link unlink install reinstall clean dev

# ── Tooling ──────────────────────────────────────────────────────────────────

# Prefer bun; fall back to npm/npx if not available.
BUN := $(shell command -v bun 2>/dev/null)
ifdef BUN
  RUN  := bun run
  EXEC := bunx
else
  RUN  := npm run
  EXEC := npx
endif

# ── Targets ──────────────────────────────────────────────────────────────────

## Compile TypeScript source → dist/
build:
	$(RUN) build

## Register the `bridgeai` command globally (npm link creates a symlink).
## After this you can run `bridgeai` from any directory.
link:
	npm link

## Remove the global `bridgeai` symlink.
unlink:
	npm unlink --global @bridge-ai/cli

## Build and then link — use this for a first-time setup.
install: build link
	@echo ""
	@echo "✓ bridgeai installed. Test with: bridgeai --version"

## Full reset: unlink existing, rebuild, relink.
## Use when you suspect a stale install.
reinstall: unlink build link
	@echo ""
	@echo "✓ bridgeai reinstalled."

## Delete compiled output.
clean:
	rm -rf dist

## Run the CLI directly from TypeScript source via tsx (no build step).
## Useful during development — changes are picked up immediately.
dev:
	$(EXEC) tsx src/index.ts $(ARGS)
