---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# pr-land reports reason:parked with exit 0 even when the park label apply failed

`--park` catches the label-apply error, leaves `reviewLabelApplied: false`, and still emits `reason:"parked"` with exit 0 — and under `--json` the stderr warning is suppressed. So an agent reports "parked, held" on a PR that is actually open, unlabelled and green, which `shouldLabelOnGreen` then labels `ready-to-merge` and the daemon lands unreviewed. Give the failed apply its own reason and a non-zero exit, locked by a unit test. Found by the round-4 review of PR #1050.

## The gap

The park block in [`we:scripts/pr-land.mjs`](scripts/pr-land.mjs) (the `PLAN.mode === 'park'` branch) does
this:

```js
try { ghC(['pr', 'edit', String(prNum), '--add-label', parkLabel]); parkApplied = true; }
catch (e) { if (!AS_JSON) process.stderr.write(`… could not apply park label … set the label by hand\n`); }
emit({ …, reason: 'parked', reviewLabel: parkLabel, reviewLabelApplied: parkApplied, … }, 0);
```

Three things compound:

1. **The reason does not change.** `reason:"parked"` is emitted whether or not the label landed. Every caller
   that switches on `reason` — the conveyor briefs, `/pr`, an agent reading the one-line result — reads "held".
2. **The exit code does not change.** `0` means "the run did what it was asked". It did not.
3. **The only honest signal is suppressed exactly where it is needed.** The warning is written to stderr under
   `if (!AS_JSON)`, and every machine caller passes `--json`. The `reviewLabelApplied: false` field is in the
   JSON, but nothing reads it — it is a field an agent has to know to look for, on a result whose `reason` has
   already told it the opposite.

The resulting state is the worst one available: the PR is open, unlabelled, and being reported as held. That is
precisely the state `shouldLabelOnGreen` ([`we:scripts/merge-ai-prs.mjs`](scripts/merge-ai-prs.mjs), #2216)
exists to heal — it labels any producer-owned AI PR `ready-to-merge` once its required check reads green — so
the PR the agent believes is parked for a human is the one the resident daemon lands soonest.

This is not hypothetical wiring: `--park` is now the documented hold in `we:skills-src/pr/SKILL.md` and all
three conveyor briefs (PR #1050), so a park failure is on the trust-chain path by design.

## Done when

- A failed park-label apply emits a **distinct reason** (e.g. `reason:"park-unlabelled"`) with a **non-zero
  exit**, carrying the PR number and the underlying `gh` error in `detail` — so a caller that only reads
  `reason` + exit code cannot mistake it for a hold.
- The successful park keeps `reason:"parked"` / exit `0` unchanged (no caller churn on the normal path).
- A unit test in [`we:scripts/__tests__/pr-land.test.mjs`](scripts/__tests__/pr-land.test.mjs) locks both
  branches — apply-succeeds → `parked`/0, apply-throws → the new reason and a non-zero code. Prefer extracting
  the decision into a pure helper (the house shape: pure core, thin CLI) so the test does not need a `gh` stub.
- The `/pr` skill's Exit-codes section lists the new reason (and its recovery: re-apply the label, or re-run
  `pr-land` on the same `--ref`).
- Decide and record what the run should do about the *open* PR when the label cannot be applied — leaving an
  unlabelled open PR behind is the hazard; state whether the run retries the apply once, or reports it and stops.
