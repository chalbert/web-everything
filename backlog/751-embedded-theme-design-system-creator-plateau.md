---
type: idea
workItem: story
size: 8
status: resolved
parent: "746"
locus: frontierui
blockedBy: ["887", "886", "888", "930"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/workbench/manifestBridge.ts
relatedProject: webdocs
crossRef: { url: /backlog/086-mockup-to-standard-code-tool/, label: "Mockup/screenshot → code (#086)" }
tags: [webdocs, block-explorer, plateau-embed, theme-creator, design-system, lead-gen]
---

# "Your theme" — embed the Plateau design-system creator on the block page and apply it live

The **capstone embed slice** of the creator funnel. Wire a **"Your theme / design system"** button on the
FUI block page that opens the **embedded Plateau creator** (iframe, per the constellation: Plateau owns it,
FUI embeds it) and feeds the author's manifest to the live **#749 switcher** so the created theme applies
to the *real* block immediately — the zero-friction lead-gen seam.

This slice is the integrating capstone: the creator itself (scaffold #886, authoring #888, import #889) is
built Plateau-side; this wires it onto the block page and closes the loop back to the live render.

## Build

- "Your theme" button on the block page → opens the embedded Plateau creator (iframe embed).
- The manifest the author produces in the creator is applied live via the #749 switcher (per the
  transport decided in **#887**).

## Acceptance

- [ ] The button opens the embedded Plateau creator (the #886/#888 surface).
- [ ] A theme authored in the embed applies live to the block via the #749 switcher.
- [ ] The sign-in-to-persist upsell (built in #886) is visible in the embed.

## Notes

Per the managed-offering constellation layering (#091) and the #775 ruling, the creator is a **Plateau**
offering FUI embeds — not built in FUI. This card owns **only the block-page embed + the live-apply
handoff**; the creator build lives in its Plateau siblings.

## Sliced (2026-06-17, `/split 751`)

Was a size-13 catch-all ("not batchable, needs slicing"). Split under the existing parent #746 (kept a
story, not nested as an epic, since #746 is already the epic). The creator build and the open fork were
carved out into siblings; this card was re-scoped to the embed capstone (size 13 → 3) and re-pointed:

- **#886** — Plateau creator domain scaffold (route + mount + seedProvider + upsell CTA).
- **#888** — manual #747 manifest authoring + localStorage (blocked by #886).
- **#889** — DTCG / Figma-file import adapter (free local parse; blocked by #888).
- **#890** — screenshot→theme (paid vision) — **parked**: no vision token-extraction capability exists
  (#086/#382 yield ComponentIR, not tokens).
- **#887** — `type:decision`: the **cross-boundary feed** (how a cross-origin Plateau-authored manifest
  reaches the FUI-resident #749 switcher, and whether the switcher should consume a user manifest vs its
  fixed gallery). Previously buried in this body; now its own card. **This slice blocks on it.**

`blockedBy: [887, 886, 888]` — needs the transport decided, a creator to embed, and a manifest to feed.
Full analysis: `we:reports/2026-06-17-backlog-split-analysis.md`.

## Re-blocked + re-sized 3 → 8 (batch-2026-06-18 claim)

Claiming for the batch surfaced two gaps the "capstone wiring·3" estimate under-counted (it assumed
#886/#888 left an emit-ready creator whose tokens align with the switcher):

1. **The creator has no emit path.** `plateau:plateau-app/src/design-system-creator/` builds + validates a
   manifest (#886/#888) but **never posts it** — no `postMessage` / `apply-design-system` anywhere
   (grepped). So the live-apply handoff needs building on **both** sides (creator emit + FUI receiver),
   not just the FUI receiver, across two checked-out repos.
2. **An undefined, lossy token-mapping bridge (the real blocker).** The creator authors **DTCG tokens**
   (`color.primary`, `space.*`, a `radius` trait) while FUI's stage applies **5 fixed props**
   (`fui:frontierui/workbench/designSystems.ts` `DesignSystemTokens`: `--wb-accent/--wb-radius/--wb-pad/--wb-font/--wb-shadow`,
   consumed by `applyDesignSystem` at `fui:frontierui/workbench/mount.ts:277`). #887 ratified the
   *transport* but explicitly left the message's field list / fidelity as a build detail — and that detail
   is a genuine **semantic-alignment fork** (rhymes with #910's WE↔FUI tag-alignment), not improvisable in a
   batch. Filed as decision **[#930](/backlog/930-decide-the-plateau-creator-manifest-fui-workbench-stage-toke/)**
   (A: lossy DTCG→`--wb` mapping table · B: stage consumes DTCG directly · C: constrain the creator to the
   `--wb` shape); `blockedBy: [930]` added.

Re-sized 3 → 8 (3-repo emit+receive+bridge build, gated on #930), released to `open`. Once #930 rules, the
build is: creator emit (`window.parent.postMessage` over the #887-A origin-validated bus) + a "Your theme"
button on the FUI workbench opening the creator iframe + an origin-validated `message` receiver mapping the
manifest → a `DesignSystemPreset` and calling `applyDesignSystem`.

## Progress (batch-2026-06-18) — resolved

Built the 3-repo capstone per **#930-A** (lossy DTCG→`--wb-*` mapping in the FUI receiver, declared
coverage) over the **#887-A** origin-validated `postMessage` bus. All blockers (#887/#886/#888/#930) were
resolved at claim.

- **Wire contract (FUI, `fui:frontierui/embed/contract.ts`).** Added `ApplyDesignSystemMessage` (guest→host)
  + `ResolvedDesignSystemManifest` (the #871 shape, token *values* inlined per #887) + an `isResolvedManifest`
  guard. A **contract addition** to the existing versioned, origin-validated `fui-embed` bus — not a new
  channel.
- **The bridge (FUI, `fui:frontierui/workbench/manifestBridge.ts`) — the #930 conformance heart.**
  `bridgeManifest()` aliases the whole manifest into the 5 `--wb-*` slots (`--wb-accent`←`color.primary`,
  `--wb-pad`←`density`, `--wb-shadow`←`surface`, `--wb-radius`←`radius` trait, `--wb-font`←a `type.*` family),
  with base-default fallbacks. **Ratified enum-collapse tables** (`SURFACE_COLLAPSE` flat|raised|sunken→
  lift|solid; `RADIUS_COLLAPSE` sharp|soft|round→none|sm|lg) are exported data, and it returns a **declared,
  inspectable `BridgeCoverage`** (mapped / dropped / collapsed / fallbacks) per the #930 amendment (never a
  silent apply). `acceptApplyMessage()` is the pure origin/source/shape receiver gate.
- **"Your theme" button + receiver (FUI, `fui:frontierui/workbench/mount.ts` + `fui:frontierui/demos/workbench.ts`).** A
  config-driven (`creatorEmbed.url`, `?creator=` override) button opens the Plateau creator as a nested child
  iframe; an origin-validated `message` listener bridges an inbound manifest → the **same** `applyDesignSystem`
  the gallery uses (live, no reload, no backend), and renders the declared coverage.
- **Creator emit (Plateau, `plateau:plateau-app/src/design-system-creator/embedBridge.ts` + the creator UI).**
  `emitApplyDesignSystem()` posts the resolved manifest to the embedder origin (read from the referrer) when
  embedded, no-op standalone; an "Apply to live block" button wires it. Wire shape **byte-replicated** (Plateau
  never imports FUI — the constellation boundary; interim until `@webeverything/contracts`).
- **Tests — 17 new, all green.** FUI: 12 (the `manifestBridge` suite — mapping, coverage, ratified enum
  tables, receiver origin/source/shape gates). Plateau: 5 (the `embedBridge` suite — embedded detection,
  host-origin derivation, targeted post, no-op standalone). Typecheck clean both repos.
- **Live verify (Playwright, running :3001/:4000).** Workbench renders the "Your theme" button; clicking opens
  the creator iframe at the configured origin; coverage starts hidden. The **full cross-origin message loop
  could not be exercised live** because a **concurrent session's** `plateau:plateau-app/src/component-assembler/authoring.ts`
  currently 500s on transform (unresolved `we:src/_data/blocks.json` import — #688/#689 in flight), which
  breaks `plateau:main.ts`'s module graph so no Plateau route mounts. Out of my changeset (clean `git status`),
  stepped over per the batch scoped-stop rule; the receiver/emit/bridge logic is fully unit-covered.

### Known follow-on (warn-level, not blocking)

#948's barrel re-point made the FUI `#840` CEM-drift checker cite the barrel module and warn "no
observedAttributes surface found" for the re-pointed blocks — the **same re-export-following limitation**
#927's real resolver fixes (mapped into #927). FUI gate stays **0 errors**.
