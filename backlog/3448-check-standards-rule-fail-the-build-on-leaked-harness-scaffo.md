---
bornAs: xknm96d
kind: story
size: 3
parent: "3383"
status: resolved
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
dateResolved: "2026-09-03"
tags: []
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards-rules-content-lint.test.mjs
  - we:scripts/__tests__/fixtures/check-standards-rules-fixtures.mjs
---

# check:standards rule: fail the build on leaked harness-scaffolding markers in tracked backlog/report content

PR #1803 committed a literal <system-reminder> block (harness attribution/session-URL/SendUserFile guidance) into we:backlog/3427-design-an-operation-manager-a-real-execution-chokepoint-ever.md -- accidentally copy-pasted from the authoring agents own context, not an external attack, but undetected until human review. Add a deterministic we:scripts/check-standards-rules.mjs (or pre-commit) rule that greps changed markdown/backlog/report files for harness-scaffolding markers (`<system-reminder>`, `<system>`, `Claude-Session:`, SendUserFile-style tool-invocation instructions) and fails check:standards if any are found in tracked content outside of a code fence documenting the pattern itself.

## Done when

1. **Executable** — `we:scripts/check-standards-rules.mjs` gains a new rule that scans tracked
   `backlog/**/*.md` and `reports/**/*.md` content for harness-scaffolding markers (`<system-reminder>`,
   `<system>`, `Claude-Session:`, and SendUserFile-style tool-invocation instructions) appearing outside a
   fenced code block, and fails `npm run check:standards` when any are found, naming the file and line.
2. A fixture proves both directions: a file containing a bare `<system-reminder>` block fails the rule; the
   same marker fenced in a code block (documenting the pattern itself, as this discussion does) passes.
3. `npm run check:standards` passes on the current tree once the rule ships (no false positive on existing
   content).
