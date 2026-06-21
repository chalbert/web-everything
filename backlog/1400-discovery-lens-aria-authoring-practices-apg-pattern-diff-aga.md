---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
tags: [discovery, lens, aria, apg, accessibility, gap, book-candidate]
---

# Discovery lens — ARIA Authoring Practices (APG) pattern diff against the registry

Run the [latent-standard discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **WAI-ARIA Authoring Practices Guide** pattern list (~30 patterns: accordion, alert,
combobox, dialog, disclosure, feed, grid, listbox, menu/menubar, meter, radio-group, slider, spinbutton,
**splitter/windowsplitter**, switch, tabs, toolbar, tree, treegrid, …). Each APG pattern is a behavior
*contract* (roles + keyboard + state), so it maps cleanly to a WE intent/block. Diff each against
[we:src/_data/intents/](../src/_data/intents/) + [we:src/_data/blocks/](../src/_data/blocks/); every ❌ /
partial → a card (placement-unsure → `decision`). High-signal because APG is finite, authoritative, and
a11y-first — `role=separator` is exactly what implied the splitter in
[#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/).

## Do

- Enumerate the current APG pattern index (cite the version/date in the report).
- For each: covered (name the intent/block) / partial / ❌.
- File a `book-candidate` card per ❌ or partial; dismiss with a one-line reason otherwise.

## Done when

Every APG pattern has a covered / partial / ❌ verdict, and each non-covered verdict is a filed card or a
dismissed-with-reason line.
