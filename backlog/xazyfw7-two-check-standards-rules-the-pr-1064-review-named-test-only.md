---
kind: story
size: 3
status: open
dateOpened: "2026-08-06"
tags: []
---

# Two check:standards rules the PR #1064 review named: test-only exports and unfenced mandates

Two script-decidable gate rules whose whole-repo shape needs design work before they can block. (a) TEST-ONLY EXPORT SCAN: flag any we:scripts/lib/*.mjs export whose only in-repo importer is its own __tests__ file — that catches the whole 'extracted, tested, never wired' class (reduceLensJury was exported, unit-tested and never called, so multi-juror lenses collapsed last-writer-wins). A probe run finds ~156 candidates, most false positives (CLI-shelled consumers, star-import re-exports, harness bodies that cannot import), so the carve-out set is the work. (b) UNFENCED MANDATE SCAN: fail any mandate-building export in we:scripts/lib/ that interpolates a caller-supplied string without routing it through fenceUntrusted + FENCED_DATA_RULE — the #2438 splice guard, which was left local to the plan handshake so the next author composing a mandate followed the older unfenced example.

The third rule the same review named — the declared-contract-vs-imports diff — was **cheap and in scope, so it
shipped in the PR #1064 fix** (`validateDeclaredModuleContract`, rule 16). These two are what was left.

## (a) The test-only-export scan

**What it catches.** `reduceLensJury` was exported from we:scripts/lib/converge-core.mjs, unit-tested with three
cases, and never called by anything. The consequence was not cosmetic: multi-juror lenses collapsed
last-writer-wins inside `reducePanelRound`, so the SAME two jurors produced `land` or `edit` depending on array
order. "This export's only in-repo importer is its own test file" is fully script-decidable, and it catches the
whole extracted-tested-never-wired class in one rule.

**Why it is not a one-liner.** A probe over `scripts/` + `skills-src/` finds ~156 candidates today, and most are
false positives:

- exports consumed through a namespace star-import (the whole check-standards rule family);
- exports consumed by a Workflow HARNESS BODY, which cannot import at all and shells a CLI instead;
- contract constants (`REVIEW_POLICY`, the `POLICY_*` family) whose only importer is a conformance suite BY
  DESIGN — the suite pinning impl-to-contract IS the consumer;
- genuinely-public API a sibling repo consumes.

The work is the carve-out set and how it is declared, not the scan.

## (b) The unfenced-mandate scan

**What it catches.** A mandate-building export in we:scripts/lib/ that interpolates a caller-supplied string
straight into instruction position. This repo already ships `fenceUntrusted` + `FENCED_DATA_RULE` for exactly
that splice (#2438), but the fix was left local to the plan handshake — so the next author composing a mandate
(`buildPanelMandate`, `buildEditorMandate`) followed the older unfenced example and put a raw diff, and then raw
juror finding text, adjacent to the mandate. The second hop is the dangerous one: finding text goes to an agent
with WRITE TOOLS pointed at a live tree.

**Shape.** For each mandate-building export in `scripts/lib/`, require every parameter that reaches a template
literal in the returned string to pass through `fenceUntrusted`, and require the returned string to contain
`FENCED_DATA_RULE` when any does. Needs an allow-list for parameters that are CLOSED enums (a lens name, a round
number) — those are not untrusted and fencing them would be noise.

## Definition of done

- Both rules live as pure functions in we:scripts/check-standards-rules.mjs with synthetic-fixture unit tests,
  wired into we:scripts/check-standards.mjs, and the live repo is GREEN under both.
- Each carve-out is declared in code with its reason, not silently dropped from the scan.
- Neither rule adds an enforcement flag without a matching entry in we:scripts/check-standards.contract.json.
