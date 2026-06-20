---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: scripts/validation-normalize/live-config.mjs
tags: [dev-experience, devtools, validation, linting, adapters, normalization, no-lock-in]
parent: "236"
---

# Validation-normalize: live-config CLI (run see over a project's actual configs)

Fourth thread of the adapter-as-normalization-hub (spun out of #236's see leg, which today runs the comparative model over fixtures). Add a small Node CLI that discovers and reads a project's OWN ESLint + Oxlint configs in place — flat-config, eslintrc, or we:.oxlintrc.json — and prints/emits the same unified comparative model the /validation-rules/ page renders. Zero lock-in: read-only, touches only the incumbents' files, leaves no project-facing artifact. Engine + adapters already exist in scripts/validation-normalize/ (we:index.mjs see()); this just swaps fixtures for real config discovery.

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). Pure discovery+reading layer on top of the existing `see()` engine — re-implements none of the normalization, honouring the hub's zero-lock-in / single-source shape.
- **Done — `we:scripts/validation-normalize/live-config.mjs`:**
  - `discoverConfigs(dir)` finds a project's own ESLint config in platform precedence (flat-config `eslint.config.{js,mjs,cjs}` → legacy `.eslintrc.{js,cjs,json,yml,yaml}`/`.eslintrc` → `we:package.json#eslintConfig` fallback) and Oxlint (`we:.oxlintrc.json`/`we:oxlint.json`), reads each, and returns `{ configsByTool, sources, notes }` to feed `see()`. `seeLiveConfigs(dir)` = discover + normalize; `formatLiveReport` renders the readable view.
  - Readers are resilient: flat-config via dynamic `import()` (rules merged across the array, later wins, via `flattenFlatConfigRules`); eslintrc/oxlintrc via JSON (comment-tolerant); YAML via `js-yaml` when present, else a `note`. A missing/unreadable config becomes a `note`, never a throw — one bad config doesn't sink the run. **Read-only; no project-facing artifact written.**
  - CLI entry (run-as-main): `npm run validation:see -- [projectDir] [--json]` (default dir = cwd). `--json` emits `{ sources, notes, model }`; otherwise the readable per-concern comparison.
  - README updated with a "Live-config CLI" section; npm script `validation:see` added.
  - Tests `we:scripts/validation-normalize/__tests__/live-config.test.mjs` (9): `flattenFlatConfigRules` merge, the JSON readers against the existing fixtures, error-not-throw on a bad file, discovery precedence (flat config selected over eslintrc — env-agnostic), flow into `see()`, and the empty-project (no-config, no-error) path.
- **Verified live:** ran the CLI against a temp project (`we:.eslintrc.json` + `we:.oxlintrc.json`) — it discovered both, reported their sources, and printed the comparative model (6 concerns, 3 active, 2 divergent). WE itself ships no lint config, so a run here correctly reports "nothing to compare."
- **Gate:** full `scripts/validation-normalize` suite 18/18; `check:standards` 0 errors.
