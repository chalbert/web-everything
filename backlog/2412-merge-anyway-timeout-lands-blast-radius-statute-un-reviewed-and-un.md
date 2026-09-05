---
kind: story
size: 8
status: resolved
relatedTo: ["2410", "2409", "2406", "2403", "2313", "2307", "2281", "2262", "2171", "2398", "2285"]
dateOpened: "2026-07-10"
dateStarted: "2026-09-04"
dateResolved: "2026-09-04"
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

## Progress

Re-surveyed against `main` before building (2026-09-04): Gap 1 was already delivered by #2425 (the
merge-anyway timeout is removed entirely — `we:scripts/lib/review-escalation.mjs`'s `decideReviewGate` names
"resolving #2412 Gap 1" in its own doc comment), and part of Gap 2 by #3308 (the review-coverage announcement,
narrower than this item's ask — it fires only on a detected coverage gap, not on every landing PR). This build
covers what was left:

- **Gap 2, completed.** Every landing candidate — manifest-carrying or not — now gets a `merge-trace` drain
  comment, posted right before the merge write, naming the exact live head SHA about to land and the merging
  caller/session (`we:scripts/merge-ai-prs.mjs`'s `buildMergeTraceReason`/`MERGE_TRACE_KIND`, a fifth
  `drainReasonMarker` kind alongside park/skip/land/review-coverage). Closes the silent plain-`mergePr(...)`
  path Gap 2 named.
- **Layer 5, built.** `we:scripts/check-review-gate.mjs` (+ `we:.github/workflows/review-gate.yml`) — a
  required status check that reads red for as long as a review hold
  (`review:pending`/`review:changes`/`review:human`) sits on the PR, closing the manual-`gh pr merge`-bypass
  hole a code-side gate can't see. Adding its check name to the branch-protection required list is a
  repo-admin action, not a code change (same as `smoke` in `we:.github/workflows/ci.yml` — see that job's own
  note).
- **Layer 4, scaffolded off, NOT built here — genuinely blocked.**
  `we:scripts/lib/review-escalation.mjs`'s own `REVIEW_LABELS.redteamAccepted` comment already names "requiring
  it before an engine-tier auto-land" as #2412's concern. But no CODE-LEVEL / daemon-reachable writer applies
  `redteam:accepted` to a live PR yet: `we:scripts/converge-cli.mjs`'s pre-PR `/converge` tool runs the
  validator judging (`buildValidatorMandate`) but never calls `combineValidatedVerdict` and never writes any
  label (by design — `/converge` is advisory only); the only place the actual `gh pr edit --add-label
  redteam:accepted` procedure exists today is as hand-run prose in `we:skills-src/drain/SKILL.md`, for a
  human/agent to type during an interactive escalated-PR drain session — no `.mjs` script anywhere calls it, so
  the fully-automated resident daemon and the deterministic `we:scripts/merge-ai-prs.mjs` sweep have zero code
  path touching it. That gap is #2410 slice 2, still open. Requiring the label in `decideReviewGate` before
  #2410 ships a code-level writer would strand every future blast-radius/engine-tier auto-land that goes
  through the automated/daemon path — a regression, not a tightening. Scaffolded as a new item,
  `blockedBy: ["2410"]`, so the enforcement lands once its producer exists rather than being built prematurely
  against one that doesn't.
- **Reconcile-with-#2403 row: unaffected.** That reconciliation is Layer 4's job (it is about which label
  `autoLand` keys on), so it moves with Layer 4 to the scaffolded follow-up.
