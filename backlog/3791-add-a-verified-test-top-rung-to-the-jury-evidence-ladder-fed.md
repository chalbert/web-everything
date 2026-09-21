---
bornAs: xocztro
kind: story
size: 3
parent: "3318"
status: open
blockedBy: ["3790"]
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Add a VERIFIED_TEST top rung to the jury evidence ladder, fed by a mutation-check result

Build Fork 2 of #3375 (rule: we:docs/agent/platform-decisions.md#creator-owed-proof-not-reviewer-rederivation). Extend EVIDENCE_KINDS in we:scripts/lib/jury-core.mjs with one new top rung, EVIDENCE_KINDS.VERIFIED_TEST, ranked above quoted-citation in EVIDENCE_STRENGTH. It is fed as caller-supplied ground truth, the way scope and sources already are: the source is a mutation-check killed outcome from we:scripts/operations/mutation-check.mjs. classifyFindingEvidence never trusts a juror's own word. One shared ladder and one floor mechanism, no parallel boolean field. Chained after the disposition story because both edit we:scripts/lib/jury-core.mjs.

## Design (settled by #3375 Fork 2 — nothing here is open)

- **Extend the shared enum, never a parallel field.** No `creatorVerifiedByTest` boolean: that would need its own
  floor logic beside `admitFindingsByEvidence`, the hand-copied-twin drift the module's totality assertions exist
  to prevent. One ladder, one floor mechanism, one totality assertion.
- **Ground truth comes from the caller.** `classifyFindingEvidence` keeps ignoring a juror's own word. The caller
  hands it a mutation-check result whose outcome is `killed` (`MUTANT_OUTCOMES`); `survived` and `unrun` never
  raise a finding to the new rung, because absence of evidence is never evidence.
- **Usable in both directions.** The rung serves a future reviewer-side consumer that can supply a
  mutation-check result too (e.g. #2877's probe runner), so it is not scoped to creator-proof context.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs` passes with new cases that fail
   before this item: `EVIDENCE_KINDS.VERIFIED_TEST` exists and `evidenceStrength` ranks it strictly above
   `quoted-citation`; `classifyFindingEvidence` returns it only when the caller-supplied mutation-check result
   for that finding is `killed`; `survived`, `unrun` and a juror-asserted claim of a passing test all classify
   at their pre-existing rung.
2. **Executable** — the existing totality assertions still hold: loading the module with the new kind but no
   `EVIDENCE_STRENGTH` or `EVIDENCE_GLOSS` entry throws, and the shipped tables carry both.
3. **Executable** — `admitFindingsByEvidence` with the floor set to the new rung admits a `killed`-backed finding
   and demotes a `quoted-citation` one; with the floor left at its default (`assertion`) every pre-existing
   caller's verdict is byte-stable.
