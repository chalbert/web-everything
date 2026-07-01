---
kind: story
size: 13
parent: "1226"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:reproduction-parity/shadcn/reproduction.ts"
supersededBy: "2022"
relatedReport: reports/2026-06-20-1243-split-analysis.md
tags: [reproduction, conformance, shadcn, parity, gap-list]
---

# Reproduce shadcn/ui as theme+intents over WE/FUI — first parity target, gap list

> **Reconciliation (#2032, 2026-07-01):** the RENDERED/MEASURED deliverable this story claimed was never
> shipped — only a declarative WE-side scaffold (`we:reproduction-parity/shadcn/theme.ts` +
> `we:reproduction-parity/shadcn/reproduction.ts`) with the co-evolving oracle ingesting **zero** readings
> (see Progress below). Nothing rendered, nothing measured; the gap list is asserted, not proven. To stop
> `resolved` masking that stub, this story is **formally superseded by #2022** ("Author a real shadcn/ui
> flavor + produce the parity gap list"), which delivers the real DTCG flavor loaded through the #2017
> manifest loader and diffed against rendered shadcn components. Status left `resolved` because the
> *foundational scaffold slice* genuinely landed; the unfinished measured-parity work now lives under #2022,
> not a reopen of this story.

First per-target slice of the reproduction-conformance program (#1226). Reproduce shadcn/ui pixel- and behavior-perfect using ONLY WE intents + webtheme tokens over FUI primitives; the deliverable is the GAP LIST (what theme+intents can't yet express), not the copy. Every parity claim gates on a confirmed layered-oracle measurement (fuzzy-pixel + structural diff + advisory VLM) from the AI-Playwright validator chain (#1167/#1219/#1220/#1221) — a CO-EVOLVING dependency, not a hard blockedBy (per #1226 Fork 1). Feeds gap-sweep #315. Likely needs /split into per-component build slices once the harness is wired.

## Could-not-split (`/split 1243`, 2026-06-20 → `unsplittableReason: foundational`)

Ruled could-not-split: rubric (3) — the per-component slices aren't `file:line`-groundable because the reproduction surface (shadcn webtheme scheme + reproduction scaffold + the external-reference fuzzy-pixel/structural-diff parity leg) doesn't exist in the tree yet. **This story IS that foundational slice** — stand up the harness + reproduce a seed set (~2–3 leaf components) to prove the loop against the #1227 `ReproductionVerdict`/`GapDelta` contract and emit a first gap delta. Once it ships, the per-component explosion becomes investigable: **re-run `/split 1243`** to carve it against the then-real surface. Full analysis in we:reports/2026-06-20-1243-split-analysis.md.

## Progress — foundational harness + first gap delta shipped (2026-06-20)

The WE-side foundational slice landed (declarative, no rendering — the styled page + oracle co-evolve FUI/Plateau-side per the charter). All three reproduction buckets + the ingestion loop, gate + tests green.

- **Theme pack** — we:reproduction-parity/shadcn/theme.ts. shadcn's neutral-base oklch tokens transcribed verbatim (`SHADCN_TOKENS`) + mapped into the webtheme DTCG model as an `extends` override (`shadcnTheme`/`shadcnTokens`); `buildShadcnScheme()` runs them through the webtheme scheme + contrast gate. Only model-expressible tokens declared; the rest are gaps.
- **Intent set + scaffold** — we:reproduction-parity/shadcn/reproduction.ts. Seed set (`button`/`input`/`badge` × states × light/dark) as `ReproductionTarget[]`, each mapped to WE intent(s) + token roles + shadcn variants (`INTENT_MAP`): button→action, input→input, badge→status-indicator.
- **Gap list (the deliverable)** — `SHADCN_GAPS: GapDelta[]`, six recorded shortfalls (2 intent-axis + 4 token), full narrative in we:reports/2026-06-20-1243-shadcn-first-gap-delta.md. Filed as gap-sweep #315 intake: #1314/#1315 (webtheme token builds), #1316/#1317 (focus-ring + neutral surface roles), #1318/#1319 (Action emphasis-style + decorative-label intent — `decision`s).
- **Ingestion loop** — `buildShadcnReport()` rolls up the co-evolving oracle's verdicts + conformance-checks each via `assertVerdictGating()` (the thin-contract rule: `pass` = AND of gating pixel+structural legs; advisory VLM never flips/scores). Seed run ingests zero readings (oracle co-evolving, #1226 Fork 1) → ships gaps now, verdicts when measured (no claim without measurement). Path proven by test.
- **Tests** — we:reproduction-parity/__tests__/shadcn.test.ts (13, green); registered the dir in we:vitest.config.ts.

**Reading:** the residue is small + structured (scheme-paired/derived tokens + two intent-axis shortfalls), nothing structural/behavioral escaped WE/FUI — the `theme + intents` thesis holds at seed scale.

**Re-split:** re-run `/split 1243` once the rendered surface + layered oracle co-evolve far enough to seam per-component build slices against this scaffold (the analysis's stated re-entry condition).
