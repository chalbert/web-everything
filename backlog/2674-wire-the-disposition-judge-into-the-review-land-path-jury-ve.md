---
bornAs: xuqbibk
kind: story
size: 5
parent: "2636"
status: open
scope: ["we:scripts/lib", "we:scripts"]
dateOpened: "2026-07-26"
tags: [jury, disposition, review, land-path]
relatedTo: ["2652", "2639"]
---

# Wire the disposition judge into the review land path (jury verdict -> disposeVerdict -> label decision)

`we:scripts/lib/disposition-judge.mjs` (`proposeDisposition` / `redRefute` / `disposeVerdict`, from #2652)
is built as PURE functions but is imported by NOTHING on the land path — the only consumer today is
`we:scripts/lib/micro-decision-surface.mjs`. This card builds the missing seam so a parked-PR jury verdict
actually flows through the judge to a label decision.

## What to build

- Feed a parked PR's jury ledger through `disposeVerdict` (consuming the #2651 disposition-config for the
  per-lens weights + dissent threshold) to get a disposition.
- Map that disposition onto a label decision via `we:scripts/review-set-label.mjs` `decideSetLabel`:
  - **clear-winner** disposition -> the auto-clear intent (accept).
  - **contested / red-refuted** (`redRefute`) -> `review:human`, kept parked for the human.
- Keep the judge PURE and the wiring thin: the seam reads the ledger, calls `disposeVerdict`, and returns
  a label intent — it does not itself write the label or merge (that is the auto-land seam, the sibling
  card, and stays behind SHADOW mode).

## Notes

- `decideSetLabel` already REFUSES `to==='accepted'` when the PR carries `review:human`, so a contested
  verdict cannot be laundered into an accept — the seam relies on that invariant, it does not bypass it.
- This is the judge-wiring half; the actual `review:accepted` write + drain-merge is gated behind the
  SHADOW-first auto-land seam (sibling card, blocks on this one).

Relates to #2652 (the judge), #2639 (the convergence loop that produces the round-by-round ledger).

locus: we
