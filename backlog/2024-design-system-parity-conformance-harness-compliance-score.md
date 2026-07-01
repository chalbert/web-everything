---
kind: story
size: 8
parent: "1226"
status: open
blockedBy: ["2017"]
dateOpened: "2026-07-01"
tags: [parity, conformance, harness, compliance, gap-list]
---

# Design-system parity conformance harness (repeatable compliance score)

## Digest

The parity program (#1226) asserts every top design system reduces to `theme tokens + intents`, but there is **no
repeatable measurement** — parity is claimed, not scored. Today's "flavors" are hand-eyeballed. This item builds a
conformance harness: given a flavor manifest and a reference design system, it renders a fixed component set under
the flavor, diffs each against the reference (visual + key behaviors), and emits a **compliance score + gap list**.
This is what actually answers *"are we at 100% for shadcn / Material / Fluent / Carbon?"* — and turns each parity
slice (#2022, #2023, #2025) into a graded, re-runnable check instead of a one-off screenshot.

## Scope

- Define a canonical component set (button, input, card, badge, nav, tabs, …) and a reference-capture method per
  target design system.
- Build a harness (`fui:` test/CLI, invoked from WE like the data-table hook) that loads a flavor via the #2017
  loader, renders the set, diffs vs reference, and outputs `{ component: score, gaps: [...] }`.
- Emit a per-flavor compliance report under `we:reports/…`; wire it so a flavor's score is re-derivable on demand.
- Consume the gap lists from #2022/#2023 as the seed gap taxonomy.

## Acceptance

- Running the harness on the shadcn flavor (#2022) yields a numeric per-component compliance score + gap list,
  reproducibly.
- The harness is target-agnostic (no shadcn-specific hardcoding) — proven by also scoring the Material flavor (#2023).
- Output is a committed report; re-running updates the score.

## Notes

- Depends on #2017. Pairs with the reproduction-conformance program's evolving standard (#1226) and the general
  UI-tester/judge line (#1167 / #1552) — keep the harness general, no per-system code baked in.
