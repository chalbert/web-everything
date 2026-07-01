---
kind: story
size: 13
status: open
blockedBy: ["1993"]
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
tags: []
---

# Migrate view:if/view:switch/for-each directives off CustomAttribute onto CustomTemplateTypeRegistry

Chunk 4 of the Custom Type Registry family (#1990, chunks 1-3 delivered). Migrate the three structural directives (fui:blocks/view/ViewIfDirective.ts, fui:blocks/view/ViewSwitchDirective.ts, fui:blocks/for-each/ForEachBehavior.ts) off CustomAttribute onto the minted CustomTemplateTypeRegistry: the directive now IS the typed template (extends CustomTemplateType), authored as a typed <template>, registered by type VALUE not attribute name. Drop the registry-define calls for the directives in fui:blocks/view/registerViewDirectives.ts (view:show stays a behavior). NOTE the re-prototype constraint proven in chunk 2: upgrade() re-prototypes the existing node and runs NO constructor, so the directives must NOT use private instance fields with initializers (those throw on access for a re-prototyped node) — move marker/state init into connectedCallback. Blocked on #1993 (the option-attribute spelling — where the if-condition / switch-selector expression lives now that type= carries the identity) — now **resolved** (`condition` / `match` / fused `items="… as …"` + bare `key`).

## Grounding — outgrew story·3 + surfaced activation-wiring design fork (batch-2026-06-30, resized 3→13, released not resolved)

The class-migration half is clean and ready (spelling ratified by #1993; the re-prototype/no-`#private`-fields pattern is proven by chunk 2's stub). But a faithful, **non-regressing** chunk 4 is materially larger than the mechanical rename the body scopes, and it carries an unmade **design call** — so it is not serial-batchable as a story·3.

**The regression the item's own mandate creates.** The item says "drop the registry-define calls for the directives." Today `for-each` is the **only one of the three that is live** — `registerForEach(window.attributes)` (`fui:plugs/bootstrap.ts:295`, `fui:plugs/bootstrapUnplugged.ts:193`); `registerViewDirectives` (which defines `view:if`/`view:switch`) is **never called in either bootstrap**, so those two are dead-on-site today (tested only). Live for-each activates via consumer upgrade calls against the behavior registry — e.g. `fui:demos/for-each-demo.html:131` `window.attributes.upgrade(document.body)` (the demo loads the **plugged** `fui:plugs/bootstrap.ts`, auto-injected by `fui:vite.config.mts:28-30`). **`CustomTemplateTypeRegistry` is instantiated and driven NOWHERE in the app** (only in its unit test). So dropping for-each's `CustomAttribute` define **without** wiring `customTemplateTypes` activation silently breaks live for-each — and it is **gate-invisible**: the unit/integration suites can drive their own local `registry.upgrade(root)` and stay green, so `check:standards` would NOT catch the live break.

**The design fork (needs a call — do not force).** How to drive `customTemplateTypes` activation in parity with the `CustomAttribute` upgrade path, which spans **two** boot models:
- **Unplugged** (`fui:plugs/bootstrapUnplugged.ts`) — a unified `register(plug)` + `upgrade(document)` cascade (`fui:plugs/unplugged.ts:126-142`); `attributes` is a registered `Plug` (`:217`). `CustomTemplateTypeRegistry` is already `Plug`-shaped (`localName` + `upgrade` + `downgrade`), so here it is a clean one-line `register(customTemplateTypes)`.
- **Plugged** (`fui:plugs/bootstrap.ts`) — patches globals, **no central upgrade**; each consumer + insertion cascade drives `window.attributes.upgrade(root)` itself: demos, the loan/insurance apps (`fui:demos/loan-origination/app.ts:661`, `fui:demos/auto-insurance/app.ts:740`), the nav blocks (`SectionedNav`/`DisclosureNav`), and — load-bearing — the dynamic-insertion cascades that make for-each work inside inserted HTML (`fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:89,103,130`, `fui:plugs/webinjectors/InjectorRoot.ts:289,332`). For migrated for-each to keep working, `window.customTemplateTypes.upgrade(root)` must run in parity at **every** one of those ~15 sites.

Candidate resolutions: **(a)** ride the unplugged Plug-cascade + add per-site `customTemplateTypes.upgrade` across the ~15 plugged sites; **(b)** introduce a shared "upgrade the value-space registries alongside `attributes`" seam so one call drives both (fewer sites, new abstraction); **(c)** have `CustomAttributeRegistry.upgrade` also drive the sibling template-type registry (couples the two families — tension with the #1986 rule-1 split that deliberately separated behavior vs directive registries). This is real architecture, not a mechanical rename.

**Recommended next step:** file/`/prepare` a small decision on the parity-wiring seam (a/b/c above), set #1994 `blockedBy` it, and resize #1994 back down to the class+registration+test estimate once the wiring lands as its own slice. The class migration is ready to execute the instant the wiring architecture is chosen.
