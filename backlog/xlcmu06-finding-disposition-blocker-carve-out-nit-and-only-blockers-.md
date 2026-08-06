---
kind: story
size: 5
parent: "x169s8f"
status: open
dateOpened: "2026-08-06"
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

A fix that serves the item's stated goal is in scope however many files it takes — new integration tests, a caller that needed updating, a doc the change invalidated are the same goal *finished*, not new scope. A fix that introduces a **new** goal is a carve-out. Anchor the test on the item's lead paragraph (the one gate-enforced goal field today; only ~9% of items carry a `## Acceptance` section) and prefer #xctebq6's criteria once those exist.

**The anti-spiral guard is on rounds, not files:** in round 2+, jurors may judge only the round-1 fix. Anything else they notice is auto-carved, not argued. Combined with blocker-only rounds, a PR cannot exceed two passes no matter what anyone finds.

## Build

- we:scripts/lib/jury-core.mjs — a `DISPOSITIONS` enum + `deriveFindingDisposition({introduced, worseThanMain, parallelizable})`; `derivePanelVerdict` reduces over **blockers only**; the round-2 scope freeze in `deriveNegotiationOutcome`
- we:scripts/lib/jury-core.mjs — extend the juror `Finding` shape and the `finding` ledger event with the disposition + the three answers
- we:scripts/lib/review-core.mjs — the juror charter carries the three questions and the better-than-`main` direction test
- we:skills-src/jury/subject-jury.workflow.js — nits batch into an open round; a nits-only panel opens none
- we:scripts/lib/__tests__/ — the disposition truth table, the nits-only zero-round case, the round-2 freeze

## Acceptance

1. **Executable** — a vitest truth table over the eight combinations of (introduced, worse-than-main, parallelizable) asserting exactly one yields `blocker`.
2. **Executable** — a vitest case where every finding is a nit and the panel returns `accept` with `rounds: 0`.
3. **Executable** — a vitest case where a round-2 juror raises a finding unrelated to the round-1 fix and it comes back dispositioned `carve-out`, not `blocker`.
4. **Executable** — a vitest case proving a pre-existing finding on an untouched file never reduces to `changes`.
5. **Executable** — `npm run check:standards` green and the existing jury-core suite stays green.
