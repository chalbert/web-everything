---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
tags: [discovery, lens, divergence, meta, gap, book-candidate]
---

# Discovery lens — design-system divergence pass (where incumbents disagree)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline as a **meta-pass over the component data** the /gap-sweep already collects — but inverted. Where
design systems all solve a concern the *same* way, it's a candidate for native/Baseline. Where they
**disagree** (different APIs, models, names for the same job), that divergence marks an *un-abstracted
concern* — a strong candidate for a WE **intent** that abstracts the variants into one contract (the WE
move: standardize the concern, not the variant). Diff the divergence set against
[we:src/_data/intents/](../src/_data/intents/); every un-owned divergence → a card (placement-unsure →
`decision`).

## Do

- From the gap-sweep benchmark data, list concerns where ≥3 systems diverge in model/API.
- For each: does a WE intent already abstract it? covered / partial / ❌.
- File a `book-candidate` card per ❌ framing the divergence as the abstraction opportunity.

## Done when

The divergence set is enumerated, each item verdicted against the intent registry, and each gap is a filed
card or dismissed-with-reason.
