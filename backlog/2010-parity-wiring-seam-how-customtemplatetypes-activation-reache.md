---
kind: decision
parent: "1994"
status: active
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
relatedReport: reports/2026-07-01-2010-customtemplatetypes-parity-wiring.md
tags: []
---

# Parity-wiring seam: how customTemplateTypes activation reaches parity with the attributes upgrade path

Fork extracted from #1994 (chunk 4 of the Custom Type Registry family, #1990). Blocks the for-each
activation-wiring slice #2012 → for-each migration #2013. Full grounding, the corrected site inventory, and
the skeptic transcript are in `we:reports/2026-07-01-2010-customtemplatetypes-parity-wiring.md`.

## Digest — the call

Migrated for-each becomes a typed `<template type="for-each">` on `CustomTemplateTypeRegistry`, but that
registry is instantiated **nowhere** in the app today (unit tests only). Wiring its activation wrong
silently and **gate-invisibly** breaks live for-each. Grounding the real `fui:` tree collapsed the framed
three-way fork: the **registration mechanism is settled by in-code precedent** (register the eager-walk way
`window.attributes` is registered), the coupling branch (c) is **foreclosed in code** by #1986 rule-1, and
the item's *"~15 sites"* premise was wrong — the real surface is **4 eager sites + 3 detached-fragment
cascade sites** (7 total), and the insertion cascades don't touch `attributes` at all. **One genuine
sub-choice survives:** how to give the detached-fragment cascade coverage of the directive registry. That
is the whole of Fork 1.

## Recommended path at a glance

| | Concern | Ruling |
|---|---|---|
| — | **Plugged registration** | Register `customTemplateTypes` the eager-walk way (like `attributes`) + eager `upgrade(document.body)` at the **4** existing sites. *Settled by precedent — not a fork.* |
| — | **Unplugged registration** | One line `register(customTemplateTypes)` alongside `register(attributes)`. *Settled by precedent — not a fork.* |
| — | **Coupling to `CustomAttributeRegistry.upgrade` (old candidate c)** | **Rejected** — foreclosed in code by #1986 rule-1. Not a live branch. |
| **Fork 1** | **Detached-fragment cascade coverage** | **(a) generalize the shared `resolveRegistry` helper** to resolve+upgrade the sibling directive registry too. |

## Supported by default (not decisions)

These read as "the fork" in the original card but are **settled by the shipped code**, so they are wiring,
not ratifications:

- **Plugged activation** — mirror what `window.attributes` does. `window.attributes` is a **bare global**
  (`fui:plugs/bootstrap.ts:196`) that self-activates via per-consumer `upgrade(document.body)`; six sibling
  value-space registries instead ride the injector chain (`documentInjector.set(...)`,
  `fui:plugs/bootstrap.ts:209-258`). `customTemplateTypes` is in the **eager-walk** class (it re-prototypes
  templates and installs its own `MutationObserver`), so it follows `attributes`: instantiate it, register
  `if`/`switch`/`for-each` on it (`registerViewTemplateTypes`, `fui:blocks/view/registerViewDirectives.ts:30`
  — exported but never called today), and add `window.customTemplateTypes.upgrade(document.body)` at the
  **4** eager sites that already call `attributes.upgrade` (loan `fui:demos/loan-origination/app.ts:660-661`,
  insurance `fui:demos/auto-insurance/app.ts:739-740`, `fui:demos/lazy-traits-plugged.ts:41`,
  `fui:demos/inert-dead-zone.ts:41`). No per-insertion wiring is needed for connected trees — the registry's
  own observer (`childList:true, subtree:true`, `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts`
  `#createObserver`) upgrades added nodes, exactly as `CustomAttributeRegistry` does
  (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:512-514,560-562`).

- **Unplugged activation** — a genuine one-liner. The registry is already `Plug`-shaped (`localName` +
  `upgrade` + `downgrade`, `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:60,109,120`), so add
  `register(customTemplateTypes)` next to `register(attributes)` (`fui:plugs/bootstrapUnplugged.ts:216-219`)
  and the unified `upgrade(root)` cascade (`fui:plugs/unplugged.ts:126-142`) drives it. (Note: chain
  registries there use `docInjector.set`, not `register()` — but `customTemplateTypes` needs the eager walk
  `register()` gives, so `register()` is correct, matching `attributes`.)

## Fork 1 — detached-fragment cascade coverage for the directive registry

**Fork-existence justification (case (a), forced-invariant sub-choice):** the connected-tree path is
observer-covered and needs no decision, but **detached fragments** (`Range.createContextualFragment`,
`Element.setHTMLUnsafe`, `outerHTML=` — upgraded *before* connection, so the registry's observer never sees
them) are covered only by the explicit cascade in `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts`,
whose `resolveRegistry` **hardcodes `'customTextNodes'`** (`:52-54`) and upgrades *only* that registry. A
for-each `<template>` inserted via those APIs will **not** be upgraded unless this file is changed —
gate-invisibly, the exact failure class this whole decision guards. The excluded/broken branch is
**"do nothing to the cascade"**: leave `resolveRegistry` as-is and inserted for-each silently dies. So the
cascade *must* change; the only choice is the shape of that change.

Crux: `resolveRegistry(contextNode)` returns one hardcoded registry
(`InjectorRoot.getProviderOf(contextNode, 'customTextNodes')`); the three insertion branches
(`:88-89`, `:102-103`, `:117-130`) each call `registry?.upgrade(fragment)`.

- **(a) Generalize the shared resolver.** Change `resolveRegistry` to resolve+upgrade **each eager-walk
  value-space registry visible on the chain** (or an explicit `['customTextNodes','customTemplateTypes']`
  set), so all three branches cover both registries from one edit. Smallest diff, single seam, and it makes
  the cascade extensible when the next directive registry lands.
  ```ts
  // fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts — generalize the single resolver
  const CASCADE_REGISTRIES = ['customTextNodes', 'customTemplateTypes'] as const;
  function upgradeInsertedTree(contextNode: Node | null, tree: RootNode): void {
    if (!contextNode) return;
    for (const name of CASCADE_REGISTRIES) {
      const registry = InjectorRoot.getProviderOf(contextNode, name) as
        { upgrade(root: RootNode): void } | undefined;
      registry?.upgrade(tree);
    }
  }
  // each branch: upgradeInsertedTree(this.startContainer ?? null, fragment as unknown as RootNode);
  ```
  This presumes `customTemplateTypes` is placed on the injector chain (so `getProviderOf` finds it) — a
  cheap `documentInjector.set('customTemplateTypes', templates)` in plugged bootstrap alongside the eager
  `upgrade`; the chain membership costs nothing extra and is what makes the resolver generic.

- **(b) Duplicate the resolve+upgrade per branch.** Add a second `resolveRegistry`-for-directives call and a
  second `.upgrade` in each of the three branches, keyed directly off `window.customTemplateTypes`. No chain
  membership needed, but it triples the edit and re-introduces the per-site duplication this registry family
  was designed to avoid — and the next directive registry repeats it again. *Rejected* — more surface, less
  extensible, same behavior.

- **(c) Couple `CustomAttributeRegistry.upgrade` to also drive the sibling registry.** *Rejected* — this is
  the original candidate (c); it is foreclosed in code by #1986 rule-1
  (`fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:15-18`), which deliberately separated the
  behavior and directive registries. Coupling their upgrades re-merges exactly that split, and the two
  registries have different node sets (attributes tree-wide vs `<template type>` value-space). Not a live
  branch.

**Default: (a) — generalize the shared `resolveRegistry` helper (with `customTemplateTypes` placed on the
injector chain so the generic resolver finds it).**

Skeptic: SURVIVES-WITH-AMENDMENT — the prep skeptic REFUTED the original framing on all 4 axes (it is not a
merit fork; the "inherit the cascade for free" premise was false because `resolveRegistry` hardcodes
`customTextNodes`; `codifiedIn` would mis-target; #1986 rule-1's scope is registration-home not activation).
Folded in: the decision was **re-cast from a 3-way merit fork to settled-by-precedent wiring + this one
cascade sub-choice**, and the cascade generalization was made an **explicit, mandatory** part of the wiring
rather than an assumed freebie. The surviving default (a) beat (b) on diff size + extensibility.

## Context

- **No new statute.** This resolves `--codified-to=one-off`. #1986 rule-1 governs *registration home*, not
  activation wiring; the `<template type>` value-grammar anchor (`we:docs/agent/platform-decisions.md:2222`,
  #1983/#1987) governs *values*, not the upgrade seam. Neither is codified-against here.

- **Downstream.** #2012 (the wiring slice, `blockedBy` this) becomes small once ruled: register on the chain
  + eager upgrade at 4 sites (plugged), one `register()` line (unplugged), and the Fork-1 (a) resolver
  generalization. The item #2012's provisional size·5 (predicated on the false ~15-site count) should
  **drop to ~2-3**. #2013 (live for-each migration) rides on #2012.

- **Corrected refs** (the card's originals had drifted): the `attributes` register site is
  `fui:plugs/bootstrapUnplugged.ts:217` (not `fui:plugs/unplugged.ts:217` — the two files were conflated);
  `fui:plugs/webinjectors/InjectorRoot.ts:289,332` are injector-chain upgrades, not `attributes` upgrades,
  and are **not** parity sites; the nav blocks have **zero** upgrade calls.
