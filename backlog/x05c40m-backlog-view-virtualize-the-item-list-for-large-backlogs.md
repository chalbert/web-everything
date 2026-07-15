---
kind: story
size: 3
parent: "2505"
status: open
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: virtualize the item list for large backlogs

Virtualize the item list so only the visible rows live in the DOM. A real backlog is thousands of rows; rendering them all makes the list janky to scroll and slow to filter / sort. Render a windowed slice tied to scroll position while keeping the full ordered / filtered set in state.

**Acceptance:** the list scrolls smoothly at thousands of items; row selection, filtering, and sorting stay correct with virtualization on; the count and keyboard focus behave as if the whole list were present.
