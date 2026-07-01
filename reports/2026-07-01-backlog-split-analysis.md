# Backlog split analysis — 2026-07-01

Focused run: `/split 1994`; appended `/slice 2005`.

---

# `/slice 2005` — SSR & hydration of comment-anchor directive regions

Focused run on the childless epic **#2005** (`kind: epic`, parent #1971, no children).

## Work-investigation pass (frontierui)

The epic's own body claims "no SSR surface exists in FUI today." Verified against the tree:

- **Comment-anchor directive surface is parse/lifecycle only** — `fui:plugs/webdirectives/` holds
  `fui:plugs/webdirectives/CustomComment.ts`, `fui:plugs/webdirectives/CustomCommentParser.ts`,
  `fui:plugs/webdirectives/CustomCommentParserRegistry.ts`,
  `fui:plugs/webdirectives/CustomCommentRegistry.ts`, `fui:plugs/webdirectives/directiveLifecycle.ts`,
  `fui:plugs/webdirectives/multiTemplate.ts`. **No server renderer, no `renderToString`, no hydration
  hook** anywhere in this path.
- **The only SSR/hydration tokens in FUI live in *other* plugs** —
  `fui:plugs/webinjectors/declarativeInjector.ts` (#1827 client-only injector-context hydration),
  `fui:plugs/webregistries/declarativeRegistry.ts` (an SSR *guard*, not a renderer),
  `fui:plugs/webportals/__tests__/unit/webportals.ssr.test.ts` (a frozen SSR-**contract** kit that ships
  *no* runtime). None is a comment-region server renderer or a comment-region hydration hook.
- **Conclusion:** the four children the body proposes — serialize / server-render / hydrate / streaming —
  have **no design and no impl** (a true GAP). The seams can't be `file:line`-grounded because the surface
  they'd cut through does not exist.

## Could not split — #2005

| NNN | title | rubric condition failed | unblocking action |
|-----|-------|-------------------------|-------------------|
| #2005 | SSR & hydration of comment-anchor directive regions | **(1) Volume, not uncertainty** — every proposed child is design-gated behind a foundational "how does FUI server-render + hydrate a comment-anchor region" call with no design *and* no impl. Slicing would scatter the same unmade decision across serialize/server-render/hydrate/streaming children. Also fails **(2)/(3)** downstream — no `file:line`-citable surface to name in any slice. | **Resolve the foundational SSR-of-comment-regions design first.** File it as a `kind: decision` card (`status: open`), point #2005's `blockedBy` at it, set `childlessReason: blocked`, and de-bury the inline fork in #2005's body → pointer to the card. Re-run `/slice 2005` once the decision lands: it then cuts into serialize / server-render / hydrate / streaming stories with real seams. |

**No partial split is available.** The only carve-able unit today is the single foundational design spike
itself — that's *one* item, not the ≥2 independent slices rubric (2) requires, so it's a decision to file,
not a split to execute.

---

# `/split 1994` (original run)

## Candidate

| NNN | workItem | size | why a candidate |
|-----|----------|------|-----------------|
| 1994 | story | 13 | oversized (>8); chunk 4 of Custom Type Registry family (#1990) |

## Work-investigation pass (frontierui)

Verified the item's factual claims at `file:line`:

- **Three directives** all extend `CustomAttribute` with `#private` initializer fields:
  `fui:blocks/view/ViewIfDirective.ts:37` (+ `#startMarker`/`#endMarker`/`#stampedNodes`/`#reactive`),
  `fui:blocks/view/ViewSwitchDirective.ts:34`, `fui:blocks/for-each/ForEachBehavior.ts:98`. Confirms the
  chunk-2 re-prototype constraint (no `#private` initializers; move init into `connectedCallback`).
- **view:if / view:switch are dead-on-site.** `registerViewDirectives` (`fui:blocks/view/registerViewDirectives.ts:13`)
  is only *exported* (`fui:blocks/view/index.ts:7`) — **never called in bootstrap or bootstrapUnplugged**.
  Only their unit tests drive them.
- **for-each is the only live one.** `registerForEach(window.attributes)` at `fui:plugs/bootstrap.ts:295`
  and `registerForEach(attributes)` at `fui:plugs/bootstrapUnplugged.ts:193`.
- **`CustomTemplateTypeRegistry` is instantiated/driven NOWHERE in the app** — grep for
  `register(customTemplateTypes)` / `customTemplateTypes.upgrade` / `window.customTemplateTypes`
  returns **zero live hits**; it exists only in `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts`
  (`localName = 'customTemplateTypes'`, Plug-shaped) and its unit test. So dropping for-each's
  `CustomAttribute` define without wiring activation silently breaks live for-each, gate-invisibly.
- **#1993 (operand spelling) is resolved** (`condition`/`match`/`items="… as …"`+`key`;
  codified in `we:docs/agent/block-standard.md#directive-operand-attribute-names`).
- **No existing decision card** for the parity-wiring seam.

## Could split — #1994

The story bundles (a) genuine volume — three class migrations + activation wiring across ~15 sites —
**and** (b) one unmade design decision (the parity-wiring seam). Extracting the decision leaves clean
volume; the dead-on-site vs. live seam gives real independence.

### Slices (scaffolded on approval)

| slice | NNN | workItem | size | home | scope |
|-------|-----|----------|------|------|-------|
| **A** view:if + view:switch migration | #2011 | story | 3 | frontierui `blocks/view` | migrate both off `CustomAttribute` → `CustomTemplateType`, drop their defines. Dead-on-site → no live regression possible. Independent — batchable now. |
| **D** parity-wiring seam | #2010 | decision | — | webeverything backlog | choose (a) per-site `customTemplateTypes.upgrade` ×~15 / (b) shared value-space seam / (c) couple registries. Extracted from #1994's body. |
| **B** activation wiring | #2012 | story | 5* | frontierui `plugs` + sites | implement D so `customTemplateTypes` reaches parity with `attributes`. `blockedBy #2010`. |
| **C** for-each migration | #2013 | story | 3 | frontierui `blocks/for-each` | flip live for-each onto the now-live registry, drop its define. `blockedBy #2012`. |

\* **B is decision-gated in size:** resolution (a) (~15 sites) may hold at 5 → then a future `/split`
candidate; (b)/(c) land it at ~3. Left provisional until D resolves.

### DAG

```
A  (independent — batchable now)
D → B → C   (chain; D unresolved)
```

Every slice leaves a valid demoable state: A/B are no-ops for live behavior; C flips for-each onto the
already-live registry.

## Could not split

None deferred as un-analysable. The only gate to full execution is **decision D (#2010)**, which the
split *extracts* rather than leaves buried — A lands now; B/C register as Tier-B blocked on D.
