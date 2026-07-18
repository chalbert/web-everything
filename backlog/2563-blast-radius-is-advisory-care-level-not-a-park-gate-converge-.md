---
bornAs: cvg2563r
kind: decision
size: 8
status: active
dateOpened: "2026-07-18"
dateStarted: "2026-07-18"
preparedDate: "2026-07-18"
relatedReport: reports/2026-07-18-blast-radius-advisory-review-gating.md
tags: [drain, review, convergence, escalation, console, config]
---

# Blast-radius is advisory care-level, not a park-gate — converge-by-default, human only on non-convergence, console re-round

## Grounding digest

The drain's review rubric conflates **"this needs a review"** with **"this needs a human."** Every
deterministic signal in `scoreEscalation` — blast-radius, size, dismissed-findings, cross-repo, sampling,
plus gate-self/statute — sets one flag, `escalate` (`we:scripts/lib/review-escalation.mjs:221`), which stamps
a **blocking** `review:pending`/`review:human` label and parks the PR. But the disposition engine already
classes the *scored* signals as agent-clearable: `deriveReviewDisposition` returns `{mode: converge,
autoLand: true}` for blast-radius (`we:scripts/lib/review-core.mjs:456-457`). So a blast-radius PR is, by the
model's own logic, meant to be fixed-and-landed by the convergence loop with **no human** — yet in practice it
bounces to the operator, because (1) the blocking `review:pending` label refuses the land until a verdict
clears it (`we:scripts/merge-ai-prs.mjs:1479-1485` — "an escalated PR PARKS ALIVE … SKIPPED … until a
reviewer applies review:accepted"), and (2) the convergence loop that would clear it is a
`/drain` **skill ceremony**, and the always-on daemon that actually sweeps the queue is de-scoped to *"no
agent spawning"* (`plateau-app:tools/drain-daemon/daemon.mjs:9`). The loop never runs; the park strands; the
human is reached by neglect, not by design.

The reframe (operator, 2026-07-18): **blast-radius is not a gate — it is care-level information** that tells
the reviewer (agent or human) how hard to look. A high care-level still gets a review; it just doesn't route
to a human. **A human is reached only when the convergence loop fails to land.** The operator console gains a
**send-back-for-another-round** action with an optional steering guideline. Much of this should be
**configurable through a plateau-app-driven settings panel built on the same shared review core** — so the
standard question becomes *what is fixed vs what is a knob.*

Prior-art (report `we:reports/2026-07-18-blast-radius-advisory-review-gating.md`): the gate-vs-advisory split
tracks *what the signal measures* — **ownership/path-sensitivity is a hard gate** (CODEOWNERS, SonarQube),
**a computed risk score is advisory** (risk-based IaC review, GCP Change Risk, risk-based testing all
*flag/prioritize*, never hard-stop). Auto-fix triggers sit in a **separate event-triggered bot, not the queue
daemon** (CodeRabbit, GitHub merge queue, Graphite). Independence survives as long as fixer ≠ final approver.
Two hazards the red-team sharpened: **(i)** advisory demotion for scored signals means high-blast changes can
**auto-land with no human ever looking** — but in every "flag-don't-gate" prior-art system the high-risk
bucket still terminates at a *human desk* with more scrutiny, not at *more agents*; so the care-level needs a
**deterministic human spot-check**, not just more agent rounds. **(ii)** a separate convergence runner that
writes `main` directly races the daemon's whole-process merge lease — so the runner must **converge + label
only, never land.**

## The axis

The decision splits into **fixed invariants** (ratifiable core, never a knob), **config dimensions** (the
plateau settings panel, most-permissive default), and **two genuine forks**. The engine is unchanged and
single-sourced: `scoreEscalation` / `deriveReviewDisposition` / the convergence bar in
`we:scripts/lib/review-core.mjs` stay the one core — grounded at `scoreEscalation`
(`we:scripts/lib/review-escalation.mjs:182-222`), `producerReviewLabel` (`:236-240`), `decideReviewGate`
(`:359-380`), and `deriveReviewDisposition` (`we:scripts/lib/review-core.mjs:448-458`). It composes with — and
does not alter — the convergence bar or the non-author invariant codified at
[`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation).

## Recommended path at a glance

| # | Fork | Options | Default |
|---|------|---------|---------|
| 1 | Clear-step for `gate-self`/`statute` — may a *converged* fix substitute for the human? | (a) auto-clear on convergence · (b) human always clears | **(b) human always clears** — invariant-forced |
| 2 | Human backstop on high-blast *advisory* auto-lands | (a) deterministic sampled `review:human` spot-check · (b) rely on the agent validator alone | **(a) keep a non-zero human sample** |

*Not forks:* per-signal advisory→gate override, thresholds, human-sample rate, convergence enable/scope are
**config dimensions** (below); the console re-round action and the settings panel are **support-both builds**;
the runner-converges-daemon-lands split and the separate-runner placement are **settled** (below).

## Fixed invariants (ratifiable core — never a config knob)

- **The score→advisory *principle* is the ratified default, not a free knob.** A computed risk score
  (blast-radius / size / dismissed-findings / cross-repo / sampling) **annotates a care-level**; it does not
  block the land on a review verdict. This is the headline rule being codified — a repo may *tighten* it (see
  config), but "advisory" is the platform default, not merely one value of a preference.
- **The trust-chain / statute hard gate stays hard.** `gate-self` (`isGateSelfPath`) and `statute`
  (`isStatutePath`) keep setting `humanRequired` (`we:scripts/lib/review-escalation.mjs:206-210`) — the one
  place ownership-based hard gating is correct. No config demotes these.
- **A deterministic human spot-check on high-blast auto-lands.** Because an advisory high-blast change can
  otherwise converge and auto-land with **zero** human eyes, a **non-zero** sampled fraction of high-blast
  (`isBlastRadiusPath`) auto-lands routes to `review:human` (the rate is a knob; that it is `> 0` is fixed).
  This is the human backstop the "flag-don't-gate" prior art keeps — see Fork 2.
- **The conflict-of-interest invariant is absolute.** A landed PR is accepted by an actor that did not author
  the fix (`#agent-convergence-independent-validation`, #2439). No knob relaxes it.
- **Non-convergence hard-escalates to a human.** Round-cap / mandate-conflict → `review:human`, unchanged
  (`DEADLOCK_REASONS`, `we:scripts/lib/review-core.mjs:455`).
- **One shared core.** The settings panel, the drain, the scheduled runner, and `/review` all read the *same*
  rubric + disposition functions; no divergent second implementation.

## Settled (not forks — forced by an existing decision)

- **The convergence runner converges + labels only; the resident daemon lands.** The daemon holds the
  whole-process drain lease (#2391) for its entire residency (`plateau-app:tools/drain-daemon/daemon.mjs:5-6`).
  A runner that wrote `main` directly would deadlock on that lease or split land-authority across two
  processes (double-processing the same PR). So the scheduled runner applies `review:accepted` /
  `ready-to-merge` only; the daemon remains the sole `main`-writer on its normal `--label=ready-to-merge`
  pass. Keeps the non-author invariant crisp (agent converges, deterministic process lands).
- **The trigger is a separate scheduled agent-runner, not the daemon.** The daemon was purpose-built to *not*
  spawn agents (`plateau-app:tools/drain-daemon/daemon.mjs:9`, 2026-07-11 de-scope); the industry norm is a
  separate event-triggered auto-fix bot. So a cron/routine/`/loop`-driven session runs the **un-deferred**
  convergence workflow (`we:scripts/workflows/review-parked-prs.mjs`, finishing #2437/#2410). Placement is
  forced, not a live fork.

## Config dimensions (the plateau-driven settings panel — not ratifiable forks)

Per Q4 (both branches are legitimate end-states → `#config-extends-platform-default`), these are **knobs, not
forks** — staged autonomy (*start advisory, enforce later, graduate per-repo*) is why. Default = the
**most-permissive platform flavor**; a conservative repo tightens.

- **Per-signal advisory→gate override.** A repo may tighten a *scored* signal from advisory to a gate — where
  **`gate` means *route to a human reviewer*, never *hard-block the land with no reviewer*** (a hard-block
  recreates the exact strand this item removes). Platform default: **advisory**.
- **Thresholds.** `diffLines` (400), `sampleNth` (10) already live in `DEFAULT_THRESHOLDS`
  (`we:scripts/lib/review-escalation.mjs:43-46`); the panel exposes them.
- **The high-blast human-sample rate.** The fraction of high-blast auto-lands routed to `review:human` (fixed
  invariant: `> 0`; the value is the knob).
- **Convergence enable / scope / round-cap.** Governed by the **staged-autonomy clause of
  [`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)**
  (`we:docs/agent/platform-decisions.md:2775-2776` — off-by-default, small/non-security first, graduating
  per-repo). Cited to that anchor, **not** re-declared here, so the two rules never drift.

**Placement (fixed by the constellation model — not a fork):** the config **schema + validated defaults live
in Web Everything** (extend `DEFAULT_THRESHOLDS` into a review-config shape in the shared core); the
**settings panel is a plateau-app product surface** rendering them over the same core. WE holds zero UI. Build,
not a decision.

## Fork 1 — Which trust-chain changes force a human: the *spec*, not the whole path

*Fork-existence: the human-clear rule is forced (auto-clearing a trust-chain **spec** change lets an agent
ratify a change to its own review leash — the non-author invariant forbids it), but **what counts as a
trust-chain change** is a genuine call: the status quo over-escalates.* Today `gate-self` is a pure **path
test** (`isGateSelfPath`) — *any* edit to `we:scripts/lib/review-escalation.mjs` forces a human, whether it
rewrites the escalation rubric or fixes a comment. That over-escalates on the trust-chain side exactly as
blast-radius over-escalates on the scored side — the human is fatigued on typos and waves through the edit
that matters.

Narrow it via the **spec-vs-implementation** line (spec-based programming — see the broader direction filed
this session, `x0n1nax`, and report
`we:reports/2026-07-18-spec-based-programming-spec-formats.md`): **the spec always needs a human; the
implementation under a fixed spec is agent-clearable when an independent review agrees the spec is preserved.**

- **(a) Status quo — any trust-chain *path* touch forces a human.** Simple, but over-escalates every
  cosmetic/impl edit; fatigues the human on the changes that don't matter (the anti-pattern this whole item
  fights, now on the trust-chain side).
- **(b) A human gates a change to the trust-chain *spec*; impl changes are agent-clearable on
  conformance-green + independent review.** **Chosen.** The human-clear invariant is preserved for the thing
  that matters (the spec); behaviour-preserving impl tweaks stop stranding on a human. Convergence-success
  still ≠ clearance for a *spec* change (that stays `autoLand: false` → human).

**Settled sub-fork — the spec is a SCHEMA, not prose (ratified 2026-07-18).** For the gate to be
*deterministic*, the trust-chain spec must be a typed/executable **contract** (a schema for the thresholds +
reason sets + disposition, plus a conformance suite), so *"did the spec change?"* = a mechanical diff of the
contract file → **human**, and *"did the impl preserve the spec?"* = **run the conformance suite** →
agent-clearable. NOT prose (Kiro/Spec-Kit style), which forces the reviewer to interpret and kills
determinism (no tool auto-detects prose-spec drift). **Size is the wrong metric**: a 1-char threshold flip
(`400`→`40`) is an impl-sized diff but a *spec* change → human; a 200-line behaviour-preserving refactor is a
big diff but pure impl → agent-clearable.

**Prerequisite (a build):** extract the escalation policy into an explicit contract artifact (the
`DEFAULT_THRESHOLDS` + reason sets + `deriveReviewDisposition` branches are already nearly one) + a conformance
suite. Until the spec is explicit, **fail safe to human** (the status-quo path test). This is the first
concrete instance of `x0n1nax` (spec-based programming across the constellation).

```js
// deriveReviewDisposition — the carve-out (we:scripts/lib/review-core.mjs:455-457). Fork 1 (b) narrows WHICH
// gate-self diffs hit line 456: a SPEC change (contract-file diff) → human; a conformance-green IMPL change → 457.
if (list.some((r) => DEADLOCK_REASONS.includes(r)))          return { mode: HUMAN,    autoLand: false }; // non-convergence → human
if (list.some((r) => HUMAN_SENSITIVITY_REASONS.includes(r))) return { mode: CONVERGE, autoLand: false }; // trust-chain SPEC change → human CLEARS ← Fork 1 (b)
return { mode: CONVERGE, autoLand: true };                                                               // scored signals + spec-preserving impl → converge + auto-land
```

*Skeptic:* SURVIVES-WITH-AMENDMENT (amendment adopted, 2026-07-18) — original attack ("independence of the
validator could let gate-self auto-clear") still refuted: independence of the *reviewer* is not authority to
*amend the leash*. New attack the refinement invites: *"narrowing to spec-changes lets a real policy change
slip through disguised as impl if the conformance suite is incomplete."* Answer: any diff touching the
**contract file itself** is always human (never conformance-gated), and the suite's completeness is itself
part of the spec (gate-self); ambiguous / can't-prove-impl-only → human. The invariant holds; the gate just
stops firing on cosmetic trust-chain edits.
*Screen:* clear — a standard-level governance contract (which trust-chain changes need a human), not an impl
detail; a stark merit gap survives "both free to build" (over-escalate-everything vs gate-the-spec). The
schema-vs-prose sub-fork is a config/mechanism call, resolved to schema for determinism.

## Fork 2 — Human backstop on high-blast *advisory* auto-lands

*Fork-existence: two coherent branches that genuinely cannot coexist — either a deterministic human sees a
sampled fraction of high-blast agent-only lands, or none is guaranteed to. Both are buildable; they differ on
the safety/throughput merit, not on sequencing.* This is the genuinely-open call the red-team surfaced.
Demoting blast-radius to advisory means a change matching `isBlastRadiusPath` (but not
`isGateSelfPath`/`isStatutePath`) converges → an agent validator accepts → CI green → **auto-lands with no
human in the loop at all** (`scoreEscalation` `:198-199` → `deriveReviewDisposition` auto-land `:457`). Every
"flag-don't-gate" prior-art system still terminates its high-risk bucket at a human desk (more scrutiny), not
at more agents — so the pure-agent path bets the entire wide-impact surface on the validator having no
systematic blind spot (same model family, diff-borne prompt injection, an un-probed bug class).

- **(a) Deterministic sampled `review:human` spot-check.** A **non-zero** fraction of high-blast auto-lands
  (rate = a config knob) routes to `review:human` instead of `review:pending`, so a small, fixed share of
  wide-impact agent-only lands always gets human eyes. Preserves the thesis ("don't route *every* blast-radius
  PR to a human") while restoring the one human touchpoint the cited prior art keeps. **Chosen.**
- **(b) Rely on the agent validator alone.** No human ever guaranteed on the high-blast path; maximum
  throughput, zero deterministic backstop. Rejected — it over-claims the prior-art support (which always keeps
  a human desk) and has no recovery if the validator has a systematic blind spot.

```js
// scoreEscalation — a sampled high-blast auto-land is escalated to a HUMAN, not just review:pending.
// The rate is a config knob; that the sample is > 0 is a fixed invariant (the human backstop).
if (signals.blastRadius && sampledForHumanSpotCheck(prNum, cfg.highBlastHumanSampleRate)) {
  humanRequired = true;                        // routes to review:human, not the agent-clearable review:pending
  reasons.push('high-blast human spot-check (deterministic sample)');
}
```

*Skeptic:* SURVIVES-WITH-AMENDMENT (amendment adopted) — the red-team showed the original "care-level → extra
rounds" mitigation solved the wrong risk (for scored signals there is *no human to fatigue*; extra rounds just
add agent passes). The real hole — high-blast auto-lands with zero human eyes — is closed by this fork's `(a)`
default; the deterministic human sample is the fix.
*Screen:* clear — a standard-level human-review-coverage policy (like the segregation-of-duties call), not
orchestration; a real safety-vs-throughput merit difference survives "both free to build." *(Replaces the
earlier trigger-placement framing, which the fresh-context screen flagged as an impl/build detail — now moved
to "Settled" above.)*

## Supported by default (builds, not forks)

- **Console re-round action** (plateau-app, on the same core): a **send-back-for-another-round** button on a
  parked PR, with an optional free-text guideline that seeds the next `buildEditorMandate()` round; the
  guideline persists in the round history. No excluded branch — a build under #2494's loop console.
- **The settings panel** (plateau-app product surface over the WE review-config schema) — see *Placement*
  above.

## Codified-in reconciliation

Sets `codifiedIn` to a **new sibling anchor** — `#blast-radius-advisory-care-not-a-gate` — that **composes
with**
[`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)
(#2398/#2410): that anchor governs *how* a fix converges (the convergence bar + non-author invariant, both
unchanged); this one governs *which signals route into that loop advisorily vs hard-gate a human*, and the
high-blast human spot-check. No collision (verified: they test different turf). One anti-drift rule: the
**staged-autonomy / off-by-default clause is the sibling anchor's** (`we:docs/agent/platform-decisions.md:2775-2776`) —
this decision **cites** it, never re-declares it. Cite the two together at resolve.

## Related

Successor design over epic #2285 (negotiated agent review) and its open successor #2410 (unified convergence
loop); consumes #2437 (parked-PR workflow, to be un-deferred) and #2494 (loop console). Renders through the
shared review core (`we:scripts/lib/review-core.mjs`, #2325). Gate-self: this edits the review trust chain, so
any implementing diff is `review:human` and a human clears it.
