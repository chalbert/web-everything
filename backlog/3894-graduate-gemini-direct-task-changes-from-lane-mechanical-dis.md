---
bornAs: xl9vvqj
kind: story
size: 3
parent: "3443"
status: resolved
scope: ["we:scripts/__tests__/gemini-direct-task.test.mjs", "we:scripts/gemini-direct-task.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: one-off
tags: []
---

# Graduate gemini-direct-task changes from lane/mechanical-dispatcher to main

Ports 1 files (we:scripts/gemini-direct-task.mjs) plus their tests. Standalone. main changed this file 12 times since the merge base: diff-merge carefully. Main also changed these files, so each gets a diff-merge: we:scripts/gemini-direct-task.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

### Merge notes for #3894 (2026-09-22)

**`we:scripts/gemini-direct-task.mjs`** and **`we:scripts/__tests__/gemini-direct-task.test.mjs`**
- **Main side:**
  - Main created the script (`baeb001a7`), then added the #2254 fixes, the one-time `agy --conversation` resume, the TOOL_ERROR surfacing, the empty `--print` fix, and the FOREGROUND ONLY banner.
  - `d622b4d80` (3785): the full gate runs `npm run test:unit` instead of `npx vitest run`, with the matching one-line test change.
- **Branch side:** only `6761be552`, a squashed copy of main's files as of `90b9ab8a8` (script) and `34be1853e` (test). `git diff 90b9ab8a8 ff1618065 -- we:scripts/gemini-direct-task.mjs` is empty, so the branch made no change of its own.
- **Trial merge:**
  - Against `ca7e68b71`: 2 fake conflicts (the file is absent there, so git sees it as added on both sides).
  - Against the effective base `90b9ab8a8`: 0 conflicts, and the result is byte-identical to main.
- **Dependencies:** none.
- **Semantic risks:** copying the branch file over main would regress main's 3785 fix (back to a raw `npx vitest run`).

**Worker steps**
1. Confirm `git diff 90b9ab8a8 ff1618065 -- we:scripts/gemini-direct-task.mjs we:scripts/__tests__/gemini-direct-task.test.mjs` is empty.
2. Make no code change. Resolve this card as already at parity, noting that main is a superset of the branch.
