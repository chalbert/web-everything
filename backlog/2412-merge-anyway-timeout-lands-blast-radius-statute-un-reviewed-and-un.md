---
kind: story
size: 8
status: open
relatedTo: ["2410", "2409", "2406", "2403", "2313", "2307", "2281", "2262", "2171", "2398", "2285"]
dateOpened: "2026-07-10"
tags: [gate, review, drain, merge-anyway, traceability]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/lib/review-policy.mjs
  - we:scripts/lib/review-policy.contract.json
  - we:scripts/lib/__tests__/review-policy.conformance.test.mjs
  - we:scripts/lib/gate-config.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/pr-merge-gate.mjs
  - we:scripts/__tests__/pr-merge-gate.test.mjs
  - we:scripts/check-review-gate.mjs
  - we:scripts/__tests__/check-review-gate.test.mjs
  - we:scripts/lib/__tests__/gate-invariants.test.mjs
  - we:.github/workflows/
---

# Escalated blast-radius/statute parks can auto-land un-reviewed on timeout — and not every merge path leaves a trace

Two gaps, both surfaced landing PR #371 (`decision(#2398)`, a `we:docs/agent/platform-decisions.md` statute edit).

**Gap 1 (primary) — an agent-reviewable blast-radius park auto-lands with no acceptance verdict once the window
expires.** `decideReviewGate` (`we:scripts/lib/review-escalation.mjs`) times a blast-radius / size / sampling
park out to `merge-anyway` after `DEFAULT_THRESHOLDS.windowMinutes` (30) with no reviewer verdict — by design
(#2262), so a stalled queue with no reviewer daemon never parks forever. Only `review:human` / gate-self parks
are exempt (no timeout). But `we:docs/agent/platform-decisions.md` is the **cite-able statute layer** and scores
blast-radius, *not* gate-self — so a statute edit auto-merges un-reviewed after 30 min, and a human `/review` is
racing that clock. Concretely: #371 parked 02:18, timed out and merged 02:51 at its round-2 head, stranding a
round-3 review fix (main's statute cited a *resolved* epic until a follow-up PR).

> **Gap 1 delivered by 2425 (2026-07-10, operator call): the merge-anyway timeout is REMOVED entirely** —
> a park now rests parked until a verdict label, with the operator's manual `/drain` /
> `--no-review-escalation` as the stuck-park relief valve. The recurrence that motivated the removal: PR #396
> repeated #371's pattern the same day (merged mid-negotiation at its round-1 head). Gap 2 and the
> defense-in-depth layers below remain this item's open scope.

**Gap 2 (narrower than first filed) — merge traceability is incomplete, not absent.** Correction to the initial
framing: the merge-anyway path *does* auto-file a trace comment (`we:scripts/merge-ai-prs.mjs:1155`; #371 carries
it at 02:51:27Z — "⏱ review-escalation window expired … The review is still owed: blast-radius (…)"). The real
residue: (a) the **non-escalated plain merge path** (`we:scripts/merge-ai-prs.mjs:1217`, `mergePr(...)`) posts
**no** comment — a normal green+mergeable auto-land is silent; (b) even the merge-anyway comment omits the
**landed head SHA** and the **merging session/caller id**, and fires *before* the merge (so it records the
decision, not the confirmed outcome + what actually landed).

## Recommendation — defense in depth (stack every layer, not one)

A high-value/blast-radius surface (statute, gate-self, scripts, hooks, CI) should have to pass **all** of these to
land; each layer catches what another misses, and no single layer is trusted alone. Layers, outermost to inner:

1. **Producer classification (exists, #2307/#2171).** The escalation label is applied deterministically at
   PR-open so the PR is gated from the first second, not retroactively.
2. **Adversarial acceptance verdict (build, #2410 slice 2).** A distinct fresh validator — adversarial "find the
   reason to reject" persona, ideally a diverse panel/jury — must accept, and its accept is persisted as a
   deterministic `redteam:accepted` label (taxonomy per #2281). Peer agreement is *not* acceptance; the verdict
   is the load-bearing layer.
3. **Reviewed-commit-set == head at accept time (build, #2409).** The label is honored only if the accepted
   commit-set still matches the live head — a commit can't ride in after acceptance.
4. **Code-side hard gate — no timeout escape (build, THIS story).** `decideReviewGate` must *require* the
   acceptance label for a high-value surface and **must not** fall through to `merge-anyway` on timeout: treat it
   like `review:human` (never times out) / route it through #2410 / suspend the window while a `/review` is open.
   The 30-min timeout stays only for genuinely low-value sampled/size parks. This is the primary fix for Gap 1.
5. **GitHub branch-protection required status check (build).** A required check that is red while a blocking
   `review:*`/`redteam:*` label is present — so even a manual `gh pr merge` (outside the drain, the sole writer
   to main today, #2290) is refused. The drain applies its own labels, so this can't *replace* the code-side gate
   (it can't tell "validator accepted" from "label applied"), but as an outer layer it closes the manual-bypass
   hole the code-side gate can't see.
6. **Anti-test-gaming on the deterministic clause (build, #2410 slice 3).** For a fix that goes green by editing
   tests, the CI-green clause is only sound with the read-only-tests / coverage-floor / pre-change-failing-test
   guards — otherwise the deterministic layer is itself gameable.
7. **Invariant tripwires / hermetic tests (build, #2406).** CI-verified properties that the gate itself can't
   regress: a gate-self path always yields `humanRequired`; `decideReviewGate` never merges under a sticky
   `review:human`; editing an invariant forces `review:human`. Guards the guards.
8. **Merge-time traceability (build, THIS story — Gap 2).** Every merge path posts a **before-land trace comment**
   — who/what merged, the reason (acceptance verdict vs. merge-anyway timeout vs. bare orphan sweep), the **exact
   head SHA landed**, and the session/caller id. Extend the merge-anyway comment (`:1155`) to carry SHA + session
   and add the same to the silent plain `mergePr(...)` path (`:1217`) — so a landed PR is always auditable even
   when an earlier layer is later found to have failed.

THIS story owns layers **4, 5, 8** (the enforcement + traceability); the rest are cross-referenced siblings so
the full stack is decided together, never one layer in isolation.

**Reconcile with #2403:** `deriveReviewDisposition` blesses `blast-radius → { converge, autoLand: true }` on
the assumption a *converged accept* preceded the land. Gap 1 tightens that: `autoLand` must key on an actual
acceptance verdict (the `redteam:accepted`/`review:accepted` label), **not** a bare window timeout — decide
#2403's row and this timeout-tightening together. The acceptance label itself is produced by #2410 slice 2
(the adversarial validator); this story owns only the *enforcement* — the gate requires the label and drops the
merge-anyway fallback for high-value surfaces. Enforce **code-side** in `decideReviewGate` (the drain self-approves
and applies the label, so a GitHub branch-protection required check can't tell "validator accepted" from "label
applied" — code-side + #2406's invariant tripwires is the real gate; a required check is only a backstop
against a manual `gh pr merge`).

Siblings: #2409 (reviewed-commit-set ≠ head hole), #2410 (the convergence loop that produces the acceptance
verdict this gate would require), #2313 (the park/skip comment infra Gap 2 extends to the merge path), #2281
(deterministic PR-lifecycle label function). Ships with an invariant tripwire like the rest of the gate
(#2406). Note: the gate files are gate-self → this build lands human-reviewed, not via the timeout it fixes.

## Current state (re-grounded, 2026-08-21) — read this before layer 4

**Layer 4 is delivered and its scope is closed.** `we:scripts/lib/review-escalation.mjs` now states, in the
`decideReviewGate` region, *"A park NEVER times out (resolving #2412 Gap 1 — the old 30-min merge-anyway window
raced the very…)"*, and the only other `merge-anyway` mention in the file is a historical note ("the
since-removed merge-anyway window"). `DEFAULT_THRESHOLDS` no longer carries a live merge-anyway
`windowMinutes` path. Do **not** re-derive a timeout-tightening design: the timeout is gone entirely, per the
operator call already recorded in the block-quote above.

**Gap 2 has moved too, and narrowed again.** A `land` trace comment now exists:
`buildDrainReasonComment('land', LAND_REASON, auditLine)` in `we:scripts/merge-ai-prs.mjs` posts
`✅ **Landed by the drain**` immediately **before** the `withLandWriteLock(… mergePr …)` block, alongside the
`park` and `skip` kinds. Two residues survive, both verifiable by reading that call site:

1. **It is conditional on `c.hasManifest`.** An orphan/impl PR — one carrying no manifest block — still lands
   with **no** comment at all. The card's original "silent plain merge path" is now exactly this subset.
2. **The comment carries neither the landed head SHA nor the merging caller.** `LAND_REASON` is a fixed string
   (`'landing — recording the acted-on manifest escalation values before merge'`) and `auditLineFor(c)` records
   only the manifest escalation values (`dismissedFindings`/`crossRepo`/`blockedBy`). Neither SHA nor session
   id appears anywhere in the body.

## Design

**THIS story's remaining scope is layer 8 (traceability) and layer 5 (branch protection). Layer 4 is closed.**

**Layer 8 — extend the existing land record; do not add a second comment path.** All four call sites already
funnel through one helper pair, so the change is local:

- `buildDrainReasonComment(kind, reasonText, auditLine)` (pure, exported) and `drainReasonMarker(kind)` are the
  single home of the comment body; `postDrainReasonComment(...)` is the impure poster that swallows every `gh`
  error so it can never block or alter a merge. Keep both properties.
- Add the two missing fields to the `land` body: the **head SHA about to be merged** and the **merging
  caller/session id**. The id already exists — `drainOwner()` in `we:scripts/readiness/drain-lock.mjs` is the
  same `<host>:<pid>:drain` string the whole-process lease records, so the comment and the lease name the same
  actor. Thread it in rather than inventing a second identity notion.
- Drop the `if (c.hasManifest)` guard on the **land** kind so an orphan/impl PR is recorded too; keep
  `auditLineFor(c)` returning `undefined` for a manifest-less PR, which `buildDrainReasonComment` already
  handles by omitting the audit line. The comment stays byte-identical for manifest PRs apart from the two new
  fields.
- The comment fires **before** the merge by design (a post-merge poster would be lost if the process dies), so
  the SHA it records is the head it *intends* to land. Say that in the body text — "head at land decision" —
  rather than implying a confirmed outcome.

**There is a THIRD write-to-main route, and Gap 2 as filed does not see it.** Enumerate the callers of the
shared merge-authority seam (`assertMayMerge` / `mergePr` in `we:scripts/lib/pr-merge-gate.mjs`), not just the
drain cascade. There are exactly two production callers: the drain's `withLandWriteLock(… mergePr …)` block,
and **`we:scripts/pr-land.mjs`'s break-glass `--fallback-git` path** — `assertMayMerge({ caller: 'pr-land' })`
followed by a local `git merge --no-ff` + `git push`, armed by `WE_MERGE_BREAK_GLASS=1`. That route calls
neither `buildDrainReasonComment` nor `postDrainReasonComment`, so it lands on main with **no PR comment at
all**, only a stderr audit line that dies with the process. Extending only the drain cascade leaves this card's
own headline — "not every merge path leaves a trace" — still true after it ships. Either cover it here, or
carve it out onto its own item explicitly; do not leave it undiscovered.

**Layer 5 — a required status check, explicitly as an outer layer only.** The drain applies its own labels, so a
branch-protection check cannot distinguish "validator accepted" from "label applied"; its whole value is
refusing a **manual `gh pr merge`** outside the drain (which is the sole writer to main today, #2290). One
workflow under `we:.github/workflows/` now touches review labels — `we:.github/workflows/apply-review-request.yml`, which *applies* a
staged verdict through `we:scripts/review-set-label.mjs` — but nothing there is a **required status check**, and
its own header records the trust boundary ("anyone who can push to this branch can move a review label"). So the
gap this layer names is still open; the new work is a check that is red while a blocking `review:*` label is
present, and it must not be confused with the applier.

**Siblings, restated with current status.** #2409 (reviewed-commit-set ≠ head), #2410 (the acceptance verdict
this gate would require), #2281 (deterministic PR-lifecycle labels), #2406 (invariant tripwires), #2403
(`deriveReviewDisposition`'s `blast-radius → autoLand: true` row). The #2403 reconciliation paragraph above was
written against the timeout; with the timeout removed, re-read that row before assuming it still needs changing.

## Done when

- `npx vitest run merge-ai-prs` fails before and passes after on new cases for the pure
  `buildDrainReasonComment('land', …)` body: it contains the head SHA and the caller id; it still contains the
  `drainReasonMarker('land')` marker and the `✅ **Landed by the drain**` heading; and it omits the audit line
  when `auditLine` is `undefined` (the manifest-less PR).
- A wiring test proves the `hasManifest` guard is gone from the land path: a landing candidate with **no**
  manifest produces exactly one `land` comment. Today it produces zero — so this fails before and passes after.
- `npm run check:standards` and `npx vitest run` stay green with the comment poster still decision-preserving:
  a `gh` failure inside `postDrainReasonComment` returns `false` and the merge proceeds unchanged (assert it,
  since a throw here would turn an audit nicety into a landing outage).
- Layer 5 is either built (a workflow under `we:.github/workflows/` that is red while a blocking `review:*`
  label is present, verified on a test PR) **or** explicitly re-scoped out of this story onto its own item with
  a reason — not left as an unclosed bullet.
- Every caller of the merge-authority seam is accounted for. An invariant in
  `we:scripts/lib/__tests__/gate-invariants.test.mjs` (already in this item's `scope`, already the home of the
  "drain is sole writer" invariant) enumerates each `caller` string passed to `assertMayMerge` / `mergePr` and
  asserts it is paired with a trace-comment post or a **named** exemption. Today there are two callers
  (`'drain'`, `'pr-land'`) and one of them posts nothing — so this test fails before and passes after, and a
  future third caller cannot be added silently.
- Layer 4 is recorded as **delivered by #2425**, not re-implemented: `grep -c "merge-anyway"` over
  `we:scripts/lib/review-escalation.mjs` returns only the historical mentions, and this item's close-out says so.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — The card's 'Current state (re-grounded)' section re-verifies Layer 4's closure and Gap 2's narrowed shape against the live repo before proposing further work; independently confirmed against origin/main: we:scripts/lib/review-escalation.mjs carries only the two historical 'merge-anyway' mentions (lines ~1994, ~2076), DEFAULT_THRESHOLDS carries no windowMinutes, and the `if (c.hasManifest)` guard plus fixed LAND_REASON string with no SHA/session id are exactly as described at the we:scripts/merge-ai-prs.mjs land call site.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card finds consumers of the land-comment seam only inside we:scripts/merge-ai-prs.mjs's drain cascade; it misses the second production caller of the shared merge-authority seam — we:scripts/pr-land.mjs's break-glass `--fallback-git` path (`assertMayMerge({caller:'pr-land'...})` then a local `git merge`+push) — which is a real write-to-main route that never calls buildDrainReasonComment/postDrainReasonComment at all, so it posts no trace comment even after this card's fix lands.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Done-when section explicitly requires a wiring test that fails before and passes after the `hasManifest` guard removal (a manifest-less PR must produce exactly one land comment), which is the right test-first framing for this exact class of guard.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when explicitly requires asserting that a `gh` failure inside `postDrainReasonComment` returns false rather than throwing, so the comment poster stays decision-preserving and its own failure doesn't silently swallow a landing outage.

**Corrections recommended:**

- none — the preparation held up as written.

The card's factual re-grounding (Layer 4 closed, Gap 2's hasManifest guard and missing SHA/session) checks out exactly against origin/main, but its Gap 2 diagnosis enumerates only the drain's own cascade land site and misses the break-glass `--fallback-git` merge path in we:scripts/pr-land.mjs, which writes to main via `assertMayMerge({caller:'pr-land'})` yet never calls `postDrainReasonComment` at all.

**Finding applied after this review** (accepted): the design now enumerates the callers of the shared merge-authority seam rather than only the drain cascade — `we:scripts/pr-land.mjs`'s break-glass `--fallback-git` path writes to main and posts no comment at all, so Gap 2 as filed would have shipped with the headline still true. A `gate-invariants` criterion now enforces caller-vs-trace coverage.

_Recorded through the declared `review-prep` operation._
