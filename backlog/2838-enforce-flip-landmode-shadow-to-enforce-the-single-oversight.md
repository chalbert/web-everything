---
bornAs: x2w4qbf
kind: decision
size: 3
status: resolved
dateOpened: "2026-08-02"
dateResolved: "2026-08-02"
preparedDate: "2026-08-02"
codifiedIn: "docs/agent/platform-decisions.md#enforce-flip-triple-gated"
tags: [governance, enforce-flip, land-mode, shadow-mode, review-pending, auto-land, oversight]
---

# Enforce-flip — `landMode: shadow → enforce`, the single oversight-reducing switch

**Principle statement.** The scheduled review runner clears `review:pending` **mechanically** — writing
`review:accepted` so the drain merges — **only once** the global land mode flips from `shadow`
(observe-only) to `enforce`. That flip is the ONE switch that reduces human oversight, so it is gated: it
may arm only when the machinery that makes it safe has landed AND a clean shadow-mode track record proves
the auto-clear agrees with the human. Until then the seam runs in shadow: it computes the would-clear
decision and logs it, but a human still clears every `review:pending` PR.

This is a principle, so it lands in a decisions-only PR parked `review:human` alongside `#2840` and
`#2839`; the code that reads the flip predicate is a follow-on impl PR under the two-PR rule
(`#2839`). The `#human-required-is-judgment-only` anchor it composes lands via `2851` (PR #982), so
that is a **hard land-order precondition** — #982 must land first or the lineage cite 404s. It is stated in
prose, not `blockedBy` frontmatter, because `2851`'s file is not yet in this tree and
`we:scripts/check-backlog-item.mjs` would reject an unresolved target.

**Coupling to `#2840` (load-bearing).** This decision's headline safeguard — "the flip edit is itself
`review:human`" — holds **only** because `landMode` lives in `we:scripts/lib/review-policy.contract.json`,
whose basename is in the policy-core / declarative-leash set, so editing it is path-gated to a human.
`#2840` narrows that gate. The two decisions are safe together **only** because `#2840`'s corrected
design **pins** the declarative-leash files (contract, roster, suites) to the human gate as whole files,
permanently — it does *not* narrow them to marker-grain. Ratifying these together therefore keeps the flip
edit human-gated. If `#2840` were adopted in a form that let the contract leave the path gate, this
safeguard would evaporate and the single most oversight-reducing edit in the system would become
agent-clearable — so this decision explicitly **depends on `#2840`'s leash pin** (see its item 3 /
`isDeclarativeLeashPath`).

## Current state

The auto-land seam already exists and already defaults to shadow (ratified, operator 2026-07-26). The
global `careJury.disposition.landMode` knob (`shadow | enforce`) is read via `resolveDispositionConfig`
(`we:scripts/lib/auto-land-seam.mjs#applyAutoLand`), and anything not exactly `enforce` normalizes to
shadow. In shadow the seam runs the `#2674` decider to a label INTENT and OBSERVES; it never writes
`review:accepted`. So today every `review:pending` PR waits for a human to clear it — correct, but it is
standing human work on a loop the seam is built to mechanize.

A separate, related flip already has its readiness metric built: `computeAgreementMetric` /
`resolveLandMode` (`we:scripts/lib/decision-routing.mjs#resolveLandMode`) with `ENFORCE_FLIP_TRIGGER`
(N = 20 consecutive shadow-vs-human matches, M = 20 trailing window, 0 divergences). That is the model this
decision reuses for the REVIEW seam's flip — but the *metric* is proven, not the *plumbing it needs here*.
Two gaps must be closed by the impl, and this decision names them as preconditions rather than pretending
they exist:

- **No durable review-seam ledger.** `recordShadowOutcome` / `ShadowOutcomeRecord` in
  `we:scripts/lib/decision-routing.mjs` are the **decision-routing** ledger — a different seam. The review
  auto-land seam `we:scripts/lib/auto-land-seam.mjs#applyAutoLand` only **emits an observation line to
  stderr**; it persists nothing. So there is no `reviewShadowLedger` for `computeAgreementMetric` to read.
  A persistence layer — auto-clear-vs-human outcomes written as `ShadowOutcomeRecord[]` to a durable store —
  is a prerequisite of condition (c), not a given.
- **(a)/(b) are remote CI state, not a working-tree read.** "Conformance test GREEN on `main`" is a
  build-status fact, not something a pure function or a `check:standards` run over the local tree can
  derive. The predicate reads them as an **impure CI-status probe**, or the write gate degrades to a
  file-exists check that passes vacuously — which is explicitly rejected below.

## The change

Define the review-seam enforce-flip behind a deterministic predicate. `landMode: enforce` may arm **only
when ALL** of:

- **(a) `#2820` merge-predicate landed (PR #975)** — review-hold labels block merge regardless of
  `ready-to-merge`. Without it, an auto-written `review:accepted` could be merged even while a hold label
  should have stopped it; the flip is unsafe until the hold actually holds.
- **(b) `#2823` prevention field landed (PR #976)** — every review that surfaces findings emits the
  mandatory prevention-introspection block. Without it, a mechanically-cleared review can pass without ever
  generalizing its finding to the class — the flip would mechanize an under-powered review.
- **(c) a defined clean shadow-mode track record** — N observations the operator agreed with, 0
  divergences, over the trailing M-window (the `computeAgreementMetric` bar). Proof the auto-clear decides
  what the human would.

## Mechanical enforcement design (the concrete gate)

The flip is NOT a free-text toggle a session can set. It is gated by a readiness predicate + a write gate.
The predicate is **not a pure function** — it reads remote CI state and a persisted ledger — so it is
specified honestly as a **precondition-checked gate**, and its two data dependencies (below) are named
preconditions of the impl PR:

- **`enforceFlipReady({ ciStatus, reviewShadowLedger })`** — home: `we:scripts/lib/decision-routing.mjs`,
  beside the existing `resolveLandMode`. It is pure over its **injected inputs** (the CI-status object and
  the ledger array), but those inputs are gathered impurely by the caller. Returns `{ ready, reasons }`,
  `ready` iff **all three** hold:
  - **(a)** the injected `ciStatus` shows the `#2820` merge-hold conformance test GREEN on `main` (the merge
    gate refuses `ready-to-merge` when a `review:*` hold label is present). The caller fetches this via a
    **CI-status probe** — an impure read, NOT a working-tree or file-exists check (a file-exists check would
    pass vacuously once the test file exists, so a regression that reddens the test would not re-refuse the
    flip — the failure the reviewer flagged, explicitly avoided).
  - **(b)** the injected `ciStatus` shows the `#2823` prevention-field conformance test GREEN on `main` (the
    shared review core emits the required prevention block per finding-class) — likewise a live CI-status
    probe.
  - **(c)** `computeAgreementMetric(reviewShadowLedger).flipReady === true` — where `reviewShadowLedger` is a
    **durable** `ShadowOutcomeRecord[]` of review auto-clear-vs-human outcomes. This ledger **does not exist
    yet** (the review seam only logs to stderr — see Current state) and is a precondition: the impl must add
    the persistence layer that writes each shadow-mode review outcome as a `ShadowOutcomeRecord` the same
    shape `we:scripts/lib/decision-routing.mjs#computeAgreementMetric` consumes. Without it, (c) has no
    records and the gate never opens — fail-safe, but it means the ledger build is real impl scope, not a
    reuse.
- **The flip itself is a policy-spec change → `review:human`.** Setting `landMode: enforce` in the `#2651`
  disposition config is an edit to the declarative leash (`we:scripts/lib/review-policy.contract.json`), so
  it is human-gated by `we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`. This
  survives `#2840` **only** because `#2840` pins the leash files to the human gate as whole files (its
  `isDeclarativeLeashPath` floor) — see the Coupling note above. The operator makes the flip; the machine
  only proves it is *allowed*.
- **Write gate.** A `check:standards` rule (`we:scripts/check-standards-rules.mjs`) **refuses**
  `landMode: enforce` in the disposition config unless `enforceFlipReady().ready` is true, and stamps the
  three reasons. So the switch cannot be flipped early even by a human edit: the preconditions are a
  machine-checked precondition of the config value, not a checklist a session eyeballs.
- **Auto-clear consumes the resolved mode unchanged.** `applyAutoLand`
  (`we:scripts/lib/auto-land-seam.mjs#applyAutoLand`) already writes `review:accepted` only in `enforce`;
  the safety rails (never auto-land a keep-parked / red-refuted / gate-self intent; fail-closed on any
  write error) hold in both modes and are untouched. This decision adds only the *gate on the flip*, not
  new auto-land behaviour.

## RISK

**Flipping to enforce reduces human oversight** — that is the whole point, and the whole danger. Once
armed, `review:pending` PRs clear without a person, so any weakness in the auto-clear decision now lands
code instead of merely logging a disagreement. A too-loose readiness bar (small N, a lenient match
definition) flips before the track record actually earns trust.

## SAFEGUARD

The flip is **triple-gated and defaults closed.** (a) and (b) require the *safety machinery* to have
landed and stay green (a regression in either reddens the conformance test → `enforceFlipReady` returns
false → the write gate re-refuses `enforce`). (c) requires a *measured* agreement record — matches the
operator agreed with, 0 divergences — reusing the proven `computeAgreementMetric` bar; a single divergence
resets it. Anything not exactly `enforce` normalizes to shadow (`we:scripts/lib/auto-land-seam.mjs`), so an
unset / unknown / corrupted mode fails safe to observe-only. And the flip edit is itself `review:human`, so
a person makes the call the machine merely *permits*. The safe direction — staying in shadow — is the
default at every layer.

## Ruling — ratified 2026-08-02 (A)

**Option A adopted, ratified by the operator (Nicolas Gilbert) on 2026-08-02.** The review-seam enforce-flip
(`landMode: shadow → enforce`) is triple-gated and defaults closed: `enforce` arms only when (a) #2820's
merge-hold conformance test is GREEN on `main` (live CI-status probe), (b) #2823's prevention-field
conformance test is GREEN on `main` (likewise probed), and (c) the durable review-seam ledger shows a clean
shadow-mode track record (the `computeAgreementMetric` bar) — and the flip edit itself stays `review:human`
via #2840's leash pin. Codified in `we:docs/agent/platform-decisions.md#enforce-flip-triple-gated`. The
predicate + CI probe + ledger + write gate are the follow-on `xva71x1` (`blockedBy: xe5vt9s`). The Options
table and Recommendation below are retained as the deliberation record; this ruling is the operative call.

## Options

| Option | Shape | Verdict |
|--------|-------|---------|
| **A — triple-gated flip predicate (CI-status + durable ledger) + write gate (recommended)** | `enforce` armed only when (a)+(b) show GREEN via a CI-status probe AND (c) the durable review-seam ledger meets the agreement metric; the flip edit stays `review:human` (leash pin, per `#2840`) | oversight reduced only after the machinery + track record earn it |
| B — operator flips by hand, no predicate | trust the operator to check the three conditions before editing the config | REJECT — the directive is "enforced by mechanical gating"; an unchecked hand-flip is the unenforced instruction |
| C — auto-flip on the metric alone | flip when `computeAgreementMetric.flipReady`, ignore (a)/(b) | REJECT — flips before the merge-hold and prevention machinery exist; mechanizes an under-powered, unsafely-mergeable review |

## Recommendation

**Adopt A.** This is the single switch that turns the whole shadow-mode investment into actual reduced
oversight, and it should flip exactly when — and only when — it is safe. Gating it on (a) the merge-hold,
(b) the prevention field, and (c) a measured clean track record makes "is it safe to stop having a human
clear these?" a machine-checked precondition, not a judgment call each time. The flip edit remains the
operator's `review:human` act; the gate only certifies it is permitted. The `enforceFlipReady` predicate,
the CI-status probe, the durable review-seam ledger, and the write gate are a follow-on impl PR under
`#2839` — this PR authors only the principle and its gate conditions.

## Preconditions (impl PR, under `#2839`)

1. **`2851` (PR #982) landed** — the `#human-required-is-judgment-only` anchor this composes exists on
   `main` (prose land-order precondition; not frontmatter `blockedBy` — the file is not yet in this tree).
2. **`#2840` leash pin ratified** — keeps `we:scripts/lib/review-policy.contract.json` human-gated, or
   the flip's own safeguard evaporates.
3. **`#2820` (PR #975) and `#2823` (PR #976) landed** — the merge-hold predicate and the prevention field,
   read via a live CI-status probe by conditions (a)/(b).
4. **A durable review-seam ledger built** — the auto-land seam persists each shadow review outcome as a
   `ShadowOutcomeRecord`; today it only logs to stderr, so condition (c) has nothing to read until this
   exists.

**Lineage:** composes `we:docs/agent/platform-decisions.md#human-required-is-judgment-only` (mechanical
convergent review need not stay human once the flip is safe) and reuses the shadow→enforce readiness
*metric* `we:scripts/lib/decision-routing.mjs#resolveLandMode` /
`we:scripts/lib/decision-routing.mjs#computeAgreementMetric` (`ENFORCE_FLIP_TRIGGER`) and the auto-land
seam `we:scripts/lib/auto-land-seam.mjs#applyAutoLand` (the #2675 shadow default) — but adds the missing
review-seam persistence layer and CI-status probe the metric needs at this seam.
