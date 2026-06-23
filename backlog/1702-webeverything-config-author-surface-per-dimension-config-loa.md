---
kind: story
size: 8
status: open
dateOpened: "2026-06-23"
tags: []
---

# webeverything.config author surface + per-dimension config loader/resolver

Build the project author surface ratified by #1662: a single root config keyed per dimension (any key extractable to its own file) plus the per-dimension loader/resolver that composes each dimension's flavor-extends chain (nearest-wins, lazy) and feeds it to that dimension's registry/consumer. Includes the config file format + flavor packaging. Scope: the project-facing config surface and its runtime wiring; the per-dimension strategy registries themselves are owned by #227/#080/#798/theme. Filesystem-colocated per-component scope discovery is a follow-on extension, not in this slice.
