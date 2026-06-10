---
type: idea
status: resolved
workItem: story
size: 3
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "scripts/propose-readiness.mjs"
blockedBy: ["250"]
tags: [backlog, tooling, ai, cli]
---

# An LLM spec-gap *proposer* for readiness — content authoring, quarantined from the deterministic core

The deterministic readiness fixer (#250) refuses anything requiring judgment — it never writes
acceptance criteria, invents file paths, or resolves a `decision` fork. That non-deterministic
*assist* was explicitly carved out of #250 into its own item: a **separate `--dry-run` proposer**
that suggests criteria/paths for a vague-but-already-decided backlog item, and **never touches the
deterministic core** in [scripts/readiness/engine.mjs](scripts/readiness/engine.mjs).

This is the readiness analogue of the conformance auto-fix `model` fixer (#196): AI is a swappable
provider behind a stable contract, not architecture. It plugs into the *same* propose-and-verify
discipline (#089) — propose a patch, never auto-apply prose.

## What it does (and still refuses)

- **Proposes** (dry-run only): for an `open` issue/idea that is decided but thin (no acceptance
  criteria, no concrete file paths), draft candidate criteria / likely paths for a human to accept.
- **Refuses** to auto-apply: body prose is never written without explicit human acceptance — the
  proposer prints a diff; it does not splice. It also leaves Tier C (`decision`/`review`) items
  alone — a fork is a human call, not a gap to fill.
- **Stays out of the deterministic path**: it imports nothing from the #250 core and the #250 core
  imports nothing from it, so `check:readiness` remains byte-deterministic with no model in the loop.

## Build

- A `propose:readiness` CLI (or a `--propose` flag that hard-requires a BYO key) reusing the loader's
  derived `tier`/`blockers` to *select* candidates, then a model provider to draft.
- Same registry seam as the conformance `CustomFixerRegistry` — register a `model` provider; absent a
  key, the command reports "no provider" rather than faking output.

## Acceptance criteria

- Running it on a thin-but-decided item prints proposed criteria/paths and writes nothing.
- It never edits a `decision`/`review` item and never auto-applies prose.
- With no model provider registered it degrades gracefully (reports the gap, exits clean).

## Progress

- **Status:** resolved (2026-06-09)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Pure quarantined engine [scripts/readiness/proposer.mjs](scripts/readiness/proposer.mjs):
    deterministic candidate selection (decided-but-thin issue/idea, both gap signals), the
    `CustomProposerRegistry` provider seam (mirrors `CustomFixerRegistry` #196), a deterministic
    reference/scaffolding proposer, and the `propose` → `renderProposalDiff` orchestration. Imports
    nothing from the #250 core (structural test guards both directions).
  - CLI [scripts/propose-readiness.mjs](scripts/propose-readiness.mjs): BYO-key `claude-opus-4-8`
    model provider (raw `fetch`, adaptive thinking, `json_schema` output) registered only when
    `ANTHROPIC_API_KEY` is set; `--reference` swaps in the keyless scaffolding proposer; `--json`
    machine output. Dry-run only — prints a `+`-prefixed diff, writes nothing.
  - `npm run propose:readiness` script wired.
  - 12 demo-first tests in `scripts/readiness/__tests__/proposer.test.mjs` (all 3 acceptance criteria
    + quarantine guard + provider-failure handling), all green. `check:standards` 0 errors.
  - Verified live: keyless run reports `provider: none` and lists gaps without drafting (criterion 3);
    `--reference` prints proposed criteria/paths and writes nothing (criterion 1); decision/review
    items are never selected (criterion 2).
- **Next:** none — resolved. Follow-up #253 (model-provider retry/backoff) captured.
- **Notes:** the pre-existing `blocks/.../mapping-conformance.test.tsx` failure is from an unrelated
  uncommitted working-tree change to its JSX fixture, not this work (passes once that change is stashed).
