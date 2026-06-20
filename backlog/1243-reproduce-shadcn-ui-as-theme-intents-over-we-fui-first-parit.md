---
kind: story
size: 13
parent: "1226"
status: open
dateOpened: "2026-06-20"
relatedReport: reports/2026-06-20-1243-split-analysis.md
unsplittableReason: foundational
tags: [reproduction, conformance, shadcn, parity, gap-list]
---

# Reproduce shadcn/ui as theme+intents over WE/FUI — first parity target, gap list

First per-target slice of the reproduction-conformance program (#1226). Reproduce shadcn/ui pixel- and behavior-perfect using ONLY WE intents + webtheme tokens over FUI primitives; the deliverable is the GAP LIST (what theme+intents can't yet express), not the copy. Every parity claim gates on a confirmed layered-oracle measurement (fuzzy-pixel + structural diff + advisory VLM) from the AI-Playwright validator chain (#1167/#1219/#1220/#1221) — a CO-EVOLVING dependency, not a hard blockedBy (per #1226 Fork 1). Feeds gap-sweep #315. Likely needs /split into per-component build slices once the harness is wired.

## Could-not-split (`/split 1243`, 2026-06-20 → `unsplittableReason: foundational`)

Ruled could-not-split: rubric (3) — the per-component slices aren't `file:line`-groundable because the reproduction surface (shadcn webtheme scheme + reproduction scaffold + the external-reference fuzzy-pixel/structural-diff parity leg) doesn't exist in the tree yet. **This story IS that foundational slice** — stand up the harness + reproduce a seed set (~2–3 leaf components) to prove the loop against the #1227 `ReproductionVerdict`/`GapDelta` contract and emit a first gap delta. Once it ships, the per-component explosion becomes investigable: **re-run `/split 1243`** to carve it against the then-real surface. Full analysis in we:reports/2026-06-20-1243-split-analysis.md.
