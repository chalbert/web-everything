---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-06"
preparedDate: "2026-09-06"
tags: [conveyor, review, pr-watch]
---

# Define "neglected" for a general parked-PR landing-progress watch

What exact, conservative rule should a new mechanical pass (`we:x7llsyo`, the general PR-landing-progress
watch) use to decide a parked PR (`review:pending`/`review:changes`/`review:human`) is **neglected** — making
no real progress toward landing — versus merely normally waiting its turn. Carved out of `we:x7llsyo` per this
repo's own rule that a fork never lives inline in a build item (`we:docs/agent/backlog-workflow.md`, "never
inline in an idea/epic/story body"); that story is `blockedBy` this item.

## The evidence this has to explain

Two real, distinct incidents, same night (2026-09-06/07), neither caught by either of the two watches already
built under `#3383` (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/duplicate-pr-watch.mjs`):

1. **PR #1928** sat `review:pending`, mergeable, for an extended period with **no independent review ever
   dispatched** for it. Found only because a human happened to run `gh pr view` directly — nothing mechanical
   noticed.
2. **PR #1939** sat carrying a **stale `review:changes` label** left over from a duplicate-PR situation
   (`#1942`) that was resolved and closed. The concern the label encoded stopped applying the moment `#1942`
   closed, but nothing ever re-derived the label and cleared it.

These are two structurally different neglect shapes — (1) is "nothing ever happened," (2) is "something
happened, then stopped mattering, and the label never caught up" — and a single rule has to cover both without
false-flagging a PR that is simply, normally, still waiting its turn (the common case for most parked PRs most
of the time).

## Fork 1 — which neglect signal(s) does the FIRST build cover?

- **(a) No-review-ever-dispatched only.** A PR is neglected iff it has carried an uncleared review hold for
  longer than the Fork-2 threshold AND no `review-<pr>`/`fix-<pr>` named session has EVER appeared in `claude
  agents --json --all`'s full listing for it — reusing the exact ground-truth read + session-name-grammar match
  `we:scripts/conveyor/session-reaper.mjs` and `we:scripts/conveyor/review-status-tag.mjs` already use, but over
  the FULL listing (which `we:scripts/conveyor/review-status-tag.mjs`'s own header notes never prunes a
  finished `done` row) rather than only the currently-live rows — so "ever dispatched," not just "dispatched
  right now," is actually answerable with no new store. Directly closes #1928's exact shape.
- **(b) (a) OR a stale-verdict-label check**: also flag a `review:changes` PR whose triggering finding can be
  mechanically re-checked and found moot — concretely, a finding posted by `we:scripts/conveyor/duplicate-pr-watch.mjs`
  naming a sibling PR that has since closed. This closes #1939's exact shape too, but needs parsing which prior
  PR comment caused the label and re-checking that PR's live state — real, but meaningfully harder and its own
  design surface (which comment counts as "the" finding, what to do with a label whose cause can't be
  identified at all).
- **(c) Ship (a) now; carve (b) into its own follow-on story once (a) is live.** (a) alone already gives the
  neglect watch real, general teeth (a long-uninvestigated PR is caught regardless of WHY it's uninvestigated —
  which, given enough elapsed time with truly nobody looking, also eventually catches a #1939-shaped PR the
  moment a fresh human/agent glance would have cleared it anyway), while keeping the first build's blast radius
  to one clean, already-proven mechanism (reused ground-truth liveness, no comment-parsing). (b)'s
  comment-attribution problem deserves its own scoped design pass rather than riding in on this item's build.

**Recommended default: (c).** It matches this file set's own established bias
(`we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s docstring: ship the mechanically-safe, unambiguous half
now; the harder, judgment-adjacent half is a deliberate later step, not a blocker).

## Fork 2 — the wall-clock threshold and its time source

The "no separate state store" ruling (#2612) means there is no existing durable clock counting how long a PR
has sat parked. Candidates:

- **(a) Read the label's own apply time off GitHub's own timeline** (`gh api`'s issue-events endpoint,
  filtered to the `labeled` event for the current `review:*` label) as the durable start-of-park marker — no
  new store, ground truth GitHub already keeps. Costs one extra `gh api` call, but only for a PR that is
  *already* a parked candidate (a small minority of the open-PR population each tick) — the same lazy-extra-
  fetch shape `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s own `GH_FILES_GRAPHQL_CAP` re-fetch already uses.
- **(b) Use `pr.createdAt`** (free — already on the existing `gh pr list --json` read) as a proxy for "since
  parked." Simpler, but wrong in the unsafe direction for a PR that spent real time unparked before a LATER
  re-park (e.g. bounced back to `review:changes` after a fix): it over-counts elapsed parked-time and
  false-flags earlier than the PR actually earned.
- **(c) A tick-count floor with no wall-clock anchor**, mirroring the sibling watches' own cadence-free
  reaction shape. Doesn't fit here — a tick-count with no wall-clock anchor means nothing durable across a
  runner restart, and elapsed real time is the entire point of a neglect check.

**Recommended default: (a)** — accurate, no new store, and the sibling watches already establish the
"pay the extra `gh` call only on an already-narrowed candidate set" pattern.

**The threshold `N` itself — propose 24 hours as the bold default**, subject to the operator's own tuning once
real false-positive/negative data exists: long enough that a PR waiting for someone's normal daily check-in is
never false-flagged, short enough to catch a genuine multi-day silent stall (the #1928 shape) well within one
working day. This specific number is a cheap, low-stakes, easily-revised knob — not worth gating the build on
further debate, but stated here explicitly rather than picked silently inside the implementation.

## Done when

1. Fork 1 is ratified — a stated choice among (a)/(b)/(c) above, recorded on this item.
2. Fork 2 is ratified — a stated choice of time source ((a)/(b)/(c)) and a stated `N`, recorded on this item.
3. `we:x7llsyo` (the general PR-landing-progress watch story) has its `blockedBy` cleared and can proceed to
   build against the ratified rule.
