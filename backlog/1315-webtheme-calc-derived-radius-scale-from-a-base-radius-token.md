---
kind: story
size: 3
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webtheme
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme: calc-derived radius scale from a base radius token

Reproduction-conformance gap #2 from shadcn (#1243). shadcn derives its radius scale by calc() offsets of one base (--radius-md = calc(--radius - 2px), sm/lg/xl likewise); webtheme radius is a flat, independent scale with no way to encode the derived relationship, so the scale drifts from the base when a project re-themes the base radius. Allow a radius token to express a calc-derived offset of a base radius (DTCG alias + offset, compiled to native calc()). Surfaced by reproduction #1243, feeds gap-sweep #315.
