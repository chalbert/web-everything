---
type: idea
workItem: story
size: 3
parent: "1073"
status: resolved
blockedBy: ["1080"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "plateau-app:src/vision-review/vision-review.ts"
tags: []
---

# Review / tag / train UI for the Tier-2 vision model

Slice E of #1073: a human-in-the-loop, PER-SCREENSHOT UI — you review one captured screenshot at a time, REVIEW the Tier-2 model's rich output on it, TAG ground truth directly on that screenshot (draw/label element-regions, correct the description/tags), and feed TRAINING — the labeling surface that produces the tagging/element-detection corpus slice B (#1081) evals against and the VLM trains on. The Tier-2 analogue of the critique review surface #1036 (same comment/correct/persist-as-labeled-pair pattern); a plateau-app product surface, vision stays a Plateau no-leakage service (#475). Blocked by #1080 (tags against the rich-output contract). Not a decision — a build.

## Progress (2026-06-19) — resolved

Shipped as a plateau-app surface at route `/vision-review` (`plateau-app:src/vision-review/`), glue-only per the plateau cardinal rule:

- **Data layer** — `plateau-app:src/vision-review/data.ts` (pure, 14 unit tests in
  `plateau-app:src/vision-review/data.test.ts`): the label shape MIRRORS slice A's WE Tier-2 contract
  (#1080 `normalizeRichOutput`) — `{ description, tags, regions }`, region `{ label, box }`, `box`
  normalized `{ x, y, w, h }` in 0..1 — so a corrected record IS a labeled training pair. Plus
  pixel-drag⇄unit-box conversion (handles backward drags + edge clamp), tag dedup, localStorage persist.
- **UI** — `plateau-app:src/vision-review/vision-review.ts` (`mountVisionReview`): per-screenshot review
  of the model's output, edit description/tags, **drag on the screenshot to add an element-region** and
  label it, Prev/Next through the queue, Save → persists the training pair (localStorage), Copy pair,
  Revert-to-model. `plateau-app:src/vision-review/seed.ts` holds a throwaway self-contained queue
  (inline-SVG screenshots); the real corpus source + write endpoint are a parked later phase.
- **Wired** into `plateau-app:src/main.ts` + `plateau-app:index.html` (nav + route + breadcrumb),
  mirroring the intent-configurator pattern.
- **Verified by observation** — headless Playwright (isolated, bypassing an unrelated pre-existing
  Vite-overlay from a broken sibling file): renders the model's 3 regions/4 tags, drag adds a region
  (3→4 boxes), tag add works, Save persists 4 regions + 5 tags under the screenshot id, Next advances to
  the second screenshot. Region-annotation logged as a gap in `plateau-app:MISSING_BLOCKS.md`.

The corpus this accumulates is what slice B (#1081) evals against. Tag types match slice A's envelope.
