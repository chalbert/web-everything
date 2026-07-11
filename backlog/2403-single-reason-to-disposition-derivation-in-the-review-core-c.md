---
kind: story
size: 5
status: resolved
relatedTo: ["2285", "2326"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: 6b5874f7 (review-core deriveReviewDisposition)
tags: [review, drain, skill, agent]
---

# One reason→disposition derivation in the review core — converge vs hand-to-human, for all reviews

Today the choice between **run the fix/review convergence** and **hand it to a human** lives as prose in the
drain (`we:skills-src/drain/SKILL.md`), branching on a single `humanRequired` boolean. That boolean collapses two
genuinely different situations into one "advisory only, wait for the human" behaviour — and it's drain-only, so
the other review surfaces don't share the policy. Lift the branch into ONE derivation in the shared review core
(`#2325`), key it on the escalation **reason**, and route **every** review consumer through it.

## The distinction (why one boolean is too coarse)

A PR ends up in front of a human for two structurally different reasons, and they deserve opposite handling:

- **A sensitivity park — the diff touched a blacklisted path, but no review has deadlocked.** The human gate is
  "extra eyes on a sensitive area," not "the agents couldn't agree." An agent reviewer/editor is still useful
  here, so we should **run the full panel↔editor convergence and apply the fixes** — the PR arrives *improved* —
  while the human still gates the merge. The sharpest case is the **trust-chain / gate-self** blacklist
  (`we:scripts/lib/review-escalation.mjs`, `we:scripts/merge-ai-prs.mjs`): convergence may fix bugs there too, but
  because it edits the code that decides the agent's own leash, its disposition is **converge-but-never-auto-land**
  (see the invariant) and the advisory comment must flag that the diff now carries agent-authored trust-chain edits.
- **A negotiation deadlock — the panel↔editor loop already ran and could not agree** (hit the round cap without
  converging, or a genuine mandate conflict). Re-running convergence just repeats the same deadlock. There is **no
  point converging**; hand it to the human to decide. (This is already terminal after the round cap — the change is
  to make it explicit in the shared derivation and to guarantee we never *newly* re-enter convergence here.)

## Deliverable

**1 — `deriveReviewDisposition({ reason })` in `we:scripts/lib/review-core.mjs`.** The single mapping
`reason → { mode, autoLand }`:

| reason | mode | autoLand | note |
|---|---|---|---|
| `gate-self` (trust-chain / leash) | `converge` | `false` | fix it, human still gates the merge — the one new behaviour |
| `blast-radius` / `size` / `sampling` / `dismissed-findings` | `converge` | `true` | today's agent-reviewable path, unchanged |
| `non-convergence` (round cap) | `human` | — | no re-converge |
| `mandate-conflict` | `human` | — | no re-converge |

Pure derivation, exhaustive over the reason vocabulary, unit-tested — same discipline as `deriveVerdict` /
`deriveNegotiationOutcome`. The reason vocabulary is single-sourced (export a frozen `REVIEW_REASONS`).

**2 — Route every review consumer through it (the "all reviews" requirement).** No consumer hand-rolls the
converge-vs-human branch:

- **drain** — the parked-PR branch (`we:skills-src/drain/SKILL.md`) calls `deriveReviewDisposition` instead of its
  `humanRequired` prose. `gate-self` now runs the convergence (advisory *fix*, `autoLand:false`) rather than
  advisory-comment-only.
- **`/review`** (`we:skills-src/review/SKILL.md`) — reads the disposition so the operator sees *why* it's human-gated
  (sensitivity vs deadlock) and whether an advisory fix was already applied.
- **`/merge`** (`we:skills-src/merge/SKILL.md`) — the open-PR sweep honours the same disposition: it never
  converges (that's the drain's loop), but `autoLand:false` / `mode:human` are exactly the un-cleared labels
  `hasUnclearedReviewLabel` (#2366) already refuses, now stated as one shared derivation.
- **`/code-review`** — the global harness skill (not in this repo) reviews a working diff and defers the
  converge-vs-human routing to the drain gate; no in-repo change, it inherits the policy by construction.

## Invariant preserved (unchanged from `#2326`)

`gate-self` (and any `autoLand:false` disposition) **never** gets `review:accepted` from an agent and **never**
auto-lands — the human gates the merge. `autoLand` is the single enforcement point. The core still **judges only**;
what a disposition *does* (label, land, comment) stays with the caller. Convergence on a gate-self PR pushes
attributed fixes and re-panels to confirm, but the terminal state stays `review:human`.

## Acceptance

- `deriveReviewDisposition` exists in the review core, is exhaustive over `REVIEW_REASONS`, and is unit-tested
  (including that `gate-self` ⇒ `autoLand:false`).
- The drain, `/review`, and `/merge` all branch converge-vs-human through this one derivation — no in-repo
  consumer re-implements it (`/code-review` is out-of-repo and inherits it via the drain gate).
- A `gate-self` parked PR now carries an advisory-fix convergence (fixes applied, panel re-run) yet still cannot be
  agent-cleared / auto-landed.
- A deadlock-escalated PR is handed to the human with no re-convergence.

## Resolution note

This item was filed 2026-07-10, one day after the exact deliverable it describes had already landed on
`main` in commit `6b5874f7` ("review-core: one reason→disposition derivation, shared by all reviews") plus
follow-up `43782cab` ("review-core: accept decorated scoreEscalation reason strings"). Verified against every
acceptance line:

- `deriveReviewDisposition({ reason | reasons })`, `REVIEW_DISPOSITIONS`, and the frozen `REVIEW_REASONS`
  vocabulary exist in `we:scripts/lib/review-core.mjs`, exhaustive over the reason set (plus `cross-repo`,
  a superset of this item's table), with the exact precedence this item specifies (deadlock reasons beat
  `gate-self` beats plain sensitivity reasons) and unit-tested in
  `we:scripts/lib/__tests__/review-core.test.mjs` (`describe('deriveReviewDisposition …')`), including the
  `gate-self ⇒ autoLand:false` case and the strictest-reason-wins case.
- `we:skills-src/drain/SKILL.md`, `we:skills-src/review/SKILL.md`, and `we:skills-src/merge/SKILL.md` all
  call `deriveReviewDisposition` rather than hand-rolling the `humanRequired` branch (grep confirms no
  in-repo re-implementation).
- The `#2285`/`#2326` invariant (`autoLand:false` is never agent-cleared) is unchanged and still the single
  enforcement point.

No further code change was needed; resolving as already-delivered by the prior commits.
