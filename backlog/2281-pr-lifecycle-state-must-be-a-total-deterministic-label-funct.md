---
kind: decision
size: 3
status: resolved
dateOpened: "2026-07-05"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#ci-lifecycle-total-label-function"
preparedDate: "2026-07-09"
tags: [pr-lifecycle, labels, drain, determinism]
---

# PR lifecycle state must be a total, deterministic label function (no implicit unlabelled states)

> **Prep note (2026-07-09, `/prepare all`).** No `/research/` topic — this ratifies a taxonomy over shipped
> drain/label tooling. The **principle** (status always reflected by a deterministically-applied label, never
> inferred from absence) is a **user directive (2026-07-04)** — settled statute. A hostile skeptic pass
> **flipped the recommended default** (see Skeptic): the earlier draft defaulted to (a) terminal-only, leaving
> "checks-in-flight" bare — a *self-admitted* inference-from-absence that a same-session author has no standing
> to relax on the user's behalf. Prep now defaults to the **statute-honoring reading (b) total coverage**,
> implemented via the *existing* CI-truth reconcile pass (which neutralizes (b)'s churn cost **and** fixes a
> latent stranding bug in (a)), and routes the *relaxation* to (a) as the directive-author's explicit opt-in.
> A statute collision the earlier draft missed (#2183 F1 / #2138 F4 depend on `ready-to-merge` **absence**) is
> reconciled below by scoping this decision to the **ci-lifecycle dimension**.

## Grounding digest

- **The absence-signal the directive forbids is relied on in three places.** `--no-wait` open leaves a PR
  **unlabelled** (`we:scripts/pr-land.mjs:577-579`); a red required check leaves it **unlabelled**
  (`we:scripts/pr-land.mjs:603`, exit 2); the drain's candidate set is bounded by `--label ready-to-merge`, so
  an **unlabelled PR is never a candidate** (`we:scripts/merge-ai-prs.mjs:575-577,711`).
- **Blocked-ness has no label at all** — it lives only in the transient manifest. The drain re-derives it from
  `readPrManifest → v.blockedBy` (`we:scripts/merge-ai-prs.mjs:756-758`) and defers in `planLabelDrain`
  (`we:scripts/merge-ai-prs.mjs:300-315`). The manifest (`we:.lane-manifest.json`) is **not committed to main**
  — read via `git show` from the lane tip (`we:scripts/merge-ai-prs.mjs:694`), `git rm`'d post-land
  (`we:scripts/lane-drain.mjs:528`). So `blockedBy` never persists where a human/tool can read it — the
  highest-payoff label to add.
- **(a) terminal-only does *not* deliver the total function it is sold on.** Its claim is
  `bare ⟺ checks-in-flight`. But a check that goes red (or times out) *after* `pr-land` exits leaves a **bare,
  terminal** PR — `pr-land` exits at red (`we:scripts/pr-land.mjs:603`) / timeout, and the #2216 reconcile pass
  only re-derives the *green→ready-to-merge* case (`we:scripts/merge-ai-prs.mjs:702-718`), never `ci:failed`.
  So under (a) bare means "in-flight **OR** stranded-terminal" — the exact ambiguity the directive forbids.
- **The fix for that ambiguity also collapses (b)'s cost objection.** The cure is to make the *existing*
  reconcile pass (`reconcileGreenLabels`, run every drain pass + `--watch` interval,
  `we:scripts/merge-ai-prs.mjs:606,702-718`) derive **all** lifecycle labels from CI truth, not just green. Once
  it does, a "checking" label under (b) is set/cleared by that same sweep — not churned per check-tick by
  `pr-land` — so (b)'s "≈2× label ops / stranded-`checking`" cost (the whole case for (a)) largely evaporates.
  The reconcile pass (a) *needs anyway* is what makes (b) cheap.
- **Statute collision the earlier draft missed.** A strictly-literal "no PR status is *ever* bare" contradicts
  **already-ratified** anchors that depend on absence: #2183 F1 (`we:docs/agent/platform-decisions.md:2614` —
  "the ready-to-merge **signal is a PR label** … label-scoped lander"; unlabelled = not a candidate) and #2138
  F4 (`we:docs/agent/platform-decisions.md:2602` — "ready-to-merge is a **local queued token**"; absence =
  not-queued). Resolution: this decision governs the **ci-lifecycle dimension** (checks / blocked), a *different
  axis* from the `ready-to-merge` **landing-gate** dimension; the two compose, and #2183/#2138's
  absence-semantics on the landing-gate axis are **preserved**, not overridden.
- **`review:*` and lifecycle labels are already orthogonal** — a certified PR carries `ready-to-merge` **and**
  `review:pending` at once (`we:scripts/pr-land.mjs:625-630`; `decideReviewGate` at
  `we:scripts/merge-ai-prs.mjs:928-938`). New lifecycle labels are mutually exclusive among themselves, compose
  freely with `review:*`.
- **The transition-table test harness already exists** — `pollVerdict` (`we:scripts/pr-land.mjs:184`, tested in
  `we:scripts/__tests__/pr-land.test.mjs`), `classifyPr` (`we:scripts/__tests__/merge-ai-prs.test.mjs:53-124`),
  `decideReviewGate` (`we:scripts/lib/__tests__/review-escalation.test.mjs`). Adding lifecycle cases extends a
  mature harness, not greenfield.

## Axis-framing

The directive is settled; the open axis is **the label taxonomy that makes "read the ci-lifecycle state off a
label" a total, deterministic function** — its *granularity* (Fork 1) and its *names* (Fork 2). Running the
fork-existence test on Fork 1: it is a **real either/or** (two coherent, mutually-exclusive label sets — either
every lifecycle state carries a label or "checks-in-flight" stays bare), but — crucially — **the default is not
prep's to pick on merit-cost grounds**, because the branch that reads state from absence collides with the
user's own literal directive. So prep defaults to the statute-honoring branch (b) and routes the relaxation (a)
to the directive's author (only they can say whether the directive was meant to *reform* the day-old
absence-reliance of #2183/#2138 or *coexist* with a single bare cell). Fork 2 (names) is a genuine
naming/convention merit call, no code shape. The composition rule is support-both (already how the code
behaves). Fork 1 turns on a code-level shape (the reconcile-pass transition table), so it carries a code example.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | The relaxation / alternative |
| --- | --- | --- | --- |
| 1 | Label granularity — cover every lifecycle state, or leave "checks-in-flight" bare? | **(b) Total coverage — every ci-lifecycle state carries a deterministic label (`checking` / `ci:failed` / `blocked`), set by the *existing* CI-truth reconcile pass generalized to all labels (not per-tick churn).** Honors the directive's letter; the reconcile pass also fixes (a)'s bare-stranded-terminal bug, so (b)'s churn cost is largely moot. | **(a) Terminal-only** — leave "checks-in-flight" bare. A *relaxation of the literal directive* the **directive's author** may opt into (accept one unambiguous bare cell to avoid a `checking` label); if chosen, it must *also* truth-reconcile terminal labels, or it fails its own totality claim. |
| 2 | Names + namespacing | **`ci:failed` (deterministic red-check state; groups a `ci:*` state family) and bare `blocked` (matches the bare `ready-to-merge` lifecycle sibling).** | `needs-fix` (judgment-flavored) · `blocked:deps` (YAGNI — no second block source exists) |

**Supported by default (not a fork):** lifecycle labels are **mutually exclusive among themselves** and
**orthogonal to `review:*`** (a PR can be `blocked` + `review:pending`), and orthogonal to the `ready-to-merge`
**landing-gate** whose absence-semantics (#2183 F1 / #2138 F4) this decision **preserves**. Already how the code
composes `ready-to-merge` + `review:*` (`we:scripts/pr-land.mjs:625-630`) — codify it, don't re-decide it.

## Fork 1 — Label granularity (total coverage vs terminal-only)

**Fork exists because** the two label sets are coherent and genuinely cannot coexist — a `checking` state either
carries a label or it doesn't. But this is **settled toward (b) by the user's directive, not weighed by prep**:
the directive says state is "never inferred from the **absence** of a label," and (a) reads "checks-in-flight"
from absence. Prep has no standing to substitute the weaker predicate ("no *ambiguous* absence") for the user's
literal words and default to it. So the default honors the statute (b); (a) is the author's opt-in relaxation.

- **(b) Total coverage (default — statute-honoring).** Mint `checking` + `ci:failed` + `blocked`. Set them not
  by per-tick `pr-land` writes but by generalizing the existing reconcile pass
  (`we:scripts/merge-ai-prs.mjs:702-718`, already run every drain pass + `--watch` interval) to derive **every**
  lifecycle label from CI truth: green → `ready-to-merge`, red/failed → `ci:failed`, in-flight → `checking`,
  manifest-`blockedBy` open → `blocked`. Self-healing (a stranded label is corrected on the next sweep — the
  same mechanism that fixed #2216), so no unlabelled lifecycle state ever persists. Cost is one broader sweep,
  not a new per-transition write path.
- **(a) Terminal-only (the directive-author's relaxation).** Add only `ci:failed` + `blocked`, leave
  "checks-in-flight" bare. Lighter, but reads one state from absence — a relaxation *only the directive's author
  may authorize*. If chosen, it **must** still truth-reconcile `ci:failed`/`blocked` via the same pass, or it
  inherits the bare-stranded-terminal ambiguity (a red-after-`pr-land`-exit PR left bare,
  `we:scripts/pr-land.mjs:603`) and fails its own "bare ⟺ in-flight" claim.

Transition table under the default (keyed to the real reconcile pass — one CI-truth sweep sets every label):

```js
// (b) via the EXISTING reconcile pass generalized to all lifecycle labels — runs every drain pass + --watch
// interval (we:scripts/merge-ai-prs.mjs:702-718), so labels self-heal; no per-check-tick churn in pr-land.
// Minted idempotently in the SAME gh-label-create loop as review:* (we:scripts/merge-ai-prs.mjs:870-881).
function lifecycleLabelFromCiTruth(pr) {                 // total function over an open AI PR
  if (blockedByOpen(pr))            return 'blocked';     // manifest blockedBy still open (:756-758) → visible
  if (requiredCheckGreen(pr))       return 'ready-to-merge';        // green (:207-213) — unchanged
  if (requiredCheckRedOrFailed(pr)) return 'ci:failed';  // replaces the bare exit @ pr-land.mjs:603
  return 'checking';                                      // in flight — labelled under (b); bare under (a)
}
// Invariant (unit-tested, extending we:scripts/__tests__/pr-land.test.mjs + merge-ai-prs.test.mjs):
//   EXACTLY one of { checking, ci:failed, blocked, ready-to-merge } on every open AI PR (b);
//   any review:* composes freely; the ready-to-merge LANDING-GATE absence-semantics (#2183 F1/#2138 F4) are
//   unchanged — this governs the ci-lifecycle dimension only.
```

**Skeptic:** REFUTED → default flipped (hostile 4-axis attack). **(0) Classification (the crux):** the earlier
(a) default was a *self-admitted* literal breach of the user's directive, relaxed by prep silently swapping
"absence" for "ambiguous absence" — which prep has no standing to do. Default flipped to (b); (a) demoted to the
directive-author's explicit opt-in. **(1) Merit:** (a) doesn't even deliver its totality claim — a red/timeout
after `pr-land` exit strands a bare-terminal PR (`we:scripts/pr-land.mjs:603` +
`we:scripts/merge-ai-prs.mjs:702-718` covers only green); and the fix (generalize the reconcile pass) collapses
(b)'s churn-cost, so the case *for* (a) largely evaporates. **(2) Statute-overlap (folded):** a literal "nothing
bare" collides with #2183 F1 (`we:docs/agent/platform-decisions.md:2614`) + #2138 F4 (`:2602`), which depend on
`ready-to-merge` absence — reconciled by scoping this to the **ci-lifecycle dimension**, preserving the
landing-gate absence-semantics. **(3) Citation-scope:** the earlier draft cited #2216 one-sidedly as a *cost* of
(b); it is actually the *mechanism* that makes (b) cheap and that (a) needs too — corrected.

**Screen:** flagged(prio) → fixed. The fresh-context screen found the earlier (a) default rested *entirely* on
cost (with churn=0, (b) is the merit/letter winner), i.e. prioritization wearing a merit label. Fixed by
flipping to (b) and framing (a) explicitly as a cost-justified *relaxation the directive's author opts into*, not
the determinism-merit winner. (Impl axis clear — labels are the human+drain-visible contract; Fork 2 clear —
genuine naming/convention call.)

## Fork 2 — Names + namespacing

**Fork exists because** two coherent naming conventions cannot both be canonical, and the choice is durable
(labels are wire-format the drain matches on). No code shape (pure naming).

- **`ci:failed` + bare `blocked` (default).** `ci:failed` names the *deterministic* red-check state and groups a
  `ci:*` state family (`ci:failed` today; `checking` may namespace as `ci:running` under (b)). `blocked` stays
  **bare** to match the true lifecycle sibling — `ready-to-merge`, the *landing-gate* label, is itself bare/
  un-namespaced (`we:docs/agent/platform-decisions.md:2614`), so the lifecycle family's precedent is *no*
  namespace, not `review:*`'s.
- **`needs-fix` / `blocked:deps` (rejected).** `needs-fix` reads as a human judgment, not the deterministic
  "`test` is red" fact. `blocked:deps` is YAGNI — the only block source that exists is the manifest `blockedBy`
  (`we:scripts/merge-ai-prs.mjs:756-758`); a `:deps` suffix forward-compats a hypothetical second source that
  is filed nowhere. Prefer bare `blocked` until a real second source appears.

**Skeptic:** SURVIVES-WITH-AMENDMENT. `ci:failed` survives, but the precedent citation was corrected: the
earlier draft matched it to `review:*` (an *orthogonal landing-gate* dimension) — the real lifecycle sibling is
the **bare** `ready-to-merge` (`we:docs/agent/platform-decisions.md:2614`), so `ci:failed` is justified as a
*new `ci:*` state family*, not as `dimension:state` mimicry. `blocked:deps` **REFUTED → bare `blocked`** (YAGNI;
consistency points at the bare family).

**Screen:** clear (fresh-context). Names are a consumer-visible contract (impl: clear) and a genuine
merit/convention call independent of cost (prio: clear).

---

## Ruling (ratified 2026-07-10)

Directive-author ratified both forks at the recommended defaults, after a fresh adversarial pass on (b) held on
all axes:

- **Fork 1 — granularity: (b) total coverage.** Every ci-lifecycle state carries a deterministic label —
  `checking` / `ci:failed` / `blocked` / `ready-to-merge` — exactly one per open AI PR, set by the *existing*
  CI-truth reconcile pass generalized to all lifecycle labels (self-healing sweep, not per-tick `pr-land`
  writes). (a) terminal-only **declined**: it reads one state from absence (the directive's exact prohibition)
  and fails its own totality claim (bare-stranded-terminal), while the fix it needs is the same generalization
  (b) uses — so its only advantage (less churn) evaporates.
- **Fork 2 — names: `ci:failed` + bare `blocked`.** `ci:failed` opens a deterministic `ci:*` state family;
  `blocked` stays bare to match its sibling `ready-to-merge`. `needs-fix` / `blocked:deps` rejected.
- **Composition (codified, not re-decided):** lifecycle labels mutually exclusive among themselves, orthogonal
  to `review:*`; the `ready-to-merge` **landing-gate** absence-semantics (#2183 F1 / #2138 F4) preserved — this
  governs the **ci-lifecycle dimension** only.

**Fresh red-team (2026-07-10):** strongest case for (a) is fewer labels / no `checking` noise — defused (the
reconcile pass (a) needs anyway makes (b) nearly free). (b) vs the preserved absence-semantics — no collision:
non-green PRs now carry `checking`/`ci:failed`/`blocked` instead of being bare, which *strengthens*
"unlabelled-`ready-to-merge` = not queued"; the drain's `--label ready-to-merge` query is unaffected. Principle
check (impl-is-not-a-standard) — labels are the human+drain-visible contract, not impl leakage. Attack fails on
all axes.

**Codified:** `we:docs/agent/platform-decisions.md#ci-lifecycle-total-label-function`.
**Successor build (agent-ready):** #xqd7m2u — generalize the reconcile transition table + mint labels + tests.

Relates #2199 (the `ready-to-merge`-on-green precedent this generalizes), #2216 (the CI-truth reconcile pass
that makes (b) cheap and (a) unsound), #2262 (the `review:*` mint step new labels join), #2171 (the review
rubric), #2183 F1 / #2138 F4 (the `ready-to-merge` absence-semantics this decision preserves).
