---
type: decision
workItem: story
size: 5
status: resolved
parent: "746"
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
relatedProject: webdocs
relatedReport: reports/2026-06-16-design-system-creator-open-core-tiering.md
preparedDate: "2026-06-16"
crossRef: { url: /backlog/751-embedded-theme-design-system-creator-plateau/, label: "Plateau-embed creator — the full tier (#751)" }
tags: [webdocs, block-explorer, design-system, theme-creator, open-core, plateau-embed, fui, monetization]
---

# Design-system creator/assembler — open-core layering: free + paid tiers of one Plateau-owned tool

> **How to read this ruling — monetization ≠ standard (soft-accepted, revisitable).** Unlike a WE *standard* — which must be strong and stable — this is a *monetization* ruling: **soft-accepted and explicitly revisitable** as we collect usage data and the market evolves. The partition *principle* (Fork 1's cost/hosting rule) is fixed firmly because it is what generalizes; specific knob placements are **provisional**, to be re-tuned with evidence. This framing is itself why Fork 2 resolves to the structural cost/hosting axis over the shifting "proprietary" one — pricing should not rest on a category that can change overnight.

**Grounding (✓ ready to ratify):** [#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/) settled *what a design system is* (a config-flavor manifest); this item settles the **open-core tiering of the tool that authors it**. Surveyed the theme/token/design-system-builder market (Tokens Studio, Material Theme Builder, Style Dictionary, Codia AI screenshot→tokens, Supernova/zeroheight/Knapsack) and published `/research/design-system-creator-open-core-tiering/` (report: `we:reports/2026-06-16-design-system-creator-open-core-tiering.md`). The survey **collapsed most of the framing**: the market draws one universal tri-partite line, and mapped onto WE's existing rulings **three of the four boundary segments are forced invariants** — the two-tier split itself, manual-authoring-free, vision-paid, persist/share-paid. **Three genuine forks** remain — the *partitioning principle* (Fork 1), the *free-floor format identity* (Fork 2 — reframed; `check:health` G4 correctly caught the original "deterministic import" framing as a prioritization-in-fork's-clothing false fork), and the *locus of the assembler* (Fork 3 — surfaced in discussion: should Plateau own the assembler end-to-end across both tiers, rather than a FUI-native free tool) — each with a **bold** default below.

## The axis

The #747 manifest needs an authoring tool. Per the constellation ([#091](/backlog/091-web-docs-as-a-service-plateau/)) the capability decomposes by tier: a **free tier** (no sign-in — pick tokens + set intent defaults + presentational trait defaults, emit a #747 manifest, localStorage) and a **paid tier** ([#751](/backlog/751-embedded-theme-design-system-creator-plateau/) — hosted persist/share, live Figma sync, screenshot→theme). Output of both is a #747 manifest that feeds the live switcher ([#749](/backlog/749-live-theme-design-system-switcher/)). What's undecided is **exactly where the free/paid line sits (which knobs are free)** and **who owns the tool** — the tool's locus was originally assumed FUI-native; Fork 3 settles it (→ Plateau-owned, both tiers).

The market draws the line **tri-partite and identically across every surveyed tool** (research finding 2): (1) manual deterministic locally-runnable authoring → **free**; (2) per-call variable-cost automation, AI/vision → **paid, metered** (Codia's ~$49/image is the clearest case); (3) managed integration + hosted persistence + collaboration → **paid** (the Tokens Studio Pro line; the whole of the zeroheight/Supernova paid tiers). Inside "import" the split is **open-standard format (DTCG — free everywhere) vs proprietary-vendor managed integration (Figma-Styles — the canonical Pro feature)**.

Mapped onto WE's existing rulings, the boundary is **almost entirely already-decided**:

- The **two-tier split itself** is the #091 constellation decomposition applied — FUI ships *enough free composable primitives to self-host* (the cancel-and-self-host floor: [#091 ruling table](/backlog/091-web-docs-as-a-service-plateau/)), the complete product is a `plateau-app` open-core offering (#751). Not a fork.
- **Manual authoring must be free** — the manifest is a WE *standard* artifact ([#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/): `{ extends, themeTokens, intentDefaults?, traitDefaults? }`); hand-authoring it must be in the free tier or the self-host promise breaks. #751 already frames the simple path as **localStorage + no sign-in**.
- **Vision/screenshot→theme is forced PAID** by [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) (vision is a no-leakage Plateau service, never a WE capability — `mockupAnalyzer` already consumes it via the `CustomVisionProvider` no-leakage seam, [we:blocks/renderers/upgrader/analyzers/mockupAnalyzer.ts](../blocks/renderers/upgrader/analyzers/mockupAnalyzer.ts)) + the linear-cost-with-revenue rule (no uncapped per-call cost inside the free floor).
- **Cloud persist/share/collaboration is forced PAID** by #751's sign-in-to-persist upsell and the universal market line.

### Per-fork classification (the 7-question pass)

**(1) Layer** — a **monetization/tiering decision**, not a new standard artifact: it partitions *which capabilities of an authoring tool* land in the free tier vs the paid tier. The manifest format it tiers is already a WE standard (#747); the tool itself is a **`plateau-app` product spanning both tiers** (per #091 + Fork 3-A), while FUI ships the **primitives + #749 switcher** that hold the self-host floor. **(2) Protocol or intent dimension?** — neither; tiering is a product/business concern, never a protocol or a UX intent. **(3) Expose the whole axis?** — no: this is a fixed partition (free vs paid), not an author-customizable dimension. **(4) Fixed mechanic or dimension?** — a fixed mechanic (the line is a product decision). **(5) DI-injectable?** — n/a (not runtime config). **(6) Most-permissive default?** — the free floor takes the *widest deterministic/self-hostable* surface the rules allow (every knob that is fixed-cost and locally-runnable), so a self-hoster is never gated on core authoring (honours the self-host floor). **(7) Seam between layers?** — yes, the **free-tier / paid-tier seam within one tool**; honours separation — the free tier emits a manifest the paid tier is a superset of, never a fork of (one format, one tool, two tiers).

## Recommended path at a glance

| Concern | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Two-tier open-core split (free + paid tiers) | **forced — #091 constellation** | — *(not a fork)* | High |
| Manual authoring (tokens + intents + presentational traits → manifest, localStorage) | **forced FREE — self-host floor** | — *(not a fork)* | High |
| Vision / screenshot→theme | **forced PAID — #475 + linear-cost** | — *(not a fork)* | High |
| Cloud persist / share / team | **forced PAID — #751 + market** | — *(not a fork)* | High |
| **Partitioning principle** *(Fork 1)* | **capability-cost line** (deterministic+local = free; per-call cost OR hosted/collab/managed = paid) | manual-only-free; quota-gating | High |
| **Free-floor format identity** *(Fork 2)* | **B — cost/hosting line** (free local parse of any format incl. Figma-file; paid = hosted sync/per-call) | A — open-formats-only (proprietary → paid) | ~80% |
| **Locus of the assembler** *(Fork 3)* | **A — Plateau owns both tiers (one product); FUI keeps primitives+switcher** | B — FUI owns free assembler, Plateau = paid only | ~72% |

## Ratify (forced invariants — not weighed)

- **The two-tier open-core split.** A free tier (no sign-in, localStorage) + a paid tier (#751 upsell) *is* the #091 constellation decomposition applied (open-core by usage). What is forced is the *split itself*, not where the tool lives — **the assembler's locus is decided by Fork 3-A, not assumed here.** Per that ruling it is **one Plateau-owned product spanning both tiers**; FUI's contribution to the free self-host floor is the **primitives + the #749 switcher**, *not* the authoring tool. *(The card's original "FUI-native assembler" wording — in the old title and "The axis" — is superseded by Fork 3-A.)*
- **Manual authoring is free.** Pick/edit theme tokens, set intent defaults (density/motion/surface), set presentational trait defaults (radius/feel), emit a #747 manifest, save to localStorage, apply live via the #749 switcher — all free, no sign-in. Forced by the self-host floor (the manifest is a WE standard artifact) and already framed by #751.
- **Vision/screenshot→theme is paid (Plateau).** Forced by #475 (vision = no-leakage Plateau service) + the linear-cost rule (per-call cost can't sit in the free floor) — and the market meters it per-call universally.
- **Cloud persist / share / collaboration is paid (Plateau); localStorage is the free floor's persistence.** Forced by #751's sign-in-to-persist upsell and the universal market line.

## Supported by default (not decisions)

- **Export the manifest from the free tier** — the assembler's output is a portable #747 manifest the author owns and can self-host; gating export would break the floor.
- **Apply-live via the #749 switcher** — the free assembler's manifest renders immediately on the real block; it is the docs surface, not a paid feature.
- **"Upgrade to Plateau" lead-gen CTA in the free assembler** — the upsell seam (#751's sign-in-to-persist) is present in the free tier by default; it is the funnel, not a fork.

## Fork 1 — The partitioning principle (the rule that decides every future knob)

**Crux:** new authoring capabilities will keep arriving; rather than re-deciding each ad hoc, fix the *rule* that assigns a knob to free or paid. The market and WE's rulings already imply one (research findings 2–4).

- **A. The capability-cost line.** Free = any **deterministic, fixed-cost, locally-runnable** authoring that produces a **self-hostable** #747 manifest; paid = anything with **variable per-call cost** (vision/AI) **or** that requires **hosted persistence / collaboration / a managed-vendor integration**. This is the market's universal line *and* the composition of #091 (self-host floor) + #475/linear-cost (no per-call cost in the floor) + minimize-lock-in (the free floor speaks the open format). **← default.**
- **B. The manual-vs-assisted line.** Free = hand authoring only; paid = *any* automation or import (DTCG, Figma, vision alike).
- **C. Quota / feature-count gating.** Free = N presets / N tokens; paid = unlimited.

**Default: A.** It is a composition of existing rulings, not a new judgment, and it generalizes: every future knob is classified by two yes/no tests (per-call cost? hosted/managed?) with no fresh debate. **Clause (settled by Fork 2):** "managed-vendor integration" means *hosted / credential-holding / per-call cost* only — **not** "touches a proprietary format." A deterministic local parse of any format (open or proprietary) is free; the structural cost/hosting property is the gate, never proprietary-ness (a shifting category — see the soft-accept note above). *Rejected:* **C** is the *broken* branch — quota-gating the free floor's core authoring directly violates "cancel-and-self-host always holds" (#091); a self-hoster hitting a token cap can't self-host. **B** contradicts the universal market (DTCG import is free everywhere — Material Theme Builder, Style Dictionary) and the self-host floor (importing your own open-standard tokens must not be gated); it also mis-classifies a deterministic file-parse as a paid "magic" feature.

## Fork 2 — Where does proprietary-format import sit: the free floor's *identity*

**Crux (reframed — `check:health` G4 caught the original framing as a false fork).** The first draft posed this as "A: Figma paid vs B: Figma free, B *deferred not broken*" — but "defer it as a later slice for marginal benefit" is prioritization in a fork's clothing (a fork decides the best end-state on merit; cost/effort is never a branch): if a branch isn't *broken* you don't reject it, you either support it or you've drawn a real merit line. The genuine, non-prioritization fork underneath is about **what the free floor's identity is**, and it's a true either/or (a knob is free *or* paid — you can't "support both" a price line).

First, split the contested case — "Figma" is two capabilities, and one is already settled:
- **Figma *live API / OAuth sync*** — hosted, credential-holding, ongoing managed integration → **paid Plateau**, unambiguous under Fork 1-A (and under either branch below). Not contested.
- **Figma *variables-export file parse*** — a deterministic, fixed-cost, **local** parse, no hosting, no per-call cost. By Fork 1-A's literal cost rule this is *free*. This is the only thing the fork contests.

- **B. Cost/hosting line — Fork 1-A applied literally.** A deterministic local parse is free *regardless of format origin*, so the Figma variables-export **file** import is **free**; only Figma **live sync** is paid. Principle: don't gate a deterministic local file-parse, and *ingesting* a proprietary format into the open #747 manifest is adapter-normalization — pro-open, not lock-in (the adapter-as-normalization-hub principle: ingest incumbents bottom-up into the open pivot). **← default.**
- **A. Format-identity line — open-standard formats only in the free floor.** Free imports **DTCG** only; *any* proprietary-vendor format — including the local Figma-file parse — lives in **paid Plateau**. Principle: "free = open formats, paid = vendor convenience" as a marketing line.

**Default: B (~80%).** The deciding argument (from the call): **"proprietary" is an unstable axis** — a license can change, Figma could open its format, DTCG adoption moves — so pricing on *proprietary-ness* bakes in a brittle, shifting distinction. The price line must be drawn on a **structural** property that doesn't drift: *does it cost us per-use, or require us to host / hold credentials?* That is exactly Fork 1-A's cost/hosting rule, applied without a format-identity overlay. It also cuts the same way the market does — the universal "Figma = Pro" gate is on **hosted sync**, not on a local file parse — and a free local Figma-file import is *pro-open* (it helps authors escape Figma into the open #747 format). *Rejected:* **A** prices on a category that can change overnight and mis-reads the market signal (it's the hosting, not the format, that's gated). **This resolves Fork 1-A's clause: "managed-vendor integration" means *hosted / credential-holding / per-call* only — never "anything proprietary."**

## Fork 3 — Locus of the assembler (code, not just branding)

**Crux:** the first draft put the free assembler "natively in FUI" and the paid creator in Plateau — *two homes for one product*, the opposite of consolidation. But the assembler is a **served product that *authors* a #747 manifest**, not a self-host *primitive*: the floor is held by **(a)** the hand-authorable open #747 format, **(b)** FUI's open primitives, and **(c)** the open [#749](/backlog/749-live-theme-design-system-switcher/) switcher that *applies* a manifest. The assembler only *produces* manifests — pure convenience **above** the floor; nothing the floor needs lives in it. By #091 a served product → `plateau-app`. So the real question is which repo **owns the assembler's code**, and both the constellation and consolidation point one way.

- **A. Plateau owns the assembler, both tiers, one continuous product.** Code + hosting + branding all Plateau; free tier = no-sign-in + localStorage, paid unlocks persist/sync/vision/Figma *in place* (same surface, a feature gate — this is [#751](/backlog/751-embedded-theme-design-system-creator-plateau/) extended *down* to a free tier, not a separate tool). WE docs embed it via iframe if a live authoring demo is wanted (the sanctioned docs-embed pattern). FUI keeps the primitives + block-explorer workbench ([#809](/backlog/809-block-explorer-workbench-locus/)) + the #749 switcher — i.e. the apply-a-manifest runtime the open/self-host surface needs, **not** the authoring UI. Self-host floor untouched. Full tooling consolidation + one funnel. **← default.**
- **B. FUI owns the free assembler; Plateau owns only the paid creator.** The original framing. *Rejected (not broken, but weaker):* it splits one product across two repos (a free–paid seam), and the FUI-native placement isn't required by the floor — the assembler is a convenience above the floor, not a self-host primitive. A Plateau assembler still dogfoods FUI (it is *built from* FUI primitives, like any plateau-app, so the #777 conformance story is intact).

**Default: A (~72%).** The assembler is a product (→ plateau-app per #091), not a standard or a self-host primitive, so the constellation puts it in Plateau; consolidating both tiers there removes the free–paid seam and matches the funnel goal. *Residual:* if the FUI block-explorer workbench is meant to *contain* the assembler as a panel that argues for FUI — but the inspector and the authoring tool are separable surfaces, so the split is clean.

---

## Ruling (RATIFIED 2026-06-17)

- **Fork 1 → A** — capability-cost line; clause settled (managed = hosted/credential-holding/per-call only).
- **Fork 2 → B** — cost/hosting line: free = deterministic local parse of *any* format incl. Figma-variables-export **file**; paid = hosted sync / per-call / vision. "Proprietary" rejected as a shifting price axis.
- **Fork 3 → A** — the assembler is **one Plateau-owned product spanning both tiers** (free tier = no-sign-in + localStorage; paid unlocks in place); FUI keeps the primitives + #749 switcher that hold the self-host floor, *not* the authoring tool.
- Four forced invariants ratified (two-tier split, manual-authoring-free, vision-paid, persist/share-paid); soft-accept/revisitable framing stamped (monetization ≠ standard — re-tune knob placements with data).
- All three branches survived a final red-team (none violates self-host floor, minimize-lock-in, npm-scope-mirrors-layer, or impl-is-not-a-standard).

**Successor builds (separately prioritized):** #751 (full paid Plateau creator — the superset this scopes), #749 (live switcher both tiers feed), #754 (permalink of a configured view). No new entity graduated — this is a tiering/monetization ruling, not a standard artifact.

## Context

- **Builds on #747** (the manifest format both tiers emit) and **#091** (the open-core-by-usage principle + constellation decomposition this applies). Does not re-open either.
- **Consumed by:** #751 (the full Plateau creator — the paid tier this scopes), #749 (the switcher both tiers' manifests feed), #754 (permalink of a configured view).
- **Prepared 2026-06-16:** prior-art survey + classification done; `/research/design-system-creator-open-core-tiering/` published (report `we:reports/2026-06-16-design-system-creator-open-core-tiering.md`). Two forks at DoR with bold defaults; the other four boundary segments ratified as forced invariants — `✓ ready to ratify`. Making the call is `/next decision`'s job.
