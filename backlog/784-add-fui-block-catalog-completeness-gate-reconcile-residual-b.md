---
type: issue
workItem: story
size: 3
parent: "731"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/scripts/check-standards.mjs (catalog completeness gate)
tags: []
---

# Add FUI block-catalog completeness gate + reconcile residual blocks.json entries

This is **Check 1** of the two gates ratified in #783 (the WE-owned, implementer-agnostic one). #783 ratified
the denominator as **Option A — flat top-level dir minus `{__tests__, traits, renderers}`**; the sibling-drift
Check 2 (registered-name→spec) lives in #783's own build, not here.

Add a completeness invariant to frontierui/scripts/check-standards.mjs that FAILS if any in-scope catalog-family dir (flat top-level `blocks/<dir>` minus `{__tests__, traits, renderers}`, per #783) has zero entries in src/_data/blocks.json — mirroring check-demos' every-folder-registered rule via readdirSync(blocks/). Reconcile any residual missing entries against the #783 mapping (most are already filled by #737). Render is already manifest-driven (blocks.njk iterates blocks.json) — no work. Gate green on check:standards.

## Progress

Resolved 2026-06-16 (locus: frontierui). Added **Check 1** — the WE-owned, implementer-agnostic catalog completeness gate — to `frontierui/scripts/check-standards.mjs`:
- After the existing forward (phantom-entry) `sourcePath` check, a reverse invariant: every top-level `blocks/<dir>` minus the #783 infra exclude-set `{__tests__, traits, renderers}` must resolve to ≥1 manifest entry whose `sourcePath` falls within it (sourcePath-anchored per #783 I1, never dir-name==id). Mirrors WE's `check-demos` every-folder-registered rule via `readdirSync(blocks/)`.
- **Green today with zero new entries** — all 21 catalog families already map (as #783 predicted; residuals were filled by #737). No reconciliation needed.
- Negative-tested: an unregistered `blocks/<dir>` fails loudly; removing it restores green. Summary line now reports families-checked.
- The sibling-drift Check 2 (registered-name→spec) is #783's own build, not here.
