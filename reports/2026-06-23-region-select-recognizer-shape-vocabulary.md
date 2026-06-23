# Region-select recognizer-shape vocabulary — promote marquee to an intent?

**Point:** Marquee shipped (#1406) as a single behavior block on YAGNI; the open residual (#1463) is whether a `region-select` intent with a `shape: rect | lasso | …` dimension earns a home. This is a validation gate, not a fork — recommended verdict **NOT-YET**, un-gated only when a *second* real recognizer shape recurs. No second-shape consumer exists in the backlog today.

---

## What this prepares

The Fork-1 residual of resolved #1406. #1406 ratified marquee/rubber-band selection as a behavior block — the FUI `marquee-select` block composing the `selection` intent's result set plus a native pan recognizer — explicitly *not* a cross-cutting intent (one rectangle, one algorithm, surface-bound = a behavior, per behavior-can-do-vs-element-is-a). It also rejected `scope: spatial` on `selection` (Fork-1c) outright. #1463 holds the question #1406 deferred: does a broader recognizer-shape *vocabulary* eventually earn a `region-select` intent home, with marquee as its first realization?

It is the third decision archetype: a one-sided **validation gate** (go / no-go on a candidate, gated on a trigger), not a merit fork. There is no excluded rival branch.

## Prior-art delta — recognizer-shape vocabularies

| Incumbent | Recognizer shapes it ships | WE semantic delta |
|---|---|---|
| tldraw | Rectangle only ("brush" box-select). | Matches WE's exact state — one rect behavior, no vocabulary. |
| Excalidraw | Rect box-select first; **added free-form lasso later** (Douglas-Peucker-simplified closed path) on demand. | The canonical "second shape recurred" event (issues #6350 / #6494) — exactly the trigger #1463 waits for. |
| Figma | Rect marquee native; lasso via plugin. | Two shapes, lasso opt-in — partial, demand-driven vocabulary. |
| Miro / Fabric / Konva | Single rect rubber-band. | Canvas libs ship one rect; the app layers other shapes. |
| Photoshop / GIMP | Rectangular + elliptical marquee, free-form lasso, **polygonal lasso**, magnetic lasso, **magic-wand**, nearest/center. | The mature end-state: a true shape *vocabulary*. Only graphics-grade tools reach it. |

**Delta:** incumbents converge on the rectangle as the *first* shape and only grow a vocabulary as the tool matures (Excalidraw rect → lasso is the textbook arc). WE is at the first-shape stage; the vocabulary is real but not yet demanded.

## Native grounding

No native region-select primitive: no `Element.intersects()`, and `IntersectionObserver` is viewport-relative (not rect-vs-rect). Every shape is hand-rolled over Pointer Events + `setPointerCapture` + AABB/point-in-polygon over `getBoundingClientRect`. WE owns exactly one shape today — the rectangle AABB — in the FUI block's pure geometry core: fui:blocks/marquee-select/marqueeMath.ts:25 (bandRect), :35 (hitTest, with the #1406 Fork-2 intersect/contain/center mode at :19), :62 (resolveSelection over the replace/add/toggle/subtract modifier vocab at :22). The controller fui:blocks/marquee-select/MarqueeSelect.ts:45 is thin glue over Pointer Events; the a11y-parity keyboard equivalent is extendByKeyboard at :38/:106.

## The pure-`selection` invariant (untouched)

The we:src/_data/intents/selection.json intent stays pure — dimensions `model` / `immediacy` / `variant` / `grouping` / `deselectable`, with no `scope`, no pointer, no rect (#1406 Fork-1c). Promotion would re-home the *gesture/geometry* layer (the marqueeMath core), never push geometry into the choice contract — that would implicate non-spatial consumers (a radio group) with geometry they cannot satisfy.

## Recommendation

**NOT-YET** (YAGNI on the intent), confidence ~85%. WE ships one recognizer shape and one realization; a `region-select` intent now would invent a `shape` dimension with exactly one member — speculative generality the not-a-prioritization and most-permissive-default rules don't license.

**Concrete un-gate trigger:** a *second* real recognizer shape recurs as demand — free-form **lasso** (the Excalidraw precedent), **polygon**, or **center-point / nearest** — at which point a `region-select` intent with `shape: rect | lasso | …` earns its home, marquee as its first block, geometry re-homed off the single block.

## Skeptic

Attacked NOT-YET by hunting for a second recognizer-shape consumer already in the tree: grepped backlog for lasso / polygon / free-form / magic-wand / nearest / region-select / center-point. The only selection-recognizer hits are #1463 and #1406 themselves; the polygon / free-form hits elsewhere are unrelated (hover-intent safe-area corridors #609/#643, governance/text contexts). **SURVIVES — no second recognizer shape has real demand yet; NOT-YET holds.** Had a real lasso/polygon consumer existed, the verdict would flip to GO.
