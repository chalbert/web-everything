---
kind: story
size: 3
parent: "1552"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:trainable-judge/contract.ts"
tags: []
---

# Trainable-judge capture format — the model-agnostic feedback corpus schema

Define the durable, model-agnostic corpus schema the trainable judge (#1553) learns from: per labeled state, {frozen-frame PNG, domSnapshot, stateId, verdict, composite spatial anchor (bbox primary / a11y-role+text tiebreak / DOM-path debug-only), label vocabulary}. Capture BOTH feedback channels — verdict-on-candidate (precision/severity) and missed-issue authoring (the only recall channel). This schema is the never-lose asset (embeddings are a re-derivable cache, never stored as the asset); it seeds #489 frame/verdict pairs and is the train/benchmark split point. Foundational — blocks the store, benchmark, and learning slices. Per we:docs/agent/platform-decisions.md#trainable-judge.

## Progress (resolved 2026-06-22, batch-2026-06-22-1580-1579-1030-1564)

Authored the WE-owned, type-only corpus contract (the only WE deliverable — #1553 ruling 4: WE owns the
contract, the store/learning/benchmark are Plateau impl, #1282):

- **`we:trainable-judge/contract.ts`** — the canonical pure-contract module (zero runtime emit). Defines the
  model-agnostic corpus: `FrozenFrame` (stateId-keyed PNG `FrameRef` + `domSnapshot`, no spatial replay),
  the two composable feedback channels as a discriminated union `FeedbackLabel = VerdictLabel | MissedIssueLabel`
  (verdict = precision/severity; missed-issue = the only recall channel), the composite `SpatialAnchor`
  (bbox primary · a11y-role/text tiebreak · DOM-path debug-only), `LabelVocabulary` (versioned + open),
  `CorpusRecord` (the never-lose asset; carries `split: train|benchmark`), and `EmbeddingCacheKey`
  (`(encoderId, frameHash)` — documented as re-derivable cache, **never** the asset, zero-data-loss seam).
  Signal shapes mirror the explorer's own (`stateId` = #1168 DOM signature, `BBox` = Tier-2 `VisionRegion.box`,
  `JudgeSeverity` = explorer `Severity` + advisory).
- **`we:contracts/trainable-judge.ts`** + **`we:contracts/package.json`** `./trainable-judge` export — the
  `@webeverything/contracts/trainable-judge` type-only re-export (the WE→FUI/Plateau arrow), same pattern as
  `./dockable` / `./analytics`. No `vite.config` alias (no WE runtime consumer; alias is added only when WE
  itself imports a contract).

Unblocks #1581 (corpus store), #1582 (benchmark), #1583 (learning), #1584 (eval). `tsc --noEmit` clean;
`check:standards` 0 errors.
