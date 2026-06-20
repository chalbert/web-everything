---
kind: task
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [droplist, autocomplete, spec, blocks, plateau-debt]
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Autocomplete spec's "built today" status is stale (still reads plateau)

The `autocomplete` entry in [fui:src/_data/blocks.json](../src/_data/blocks.json) describes the
built-vs-proposed state of the droplist traits against the **abandoned plateau** prototype, which is
now wrong. Two phrases are stale after [#138](/backlog/138-auto-complete-element-and-demo/) shipped
the real `<auto-complete>` element + all six traits in **Frontier UI**:

- *"…the controller param (**now real in plateau fui:FocusDelegation.ts**)…"* — should point at Frontier
  UI's `fui:blocks/droplist/FocusDelegation.ts`, not plateau.
- *"clearable, filter, live-status, and windowed are **spec-proposed trait surfaces (only
  focus-delegation, selection, and anchor are built today)**…"* — `clearable`, `filter`, and
  `live-status` are now **built and tested** in `frontierui/blocks/droplist/` (`fui:Clearable.ts`,
  `fui:Filter.ts`, `fui:LiveStatus.ts`). Only `windowed` remains genuinely unbuilt.

Fix: update the prose to reflect the live reference implementation (Frontier UI), drop the plateau
reference, and re-scope "proposed" down to just the surfaces that really aren't built yet
(`windowed`). Re-run `check:standards`. This is documentation reconciliation only — no API change.

Caught during #138 close-out (the element the spec called "not built" is exactly what #138 shipped).
A wider sweep of remaining `plateau` mentions across `src/_data/*.json` may be worth a follow-up, but
this item is scoped to the autocomplete entry.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:** Updated the two stale phrases in [fui:src/_data/blocks.json](../src/_data/blocks.json)
  autocomplete entry. (1) `controller param (now real in plateau fui:FocusDelegation.ts)` →
  `Frontier UI's fui:blocks/droplist/FocusDelegation.ts`. (2) The "spec-proposed trait surfaces (only
  focus-delegation, selection, and anchor are built today)" claim was *itself* more stale than the
  item knew — `windowed` is also built (`fui:Windowed.ts`, 244 lines, tested in `fui:behaviors.test.ts`).
  Rewrote to: all six trait surfaces (clearable, filter, live-status, windowed + focus-delegation,
  selection, anchor) are now built and tested in Frontier UI's reference implementation. `check:standards`
  green.
- **Next:** none — done.
- **Notes:** Wider `plateau`-mention sweep done as the close-out leftover check — no defects of this
  class remain. Surviving mentions are legitimate: research topics documenting the historical
  plateau→WE migration, and "Plateau's Technical Configurator" which refers to the **plateau-app**
  product, not the abandoned prototype. No follow-up item created.
