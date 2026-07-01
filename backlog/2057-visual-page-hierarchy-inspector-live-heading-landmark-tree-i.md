---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Visual page-hierarchy inspector: live heading + landmark tree in the dev browser

A dev-browser/explorer tool that renders a page's heading + landmark hierarchy live, reading [role=heading]+aria-level and landmark roles (not tags) — surfaces structure, skipped heading levels, and missing landmarks. Fits the dev-browser tooling family (epic #1522). Surfaced during #2028 (host-is-node headings make role-aware structure tooling the right substrate).
