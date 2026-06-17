---
type: issue
workItem: story
size: 3
parent: "731"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Add FUI block-catalog completeness gate + reconcile residual blocks.json entries

This is **Check 1** of the two gates ratified in #783 (the WE-owned, implementer-agnostic one). #783 ratified
the denominator as **Option A — flat top-level dir minus `{__tests__, traits, renderers}`**; the sibling-drift
Check 2 (registered-name→spec) lives in #783's own build, not here.

Add a completeness invariant to frontierui/scripts/check-standards.mjs that FAILS if any in-scope catalog-family dir (flat top-level `blocks/<dir>` minus `{__tests__, traits, renderers}`, per #783) has zero entries in src/_data/blocks.json — mirroring check-demos' every-folder-registered rule via readdirSync(blocks/). Reconcile any residual missing entries against the #783 mapping (most are already filled by #737). Render is already manifest-driven (blocks.njk iterates blocks.json) — no work. Gate green on check:standards.
