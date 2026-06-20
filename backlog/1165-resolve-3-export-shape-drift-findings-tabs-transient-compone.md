---
type: decision
workItem: story
size: 3
parent: "904"
status: resolved
relatedReport: reports/2026-06-19-backlog-split-analysis.md
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#export-shape-drift"
preparedDate: "2026-06-20"
tags: []
---

# Resolve 3 export-shape drift findings (tabs/transient-component/view): correct contract exports vs file FUI build

De-buried from #927 (its post-#948 map named these as "genuine findings the gate SHOULD surface, not
modeling artifacts"). The export-shape arm (#927) surfaces **3 genuine contract↔impl drifts** — declared
`we:` `exports` absent from the resolved FUI barrel. Each is a **source-of-truth call**, not a build:
either the `we:` contract over-declares (correct `we:src/_data/blocks/<id>.json` `exports` to the real
impl surface) **or** the FUI impl is incomplete (file a `locus: frontierui` build for the missing
symbols).

## Grounding digest (verified file-by-file 2026-06-20)

Re-verified the resolved FUI barrels symbol-by-symbol; **all 10 declared-but-absent symbols are genuinely
missing from the entire `fui:blocks/` tree** (a `grep -r` for each `class`/`function`/`const`/`export`
across all of `frontierui/` returned zero hits — not moved, not renamed except where noted). The drift is
real, not a resolver artifact. This decision **ratifies shipped code** — no greenfield design, so no web
prior-art survey; the concrete-refs evidence is the table below.

| block | declared `we:` `exports` (`<id>.json`) | actual FUI barrel exports | drift |
| --- | --- | --- | --- |
| `tabs` | `TabsComponent` · `TabListAttribute` · `TabTriggerAttribute` · `TabPanelAttribute` (`we:src/_data/blocks/tabs.json:39`) | `TabGroupBehavior` + types `TabActivationMode`/`TabOrientation`/`TabChangeEventDetail` (`fui:blocks/tabs/index.ts:1`) | **all 4 absent** — a Component+3-attribute surface vs one behavior |
| `transient-component` | `TransientElement` · `AutoHeading` · `SmartLink` · `withSelfReplacement` · `calculateHeadingLevel` (`we:src/_data/blocks/transient-component.json:35`) | `TransientElement` · `AutoHeading` · `calculateHeadingLevel` · `registerTransient` (`fui:blocks/transient/index.ts:1`) | `SmartLink` + `withSelfReplacement` absent; FUI also ships an **un-declared** `registerTransient` |
| `view` | `ViewEngine` · `ViewEngineOptions` · `ViewBehavior` · `ViewShowBehavior` · `ViewIfDirective` · `ViewSwitchDirective` (`we:src/_data/blocks/view.json:50`) | `ViewEngine` · `ViewBehavior` + types `ViewHiddenMode`/`ViewState`/`ViewOptions`/`ViewToggleEventDetail` (`fui:blocks/view/index.ts:1`) | `ViewEngineOptions` shipped **renamed** to `ViewOptions`; `ViewShowBehavior`/`ViewIfDirective`/`ViewSwitchDirective` absent |

**Axis of the decision.** For every declared-but-absent symbol the question is one binary on **merit**:
*is the symbol **load-bearing to the block's canonical/coherent surface** (the block is gutted or
incomplete without it → **build** a `locus: frontierui` impl) or is it **additive/superseded/aspirational
over an already-complete core** (the block works without it; it names sugar FUI never chose or a design it
superseded → **trim** the `we:` `exports`)?* The two branches are mutually exclusive per symbol — you
cannot both re-spec `exports` to match the shipped barrel **and** treat the missing symbols as the
canonical surface; one side is authoritative. The classification turns on **coherence** — does the block's
own promised architecture *require* the symbol — never on which branch is cheaper. Cost is prioritization,
applied only when a spawned build is scheduled; "the build is small/large" is **not** a fork argument and
must not appear as one. One fork per block below; where a block's symbols split (`transient-component`,
`view`), the verdict is per-symbol.

## Recommended path at a glance

| Fork | Block | Excluded branch (why a fork) | Default | Confidence |
| --- | --- | --- | --- | --- |
| 1 | `tabs` | can't both re-spec to `TabGroupBehavior` **and** keep the Component+attribute surface as canonical | **Trim contract → `["TabGroupBehavior"]`** | ~85% |
| 2 | `transient-component` | can't both drop `withSelfReplacement`/`SmartLink` **and** treat them as the impl surface | **Trim both + add `registerTransient`** (both are additive/superseded over a complete core) | ~85% |
| 3 | `view` | can't both rename/trim **and** keep show/if/switch as canonical-but-unbuilt | **Rename `ViewEngineOptions`→`ViewOptions` (trim) + build the show/if/switch family** | ~70% |

**Supported by default (not forks — forced corrections, no excluded branch):**
- `view`: `ViewEngineOptions` → `ViewOptions` is a pure rename — the same options type ships at
  `fui:blocks/view/ViewEngine.ts:22`. Correct the contract string regardless of Fork 3's directive call.
- `transient-component`: `registerTransient` (`fui:blocks/transient/registerTransient.ts:21`) is a real
  public export the contract **under-declares** — add it to `exports`. (Reverse drift; the export-shape
  gate's job is contract = barrel, so the contract must list it.)

---

## Fork 1 — `tabs`: trim to the shipped behavior vs build the Component surface

**Fork-existence:** a genuine either/or — the contract's 4 declared symbols name a `TabsComponent` +
`TabList`/`TabTrigger`/`TabPanel` *CustomAttribute* architecture, while FUI shipped a single
`TabGroupBehavior` orchestrator. You cannot have both be the canonical `exports`; trimming and building
exclude each other.

- **A — Trim `exports` to `["TabGroupBehavior"]` (+ optionally the three type exports). [DEFAULT]**
  Grounding: `fui:blocks/tabs/TabGroupBehavior.ts:48` is a complete, working 10 KB `CustomAttribute`
  (full ARIA roles, keyboard nav, delegates panel visibility to `ViewEngine`) — the impl is *done*, not
  partial. The contract's own `designDecisions.syntax.chosen` already declares the canonical path is
  **"Attribute-based for core, custom element as optional wrapper"** (`we:src/_data/blocks/tabs.json`),
  and FUI built exactly that attribute-based behavior. The 4 declared symbols describe the *optional
  wrapper* path that was never the chosen core. So the contract over-declares an aspirational architecture
  — trim it to the symbol that shipped.
- **B — Build `TabsComponent` + the three `Tab*Attribute` classes in FUI.** Treats the Component+attribute
  surface as intended product. Cost: a substantial new component layer over `TabGroupBehavior`. Only
  correct if the `<we-tabs>` custom-element wrapper is genuinely wanted as canonical surface — but even
  then it is *additive* over the working behavior, not a reason to keep the 4 wrong symbols in `exports`
  today.

**Default: A**, ~85%. Residual: if the team later wants the optional `<we-tabs>` wrapper as real product,
file it as an additive `locus: frontierui` build under #904 — it does not justify holding the export-shape
gate red on 4 symbols that name an unchosen path. Red-team note: B's strongest case is "the contract is
the spec and FUI is the laggard," but the contract *itself* names attribute-based as the chosen core, so B
argues against the contract's own ruling.

## Fork 2 — `transient-component`: trim additive/superseded symbols vs build them

**Fork-existence:** real either/or per symbol — both `SmartLink` and the `withSelfReplacement` mixin name
designs FUI declined or superseded, so "drop it from the contract" and "treat it as the canonical surface"
exclude each other. Run both through the load-bearing test: the block already ships a **complete, coherent
transient system** — abstract base `TransientElement` + the concrete `AutoHeading` subclass +
`calculateHeadingLevel` + `registerTransient` registrar. Neither missing symbol is load-bearing to that
core, so both trim on merit; cost (small or large build) is *not* what decides either.

- **`withSelfReplacement` → Trim. [DEFAULT, ~90%]** Superseded. FUI built self-replacement as the
  **abstract base class** `TransientElement` (`fui:blocks/transient/TransientElement.ts` — `queueMicrotask`-deferred
  `replaceWith`, attribute transfer, child migration), *not* a mixin factory. The base class is already
  declared and present in `exports`. `withSelfReplacement` names a superseded mixin form of the same
  mechanism — its "build the mixin" branch is dominated (it would duplicate `TransientElement`).
- **`SmartLink` → Trim. [DEFAULT, ~80%]** Additive sugar over a complete core, **not** load-bearing.
  FUI built `AutoHeading` as its one concrete `TransientElement` subclass
  (`fui:blocks/transient/AutoHeading.ts`); the transient system is whole without a second `<a>`/`<button>`
  link subclass. This is the same shape as the `tabs` optional wrapper (Fork 1): a designed-but-unbuilt
  *additional* element, so the contract over-declares it → trim now; if `SmartLink` is later wanted as
  product, file it as an **additive** `locus: frontierui` build under #904 (a separate prioritization, not
  a reason to hold the gate red or keep the symbol in `exports` today). Residual is whether `SmartLink` is
  genuinely sugar vs a promised core element — flag for the skeptic pass, but its build was never argued on
  load-bearing-coherence, only on completeness, so it lands with the tabs wrapper, not view's directives.
- **`registerTransient` → Add to `exports`** (supported by default, above).

**Net default:** trim `withSelfReplacement` + `SmartLink`, add `registerTransient`. ~85% blended; the
residual is the narrow `SmartLink` sugar-vs-core-element read, not a cost coin-flip.

## Fork 3 — `view`: rename + trim vs build the show/if/switch family

**Fork-existence:** real either/or on the three structural blocks — `ViewShowBehavior`/`ViewIfDirective`/
`ViewSwitchDirective` are richly specified in the contract's `blocks` map (`we:src/_data/blocks/view.json:14`
— expression-bound `view:show`, structural `view:if`/`else`, `view:switch`/`case`/`default`) but FUI
shipped only `ViewEngine` + `ViewBehavior`. "Drop the design" and "build the directives" exclude each
other and are both coherent.

- **`ViewEngineOptions` → Rename to `ViewOptions` (trim).** Forced — same options interface ships at
  `fui:blocks/view/ViewEngine.ts:22` under the name `ViewOptions`. No functionality missing; pure
  contract-string fix. (Listed under "Supported by default" too.)
- **`ViewShowBehavior` / `ViewIfDirective` / `ViewSwitchDirective` → Build in FUI. [DEFAULT, ~70%]**
  Grounding: these are not aspirational noise — they are the directive/behavior family View's own
  architecture *promises*. `we:src/_data/blocks/view.json` `designDecisions.architecture` states View
  ships "specialized blocks (behaviors + directives)" and higher-level components "pick the block that fits
  their DOM model"; the `blocks` map specs each one's attributes and `extendsClass`
  (`CustomAttribute`/`CustomTemplateDirective`). They also plug into the **already-shipped** webexpressions
  binding layer (`view:show` is expression-bound — see the active `{{ }}`/`[[ ]]` interpreter, not
  greenfield). Trimming would gut View from a foundation-with-directives down to engine + one imperative
  behavior, contradicting the block's stated reason to exist. So these read as genuine intended product
  → file `locus: frontierui` build stories under #904.
- **Counter / excluded branch — Trim the three too.** If View is to stay Engine+Behavior-only for the
  foreseeable future, trimming and re-adding them to the contract *when* built keeps contract = impl now.
  This is the cheaper end-state but it amputates the designed surface; the bias is to preserve the
  coherent design and build (cost is a separate prioritization call on the spawned stories).

**Default:** rename `ViewEngineOptions`→`ViewOptions` + build the show/if/switch family. ~70%; the
residual is whether the directive family is scheduled product or indefinitely-deferred design — if the
latter, trim. This is the largest build candidate of the three findings (3 directives/behaviors over
`CustomTemplateDirective` + expression binding), so flag it for the skeptic pass.

---

**Relationship to #927:** does NOT block #927's arm — warn-first surfaces these as findings (the arm's
purpose). Resolving them (+ #1164) is the prerequisite to flipping `EXPORT_SHAPE_ENFORCED`. Slice of #904.
A "build" verdict on any symbol spawns its own `locus: frontierui` story under #904; a "trim" verdict edits
the block's `we:src/_data/blocks/<id>.json` `exports` array in place.

---

## RATIFIED 2026-06-20

Merit axis applied: **load-bearing-to-coherence → build; additive/superseded/aspirational over a complete
core → trim.** Cost excluded from every fork (it only schedules a spawned build). Skeptic pass run on the
one high-leverage tension (Fork 3): the "engine+behavior is already a complete core, directives are sugar"
trim case **fails** — `ViewBehavior` is imperative show/hide of one element; `view:if`/`switch` are
*structural* (add/remove subtrees, branch selection over `CustomTemplateDirective`) — a capability the core
lacks, not the same mechanism re-wrapped. That capability gap is exactly what separates view's directives
(build) from the `tabs` wrapper and `SmartLink` (both the same mechanism re-exposed → trim).

**Rulings (applied in place):**
- **Fork 1 `tabs` → TRIM.** `we:src/_data/blocks/tabs.json` `exports` → `["TabGroupBehavior",
  "TabActivationMode", "TabOrientation", "TabChangeEventDetail"]` (the shipped barrel surface). The 4
  declared `TabsComponent`/`Tab*Attribute` symbols named the *optional wrapper* the contract's own
  `designDecisions.syntax.chosen` never made canonical. Clears the tabs export-shape warning.
- **Fork 2 `transient-component` → TRIM + add.** `exports` → `["TransientElement", "AutoHeading",
  "calculateHeadingLevel", "registerTransient"]`. Dropped `withSelfReplacement` (superseded by the abstract
  `TransientElement` base class) and `SmartLink` (additive sugar over a complete core — same shape as the
  tabs wrapper, *not* load-bearing); added the under-declared `registerTransient`. Clears the transient
  export-shape warning.
- **Fork 3 `view` → RENAME + BUILD.** `exports` `ViewEngineOptions` → `ViewOptions` (pure rename, ships at
  `fui:blocks/view/ViewEngine.ts:22`). Kept `ViewShowBehavior`/`ViewIfDirective`/`ViewSwitchDirective`
  declared (load-bearing, build verdict) → filed **#1217** (`locus: frontierui`, parent #904) to build the
  family. View's export-shape warning persists on those 3 symbols until #1217 lands — expected.

**Net:** 2 of 3 findings cleared by trim; 1 reduced (view 4→3 symbols, rename resolved) pending the #1217
build. `SmartLink` deliberately *not* spawned as a build (trim verdict); if later wanted it is an additive
`locus: frontierui` build under #904 (separate prioritization). No symbol both trimmed and built.
