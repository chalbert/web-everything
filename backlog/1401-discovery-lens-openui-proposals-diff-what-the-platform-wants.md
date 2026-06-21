---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
tags: [discovery, lens, openui, platform, standards-in-flight, gap, book-candidate]
---

# Discovery lens — OpenUI proposals diff (what the platform wants to standardize)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **OpenUI** community-group catalogue and active WHATWG/W3C UI proposals. OpenUI
exists to answer "which components/behaviors *should* be standardized," so its research pages (select /
selectlist / customizable-select, popover, anchor positioning, tabs, toggle, tooltip, menu, combobox,
spinner, breadcrumb, …) are a curated list of latent standards with prior-art already gathered. Diff each
against [we:src/_data/intents/](../src/_data/intents/) + [we:src/_data/blocks/](../src/_data/blocks/);
every ❌ / partial → a card (placement-unsure → `decision`). Overlaps the platform-API watch
([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) — coordinate so a
shipped-API and its OpenUI origin don't double-file.

## Do

- List the current OpenUI research/proposal index (cite date).
- For each proposal: covered / partial / ❌ against the registry.
- File a `book-candidate` card per gap; reuse #1257 where the proposal has already shipped as a Baseline API.

## Done when

Every OpenUI proposal has a verdict and each gap is a filed card or dismissed-with-reason.
