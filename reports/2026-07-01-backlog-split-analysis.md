# Backlog split analysis — 2026-07-01

Focused run: `/split 1994`.

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
