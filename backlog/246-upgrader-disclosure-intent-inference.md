---
type: idea
workItem: task
parent: "094"
status: resolved
dateOpened: "2026-06-09"
blockedBy: ["008", "189"]
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: blocks/renderers/upgrader/analyzers/legacyWebComponent.ts (disclosure inference rule)
tags: [upgrader, intents, analyzer, disclosure, conformance, deferred]
relatedProject: webintents
crossRef: { url: /backlog/189-upgrader-intent-inference/, label: "Upgrader intent inference (#189)" }
---

# Add `aria-expanded`/`hidden` → `disclosure` inference to the upgrader once the disclosure intent ships

Deferred from [#189](/backlog/189-upgrader-intent-inference/) (intent inference). That item shipped the
deterministic `selection` (role="listbox" + aria-selected) and `motion` (prefers-reduced-motion guard)
rules in `blocks/renderers/upgrader/analyzers/legacyWebComponent.ts`. Its third worked example — a
toggled `aria-expanded`/`hidden` pair → `disclosure` — was **intentionally omitted**, because
`disclosure` is **not yet a standard intent** (it's gap [#008](/backlog/008-gap-12-disclosure-intent/)).
Inferring an intent that doesn't resolve in `intents.json` would fail the upgrader's verify gate, so the
"prefer omission over a shaky inference" discipline applies.

**Blocked on #008.** When the `disclosure` intent exists in the standard:

- Add an `aria-expanded` + `hidden` (toggled disclosure) rule to `inferIntents()` in the reference
  analyzer, with its own note (same "flag, don't fake" conservatism — require both signals).
- Add a shared fixture case to `blocks/renderers/upgrader/__fixtures__/upgrader-cases.ts`
  (`expectIntents: ['disclosure']`) so the unit suite + Code Upgrader playground both exercise it.
- Add `disclosure` to the demo's `knownReferenceIntents` set so the verify gate shows it green.

## Progress

- **Status:** resolved (2026-06-10). #008 shipped `disclosure` in `intents.json`, so the deferred
  third rule was implemented:
  - **Rule** — `inferIntents()` in `blocks/renderers/upgrader/analyzers/legacyWebComponent.ts` now
    emits `disclosure` when the lifted markup carries **both** `aria-expanded` and a bare `hidden`
    attribute. The `hidden` match is anchored (`(?:^|[\s"'])hidden(?:[\s=>/]|$)`) so the unrelated
    `aria-hidden` attribute never trips it — same two-signals "flag, don't fake" discipline as
    `selection`. Replaced the old "omitted because #008" placeholder note in place.
  - **Fixture** — added shared case `disclosure-intent` (`expectIntents: ['disclosure']`) to
    `blocks/renderers/upgrader/__fixtures__/upgrader-cases.ts`, so the data-driven suite + the Code
    Upgrader playground exercise the same input.
  - **Demo** — `disclosure` added to `knownReferenceIntents` in `demos/code-upgrader-demo.ts`.
  - **Tests** — three dedicated cases in `blocks/__tests__/unit/renderers/upgrader.test.ts` (positive
    inference + note; aria-expanded-alone negative; aria-hidden anchor-guard negative). Full file
    green (27 tests); `check:standards` 0 errors.
