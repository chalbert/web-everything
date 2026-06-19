---
type: idea
workItem: task
parent: "1088"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webregistries/CustomElementRegistry.ts"
tags: []
---

# CustomElementRegistry getStandInElement() extraction + define() duplicate validation

Extract the inline stand-in creation at we:plugs/webregistries/CustomElementRegistry.ts:114-125 into a getStandInElement() covering autonomous + customized-built-in bases, and implement the duplicate name/constructor guard at we:plugs/webregistries/CustomElementRegistry.ts:80. Slice C of #1088 (we:reports/2026-06-19-backlog-split-analysis.md). Demo: unit tests for stand-in registration (both element kinds) + duplicate-define throwing. Shares define() with slice B (#1101) — don't batch in the same concurrent slot.

## Progress

Two changes to `we:plugs/webregistries/CustomElementRegistry.ts`:
- **Extracted `#getStandInElement(options)`** from the inline stand-in creation in `define()` — builds the
  native stand-in the browser registers to parse a scoped tag: an autonomous element stands in on
  `HTMLElement`, a customized built-in (`options.extends`) on its `HTML*Element` base (e.g. `'button'` →
  `HTMLButtonElement`, falling back to `HTMLElement`).
- **Duplicate-define guard** at the `define()` TODO: throws `DOMException('NotSupportedError')` on a
  duplicate name (`hasOwn`) or duplicate constructor (`getLocalNameOf`) **on this registry**, mirroring
  native semantics. Per-registry (the same constructor may live in different scoped registries — the
  native-construction memo is separate).

Unit test `we:plugs/webregistries/__tests__/unit/getStandInElement.test.ts` — 5 green (autonomous +
customized-built-in stand-in bases, duplicate-name throw, duplicate-constructor throw, same ctor allowed in
a different registry). Also fixed a stale sibling test in `CustomElementRegistry.test.ts` that asserted the
old `whenDefined` reject-stub (replaced by #1101's real promise) — un-skipped the already-defined fast-path
test and replaced the reject assertion with the pending→define resolution. Full webregistries suite 58
green; WE `check:standards` 0 errors.
