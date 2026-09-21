---
bornAs: x997mz7
kind: task
status: open
scope: ["we:scripts/lib/review-runner-core.mjs", "we:scripts/lib/__tests__/review-runner-core-marker.test.mjs"]
dateOpened: "2026-09-19"
tags: [governance, mechanization, principle-surface]
---

# Seed an @invariant marker on the runner's forced-shadow constant (#2840 trigger 2 follow-on)

Follow-on to #2892 (`isPrincipleSurface` landed with the first seeded markers). The comment on the
`review-runner-core` roster entry in `we:scripts/lib/gate-config.mjs` records that
`we:scripts/lib/review-runner-core.mjs`'s hard-coded `LAND_MODES.SHADOW` in `runnerShadowPlan` IS the scheduled
runner's zero-mutation guarantee, and that a `@invariant` marker on it is the right long-term guard. This item
seeds that one marker (each seeding rides its own impl PR, per #2839).

## Scope

- Add one `// @invariant` marker directly above the forced-shadow assertion in
  `we:scripts/lib/review-runner-core.mjs`, citing the already-resolved anchor `#enforce-flip-triple-gated` (#2838)
  so the sequencing rule (#2839) holds.
- Keep the marker plus its assertion within `MARKED_BLOCK_MAX_LINES` (3) contiguous non-blank lines, or the
  edit-detector cannot see the marker inside a default `-U3` hunk.

## Edge cases the build must handle or reject

- The assertion is split across more than 3 lines: restructure it into one statement; do not just place the
  marker above a block the detector will only partly cover.
- A marker written on a line that is prose or inside a string rather than a comment leader must NOT read as a
  marker (`MARKER_LINE_RE` anchors to the comment leader — add no shape that loosens it).
- The file stays `leash: 'spec'` until a SEPARATE human-ratified call reclassifies it. This item does NOT
  reclassify it, and its marker only changes routing after that call.

## Done when

1. **Executable** — `npx vitest run review-runner-core-marker` passes (vitest filters by substring; the file is
   `we:scripts/lib/__tests__/review-runner-core-marker.test.mjs`). The test builds a REAL `git diff` that edits the
   marked assertion and asserts `scoreEscalation` reports `humanRequired` with `signals.markedInvariant` naming the
   file, plus a control diff that edits an unmarked line of the same file and does not raise
   `signals.markedInvariant`. It fails before the marker exists because `signals.markedInvariant` is absent then,
   even though `humanRequired` is already true (the file is `leash: 'spec'`) — so it proves the marker, not the path.
2. This item closes only the seeding — it does not close the reclassification.
