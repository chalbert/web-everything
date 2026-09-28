---
bornAs: x3u9t41
kind: story
size: 5
priority: high
parent: "4075"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/lib/approval-prevention-notice.mjs", "we:scripts/operations/file-item.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-smells/clone-stale.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Approval-time prevention cards are written into the daemon clone and never land

The approval-time prevention filer (we:scripts/review-set-label.mjs#fileApprovalPreventionCard, run from we:scripts/review-set-label.mjs#runApprovalPreventionFiling on every PR accept/clear-human) shells file-item and stops, per we:scripts/operations/file-item.mjs's own header: landing is a separate three-call sequence (file-item, verify, open-pr) the filing hook never runs. It executes inside whatever checkout reviewed the PR — a read-only daemon clone, not a lane — so the card lands as an untracked file nothing ever commits. Live 2026-09-28: 22 untracked backlog/x*.md cards in wev-review-daemon, 1 in wev-control, dating to PR #2807; each daemon rebuild keeps them 'untracked-kept' forever.

## Risks

- The filing hook must stay best-effort relative to the approval it rides on — we:scripts/review-set-label.mjs's own doc for `runApprovalPreventionFiling` says a filing failure "can therefore NEVER cost the approval that already happened." Any landing path added here (a lane + PR, or handing the write to the conveyor queue) must keep that invariant: a slow/failed land must not block or fail the approval comment.
- A daemon clone is read-only by convention (this very task's own guardrail) — the fix must route the write through a real lane clone (or an existing mechanism that already owns landing, e.g. handing the composed card to `we:scripts/conveyor/queue.mjs`/a dispatch that runs in a lane), never make daemon clones writable.

## Test plan (each fails before the change, passes after)

1. A regression that drives `runApprovalPreventionFiling`/`fileApprovalPreventionCard` from a fixture checkout shaped like a daemon clone (no `lane/*` branch, cwd not a lane) and asserts the resulting card is provably reachable from `main` (or queued into a mechanism that already lands it) — not merely written to that checkout's working tree.
2. A unit test for the new health smell (we:scripts/conveyor/health-smells/, alongside we:scripts/conveyor/health-smells/clone-stale.mjs) asserting it opens an episode for a fixture daemon clone carrying an aged untracked `backlog/x*.md` file, and closes once the file is gone/tracked.

## Tasks

1. Trace every real call site of `runApprovalPreventionFiling` and confirm which checkout(s) it runs from in production (the review-loop daemon).
2. Design and implement the landing path so a filed prevention card reaches `main` without hand intervention — reusing the existing lane + `file-item`/`verify`/`open-pr` sequence rather than inventing a second writer.
3. Add the untracked-backlog-card health smell.
4. Note in this card's PR that the 23 cards this incident already orphaned were rescued by hand as a one-time cleanup (chalbert/web-everything, lane `lane/rescue-prevention-cards`) — this card prevents a recurrence, it does not itself land those.

## Proof plan (live, before/after)

- BEFORE: the regression test in Test plan #1 fails (the card is written but never reaches `main`).
- AFTER: the same test passes, and the new smell fires red against a fixture with an aged untracked card and green once it lands — both runnable via `npm run check:standards`/`vitest` with no manual daemon-clone surgery.

## Done when

1. **Executable** — the Test plan #1 regression, red before this lands, green after.
