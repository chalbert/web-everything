---
kind: decision
parent: "746"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#source-only-workbench-block"
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-workbench-declarative-component-hosting.md
tags: [workbench, declarative-component, polyglot, frontierui, decision]
---

# How does the FUI workbench host a declarative component case so it can carry authorSource (source-only WorkbenchBlock vs wire the declarative-component runtime)?

Prepared 2026-06-23 — no design existed; the one fork below is grounded in a read of the real FUI tree (report [we:reports/2026-06-23-workbench-declarative-component-hosting.md](../reports/2026-06-23-workbench-declarative-component-hosting.md)), and carries a bold recommended default. This is the #1618 **Attachment** residual: `we:src/_data/authorModeSource.json` holds 9 declarative `<component>` cases but the workbench registers only the imperative `auto-complete` block, so no case carries `authorSource` live yet. The crux is how a declarative case enters the workbench — and it turns on a single, traceable fact: what the author-source panel actually consumes.

The decision has **one axis**: the hosting mechanism for a source-carrying declarative case. The current `WorkbenchBlock` contract requires a runnable element — `load: () => Promise<void>` (fui:workbench/registry.ts:97) and `create: () => HTMLElement` (fui:workbench/registry.ts:104) are mandatory — while `authorSource?` (fui:workbench/registry.ts:140) and `cem?` (fui:workbench/registry.ts:130) are already optional. The shell calls both unconditionally: `await block.load()` (fui:workbench/mount.ts:172) then `block.create()` in `renderStage()` (fui:workbench/mount.ts:248-263). But the author-mode panel that renders `authorSource` reads **no live instance** — `renderAuthorModePanel(source)` (fui:workbench/authorMode.ts:57-112) is pure of block state and the shell feeds it only data (fui:workbench/mount.ts:675-677). That gap between "the contract demands a `create()`" and "the consumer needs none" is the whole decision.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — hosting mechanism | **(a) source-only `WorkbenchBlock`** (relax the contract; render source without a live instance) | (b) wire a `<component>`→live-element runtime so the case is `create()`-able | High |

## Fork 1 — how the workbench hosts a declarative author-source case

**Fork-existence justification.** Genuine either/or: (a) and (b) cannot both be **the** hosting mechanism for a single source-carrying case — either the registry's `load`/`create` contract is relaxed so a block needs no live instance (a), or it stays mandatory and a `<component>`-lowering runtime is wired in so the case becomes a real instance (b). The excluded branch is **(b)**: positively disproven as needed scope — no consumer in the ratified 746 roadmap mounts the declarative author-source case as a live block (the live-render slices #912/#967 mount the generated *wrapper*, the consume-mode path, not the author-source `<component>`), and the author-source panel itself touches no `instance` (fui:workbench/authorMode.ts:57-112). Composability does not dissolve the fork: (a) cannot be a facade over (b) (a source-only block has no element to lower), and (b) over (a) would build a live runtime the surface never reads — they are distinct mechanisms, only one of which the source-carrying case requires.

**Crux (with refs).** The author-source panel consumes `{ name, definition, forms[] }` only (fui:workbench/authorMode.ts:37-44), built from pre-emitted strings; the shell gates the panel on `if (block.authorSource)` and passes the data, no instance (fui:workbench/mount.ts:675-677). The artifact already matches that shape per case (we:src/_data/authorModeSource.json — `cases[].forms[]` = `{ form, label, language, code, lossy, diagnostics }`). Meanwhile every *live* panel (theme/trait/inspect/event/anatomy) reads the `instance` from `block.create()`. So a declarative case carrying only source has nothing to feed those live panels — its real content is the source tabs.

**(a) Source-only `WorkbenchBlock`.** Relax the registry so a block may declare `authorSource` (and `cem`) without a runnable `load`/`create`; the shell renders the source/CEM panels and skips the live-instance panels for such a block. *Merit tradeoffs:* decoupled — the workbench registry pulls in no `<component>`-lowering runtime to serve a surface that reads only text (bias-toward-separation); faithful — a source-only case is hosted as exactly what it is; composes cleanly — `authorSource`/`cem` are already optional, so the contract change is additive, and (b) remains buildable later for its own consumer. *Merit cost:* a source-only block shows none of the live theme/trait/inspect chrome — correct for a source surface, but it does mean the entry is less rich than `auto-complete`.

**(b) Wire the declarative-component runtime.** Pull a `<component>`→live-element lowering into fui:workbench/registry.ts (the real path is the build-time transform fui:compiler/src/component-transform/declarative.ts → `ComponentIR`; note fui:plugs/webregistries/declarativeRegistry.ts is the `<script type="registry">` scoped-registration mechanism #854/#901, **not** a `<component>` lowering — the item's original framing conflated them) so a case becomes a real `create()`-able block with the full chrome. *Merit tradeoffs:* most capable — the declarative case gets live render + theme/trait/inspect identical to `auto-complete`. *Merit cost (why excluded):* heavier coupling — it pulls a component-lowering runtime into the workbench registry to serve a panel that reads no instance, and **no roadmap consumer needs that live instance** (the live-render slices are wrapper-side, #912/#967). It is the right mechanism for a *future live-declarative-render* slice, not for the source-carrying Attachment case here. *Rejected* as the hosting mechanism for a source-carrying case — excluded on the unneeded-coupling merit axis, not on effort; it stays available as a separate capability when a live-declarative-render consumer is filed.

**Default: (a) source-only `WorkbenchBlock`.** What the author-source panel actually requires is rendered text + diagnostics (the #700-seam minimum #818/#954 already fixed), and a live instance is unused by it and unrequested by any 746 slice. Choosing (a) keeps the workbench registry decoupled from the `<component>` runtime (bias-toward-separation) while hosting the 9 declarative cases honestly; (b) is the right tool only once a live-declarative-render consumer exists, and is filed then.

Skeptic: REFUTED-then-SURVIVES — attacked (a) with the strongest case for (b) ("the workbench's value is the live chrome; a source-only tab is a degenerate entry and the declarative cases deserve `auto-complete`'s live treatment, which only (b) gives"). Refuted on merit, not effort: the live chrome is value for a *live-render* slice, which exists for the consume-mode wrapper (#912/#967) but **not** for the author-source `<component>` — and (a) does not foreclose (b), which is built for that consumer the moment it is filed. Source-only is the faithful shape for a source-only surface; padding it with an unused live instance is scope no consumer reads. SURVIVES — beat the "degenerate entry" attack.

## Context

Lineage: #1618 (the Attachment residual this surfaced from, `blockedBy: 1701`) → #818 (the author-mode emit foundation, resolved) → parent #746 (the Block-Explorer workbench epic).

Orthogonal finding (filed separately, does not gate this decision): ratification surfaced that the MaaS serve **core** still lives in WE (`we:blocks/renderers/module-service/`) as a self-described "v1 walking skeleton" resolver — a candidate relocation to FUI under the ratified #1282 (WE = zero implementation). Filed as **#1730**. #1701 is unaffected: both forks consume only the pre-emitted `we:src/_data/authorModeSource.json` data (#954 build-emit, an allowed author-script use of `serve()`), never the runtime serve core. Placement settled by #954 (data-emit, Fork 1 = A): only rendered text + diagnostics cross the #700 seam; FUI never imports `serve()`. This decision unblocks the #1618 Attachment half; the Transport half is flat and independent. At ratification, the build spins out as a #1618 slice (relax the `WorkbenchBlock` contract + register the declarative cases as source-only blocks).

## Ratified 2026-06-24 — (a) source-only `WorkbenchBlock`

Ruling: **(a)** — relax the registry so a block may carry `authorSource`/`cem` with no runnable `load`/`create`; the shell renders the source/CEM panels and skips the live-instance panels for such a block. The contract change is additive (both fields already optional). Crux verified in-tree: `load`/`create` mandatory (fui:workbench/registry.ts:97,104), `cem?`/`authorSource?` optional (:130,140), and `renderAuthorModePanel(source)` consumes data only — no instance (fui:workbench/authorMode.ts:57, gated fui:workbench/mount.ts:675). (b) excluded on the unneeded-coupling axis (no #746 consumer reads a live instance), stays available for a future live-declarative-render consumer.

**Scope note — this decides the *contract*, not the *acquisition mechanism*.** A separate decision (**#1731**) reframes whether the workbench resolves a block's shape (source/cem/loadable/case-example) from the FUI `/_maas/` serve URL (#1029) instead of hardcoded `WorkbenchBlock` literals. (a) is a prerequisite either way — a MaaS-resolved block with no loadable module needs exactly this relaxed contract. The #1618 build slice should align with #1731 before hardcoding 9 source-only literals, to avoid hardcode-then-rip.
