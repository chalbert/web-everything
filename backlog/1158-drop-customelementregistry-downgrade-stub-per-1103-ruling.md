---
kind: task
parent: "1088"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "plugs/webregistries/CustomElementRegistry.ts"
tags: []
---

# Drop CustomElementRegistry.downgrade() stub (per #1103 ruling)

Ratified #1103 (native-first, codified at we:docs/agent/platform-decisions.md#native-first-baseline): a polyfill mirrors the native surface and native CustomElementRegistry has no downgrade. Delete the downgrade() stub at we:plugs/webregistries/CustomElementRegistry.ts:169 and the should-have-downgrade-method assertion at we:plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts:220. Single task, no design left.
