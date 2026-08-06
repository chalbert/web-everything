---
bornAs: xs7x7mg
kind: task
status: open
dateOpened: "2026-08-05"
tags: [check-standards, provenance, citation-verification, drain]
blockedBy: ["2821"]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/lane-drain.mjs
---

# Extend citation gate 3 to scan scripts/ for dangling hash slugs the at-land rewriter never rewrites

The at-land hash-to-NNN rewriter covers `we:backlog/` and `we:docs/agent/` only, so a `#xNNNNNN` written into
`we:scripts/` dangles forever once the item lands with a number.

## Why it is owed

Gate 3 of [#2821](2821-ratify-gate-provenance-hooks-make-the-self-ratify-pr-number-.md) named the scope gap and
listed `we:reports/`, `we:src/_data/researchTopics/` and `we:src/_includes/research-descriptions/` as the dirs
to add. **`we:scripts/` was not on that list, and it is the largest live instance of the class.**

A source file is exactly where an in-flight item's hash gets written, because the code comment that explains a
fix is authored in the same lane as the fix. PR #1049 alone leaves **13** `#2932` citations across
`we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-resume.mjs`, `we:scripts/conveyor/pr-watch.mjs` and their three
test files. The moment the drain lands that item as a real `NNN`, every one of them points at an id that no
longer exists — in the very docstrings a future reader consults to understand why the selector works the way it
does.

The interim convention #2821 records ("never write a hash slug outside `backlog/` + `docs/agent/`") cannot hold
here: a lane authors its code comments before it knows its number, so a hash is the only reference available at
write time. The rewrite scope is the fix, not the convention.

## Build

Either of #2821 gate 3's two mechanisms, applied to `we:scripts/`:

- **Widen the rewrite** — add `we:scripts/` to the at-land hash→NNN sweep in
  `we:scripts/lane-drain.mjs#numberPendingHashes`, under the same tracked-only / landed-only guard as the
  existing `backlog/` + `docs/agent/` scan. This self-heals the 13 cites above with no author action.
- **OR flag it** — extend the gate-3 error in `we:scripts/check-standards-rules.mjs` to fire on any `#xNNNNNN`
  living under `we:scripts/`, forcing a hand fix before land.

Widening is strongly preferred here: unlike a `.njk` research page, a code comment CANNOT avoid the hash at
write time, so the hard-error form would fire on every correctly-authored lane. Scan `.mjs`, `.js`, `.ts` and
`.md` under `we:scripts/`, and skip fixture strings that deliberately assert the un-rewritten form (the #2826
rewrite-proof-fixture problem — a rewriter that eats its own test is the failure that item exists to repair).

## Acceptance

- After `#2932` lands as an `NNN`, no `#2932` remains anywhere under `we:scripts/`.
- The sweep is idempotent and touches no un-landed hash (an item still in flight keeps its hash).
- Any fixture that must retain a literal hash slug survives the sweep, and there is a test proving it does.
- `npm run check:standards` stays at 0 errors.
