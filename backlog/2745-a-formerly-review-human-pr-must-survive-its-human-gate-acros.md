---
bornAs: xrkv3ed
kind: story
size: 5
parent: "2405"
status: open
blockedBy: ["2416"]
relatedTo: ["2309", "2416", "2410", "2285"]
dateOpened: "2026-07-27"
tags: [gate, review, drain, gate-self, review-escalation, review-human, trust-chain]
scope:
  - we:skills-src/review/SKILL.md
  - we:scripts/review-set-label.mjs
  - we:scripts/conveyor/rearm-review.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/__tests__/
  - we:scripts/__tests__/
---

# A formerly-`review:human` PR must survive its human gate across a `/review`-changes bounce, rearm, and de-escalating rebase

**Trust-chain integrity (high priority).** A PR the operator escalated to `review:human` merged
autonomously — with no human re-clear — because the human gate lives only on a **mutable label** that a
later label swap dropped. The sticky-veto that should have held (#2309) only fires while the label is
*present*, so once any path strips or fails to re-add `review:human`, the gate silently evaporates. The fix
is a **durable, SHA-anchored "human-owed" marker** that survives label churn, plus two consumers that honor
it. **No harm landed in the observed case** — the merged diff was a safe revert — so this is a latent hole
to close, **not an active breach**. File it, build it deliberately; don't mis-triage it as an incident.

## Incident (the confirmed chain)

PR **#809** (a gate-self PR that the operator had escalated to `review:human` by hand) merged autonomously
with no human re-clearance. The three links, each evidence-grounded:

- **(a) The `/review` changes bounce dropped `review:human` by omission.** In the observed run the changes
  path applied labels via a raw `gh pr edit` in [we:skills-src/review/SKILL.md](../../skills-src/review/SKILL.md)
  (the "record the verdict as a label" step), instead of routing through the pure
  `decideSetLabel({to:'changes'})` in [we:scripts/review-set-label.mjs](../../scripts/review-set-label.mjs) —
  the decision that is *written* to KEEP `review:human` on a bounce (a bounce lands nothing, so the human gate
  must stand). The **accept** path removes `review:human` on purpose; the **changes** path removed it by
  omission because it never consulted the pure core.
- **(b) Rearm preserved an existing gate but never re-derived one.**
  [we:scripts/conveyor/rearm-review.mjs](../../scripts/conveyor/rearm-review.mjs) (the fix-agent's one allowed
  swap, `decideSetLabel({to:'rearm'})`) swaps `review:changes → review:pending` and KEEPS `review:human`
  **when it is still present** — but it never **re-adds** `review:human` and never **re-scores** the diff. It
  only *preserves* an already-present gate. Once (a) had stripped the label, rearm had nothing left to keep, so
  the PR came back as plain `review:pending`.
- **(c) A de-escalating rebase shrank the diff below the gate-self threshold.** The fix commit was re-scoped
  onto infra already on `main`, shrinking the net diff to a single backlog `.md` (~52 lines). The drain's fresh
  `scoreEscalation` returned `escalate:false, humanRequired:false`, so `decideReviewGate`
  ([we:scripts/lib/review-escalation.mjs](../../scripts/lib/review-escalation.mjs)) fell through to `merge`.
  `review:pending` is **not** sticky (only `review:human` is, per #2309), so nothing vetoed. The resident drain
  merged it.

The common cause is one design fact: **`review:human` is a mutable label with no durable backing.** Every link
above is just a different way that label goes missing (stripped, not-re-added, or made moot by a fresh score),
and the moment it is gone the human gate is gone with it.

## Current state (why this is still open, and what it is not)

Since the observed run, label-preservation was partly hardened: `decideSetLabel({to:'changes'})` and
`{to:'rearm'}` are now written in the pure core to KEEP `review:human` (the #2630 invariant, single-sourced so
the CLI cannot route around it — see [we:scripts/review-set-label.mjs](../../scripts/review-set-label.mjs)),
and `decideReviewGate` already treats a **present** `review:human` label as a hard, no-timeout veto (#2309).
Those close the *specific* raw-edit strip once every caller goes through the core. **They do not close the
hole**, because all of them still rest on the label being *present*: any path that drops it, any rearm that
finds it already gone, or any tool / human / `gh` edit outside the core, still silently removes the human gate —
and a later de-escalated fresh score then merges. The linchpin — a human-owed signal that does **not** live on
a swappable label — does not exist yet. That is what this story builds.

## Required fix (three coupled parts — the durable marker is the linchpin)

1. **Durable "human-owed" marker (the linchpin).** When a human escalates or `/review`s a gate-self PR to
   `review:human`, record that fact **durably and SHA-anchored** — a marker comment / check keyed to the
   reviewed commit, not only the mutable `review:human` label. The marker is the source of truth for "a human
   was owed on this PR"; the label becomes a fast cache of it. Anchor to the SHA so a genuine later
   **human** clearance (per #2416's human-applied-accept signal) can supersede it, while a mere label swap or a
   de-escalating rebase cannot.
2. **The bounce + rearm must not silently drop the gate.** Route the `/review` **changes** bounce through
   `decideSetLabel({to:'changes'})` (which KEEPS `review:human`) instead of a raw `gh pr edit` in
   [we:skills-src/review/SKILL.md](../../skills-src/review/SKILL.md); and make `rearm`
   ([we:scripts/conveyor/rearm-review.mjs](../../scripts/conveyor/rearm-review.mjs)) **re-derive** the gate from
   the current diff (or read the durable marker) and **restore** `review:human` when it is still warranted —
   not merely preserve a label that happens to still be there.
3. **Drain / AI-review backstop against a de-escalated fresh score.** A PR that **ever** carried `review:human`
   (read from the durable marker, not the current label) must NOT be auto-merged or auto-accepted on a later,
   lower fresh score without a **subsequent human clearance**. Extend the sticky-veto in `decideReviewGate`
   ([we:scripts/lib/review-escalation.mjs](../../scripts/lib/review-escalation.mjs)) and the drain land gate
   ([we:scripts/merge-ai-prs.mjs](../../scripts/merge-ai-prs.mjs)) to key off the durable marker, so the veto
   survives label churn and diff de-escalation. **Depends on #2416** — the human-applied-accept signal is how
   the backstop knows a clearance is genuinely a human's and not an agent panel's.

## Acceptance

- A durable, SHA-anchored human-owed marker exists and is written on human escalation / `/review` of a
  gate-self PR; it is not removable by an ordinary label swap.
- Integration test: a PR stamped `review:human`, bounced `review:changes` **via the SKILL path**, rearmed, then
  rebased so its fresh score de-escalates to `humanRequired:false` — the drain **parks** it (never merges)
  until a genuine human clearance (#2416) arrives. This is the #809 chain, reproduced and closed.
- Unit tests: the changes bounce and rearm keep / restore `review:human`; `decideReviewGate` / the drain land
  gate veto on the durable marker even when the label is absent and the fresh score is de-escalated.
- `check:standards` + the required `test` check green; coverage not dropped; the new tests fail on pre-change
  behavior.

## Links

- **#2309** — `review:human` is a sticky merge veto, not only a fresh-score classification. The mechanism that
  *should* have held; it only fires on a **present** label, which is the gap this closes.
- **#2416** (blockedBy) — honor `review:accepted` only when a human applied it. Part 3's backstop needs this to
  tell a genuine human clearance from an agent one.
- **#2405** (parent) — Harden and self-improve the PR-validation gate. This is a sibling of #2416 under it.
- **#2410** / **#2285** — the drain review / convergence-loop epics this hardening lives alongside.

## Not scoped smaller here

Three tightly coupled code changes across the review-label core, the review skill, the rearm shim, the
escalation gate, and the drain land gate — kept as one story (`size: 5`) because the durable marker is only
meaningful with both consumers wired to it. The predicted touch-set is declared in `scope`
(the review skill, [we:scripts/review-set-label.mjs](../../scripts/review-set-label.mjs), the rearm shim,
[we:scripts/lib/review-escalation.mjs](../../scripts/lib/review-escalation.mjs),
[we:scripts/merge-ai-prs.mjs](../../scripts/merge-ai-prs.mjs), plus their tests).
