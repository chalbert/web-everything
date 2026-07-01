# #2010 — customTemplateTypes activation parity wiring: grounding artifact

> Prep-pass grounding for the decision **#2010** (how `customTemplateTypes.upgrade` reaches activation
> parity with the `CustomAttribute` / `window.attributes` upgrade path across the two boot models). All
> file:line refs verified against the real `fui:` tree on 2026-07-01. This report is the durable grounding;
> the ruling lives in `we:backlog/2010-*.md`.

## TL;DR — what the grounding changed

- The item's **"~15 plugged sites"** count is **wrong**. The real per-site surface is **4 eager
  app/demo call sites** + **3 detached-fragment cascade sites** (one file). See inventory below.
- The item's claim that the dynamic-insertion cascades *drive `window.attributes.upgrade`* is **wrong**.
  `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts` and `fui:plugs/webinjectors/InjectorRoot.ts`
  do **not** touch `attributes` at all — the former hardcodes **`customTextNodes`**, the latter walks the
  *injector* chain (not value-space registries).
- The load-bearing correction: **behaviors and template-directives both ride their own registry's
  `MutationObserver` (`childList:true, subtree:true`) for connected-tree insertions.** So parity is *not*
  "mirror ~15 upgrade calls" — it is "call `customTemplateTypes.upgrade(root)` wherever
  `attributes.upgrade(root)` is called (4 sites), and cover the one *detached-fragment* cascade the
  observer structurally cannot see (3 sites in 1 file)."
- The "register on the injector chain → inherit the insertion cascade for free" idea is **partially
  false**: `resolveRegistry` in the cascade **hardcodes `'customTextNodes'`**
  (`fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:54`), so a chain registration does **not**
  auto-earn cascade coverage. The cascade must be *generalized* (or a sibling-upgrade added) regardless.

## Real boot-model comparison

### Plugged — `fui:plugs/bootstrap.ts`
- `window.attributes = new CustomAttributeRegistry()` at **`fui:plugs/bootstrap.ts:196`**. **It is a bare
  global — NOT placed on the injector chain.** (Contrast: six *other* value-space registries ARE placed on
  the document injector via `documentInjector.set(...)`: `customExpressionParsers` `:209`,
  `customTextNodeParsers` `:218`, `customTextNodes` `:228`, `customValidityMerge` `:234`,
  `customValidatorResolution` `:245`, `customGuards` `:258`.)
- for-each is registered onto that bare global: `registerForEach(window.attributes)` at
  **`fui:plugs/bootstrap.ts:295`**.
- **There is NO global `upgrade(document)` in plugged bootstrap.** Activation is entirely per-consumer:
  each demo/app calls `<registry>.upgrade(document.body)` itself.
- `CustomTemplateTypeRegistry` is **instantiated nowhere** in `fui:plugs/bootstrap.ts`;
  `registerViewTemplateTypes` (`fui:blocks/view/registerViewDirectives.ts:30`) is exported but **never
  called**.

### Unplugged — `fui:plugs/bootstrapUnplugged.ts`
- Functional `register(plug)` + `upgrade(document)` cascade over `fui:plugs/unplugged.ts` (`register`
  `fui:plugs/unplugged.ts:36`; `upgrade` loop `fui:plugs/unplugged.ts:126-142`, one `plug.upgrade(root)`
  per registered plug at `:137`).
- `attributes` is a **local** `CustomAttributeRegistry` (`fui:plugs/bootstrapUnplugged.ts:189`), for-each
  registered onto it (`fui:plugs/bootstrapUnplugged.ts:193`), then `register(attributes)` at
  **`fui:plugs/bootstrapUnplugged.ts:217`** (⚠ the item cited this site as `we:plugs/unplugged.ts:217` — it
  is actually `fui:plugs/bootstrapUnplugged.ts:217`; the two files were conflated).
- **Load-bearing unplugged distinction:** value-space registries that resolve *lazily* through the chain
  (`customTextNodes`, `customGuards`, `customValidityMerge`, …) are wired via `docInjector.set(...)`
  (`fui:plugs/bootstrapUnplugged.ts:160-186`) and are **not** `register()`'d. Only the **4 registries that
  need an eager tree-walk upgrade** — `injectorRoot`, `attributes`, `contexts`, `stores` — are `register()`'d
  (`fui:plugs/bootstrapUnplugged.ts:216-219`), so the `upgrade(root)` cascade drives `attributes.upgrade(root)`.
  `customTemplateTypes` is in the **eager-walk** class (it re-prototypes templates + installs a
  MutationObserver), so its unplugged parity is a genuine **one-line `register(customTemplateTypes)`** — it
  rides the same cascade `attributes` does. (This corrects a skeptic overcorrection that claimed unplugged
  should `docInjector.set` it — that path gives no eager walk.)
- `CustomTemplateTypeRegistry` is already `Plug`-shaped (`localName='customTemplateTypes'` + `upgrade` +
  `downgrade`, `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:60,109,120`), so the one-liner is real.

## Verified per-site inventory (plugged)

| Kind | Site | Verified | Note |
|---|---|---|---|
| eager app | `fui:demos/loan-origination/app.ts:660-661` | ✓ (item said 661) | `attrs?.upgrade(document.body)` |
| eager app | `fui:demos/auto-insurance/app.ts:739-740` | ✓ (item said 740) | `attrs?.upgrade(document.body)` |
| eager demo | `fui:demos/lazy-traits-plugged.ts:41` | ✓ (new) | `window.attributes.upgrade(document.body)` |
| eager demo | `fui:demos/inert-dead-zone.ts:41` | ✓ (new) | `window.attributes.upgrade(document.body)` |
| detached cascade | `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:88-89` | ✓ | `createContextualFragment` — resolves **customTextNodes only** (`:54`) |
| detached cascade | `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:102-103` | ✓ | `setHTMLUnsafe` |
| detached cascade | `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:117,130` | ✓ | `outerHTML` setter — item said `:130` |

**Total real surface: 4 eager + 3 cascade (one file) = 7, not ~15.**

Refuted from the item's list:
- **`fui:plugs/webinjectors/InjectorRoot.ts:289,332`** — these are `this.upgrade(element)` / `this.upgrade(root)`
  on the **InjectorRoot**, which manage the *injector chain* (`#addInjectorsOnTree`,
  `fui:plugs/webinjectors/InjectorRoot.ts:247-251,437`). They do **not** upgrade `attributes` or any
  value-space registry. Irrelevant to template-directive parity.
- **Nav blocks (`SectionedNav`/`DisclosureNav`)** — grep of `fui:blocks/navigation/`,
  `fui:blocks/sectioned-nav/`, `fui:blocks/disclosure-nav/` shows **zero `.upgrade(` calls**. The item's
  "the nav blocks" claim is unfounded.
- The other ~10 `registry.upgrade(document.body)` demo sites (date-picker, gestures, etc.) drive their
  **own local** trait/behavior registries, not `window.attributes`, and carry no template directives — not
  parity sites.

## The activation mechanism (why the count collapses)

Both `CustomAttributeRegistry.upgrade(root)` and `CustomTemplateTypeRegistry.upgrade(root)` install a
`MutationObserver` with `childList:true, subtree:true` on the root and upgrade `addedNodes` on any later
insert into that observed subtree:
- `CustomAttributeRegistry`: observer `childList/subtree` `fui:plugs/webbehaviors/CustomAttributeRegistry.ts:512-514`,
  added-node branch `:560-562`.
- `CustomTemplateTypeRegistry`: observer + `mutation.addedNodes.forEach(node => this.#upgradeTree(node))`
  in `#createObserver` (`fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts`, `#observe`/`#createObserver`).

So once `customTemplateTypes.upgrade(root)` runs on a tree, **every subsequent connected-tree insertion is
handled by the registry's own observer** — no per-insertion wiring needed. The only insertions the observer
can't see are **detached fragments** (`createContextualFragment` / `setHTMLUnsafe` produce a fragment that
is upgraded *before* connection) — exactly the 3 `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts`
sites, whose own comment (`:47-51`) says they exist for the detached case.

## The "chain registration inherits the cascade" trap

`resolveRegistry(contextNode)` in the cascade hardcodes the name:
```
// fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:52-54
function resolveRegistry(contextNode: Node | null): CustomTextNodeRegistry | undefined {
  if (!contextNode) return undefined;
  return InjectorRoot.getProviderOf(contextNode, 'customTextNodes') as CustomTextNodeRegistry | undefined;
}
```
It only ever resolves `customTextNodes`. So placing `customTemplateTypes` on the injector chain
(`documentInjector.set('customTemplateTypes', …)`) does **not** make the detached-fragment cascade upgrade
it. Cascade coverage for the directive registry has to be **added explicitly** — either by generalizing
`resolveRegistry` to also resolve+upgrade the sibling directive registry, or by a second resolve+upgrade in
each of the 3 branches. This is true under *any* candidate, and is the one genuine sub-choice left.

## Statute / precedent check

- **#1986 "rule 1"** is a **code-comment rule** inside
  `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:15-18` (behavior on `CustomAttribute`; `type`-value
  directives on their own value-space sibling). It is about **registration home**, not activation wiring. It
  is **not** a named anchor in `we:docs/agent/platform-decisions.md` (grep: no `#1986` rule-1 anchor there).
- The nearest statute anchor is the `<template type>` value convention
  (`we:docs/agent/platform-decisions.md:2222`, #1983/#1987 — bare core / `owner-kind` hyphen /
  colon-rejected). It governs the directive *value grammar*, not the activation seam — no collision with this
  decision.

## Skeptic verdicts (prep skeptic sub-agent, refute-only, 4 axes)

- **Axis 0 (classification): REFUTED.** The plugged mechanism is *settled by in-code precedent* ("do what
  the 6 value-space registries + `attributes` already do"), not a contested principle. Candidate (c) is a
  strawman already foreclosed in code by #1986 rule-1. → The decision **collapses to "not a ratifiable
  merit fork"** for registration; the only live sub-choice is the cascade-generalization mechanism.
- **Axis 1 (merit): REFUTED — load-bearing.** `resolveRegistry` hardcodes `customTextNodes`
  (`fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:52-54`); "inherit the cascade for free" is
  false. Insertion parity **requires** patching that resolver too. → Default amended to make the cascade
  generalization an explicit, mandatory part of the wiring.
- **Axis 2 (statute-overlap): REFUTED.** A `codifiedIn` here would mis-target — the #1987 anchor is
  value-grammar, #1986 rule-1 is registration-home; neither governs activation wiring. → This decision
  **codifies no new statute rule** (`--codified-to=one-off` at resolve); it is mechanical wiring under the
  already-settled registration home.
- **Axis 3 (citation-scope): REFUTED.** #1986 rule-1's scope reaches *which registry keys `type=`*, not
  *how upgrade is wired across boot models* — it settles the rejection of (c) but is not a fork-deciding
  citation. → Kept only as the reason (c) was never live.

**Overall:** the default **amends toward "this is a mechanical wiring task, not a merit fork"** — one
genuine sub-choice survives (generalize the shared cascade resolver **vs** duplicate the resolve+upgrade
per branch). That single sub-choice is the whole of Fork 1.
