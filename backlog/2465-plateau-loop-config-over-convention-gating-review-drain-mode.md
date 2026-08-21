---
bornAs: x8wagm6
kind: story
size: 8
parent: "2445"
status: open
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: config-over-convention — gating / review / drain / model as platform config

Turn today's convention-encoded policy (gating, review escalation, drain policy, model choice) into inspectable, editable platform config, wired to the operable console. Deferred behind the phase-1 evidence gate — parked, pickable.

## Prep assessment (2026-08-15) — NOT build-ready as scoped; recommend split

Verified against live code before preparing this as one story (checklist item 8). Two findings, both grounded
in `path:line`, converge on "this card's premise is now stale and its four axes no longer share one shape":

1. **The "deferred behind the phase-1 evidence gate" framing is stale.** That gate ([#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/),
   still `status: open` — the "few weeks unattended" bar is not met) governed
   [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/) and
   [#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/). #2444 was
   independently un-deferred and ratified 2026-07-16 (a different consumer,
   [#2530](/backlog/2530-build-endpoint-supervised-builder-post-api-backlog-build-dra/), greenlit it — see
   #2444's "Un-deferred + prepared" note) and #2530 shipped (plateau#61, `plateau:src/build-runner/runner.ts`,
   `plateau:src/build-runner/build-action.ts`). Phase 1's runner/builder already exists; "wait for evidence"
   is no longer why this card can't move.
2. **Two of the card's four axes already shipped as config, under different epics, after this card was
   filed (2026-07-12).** Handing this card to a builder unchanged risks a redundant rebuild of work that's
   already live:
   - **Gating** is already explicit, versioned config: `we:scripts/lib/gate-config.mjs` (#2448) is the single
     source of truth for the trust-chain tiers (`isPolicyCorePath`/`isGateSelfPath`), split into a
     `leash: 'spec'` (declarative, always `review:human`) vs `leash: 'derivation'` (agent-clearable) tier per
     `we:docs/agent/platform-decisions.md#review-human-declarative-leash-only` (#2771/#2785).
   - **Review escalation** is already a machine-diffable DATA contract: `we:scripts/lib/review-policy.contract.json`
     declares the rubric thresholds, escalation-reason vocabulary, and disposition table as versioned JSON
     (#2566/#2563/#2564); `we:scripts/lib/review-escalation.mjs` derives from it and a conformance suite proves
     the derivation matches. "A diff to it trips the policy-tier path test" — it is already inspectable and
     already gated.
   - **Drain policy** is only PARTLY config: `plateau:tools/drain-daemon/lib.mjs:36-50` (`resolveConfig`)
     already reads `DRAIN_DAEMON_INTERVAL_SEC`/`_MAX_BACKOFF_SEC`/`_PASS_TIMEOUT_MIN`/`_HEARTBEAT_SEC`/`_PORT`
     from env — but the qualitative thresholds that actually decide degraded/stuck are still hardcoded module
     constants with no override: `STALL_WARN_PASSES`/`STALL_CRIT_PASSES` (`plateau:tools/drain-daemon/lib.mjs:405-406`),
     `FAIL_WARN_COUNT`/`FAIL_CRIT_COUNT`/`TIMEOUT_WARN_COUNT` (`:415-418`), `PARK_STALE_PASSES`/`CONSIDERED_NEVER_MERGED_PASSES`
     (`:419-420`). This axis is genuinely still convention.
   - **Model choice** is genuinely still convention — worse, it's unbuilt. `RunnerTask.model`
     (`plateau:src/build-runner/runner.ts:36-37`) and `BuildFlowOpts.model` (`plateau:src/build-runner/build-action.ts:131-132`)
     are plumbed all the way to `--model` on the CLI spawn (`plateau:src/build-runner/runner.ts:90`), but
     **nothing ever sets them** — grepped every caller of `runBuildFlow`/`BuildFlowOpts` in `plateau:src/`;
     the only two hits are the module itself and its test. There is no config source, no env var, no console
     control.
   - Checked the console for a policy-CONFIG surface (not per-PR escalation-outcome text, which
     `plateau:tools/dev-panel/drain-daemon.html:542-543` already shows read-only): none of
     `we:scripts/lib/gate-config.mjs`, `we:scripts/lib/review-policy.contract.json`, the `DRAIN_DAEMON_*` env
     vars, or model choice is referenced anywhere under `plateau:tools/dev-panel/` or `plateau:src/backlog-view/`.
     **The "wired to the operable console" half is 100% unbuilt for all four axes** — that part of the
     premise still holds.

**Why this blocks preparing #2465 as one story (checklist item 4 — decided design, not a menu):** the four
axes no longer share a mechanism. Two are already data-driven contracts with their own human-gated write path
(gating, review escalation — editing them from a console re-opens the self-gating invariant,
`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`, which is its own design call, not
assumable here). One is partially env-config, partially hardcoded constants (drain). One has no config
surface at all (model). A single "make it all platform config" story would either silently re-decide the
gating self-gating question or skip it and under-deliver — exactly the buried-fork failure mode item 4
exists to prevent. This needs to be split before it can be prepared to build-ready; see the follow-up item
filed for the recommended slice breakdown.

**The follow-up is [#3119](/backlog/3119-split-2465-config-over-convention-into-slices-matching-curre/)**
(`status: open`), which carries the A/B/C slice recommendation and its own `## Done when`. Line refs
re-verified 2026-08-21 against `plateau-app`: `resolveConfig` at `plateau:tools/drain-daemon/lib.mjs:36`; the
hardcoded thresholds at `:400-401` (`STALL_WARN_PASSES`/`STALL_CRIT_PASSES`), `:410` (`FAIL_WARN_COUNT`) and
`:414` (`PARK_STALE_PASSES`) — a few lines above the ranges quoted in the assessment; `RunnerTask.model` at
`plateau:src/build-runner/runner.ts:36-37` reaching `--model` at `:90`; `BuildFlowOpts.model` at
`plateau:src/build-runner/build-action.ts:132-133`, set from a single call site (`:260`) that forwards
`opts.model`, which nothing ever populates. The findings stand; only the exact offsets drifted.

## Done when

- **No tier-1 criterion can be written for this card as it stands, and that is the finding, not an
  omission.** Its own 2026-08-15 prep pass established that the four axes no longer share a mechanism, so
  there is no single build here to make a command go from red to green — two axes shipped elsewhere, one is
  partly done, one is unbuilt, and the console half of all four is gated behind an undecided self-gating
  question. Writing an executable criterion would mean inventing a scope the assessment above explicitly
  ruled against. The tier-1 proofs belong on the A/B/C slices, where each is a real single build. Until the
  split lands, this card's completion is a **structural** state, checkable by reading two items:

1. **Observable — the split has produced real items.** Backlog items exist for #3119's slices A (read-only
   console policy-inspector), B (model choice as real config) and C (externalize the remaining drain
   thresholds) — or #3119 records a documented reason fewer than three are needed. One `check:readiness`
   listing or one grep of `backlog/` for those slice titles answers this.
2. **Observable — this card no longer presents itself as buildable.** #2465 is either `resolved` as
   superseded-by-split (pointing at #3119 and the slice items) **or** its digest and scope are narrowed to
   exclude what A/B/C cover. A reader arriving at this card must not be able to mistake it for one story.
3. **Assertable — the excluded fork stayed excluded.** No slice filed off this split assumes an answer to
   "how does a console *write* to gating / review-escalation config reconcile with the declarative-leash
   self-gating invariant" (`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`).
   #3119 marks that explicitly not-a-slice; check each new item's scope against that line before it is
   marked build-ready.
4. **Assertable — the two already-shipped axes are not rebuilt.** No slice re-implements gating config
   (`we:scripts/lib/gate-config.mjs`, #2448) or the review-escalation contract
   (`we:scripts/lib/review-policy.contract.json`, #2566/#2563/#2564). Read each slice's scope; a slice that
   writes to either file has re-opened the excluded fork above.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — The entire prep pass is a premise-verification exercise: it checks the 'deferred behind the phase-1 evidence gate' framing against we:backlog/2456 (confirmed status: open, 'few weeks' bar unmet) and we:backlog/2444 (confirmed status: resolved, independently un-deferred via #2530, plateau-app PR #61 verified in git log), and checks 'four axes are equally unbuilt convention' against live code, finding gating (we:scripts/lib/gate-config.mjs) and review-escalation (we:scripts/lib/review-policy.contract.json) already shipped as versioned config. All path:line citations for both shipped axes and the two still-convention axes (plateau:tools/drain-daemon/lib.mjs, plateau:src/build-runner/runner.ts, plateau:src/build-runner/build-action.ts) were re-verified against the live plateau-app checkout (commit 4655dee, 2026-08-18) and match, including the card's own acknowledged line-number drift between the 2026-08-15 and 2026-08-21 passes.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The model-choice claim ('nothing ever sets RunnerTask.model / BuildFlowOpts.model') was re-checked with a repo-wide grep across plateau-app (not just plateau:src/) for runBuildFlow/BuildFlowOpts/kind:'build' call sites and for any subprocess/CLI/cron caller, zero hits beyond the module itself and its test, confirming the claim via both the ES-import path and the subprocess/hook path the taxonomy's consumer strategy calls for, even though the card's own stated methodology only names the ES-import grep.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's own '## Done when' is written as a structural (not mechanical) checklist specifically so a reader can't mistake this for a normal buildable story, and criterion 2 explicitly requires the card to stop presenting itself as one story once the split lands, directly targeting the failure mode where a scope-drifted card sits silently pickable.

**Corrections applied by this review:**

- The 'plateau:tools/dev-panel/drain-daemon.html:542-543' citation for the read-only escalation-outcome display points to a comment block about run-id localStorage caching, not the escalation-reason rendering, which actually lives around line 648-649 (`reasons = ... read.escalationReason`) — the underlying claim (a read-only escalation display already exists in the console) still holds, only the specific line pair is off by roughly a hundred lines.

The prep assessment's every path:line and backlog-status claim was re-verified against the live web-everything and plateau-app repos and holds (bar one minor line-citation drift on a claim whose substance still stands); it correctly concludes #2465 is not build-ready as one story, hands off cleanly to the already-filed #3119 split without re-deciding the excluded self-gating fork, and its structural Done-when criteria are consistent with the story-preparation checklist it cites.

_Recorded through the declared `review-prep` operation._
