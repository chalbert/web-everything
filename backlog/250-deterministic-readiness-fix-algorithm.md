---
type: idea
status: resolved
workItem: story
size: 3
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
blockedBy: ["248", "249"]
tags: [backlog, tooling, determinism, cli]
---

# A deterministic readiness "fix" algorithm — cascade re-evaluation, not LLM authoring

Mirror the conformance auto-fix pattern (#095) for backlog readiness, but keep the
*fix* fully **deterministic**: it only does structural repairs that follow
mechanically from the dependency graph (#248) and the readiness function (#249) —
it never authors content. The single highest-value deterministic fix is **cascade
re-evaluation**: when an item flips to `resolved`, every item with it in `blockedBy`
is re-scored, and the ones whose blockers are now *all* resolved deterministically
promote to Tier A — no LLM, no guesswork.

Depends on **#248** and **#249**.

## What the deterministic fixer does (and refuses to do)

- **Cascade promotion** — recompute `tier` for the transitive dependents of any
  newly-`resolved` item; report which items just became agent-ready.
- **Structural normalization** — flag/backfill mechanical issues: a `blockedBy`
  pointing at an already-`resolved` item (stale edge, can be dropped), a missing
  `dateStarted` on an `active` item, a story without a `size`. Pure field hygiene.
- **Refuses** anything requiring judgment: it must **not** write acceptance criteria,
  invent file paths, or "resolve" a `decision` fork. Authoring is non-deterministic by
  nature — quarantine it. An LLM spec-gap *assist* (propose criteria/paths for a vague
  but already-decided item) is explicitly **out of scope here** and, if wanted, becomes
  its own item: a separate `--dry-run` proposer that never touches the deterministic core.

## Build

- A `check:readiness` (or `fix:readiness`) script reusing the loader's derived `tier`
  and `blockers` from [src/_data/backlog.js](src/_data/backlog.js).
- Default **dry-run**: prints the cascade result + normalization findings; `--apply`
  only performs the mechanical, reversible edits (splice frontmatter, never rewrite
  bodies).

## Acceptance criteria

- Resolving an item and running the tool deterministically lists every dependent that
  became Tier A.
- The tool only ever edits structured fields; it never writes body prose, and it leaves
  Tier C (`decision`/`review`) items untouched.
- Same backlog state → identical output every run.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:** pure engine [scripts/readiness/engine.mjs](scripts/readiness/engine.mjs) (`computeReadiness` + `spliceStaleEdges`); CLI [scripts/check-readiness.mjs](scripts/check-readiness.mjs) (dry-run default, `--apply`, `--json`); 12 unit tests in [scripts/readiness/__tests__/engine.test.mjs](scripts/readiness/__tests__/engine.test.mjs); `check:readiness` + `fix:readiness` npm scripts.
- **Next:** — (resolved). Follow-up #252 = the quarantined LLM spec-gap proposer.
- **Notes:** Reuses the loader-derived `tier`/`blockers` (#248/#249) — never recomputes the rubric. Cascade reports open issue/idea with ≥1 blocker now all resolved → Tier A, plus still-blocked items + their open blockers. Normalization: `stale-edge` (resolved edge in `blockedBy`) is the ONLY `--apply` class (frontmatter splice, body untouched); `missing-date-started` (active w/o `dateStarted`) and `missing-size` (story w/o `size`, scoped to stories to match the validator) are flag-only. Verified splice on a fixture: drops the line, leaves body `["NNN"]` + sibling fields intact. check:standards green; one pre-existing unrelated JSX-renderer test failure (untouched by this work).
