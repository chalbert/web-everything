---
bornAs: xqt8yfc
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateStarted: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# check:standards gate — a skill naming a raw home that a declared operation owns

An operation is only half-built when its declaration lands. #3029/#3035 derive the CLI and HTTP callers from one declaration, but the third caller — the skill prose telling an agent which command to run — stayed a manual edit done once per operation by whoever remembered. Measured 2026-08-21: 5 of 11 operations are named by ZERO skills; 14 skills instruct we:scripts/lane-pool.mjs while 0 instruct dispatch-lane. Add a scan, same shape as the #2967 test-only-export warning, that fails when a skill names a raw home an operation declares over — unless marked as comparison or as that operation own docs.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/skill-operation-wiring.test.mjs` passes, and each
   of its guards is mutation-checked: flipping the delegation test to always-false, the exemption to
   never-applies, the `node ` prefix to optional, unknown-delegation to `raw`, subcommand matching to
   always-true, and the marker's reason requirement to absent each turn the suite red.
2. **Executable** — `npm run check:standards` emits a `#3224` warning for a skill line that instructs a
   non-delegating declared home, and emits NONE for `we:scripts/backlog.mjs claim`, which delegates.
3. **Observable** — every `#3224` warning on the tree is either fixed or carries an
   `@operation-home-ok: <reason>` naming the item that will remove it.
