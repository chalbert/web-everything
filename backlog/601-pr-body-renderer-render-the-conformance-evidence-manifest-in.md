---
type: issue
workItem: story
size: 3
status: resolved
locus: plateau-app
blockedBy: ["599", "598"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/dev-browser/pr-body/ (renderPrBody + pullRequestFromManifest)
tags: []
---

# PR-body renderer — render the conformance-evidence manifest into the bot-PR (thin markdown first)

Build the Plateau dev-browser renderer ruled by #578 (Fork 2): turn the standard-owned conformance-evidence manifest (#599) into the bot-PR body and attach it via the forge provider (#598). Per the ruling, ship B's freeform markdown rendering FIRST, backed by the manifest contract — letting the renderer's real needs drive the contract's fields rather than over-building the manifest before a real fix-loop PR exists. Layer: Plateau (rendering + attach-to-PR), per the #475/#091 constellation split (contract → WE, rendering → Plateau). Gated on the manifest contract (#599) and the forge provider (#598).

## Progress

Built the renderer in plateau-app at `src/dev-browser/pr-body/` — the Plateau rendering half of the #475/#091 split (contract stays WE-owned; only the markdown lives here):

- **`renderer.ts`** — `renderPrBody(manifest): string`, a pure/deterministic thin-markdown rendering (#578 Fork 2-B): headline (✅ restored / ✅ verified / ⚠️ not-restored, driven by `isFixSuccessful` = red→green verify) · subject (app/impl/commit) · the propose-and-verify **before→after** · a gate pass/fail table · autonomy level · a spec-versioned footer. Markdown-escapes gate detail so a cell can't break the table.
- **`index.ts`** — `pullRequestFromManifest(manifest, {repo, headBranch, …})` composes the rendered body into the #598 forge `PullRequestRequest` (the "render then attach via the forge provider" step).
- Imports the `ConformanceEvidenceManifest` **type only** (`import type`, erased at compile) from the WE-owned contract `webeverything/conformance-evidence` — Plateau consumes the standard, zero runtime coupling; matches the existing relative cross-repo import pattern (intent-configurator).
- **`pr-body.test.ts`** — 9 tests: red→green headline, not-restored warning, gate table, subject/autonomy/footer, markdown escaping, determinism, and the forge hand-off (default + explicit title/base).
- Gate: `npm test` green (131/131, +9); pr-body type-clean. Code → plateau-app; tracker → webeverything.
