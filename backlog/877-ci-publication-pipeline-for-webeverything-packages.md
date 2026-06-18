---
type: issue
workItem: story
size: 5
parent: "872"
status: resolved
blockedBy: ["874"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: .github/workflows/publish-contracts.yml
tags: []
---

# CI publication pipeline for @webeverything packages

Stand up the CI that publishes @webeverything packages (starting with @webeverything/contracts) on version bump — the piece that makes the publish/version ceremony cheap (per the #834 discussion: 'publication is not that complex with correct CI'). No CI exists yet; lower priority ('no hurry'). Covers version bump, prepublishOnly, provenance, and tag/release wiring. Risk-mitigation story for the #872 epic addressing the publish-ceremony cost.

## Progress (resolved 2026-06-18)

- **Workflow** `we:.github/workflows/publish-contracts.yml` — publishes `@webeverything/contracts` on a
  `contracts-v*` tag push (+ a `workflow_dispatch` that defaults to `--dry-run` so the pipeline is
  exercisable without uploading). Steps: checkout → `setup-node@v4` with the npm registry → `npm ci` →
  **repo health gate** (`npm run check:standards`) → tag↔version match check → `npm publish --provenance
  --access public`. `id-token: write` is set for **Sigstore provenance**; the token is `secrets.NPM_TOKEN`.
- **Package wiring** (`we:contracts/package.json`) — removed `private: true` (it is now publishable), added
  `publishConfig` (`access: public`, `provenance: true`), `repository.directory`, `license`, a `files`
  allowlist (the `*.ts` re-exports, excluding tests), and a **`prepublishOnly` guard that refuses the
  placeholder version `0.0.0`** — so the package can't be published until a deliberate `npm version` bump.
- **Triple safety against accidental publish:** tag-only trigger (`contracts-v*`, human-created) + the
  tag↔`we:package.json` version-equality check + the `0.0.0` `prepublishOnly` guard. Verified the guard fires
  and the workflow YAML/`we:package.json` are valid; `check:standards` green.

Bump ceremony documented in the workflow header (`npm version` in `contracts/` → push the `contracts-v*`
tag). The pipeline generalizes to future `@webeverything/*` packages by templating the package directory.
