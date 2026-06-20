---
kind: story
size: 13
parent: "1226"
status: open
dateOpened: "2026-06-20"
tags: [reproduction, conformance, shadcn, parity, gap-list]
---

# Reproduce shadcn/ui as theme+intents over WE/FUI — first parity target, gap list

First per-target slice of the reproduction-conformance program (#1226). Reproduce shadcn/ui pixel- and behavior-perfect using ONLY WE intents + webtheme tokens over FUI primitives; the deliverable is the GAP LIST (what theme+intents can't yet express), not the copy. Every parity claim gates on a confirmed layered-oracle measurement (fuzzy-pixel + structural diff + advisory VLM) from the AI-Playwright validator chain (#1167/#1219/#1220/#1221) — a CO-EVOLVING dependency, not a hard blockedBy (per #1226 Fork 1). Feeds gap-sweep #315. Likely needs /split into per-component build slices once the harness is wired.
