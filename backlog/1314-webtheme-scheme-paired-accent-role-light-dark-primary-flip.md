---
kind: story
size: 3
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webtheme
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme: scheme-paired accent role (light/dark primary flip)

Reproduction-conformance gap #1 from shadcn (#1243). shadcn flips --primary between schemes (light oklch(0.205 0 0) → dark oklch(0.985 0 0)); webtheme color.accent is a single scheme-invariant seed, so a system's dark-mode primary surface can't be expressed without a second theme. Add a scheme-paired accent role (light-dark() on the seed / a dark-accent anchor) so deriveSchemeRuntime tracks both schemes from one theme. Surfaced by reproduction #1243, feeds gap-sweep #315.
