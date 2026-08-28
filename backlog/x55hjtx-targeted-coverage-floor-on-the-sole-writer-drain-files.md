---
kind: story
size: 3
parent: "3321"
status: open
dateOpened: "2026-08-27"
tags: []
---

# Targeted coverage floor on the sole-writer drain files

`we:vitest.config.ts:29-35` deliberately excludes `scripts/` and `tools/` from the repo's 80%
coverage threshold ("build tooling, mostly .mjs"). That's defensible for build tooling broadly, but
it also means the files that are the SOLE writer to `main` — `we:scripts/merge-ai-prs.mjs`,
`we:scripts/lane-drain.mjs`, `we:scripts/pr-land.mjs`, `we:scripts/verify-lane.mjs` — have no floor
either, and nothing in CI would ever flag a function in them sitting at 0% coverage. That's part of
why the `#3379` numbering-push bug went seven weeks untested: not just that nobody wrote the test,
but that nothing required one to exist for this directory. Folding all of `scripts/`+`tools/` into
the existing 80% bar isn't right either — the same comment measured it at ~68% including UI/build
planes, so a blanket add would fail CI for a large pile of unrelated files on day one. Scope this
to the small set of files that actually mutate shared state on `main`, not `scripts/` broadly.

## Done when

1. **Executable** — `npm run test:coverage` (or an equivalent scoped invocation) enforces a
   threshold specifically on `we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-drain.mjs`,
   `we:scripts/pr-land.mjs`, and `we:scripts/verify-lane.mjs`, measured against their CURRENT real
   coverage (not an aspirational number picked without measuring first) — so it can only ratchet up,
   never silently regress.
2. A test (or a `check:standards` rule) fails when a new export is added to one of these four files
   with no test referencing it, mirroring the existing `test-only-export` scan's shape but inverted
   (untested-export, not test-only-export).
