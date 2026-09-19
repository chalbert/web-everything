---
bornAs: xzajv4j
kind: story
size: 3
parent: "3549"
status: open
blockedBy: ["3550"]
scope: ["we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Stale-verdict re-check: flag a review:changes PR whose triggering finding has gone moot

Fork-1b follow-on carved out of we:backlog/3549 (Fork 1 option (b)), deferred out of the first neglect-watch build per operator ratification 2026-09-07 (we:3549 is shipping only signal (a), no-review-ever-dispatched, via we:3550). A PR carrying a review:changes label whose triggering finding can be mechanically re-checked and found moot -- concretely, a finding posted by we:scripts/conveyor/duplicate-pr-watch.mjs naming a sibling PR that has since closed -- should be re-flagged/cleared instead of sitting stale forever (PR #1939's real shape). Needs its own scoped design pass: which PR comment counts as 'the' triggering finding, and what to do when a label's cause can't be identified at all. blockedBy we:3550: this follow-on's natural home is extending the SAME predicate/sweep module we:scripts/conveyor/parked-pr-progress-watch.mjs that we:3550 builds (we:3549 Fork 1's own text: 'carve (b) into its own follow-on story once (a) is live'), not a separate mechanism -- building it before we:3550 lands means the module/predicate/CLI it would extend does not exist yet on main.

## Done when

**Genuinely blocked, not arbitrarily gated** — `blockedBy: ["3550"]`. This follow-on's design proposal is to
extend `we:scripts/conveyor/parked-pr-progress-watch.mjs`, the module `we:3550` builds; ratify the two open
design questions below and build only once that module exists on `main`.

1. Which PR comment counts as "the" triggering finding is decided (e.g. the most recent
   `we:scripts/conveyor/reconcile-finding.mjs`-posted comment naming a sibling PR, matched by its own stable
   marker/format) and what to do when a label's cause can't be identified at all (leave it alone — never
   auto-clear on ambiguity) is decided.
2. `we:scripts/conveyor/parked-pr-progress-watch.mjs`'s neglect predicate gains the stale-verdict branch:
   a `review:changes` PR whose triggering finding named a sibling PR that has since closed is flagged for
   re-check via the same `we:scripts/conveyor/reconcile-finding.mjs` bounce the sibling watches already use.
3. Unit tests cover the branch (moot finding → flagged; live sibling PR → not flagged; unidentifiable cause →
   left alone) plus a fixture reproducing PR #1939's real shape.
4. `npx vitest run we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs` passes and
   `npm run check:standards` stays green.
