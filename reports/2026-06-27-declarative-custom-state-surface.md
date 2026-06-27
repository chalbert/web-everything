# Declarative custom-state surface — how a `<component>` declares & toggles `ElementInternals.states` for `:state()` styling

**Point:** A class-bodyless declarative `<component>` should declare its custom-state *vocabulary* with a `states="…"` allow-list attribute (mirroring the existing `default-aria-*` map-through) and toggle states *imperatively* via the same `internals` it already attaches — binding/predicate sugar is deferred to webexpressions, not a bespoke `state-when` mini-language. Custom states are a thin pass-through to a native platform primitive (`CustomStateSet`), so WE adds *declaration ergonomics*, never a state engine.

---

## Question

FUI's declarative `<component>` (`fui:blocks/renderers/component/declarativeComponent.ts`) already lowers two `ElementInternals` members declaratively: `form-associated` → `static formAssociated + attachInternals()` and the `default-aria-*` surface (#853). The natural next member is **custom states** (`internals.states` / `CustomStateSet`) so a declarative component exposes internal state that page CSS styles with the native `:state(…)` pseudo-class. The open call is the *authoring shape*: how a `<component>` with **no author class body** (a) **declares** which custom states it has and (b) **toggles** them at runtime — consistent with the sibling `form-associated` / `default-aria-*` members.

## Recommendation

Two genuine forks, each at most-permissive default:

1. **Fork 1 — Declaration syntax:** ship a single **`states="open active loading"` space-separated allow-list attribute** that declares the component's custom-state *vocabulary* (parsed into a validated identifier list, sorted for deterministic emit, exactly like `default-aria-*`). Confidence: **high**. Alternatives — a repeated `state-*` boolean-attribute family, or *no* declaration (infer from `:state()` selectors / let any string be toggled) — rejected: the former bloats the attribute surface for a flat list, the latter loses the validate-at-author-time parity with `default-role`/`default-aria-*` and silently accepts typo'd state names.
2. **Fork 2 — Toggle mechanism:** expose the attached **`internals` as the imperative escape hatch** (`this.internals.states.add('open')`) as the floor, and let the **already-shipped webexpressions binding layer** (`fui:blocks/parsers/*`, `{{ }}`/`[[ ]]`) drive declarative toggling where authors want reactivity — do **not** mint a bespoke `state-when="…"` predicate language. Confidence: **med-high**. A bespoke predicate DSL is rejected as a parallel reactive engine duplicating webexpressions (bias-to-reuse, "webexpressions binding layer already exists").

Both forks are pure pass-throughs to the native `CustomStateSet` primitive that `we:docs/agent/platform-decisions.md` already declares baseline-present (`#native-first-baseline`). WE/FUI adds *declaration ergonomics + a toggle seam*, never a state machine — that is the workflow-engine / LifecycleProvider's job, orthogonal to this surface.

## Key Findings

1. **`internals.states` is unused in FUI today.** `grep -rn "internals.states\|CustomStateSet" blocks/ src/` returns only `fui:blocks/workflow-engine` config (`cfg.states.draft` — a state *machine*, unrelated) and `fui:blocks/lifecycle/LifecycleProvider.ts` (`def.states[state]`). No element ever calls `internals.states.add/delete`. So this is a greenfield declarative surface, not a retrofit of scattered imperative code — confirming the item's "real leverage is the declarative surface" framing.

2. **The two sibling members are already mapped the same way — `states` should mirror them.** `form-associated` → `static formAssociated = true` + `#internals = this.attachInternals()` (`fui:blocks/renderers/component/declarativeComponent.ts:33,161,168`); `default-aria-*` → a parsed, **validated against an allow-list** (`VALID_ARIA_PROPS`, line 56-65), **sorted-for-determinism** (line 111) list mapped through in the constructor (line 171-178). A `states="…"` attribute parsed into a validated, sorted identifier list is the identical pattern — one more entry in the same `hasInternals` gate (line 155).

3. **`resize`/`shift` are public config, not state — CustomStateSet must not replace them.** `AutoComplete` declares `static observedAttributes = ['value','placeholder','disabled','resize','shift']` (`fui:blocks/droplist/AutoComplete.ts:54`) with public getters/setters (`get/set resize` line 409-415, `get/set shift` line 418-423). These are author-facing configuration (the public API), not internal state — exactly Lit's "public reactive property = input" vs "internal `@state()`" split. CustomStateSet is for the *internal* half.

4. **The one genuine internal-state candidate is already correctly modeled.** `AutoComplete` open/expanded is delegated to the `Anchored` behavior and surfaced via `aria-expanded` (`fui:blocks/droplist/AutoComplete.ts:40,118`, import line 7). An imperative `internals.states.add('open')` there is low-value without a CSS/demo consumer — so the leverage is the declarative surface, not an imperative retrofit.

5. **Custom states are NOT browser-managed — toggling is inherently imperative.** Per MDN, unlike `:hover`/`:checked`, `:state()` states "must be explicitly defined and toggled via JavaScript using the element's internal state map" — `internals.states` is a Set-like `CustomStateSet` with `.add(id)` / `.delete(id)` / `.has(id)` / `.clear()`. So the toggle floor is *necessarily* the imperative `internals` handle; the only question is whether WE adds declarative *sugar* on top (Fork 2).

6. **A reactive binding layer already exists — don't mint a second.** FUI ships webexpressions: `{{ }}` interpolation and `[[ ]]` parsers (`fui:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts`, `fui:blocks/parsers/text-node/double-square/DoubleSquareBracketParser.ts`, `fui:blocks/attributes/on-event/OnEventAttribute.ts`). A bespoke `state-when="expr"` predicate language would be a parallel reactive engine. The reuse path: a future expression *target* that writes into `internals.states` (e.g. `[[state.open]]="isOpen"`), not a new DSL.

7. **Dashed-ident `:--name` is deprecated; plain `:state(name)` is the standard.** Old Chrome `:--checked` syntax is deprecated in favor of `:state(checked)` (MDN, CSS-Tricks). So the declared identifiers are plain idents (no leading `--`), and `states="open active"` declares plain tokens — matching the `default-role` token validation (`/^[a-z][a-z-]*$/`, `fui:blocks/renderers/component/declarativeComponent.ts:95-96`).

8. **No intent owns "state"/component-state vocabulary.** `grep` of `we:src/_data/intents/` finds none; the closest is `we:src/_data/intents/disclosure.json` (`defaultState: open|closed`) which is an *intent dimension* for the disclosure UX, not the generic ElementInternals custom-state surface. `we:docs/agent/platform-decisions.md#native-first-baseline` (line 793) lists `:state()`/`CustomStateSet` as an assumed Baseline-2024 primitive. So this is a **block/impl surface** (FUI declarative-component ergonomics), not a new intent — no shared-registry mint needed (see Skipped registry need).

9. **The runtime twin lags the emitter — a real implementation gap to note.** `generateClassSource` handles `defaultAria` (`fui:blocks/renderers/component/declarativeComponent.ts:171-178`) but the runtime twin `defineFromDefinition` (line 212-250) does **not** — it destructures only `formAssociated, defaultRole` (line 216) and skips `defaultAria`. Any `states` adoption must wire **both** paths (the byte-emitted class *and* the runtime twin) or the demo/test twin diverges from the generated source. (Flagged for #1794's build, not a fork.)

## Files

| File | Lines | What it grounds |
|---|---|---|
| `fui:blocks/renderers/component/declarativeComponent.ts` | 33, 92-111, 155, 161, 168, 171-178 | `form-associated` + `default-aria-*` declarative map-through (the pattern `states` mirrors) |
| `fui:blocks/renderers/component/declarativeComponent.ts` | 56-65, 95-96, 111 | allow-list validation + token regex + deterministic sort (Fork 1 default's mechanics) |
| `fui:blocks/renderers/component/declarativeComponent.ts` | 212-250 | runtime twin `defineFromDefinition` lags emitter (impl gap, finding 9) |
| `fui:blocks/droplist/AutoComplete.ts` | 54, 409-423 | `resize`/`shift` are public config, not state (finding 3) |
| `fui:blocks/droplist/AutoComplete.ts` | 7, 40, 118 | open/expanded delegated to Anchored, modeled via `aria-expanded` (finding 4) |
| `fui:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts` | — | webexpressions binding layer exists (Fork 2, reuse not re-mint) |
| `we:docs/agent/platform-decisions.md` | 793 | `:state()`/`CustomStateSet` is an assumed Baseline-2024 primitive |
| `we:src/_data/intents/disclosure.json` | — | closest intent (defaultState dim) ≠ generic custom-state surface (finding 8) |

Sources: [MDN CustomStateSet](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet), [MDN :state()](https://developer.mozilla.org/en-US/docs/Web/CSS/:state), [CSS-Tricks custom state pseudo-classes](https://css-tricks.com/custom-state-pseudo-classes-in-chrome/), [Lit reactive properties](https://lit.dev/docs/components/properties/), [WICG custom-states-and-state-pseudo-class proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/custom-states-and-state-pseudo-class.md).
