---
kind: story
size: 2
priority: low
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a second CI-less constellation repo is queued to be drained"
dateOpened: "2026-07-28"
tags: [ci, drain, reporting]
---

# classifyPr: distinguish no test check configured from check ran red

Reporting-only, fail-closed split in the drain's `classifyPr` (`we:scripts/merge-ai-prs.mjs:246`) so a PR with
**no required check named `test` configured** is reported distinctly from one whose `test` check **ran red**.
Today both collapse to the same skip reason — `required check "test" is not green` — because
`isRequiredCheckGreen` returns `false` on an absent check (`we:scripts/merge-ai-prs.mjs:210`), a fail-*closed*
skip. This item keeps that fail-closed skip untouched; it only makes the *reporting* distinguish the two cases.
It never treats a check-less repo as landable.

> **⏸ Deferred — un-defer tripwire.** Un-defer when a **SECOND CI-less constellation repo is actually queued to
> be drained.** Speculative today: FUI now has CI (#2315's `test` check landed and green), and plateau-app is a
> product, not a CI-less constellation repo — so there is exactly one constellation repo and the "no-check vs
> red" conflation is moot. Encoded as `maturityTrigger: adoptionSignal: a second CI-less constellation repo is
> queued to be drained` (a named external milestone, per the `maturityGated` discipline), and `priority: low`
> even after it un-defers.

Relates #2315 (the ratified repo↔drain check contract —
`we:docs/agent/platform-decisions.md#repo-drain-check-contract`). This was Fork 1's option (b) follow-up, filed
separately per the ratification, never bundled into the decision.
