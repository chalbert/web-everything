---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
tags: [discovery, lens, teardown, empirical, gap, book-candidate]
---

# Discovery lens — production-app teardown (inventory real apps, diff registry)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline **empirically**: pick a best-in-class production app, inventory every distinct interaction /
behavior / surface it ships, and diff against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/). Highest-yield, noisiest lens — real apps combine patterns the
abstract taxonomies miss, but a teardown needs deliberate filtering so app-specific quirks don't become
spurious cards. One app per pass.

## Do

- Choose one app (e.g. Linear, Figma, Notion, Stripe dashboard, Gmail, Google Maps); state which.
- Walk it surface-by-surface; list each distinct pattern (not each screen).
- Verdict each: covered / partial / ❌. File `book-candidate` cards only for patterns that are *general*
  (would recur across apps), not app-specific; placement-unsure → `decision`.

## Done when

One app fully walked, each distinct pattern verdicted, generalizable gaps filed as cards, app-specific ones
explicitly set aside with a reason.
