---
kind: task
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Extend the VERDICTS totality gate: class bodies + coverage drop-out below the 2-verdict threshold

The `@verdicts-total` discovery gate (`we:scripts/lib/verdict-totality.mjs`, filed as
`xiqj3w9`, built in PR #976) closes the enum-totality miss class for the shapes it
scans, but two demonstrated evasions remain. It only recognises top-level
`function`/`const`/`let`/`var` symbols, so verdict logic inside a `class` body is
invisible; and it only treats a symbol as a verdict consumer at **≥2** distinct
verdict references, so an existing covered consumer later simplified to one explicit
branch plus a catch-all silently drops out of coverage with no signal.

## Context

Found during the round-4 human review of PR #976 (`/review`, #2326) by adversarially
testing the gate's discovery against synthetic fixtures. Neither hole is a live defect
in the tree as it stands — the gate scans 186 files, finds 9 verdict-consumer sites,
all annotated, 0 errors, and nothing in the codebase is class-based. Both were
accepted as follow-ups rather than a fifth review round, because closing them means
extending the gate rather than fixing the PR.

**Hole 1 — class bodies are invisible.** `SYMBOL_RE` in
`we:scripts/lib/verdict-totality.mjs` is
`/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/`
— it does not match `class`. Verified: a top-of-file class whose method branches on
two `VERDICTS` members produces **no error at all**. Because spans run from one
matched symbol start to the next, a class declared before any matched symbol is never
scanned; one declared after gets its lines absorbed into the *preceding* symbol's
span, which mis-attributes the finding even when it does fire.

**Hole 2 — coverage can silently drop below the threshold.** `checkVerdictTotality`
skips any symbol with `referenced.size < 2`. The interesting failure is not a new
consumer, which the author would be prompted to annotate — it is an **existing**
`@verdicts-total` symbol refactored down to one explicit verdict branch plus a
default. It then stops being a consumer, the gate stops checking it, and the marker
saying it is guarded stays in the source, now false. That is a coverage regression
with no signal — precisely the failure mode the derive-based design exists to avoid.

## Acceptance

- The scan recognises verdict consumers inside `class` bodies (either by matching
  `class` in `SYMBOL_RE` and treating methods as sub-spans, or by scanning method
  declarations directly). A class-body consumer that is unannotated errors, and one
  marked `@verdicts-total` is checked for totality.
- A symbol carrying a `@verdicts-total` marker is checked **regardless** of how many
  verdicts it references — an annotated symbol that has fallen below 2 references
  either still passes totality or errors, so the marker can never silently become a
  lie. (The ≥2 threshold stays as the *discovery* rule for unannotated symbols.)
- Both holes have a unit-test fixture in
  `we:scripts/lib/__tests__/verdict-totality.test.mjs` proving the gate now errors
  where it previously stayed silent.
- Green over the repo — no new errors on the current tree.
