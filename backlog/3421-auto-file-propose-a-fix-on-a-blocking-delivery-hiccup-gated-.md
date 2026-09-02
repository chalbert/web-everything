---
bornAs: x39jwee
kind: story
size: 5
parent: "3422"
status: resolved
dateOpened: "2026-08-31"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
tags: []
scope:
  - we:scripts/conveyor/
  - we:skills-src/conveyor/
  - we:skills-src/capture-learning/
  - we:skills-src/harvest-learnings/
---

# Auto-file+propose a fix on a blocking delivery hiccup, gated by approval; non-blocking hiccups file straight through

Follow-up build story from `#3422`'s ruling. A blocking hiccup (the tick did not proceed — a real code
defect, or a dispatched agent punting to free-form prose instead of a predefined structured response) gets
auto-filed with a proposed fix, gated behind explicit human approval before it lands or queues. A non-blocking
hiccup (delivery succeeded but surfaced something worth improving) gets filed only, no gate, no proposed fix.
Both route through the existing learnings-pool/`/harvest` pipeline rather than a parallel one, triggered
mechanically at the moment of the hiccup instead of waiting for a human `/note`.

## Addendum (2026-08-31): the missing-operation risk axis, pinned from the same `#3422` discussion

Per `#3383`'s own next-steps ("pin the missing-operation risk axis and fold it into `#3421`'s scope"), this
amends this story's scope — it does not reopen or rewrite the Done-when items above. Captured faithfully from
the operator's own framing, same 2026-08-31 discussion that produced `#3422`'s ruling:

- **Missing operations specifically are Kanban-style, not ad hoc.** A missing-operation finding (the
  `#3405`-ratified halt-and-surface path) raises a feature request that is then prepared like any other
  backlog item — read the spec, predict what it touches, build it in a lane. This is the SAME mechanism
  `#3412`'s own prepare-scope dispatch already proved end to end (see `#3383`'s 2026-08-31 session update,
  section 1), not a new one.
- **The low-risk-vs-escalate call is the building/reviewing agent's own confidence assessment, not a rigid
  rule-based classifier.** Made during the normal prepare/build flow, against a small set of named criteria:
  security risk, data-leak risk, performance, blast-radius/reversibility, and baseline correctness. Every
  built operation still gets an agent review, always — the confidence call decides whether a HUMAN also has to
  look at it, not whether it gets reviewed at all.
  - High confidence, clean on every criterion → self-clears, no human in the loop.
  - Any flagged criterion, or genuine uncertainty → joins a BATCHED list of AI-authored findings for a human
    to clear on their own time — not a blocking interactive prompt.
- **A standing blacklist of commands/APIs forces elevated review regardless of confidence.** Independent of
  the confidence call — the same denylist-and-grow shape `#3405` already ratified for the dispatch doctrine
  generally, applied here specifically to operations that call something on the list.
- **Thresholds are eventually a Plateau admin-configurable surface, not a hardcoded constant** — the confidence
  bar and the blacklist contents both. Pre-production, keep this light: a short list, a loose bar, tightened
  later once there's real usage to tune against. None of this blocks building a first version.

## Done when

1. **Executable** — a classifier derives blocking-vs-non-blocking directly off the tick core's own state
   (`we:skills-src/conveyor/runner.mjs` / `we:scripts/conveyor/tick-core.mjs` — did this tick's dispatch get
   suppressed/held, or did it proceed), with a test pinning at least one case of each shape, including
   `#3416`'s own guard-suppression case and `#3412`'s free-form-question case as named regression fixtures.
2. **Executable** — a mechanical sink writes into the SAME learnings-pool store
   `we:skills-src/capture-learning` already writes to (not a new store), stamping a blocking-bucket entry
   with the proposed fix and an explicit approval-pending flag; a non-blocking entry carries neither.
3. **Executable** — `/harvest` (or a lighter-weight companion trigger, whichever proves cheaper to wire) reads
   the approval-pending flag and refuses to file+queue a blocking-bucket entry's fix until it is cleared;
   a non-blocking entry files straight through with no gate check.
4. **Executable** — for the missing-operation case specifically (the addendum above), the confidence-assessment
   axis (named criteria: security risk, data-leak risk, performance, blast-radius/reversibility, baseline
   correctness) and the standing blacklist axis are both wired into the classifier from Done-when #1, with a
   test pinning a clean-self-clears case, a flagged-criterion-batches case, and a blacklisted-call-escalates
   case. The confidence bar and blacklist contents are a light, pre-production default (kept configurable, not
   yet surfaced as a Plateau admin setting — that surface is future work, not required to close this item).
5. `npm run check:standards` — no new errors.

## Progress

- Built the #3421 classifier core (we:scripts/conveyor/hiccup-classify.mjs): guard-suppression + free-form-response
  detection, plus the missing-operation confidence/blacklist axis from the addendum. Tests pin the #3416 and
  #3412 fixtures and all three confidence outcomes.
- Extended the learnings-drop schema (we:scripts/conveyor/learnings-drop.mjs) with optional
  blocking/proposedFix/approvalPending fields, backward-compatible with every existing non-blocking entry.
- Added the mechanical sink (we:scripts/conveyor/hiccup-sink.mjs, idempotent per hiccup) and wired it into the
  headless runner's mechanical pass (we:skills-src/conveyor/runner.mjs) so a guard-suppression hiccup is
  auto-filed without waiting for a human /note.
- Added the approval store (we:scripts/conveyor/hiccup-approve.mjs) and gated we:scripts/conveyor/learnings-harvest.mjs's
  candidate list on it (partitionGated) so an un-approved blocking entry never routes; documented in
  we:skills-src/harvest-learnings/SKILL.md.
- All new + touched conveyor/learnings test suites green (526 tests).
