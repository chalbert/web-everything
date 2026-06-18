# Design-system creator/assembler — open-core tiering prior-art survey (prep for #775)

**Date:** 2026-06-16 · **Decision:** [#775](../backlog/775-design-system-creator-assembler-open-core-layering-simple-fu.md) (parent epic [#746](../backlog/746-block-explorer-interactive-fui-block-workbench.md), Block Explorer) · **Builds on:** [#747](../backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog.md) (the manifest the creator emits), [#091](../backlog/091-web-docs-as-a-service-plateau/) (open-core-by-usage principle), [#751](../backlog/751-embedded-theme-design-system-creator-plateau/) (the full Plateau creator) · **Research topic:** `/research/design-system-creator-open-core-tiering/`

## The question

#747 ratified the *format* a design system is (a config-flavor manifest `{ extends, themeTokens, intentDefaults?, traitDefaults? }`). #775 must settle the **open-core tiering of the tool that authors it**: a SIMPLE assembler embedded natively in FUI (free) and the FULL creator offered as a Plateau product (#751, the upsell). The framing is settled-by-construction; the open question is **exactly where the free/paid line sits — which knobs are free.** Per design-first step 1 this surveys how comparable design-system / token / theme-builder tools draw their free/paid line, so the call reuses the market's vocabulary instead of coining a tiering cold.

## What the survey found

### 1 · The market draws the *same* free/paid line across every theme/token tool

| Tool | Free tier | Paid tier | Where the line falls |
|---|---|---|---|
| **Tokens Studio for Figma** (closest analog) | manual token authoring, edit, **git sync**, export | multi-file sync, **connect tokens to Figma Styles**, advanced theme management, **branch switcher**, composition tokens, collaboration | manual authoring + open export = free; **managed integration + multi-file/branching + collaboration = paid** |
| **Material Theme Builder** (Google) | full manual authoring, **DTCG/DSP import + export**, Style Dictionary codegen | — (free) | deterministic authoring + standard-format import/export is entirely free |
| **Style Dictionary** | OSS — DTCG-compatible transform/build, unlimited | — (free) | deterministic token transformation is a free primitive |
| **Codia / AI screenshot→tokens** | 5 free credits (trial) | **$49 per image** after, metered per-call | **AI/vision is per-call metered — never the free floor** |
| **Supernova / zeroheight / Knapsack** (DS platforms) | a free/starter tier | $20–$399/mo — **hosted persistence, collaboration, governance, seats** | manual/local = free; **hosting + team + governance = paid** |

Sources: [Tokens Studio pricing](https://tokens.studio/pricing) + [Pro pricing](https://tokens.studio/pro-pricing), [Material Theme Builder](https://m3.material.io/blog/material-theme-builder), [Style Dictionary DTCG utils](https://styledictionary.com/reference/utils/dtcg/), [Codia AI Design](https://www.figma.com/community/plugin/1329812760871373657/codia-ai-design-screenshot-to-editable-figma-design), [Supernova (Capterra)](https://www.capterra.com/p/266448/Supernova/), [zeroheight pricing](https://www.vendr.com/marketplace/zeroheight).

### 2 · The line is consistent and tri-partite

Three properties decide free vs paid, and every surveyed tool agrees:

1. **Manual, deterministic, locally-runnable authoring → FREE.** Picking tokens, setting values, editing by hand, exporting to a standard format. Universal free floor. Material Theme Builder gates *nothing* here; Tokens Studio's free tier is exactly this.
2. **Per-call variable-cost automation (AI/vision) → PAID, metered.** Screenshot→theme and AI generation are *always* metered per-call (Codia's $49/image is the clearest case). No tool offers unbounded AI on a flat free tier.
3. **Managed integration + hosted persistence + collaboration → PAID.** Figma-Styles sync, multi-file/branching, cloud save, sharing, team/governance. This is the Tokens Studio Pro line and the whole of the zeroheight/Supernova/Knapsack paid tiers.

### 3 · Open-standard import is free; proprietary-vendor integration is paid

The instructive split inside "import": **DTCG import is free everywhere** (Material Theme Builder imports DTCG/DSP free; Style Dictionary is OSS) — it's parsing an open standard you already own. **Figma-Styles connection is the canonical Pro feature** in Tokens Studio — it's a proprietary-vendor *managed integration* needing API auth, not a file parse. So the free/paid line inside ingest runs along **open-standard format (free) vs proprietary-vendor managed integration (paid)**, not "any import = paid."

### 4 · How this maps onto WE's existing rulings — the line is almost entirely *forced*

The market's tri-partite line lands on top of rulings WE already made:

- **The two-tier split itself is forced by [#091](../backlog/091-web-docs-as-a-service-plateau/).** #091 ratified the constellation decomposition: FUI ships *enough free composable primitives to self-host* (the "cancel-and-self-host always holds" floor), and the complete product is a `plateau-app` open-core offering. A free FUI-native assembler + a full Plateau creator (#751) *is* that pattern applied — not a fork.
- **Manual authoring must be free — the self-host floor.** Authoring a #747 manifest by hand (the manifest is a WE *standard* artifact) must be in the free tier or the self-host promise breaks. #751 already frames the simple path as localStorage + no sign-in.
- **Vision/screenshot→theme is forced PAID** by [#475](../backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) (vision is a Plateau service consumed as a no-leakage client, never a WE capability) and the [linear-cost-with-revenue rule](../backlog/513-train-quantize-the-distilled-verdict-classifier-10mb-onnx-st.md) (no uncapped per-call cost inside the free floor) — which the market confirms (per-call metered everywhere).
- **Cloud persist/share/collaboration is forced PAID** by #751's sign-in-to-persist upsell and the universal market line (Tokens Studio Pro, zeroheight, Supernova).

So three of the four boundary segments are forced. **The only genuinely-open call is the *principle* that governs future knobs, and the one knob it most contests: deterministic format import (DTCG vs proprietary Figma).**

## Recommendation (forks in #775)

1. **Partitioning principle = the capability-cost line.** Free = any deterministic, fixed-cost, locally-runnable authoring that produces a self-hostable #747 manifest; paid = variable per-call cost (vision/AI) **or** hosted persistence/collaboration/managed-vendor integration. This is the market's line *and* the composition of #091 (self-host floor) + #475/linear-cost (no per-call cost in the floor) + minimize-lock-in (the free floor speaks the open format). *High confidence — it is the composition of existing rulings, not a new judgment.* Rejected: "manual-only free, any import paid" (contradicts the universal free DTCG import + the self-host floor); quota/feature-count gating of the free tier (broken — quota-gating the self-host floor violates cancel-and-self-host).
2. **DTCG import free; proprietary-Figma ingest paid (Plateau).** The free FUI floor's import path is **DTCG** (the open standard — free everywhere in the market, and the format #747 already references); **Figma ingest is a paid Plateau capability** (a managed proprietary-vendor integration needing API auth — the Tokens Studio Pro line). *Med-high confidence.* Rejected alternative: Figma import also free via BYO-token — coherent under the cost rule, but adds vendor-API surface to the free floor for a proprietary format, and the market consistently gates Figma integration as Pro; defer a BYO-token Figma importer to a later item if demand appears.

## Cross-references

- Decision: [#775 — design-system creator/assembler open-core layering](../backlog/775-design-system-creator-assembler-open-core-layering-simple-fu.md)
- Format the creator emits: [#747 — design system = theme + intents bundle](../backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog.md) (resolved)
- The full Plateau creator (paid tier): [#751 — embedded theme/design-system creator](../backlog/751-embedded-theme-design-system-creator-plateau/)
- Open-core principle: [#091 — Web Docs as a Service](../backlog/091-web-docs-as-a-service-plateau/) (self-host floor, open-core by usage)
- Vision = no-leakage Plateau service: [#475](../backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/); reused pipeline [#086](../backlog/086-mockup-to-standard-code-tool/)
- Tiering-mechanics precedent: [/research/web-docs-open-core-tiering/](/research/web-docs-open-core-tiering/) ([#428](../backlog/428-web-docs-open-core-tiering-mechanics-metered-unit-threshold-.md))
- Epic: [#746 — Block Explorer](../backlog/746-block-explorer-interactive-fui-block-workbench.md)
