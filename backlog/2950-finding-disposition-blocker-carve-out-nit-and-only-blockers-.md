---
bornAs: xlcmu06
kind: story
size: 5
parent: "2948"
status: active
dateOpened: "2026-08-06"
dateStarted: "2026-08-07"
tags: []
---

# Finding disposition: blocker, carve-out, nit — and only blockers earn a round

Replace the whole-PR bounce on any mandatory-lens changes verdict with a per-finding disposition. A finding blocks only if this PR introduced it, it leaves things worse than main, and it cannot be fixed in parallel; everything else is filed. Nits ride an existing round but never open one, and round two may only judge the round-one fix.

## The three questions every juror answers

A finding today is binary: raise it and the PR bounces, or stay quiet. That prices every observation as a blocker, which is why the panel argues. Each juror instead answers three questions per finding, and the answers route it:

| question | if the answer is… | disposition |
|---|---|---|
| Was the problem already there? | pre-existing, on code this PR did not touch | **carve-out** — never blocks this PR |
| Are we net better or worse than `main`? | better, just not ideal | **carve-out** — accept and file |
| Can it be fixed in parallel? | yes, in an independent lane | **carve-out** — runs alongside, never holds |

So a finding is a **blocker** only when all three hold: this PR **introduced** it, it leaves things **worse than `main`**, and it **cannot** be fixed in parallel. Everything else is filed. The second question is the one models get wrong — they judge against an ideal rather than against `main` — so it belongs in the charter explicitly as a direction test.

**Nits ride, never drive.** A nit can attach to a round that a blocker already opened, batched into that fix for free. A PR whose findings are all nits opens **zero** rounds: they become non-blocking items and the PR accepts.

## Blockers are delivered, not negotiated

A blocker does not bounce the PR into an edit↔review loop. It is carved into its own lane, delivered, and then the original PR accepts — kanban, not negotiation. This is what stops a PR growing under review, which is the failure mode that makes convergence expensive.

## Scope is the goal, not the file set

A fix that serves the item's stated goal is in scope however many files it takes — new integration tests, a caller that needed updating, a doc the change invalidated are the same goal *finished*, not new scope. A fix that introduces a **new** goal is a carve-out. Anchor the test on the item's lead paragraph (the one gate-enforced goal field today; only ~9% of items carry a `## Acceptance` section) and prefer #2949's criteria once those exist.

**The anti-spiral guard is on rounds, not files:** in round 2+, jurors may judge only the round-1 fix. Anything else they notice is auto-carved, not argued. Combined with blocker-only rounds, a PR cannot exceed two passes no matter what anyone finds.

## Build

- we:scripts/lib/jury-core.mjs — a `DISPOSITIONS` enum + `deriveFindingDisposition({introduced, worseThanMain, parallelizable})`; `derivePanelVerdict` reduces over **blockers only**; the round-2 scope freeze in `deriveNegotiationOutcome`
- we:scripts/lib/jury-core.mjs — extend the juror `Finding` shape and the `finding` ledger event with the disposition + the three answers
- we:scripts/lib/review-core.mjs — the juror charter carries the three questions and the better-than-`main` direction test
- we:skills-src/jury/subject-jury.workflow.js — nits batch into an open round; a nits-only panel opens none
- we:scripts/lib/__tests__/ — the disposition truth table, the nits-only zero-round case, the round-2 freeze

## Delivered so far (2026-08-07) — the routing half

The disposition mechanism and the mandate that feeds it are built; the delivery half is not. What landed:

- **The routing is CODE, not the model's word.** `deriveFindingDisposition({introduced, worseThanBase, parallelizable})`
  in we:scripts/lib/jury-core.mjs routes the three answers; exactly one combination is a `blocker`. A juror answers
  three facts, the function decides. The routed disposition **overrides** a self-declared one so no juror can
  self-certify past a blocker — `nit` survives only as a finer label on an already-carved-out finding.
- **Only a blocker earns a round.** `earnsRound` is a verdict-narrow predicate (the `blocksAcceptance` pattern), read
  by `deriveVerdict`. A panel whose findings are all carve-outs/nits now returns `accept` and opens zero rounds.
- **Fail-closed throughout.** An absent, non-boolean, or invented answer leaves the finding blocking, so every
  pre-#2950 finding shape verdicts exactly as before — a strict relaxation, reversible by ignoring the field.
- **The mandate states the goal.** `buildSubjectMandate` takes `goal` and `round`; the juror is told what the change
  is FOR and to judge against that and the base, never an ideal. `/converge` takes `--goal` and threads it.
- **The anti-spiral guard.** At round ≥ 2 the mandate says: judge only the previous round's fix; anything else is a
  carve-out by construction. This is what lets the loop end on agreement instead of on the round cap.

Still owed by this item:

- **Blockers are DELIVERED, not negotiated** — carving a blocker into its own lane so the original change accepts.
  Not built: a blocker still opens an editor round exactly as it did.
- **Nits are FILED.** A nits-only panel accepts, and the nits reach the notice and the ledger, but nothing turns
  them into backlog items yet — so today they are reported and then dropped on the floor.
- **The round-2 freeze is a MANDATE, not a mechanism.** Round 2+ jurors are *told* to carve out anything unrelated
  to the round-1 fix; nothing enforces it, because matching a round-2 finding to a round-1 finding is not
  deterministic. Acceptance criterion 3 below is therefore met at the instruction level only.

## Acceptance

1. **Executable** — a vitest truth table over the eight combinations of (introduced, worse-than-main, parallelizable) asserting exactly one yields `blocker`.
2. **Executable** — a vitest case where every finding is a nit and the panel returns `accept` with `rounds: 0`.
3. **Executable** — a vitest case where a round-2 juror raises a finding unrelated to the round-1 fix and it comes back dispositioned `carve-out`, not `blocker`.
4. **Executable** — a vitest case proving a pre-existing finding on an untouched file never reduces to `changes`.
5. **Executable** — `npm run check:standards` green and the existing jury-core suite stays green.
