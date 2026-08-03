---
bornAs: xz22ycy
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
tags: [review, drain, mandate, mechanized-panel]
relatedTo: ["2450", "2439"]
scope:
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/review-core.mjs
---

# netChangedFiles never reaches the mechanized review panel — the CLI seam drops it

The mechanized parked-PR panel seeds every lens reviewer by shelling `review-core-cli mandate`, whose
`buildMandateText` calls `buildPanelMandate` with the lens alone — no `netChangedFiles`. So #2450's
ground-truth block, which stops a reviewer flagging a landed sibling-lane file as scope creep, reaches
only the hand-run drain prose and never the autonomous path. Worse, the value is not even reachable
there: `fetch-parked` reads `gh pr view` plus the diff, never the drain's parked array, so threading
the parameter alone would add an argument with nothing to pass.

## Why this is not just a missing argument

Surfaced by the `/review` of PR #1011 (now closed). Deferring the CLI composer read as reasonable in
isolation, and it is not — the CLI is **not** a secondary convenience seam. It is the **sole mandate
source for the autonomous workflow**: `we:scripts/workflows/review-parked-prs.mjs` shells
`review-core-cli` for the lens mandate, the reduction, the editor mandate, and the roster invite. So
the path that runs unattended is exactly the path missing the ground truth, while the hand-run path
has it.

That inverts the usual risk gradient. A human running the drain by hand can notice a phantom
scope-creep finding and dismiss it; the mechanized panel cannot, and burns a negotiation round.

## The two-part gap

1. **The composer drops it.** `buildMandateText` (`we:scripts/review-core-cli.mjs`) calls
   `buildPanelMandate({ lens })`. The library builder has taken an optional `netChangedFiles` since
   #2450 and is purely additive, so this is a signature/flag change plus tests.
2. **The value is not reachable.** Even with the parameter threaded, the workflow has nothing to pass:
   `fetch-parked` reads `gh pr view` and the diff, never the drain's `--json parked` array where the
   net changed-file set lives. Closing (1) without (2) yields a parameter that is always empty — the
   inert-flag defect the same review flagged three times on PR #1011.

Both halves are required for this item to mean anything.

## Definition of done

- **A1 — thread it.** `buildMandateText` accepts and forwards `netChangedFiles`, with a CLI flag to
  supply it in the seam's existing input style (a repeatable flag or JSON input).
- **A2 — make the value reachable.** The parked-PR workflow obtains the net changed-file set (from the
  drain's `parked` output, or by computing it the same way the drain does) and passes it through.
- **A3 — prove it end-to-end, not per-composer.** An oracle asserting the mandate the **workflow
  actually emits** carries the ground-truth block — not merely that the composer *can* carry it. A
  composer-level test would have passed throughout the period this bug existed.
- **A4 — additivity preserved.** Omitting the parameter leaves the mandate byte-for-byte unchanged.

## Boundary

`crossRepoCouple` is deliberately **not** part of this. That parameter belonged to the approach #2457
was re-scoped away from — the couple's cross-repo symbol check is now mechanical and never touches a
mandate. This item is `netChangedFiles` only.

A fourth composer, `we:skills-src/jury/resolve-roster.mjs`, is un-threaded the same way and is worth
folding in if it proves to be the same one-line shape; it was found by a JS-composer grep that missed
seams reached via shell or prose, so confirm the enumeration before closing.
