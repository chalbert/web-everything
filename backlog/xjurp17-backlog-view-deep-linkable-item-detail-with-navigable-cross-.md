---
kind: story
size: 5
parent: "2505"
status: open
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: deep-linkable item detail with navigable cross-links

Make item detail deep-linkable and its cross-links navigable. Give the detail its own route (`/backlog/:id`) so an item is directly linkable and survives a reload, and turn the relationships the backlog encodes — parent / epic, blockedBy, children — into in-view links that select the referenced item instead of dead text. The backlog is a graph; this lets you walk it from inside the console.

**Acceptance:** `/backlog/:id` opens that item's detail on load; parent / blockedBy / children render as links that navigate within the view; an unknown id shows an honest not-found.
