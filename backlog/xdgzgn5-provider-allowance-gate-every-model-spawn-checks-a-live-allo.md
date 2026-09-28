---
kind: epic
tier: pinned
status: open
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Provider allowance gate: every model spawn checks a live allowance gauge and falls back by a declared chain

Every provider spawn today — we:scripts/operations/review-pr.mjs's judgeAdvisory seat, fix/ci-heal, build/deliver wrappers, prepare's we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs, probation launchers — launches Codex/Antigravity/Claude with no live allowance check. 2026-09-28: Codex hit quota, judgeAdvisory crashed uncaught, review-loop-cli died, 5 PRs' reviews stalled (narrow fix we:backlog/x5s8b47). Meanwhile a worker's plan review switched to Gemini on its own — the systemic behavior wanted. Full design: a gauge per provider/account, ONE spawn chokepoint, per-job-kind fallback chains as policy, a health smell, auto-recovery. MVP: the chokepoint plus Codex/Antigravity gauges wired into review seats and direct-task scripts.

## Evidence (2026-09-28)

- Codex hit its own quota (reset `2026-10-03T17:11Z`). The `judgeAdvisory` seat in
  `we:scripts/operations/review-pr.mjs` (`providerName: 'codex'`) spawns Codex unconditionally — it has none of
  the quota-hold awareness `we:scripts/operations/review-extra-seats.mjs#quotaHold` already reads for its OWN
  bonus-seat path. The spawn failure was never caught cleanly, `review-loop-cli` crashed (exit 1), and 5 PRs'
  reviews (`#2865`/`#2867`/`#2873`/`#2874`/`#2875`) were left permanently suspended at
  `pending:{step:'judgeAdvisory'}` with no resume path. The narrow, single-seat fix for this one crash is filed
  separately as `we:backlog/x5s8b47` (tiered `pinned`) — this epic is the SYSTEMIC generalization: the same gap
  (a spawn with no live allowance check) sits at every OTHER provider launch point too, not only this one seat.
- Same session, meanwhile: a worker driving its own plan review switched from Codex to Gemini **by itself**
  when Codex looked unavailable — with no chokepoint or declared chain telling it to. That ad-hoc self-correct
  is exactly the behavior this epic wants **systemic and declared**, not incidental to one worker's judgment.

## Full design (product shape)

1. **A gauge per provider/account** — Claude (two subscriptions/accounts), Codex, Antigravity-Claude,
   Antigravity-Gemini, and the GitHub identities (App + personal read split — a card of its own, pending).
   Each gauge exposes `remaining` / `resetsAt` / `held`, read live where the provider exposes it and cached
   otherwise. `we:scripts/usage-report/usage-report.mjs` is the closest existing prior art (per-account
   keychain-stored Anthropic usage windows, the org monthly spend cap) — a manual **report**, not a live
   pre-spawn read; this design generalizes its data model into something every spawn site can query cheaply
   before launching, not just something a human runs on demand.
2. **ONE spawn chokepoint** every provider launch goes through. Real launch sites, inventoried this filing
   (2026-09-28), all currently spawn independently with no shared gate:
   - **Review seats** — `we:scripts/operations/review-pr.mjs` (`judgeAdvisory` codex ~line 1287,
     `judgeCorrectnessAdvisory` codex ~line 1368, `judgeAntigravityReview` antigravity ~line 1459) and
     `we:scripts/operations/review-extra-seats.mjs` (the bonus-seat path, which already owns `quotaHold`,
     ~line 245). `we:scripts/operations/cli-adapter.mjs#createDefaultJudge`/`resolveJudgeProvider` is already
     "the only place a provider is bound to the engine" for judge-kind steps (`JUDGE_PROVIDER_NAMES`:
     `claude`/`codex`/`antigravity`) — the nearest existing partial chokepoint, but it covers judge seats only,
     not delivery/probation/direct-task spawns.
   - **fix/ci-heal + build/deliver wrapper** — `we:scripts/operations/codex-delivery-provider.mjs` (the real
     `execFileSync('codex', …)` spawn every Codex fix/ci-heal/build dispatch runs through, per its own header),
     `we:scripts/operations/ci-heal-pr-dispatch.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`,
     `we:scripts/operations/deliver-item-run.mjs`.
   - **prepare** — no dedicated prepare operation exists yet (`we:backlog/xtw16qn` notes prepare passes today
     run as an ad-hoc session driving `node we:scripts/codex-direct-task.mjs --review` directly); the direct-task
     scripts themselves are prepare's real spawn point.
   - **`we:scripts/codex-direct-task.mjs`**, **`we:scripts/gemini-direct-task.mjs`** — the personal
     escape-hatch direct-task CLIs, used both by prepare passes and ad hoc by an operator low on usage.
   - **Probation launchers** — `we:scripts/operations/dispatch-providers/probation-worker.mjs` (spawns
     `we:scripts/operations/probation-heal-run.mjs` detached) and the pure decision core
     `we:scripts/lib/probation-launcher.mjs`.
   - The low-level judge-role spawns underneath the review seats: `we:scripts/lib/codex-judge-spawn.mjs`,
     `we:scripts/lib/antigravity-judge-spawn.mjs`.
3. **Per-job-kind fallback chains declared as policy data** — e.g. `advisory: codex → agy-gemini → agy-claude →
   skip-with-note`; required seats (the mandatory Claude-backed `judge`/`judgeSecurity` seats in
   `we:scripts/operations/review-pr.mjs`) never wait on an optional provider. This is the same "named dimension, not a rule scattered
   across files" shape `we:backlog/xv0h3mp` (delivery policy as configurable dimensions, parent `#4305`)
   argues for generally — a fallback chain here is naturally one more policy dimension in that epic's eventual
   schema, though this epic does not depend on that one landing first (see MVP cut).
4. **Health smell** when a provider is out or near-out, surfaced on the plan page and later Plateau.
5. **Auto-recovery** when a provider's allowance returns (e.g. Codex's own reset, or OpenAI reopening a larger
   subscription) — the gauge alone already carries `resetsAt`; recovery is noticing it live rather than
   waiting for a human to un-bench the provider by hand.

## Explicit MVP cut

**Must (MVP):**
1. The chokepoint (point 2) plus live gauges for **Codex and Antigravity only** (today's failure sources) —
   not the full per-account/per-identity roster in point 1.
2. `we:scripts/operations/review-pr.mjs`'s `judgeAdvisory`/`judgeCorrectnessAdvisory`/`judgeAntigravityReview`
   seats route their pre-spawn check through the chokepoint (generalizing, not duplicating,
   `we:scripts/operations/review-extra-seats.mjs#quotaHold`'s existing logic) instead of spawning
   unconditionally.
3. `we:scripts/codex-direct-task.mjs` and `we:scripts/gemini-direct-task.mjs` gain the same pre-spawn check, so
   a prepare pass or an operator's manual invocation sees the same gate a review seat does.
4. A declared fallback chain for at least the `advisory` job-kind (point 3 of the Full design), with a
   structured skip/fallback marker recorded on the run — the same "intentional, visible sit-out, never a
   silent crash" shape `we:backlog/x5s8b47`'s own MVP already applies to the single `judgeAdvisory` seat,
   generalized here to every MVP-covered launch site and to a genuine multi-step chain, not only a single skip.
5. Every Full-design piece this slice does NOT build — the full per-account gauge roster (Claude's two
   subscriptions, the GitHub identities), the fix/ci-heal and build/deliver wrapper, probation launchers, the
   health smell / plan-page surfacing, and auto-recovery — is filed as its own follow-up card, `blockedBy` this
   one wherever a real dependency exists, never silently dropped.

**Could (follow-up, already designed above — not built now):**
- Wiring the same chokepoint into `we:scripts/operations/codex-delivery-provider.mjs` and the fix/ci-heal +
  build/deliver wrappers, and into the probation launchers — real, but not today's observed failure source.
- The full per-account/per-identity gauge roster (Claude's two subscriptions, the pending GitHub App/personal
  identity split).
- The health smell surfaced on the plan page, and later Plateau.
- Auto-recovery when a benched provider's allowance returns.
- Cross-wiring this epic's fallback-chain policy data into `we:backlog/xv0h3mp`'s eventual policy schema, once
  that epic's own standard/schema slice lands — not a dependency of this MVP.

**Review gate:** a plan-review finding blocks only when it breaks an MVP Must above or names real harm (a
provider silently mis-gated into a worse fallback, or a required seat blocked on an optional provider); a valid
finding beyond the MVP Musts is scope-growth — auto-filed as a follow-up, never used to hold this card open
past its own review-round cap (`we:backlog/xtw16qn`'s rule, applied to this card's own review).

## Done when

**Must**
1. **Executable** — with Codex's seat-reservation ledger showing a live quota hold (a fake ledger in a unit
   test is sufficient), dispatching `we:scripts/operations/review-pr.mjs`'s `judgeAdvisory` seat AND
   `we:scripts/codex-direct-task.mjs` both skip Codex gracefully per the declared fallback chain — recording
   which fallback ran (or that every option in the chain was exhausted) — instead of crashing or silently doing
   nothing.
2. **Must** — every Full-design piece this MVP does not build (see MVP cut) is filed as its own follow-up card.

**Could**
- The full per-account gauge roster, the fix/ci-heal + build/deliver wrapper and probation-launcher wiring, the
  health smell / plan-page surfacing, and auto-recovery — each real, each deferred, named above.
