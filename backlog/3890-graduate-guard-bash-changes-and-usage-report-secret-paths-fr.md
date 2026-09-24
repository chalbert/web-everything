---
bornAs: x28e3i6
kind: story
size: 3
parent: "3443"
status: resolved
scope: ["we:scripts/__tests__/guard-bash.test.mjs", "we:scripts/guard-bash.mjs", "we:scripts/lib/usage-report-secret-paths.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Graduate guard-bash changes and usage-report-secret-paths from lane/mechanical-dispatcher to main

Ports 2 files (we:scripts/guard-bash.mjs, we:scripts/lib/usage-report-secret-paths.mjs) plus their tests. main changed we:scripts/guard-bash.mjs 14 times since the merge base: diff-merge, keeping every guard main added. Main also changed these files, so each gets a diff-merge: we:scripts/guard-bash.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/guard-bash.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

### Merge notes for #3890 (2026-09-22)

**`we:scripts/guard-bash.mjs`**
- **Main side:**
  - #3390 / #2108 write-target hardening: sed `w` / `e`, `-i` suffixes, perl `open()` / argv writes, the ReDoS fix, GNU-abbreviated options, variable flags, the perl allow-list.
  - `6b0d326dd` (#3383): hard-deny a backgrounded direct-task dispatch.
  - `d622b4d80` (3785): the heavy-admission pool, and raw heavy commands join the verification set.
  - Main already has a `dispatchKind === 'delivery'` lifecycle deny block (#3627) and already passes `dispatchKind` into `reason()` from `WE_DISPATCH_KIND`.
- **Branch side:**
  - The `'delivery'`-only block is generalized into a `WRAPPER_OWNED_AGENTS` table (`delivery` plus the new `repair` kind, #3640).
  - New deny blocks for `decision-authoring` (#3644) and `scope-authoring` (#3642).
  - New `usageReportSecretReadReason`: any dispatched agent is denied a reference to `~/.we-usage-report` or its Keychain service. It is checked first in `reason()`.
  - Docblocks updated for all of the above.
- **Trial merge:**
  - Against `ca7e68b71`: 8 conflicts.
  - Against the effective base `c6d02e777` (the branch equals that commit plus about 327 added lines): **4 conflicts**:
    1. **Header docblock, around line 99.** Main's DELIVERY AGENT bullet against the branch's four bullets (wrapper-owned, decision-authoring, usage-report, scope-authoring). Take the **branch** side; it replaces main's bullet.
    2. **Just before `export function reason`.** Main side is empty; branch adds `WRAPPER_OWNED_AGENTS` and `usageReportSecretReadReason`. Take the **branch** side.
    3. **The comment block in `reason()` above the lifecycle table.** Main side is empty; branch adds the #3645, #3629 and #3640 notes. Take the **branch** side.
    4. **The lifecycle deny block.** Main's `if (dispatchKind === 'delivery') {…}` against the branch's `owner` table plus the decision-authoring and scope-authoring blocks. Take the **branch** side. For `delivery`, the table produces word-for-word the same messages as main's block.
  - Everything else merges cleanly and main's guards are kept: the heavy-admission and `SED_ADDR_W` counts are the same as main's, and the only lines removed from main are the replaced delivery block. The result parses.
- **Dependencies:** a new import from `we:scripts/lib/usage-report-secret-paths.mjs`, which is not on main. It is in this card's scope; copy it verbatim (it imports only `node:os` and `node:path`).
- **Semantic risks:**
  - The `repair`, `decision-authoring` and `scope-authoring` blocks do nothing on main until their wrappers land and start setting those kinds in `WE_DISPATCH_KIND`. That wiring belongs to other slices, and no test depends on it.
  - The usage-report check runs first in `reason()`, so for any dispatched agent it takes precedence over main's checks. It only fires on that one secret path or Keychain name.

**`we:scripts/__tests__/guard-bash.test.mjs`**
- Effective base `c6d02e777` gives **5 conflicts** (`21aaedb0b` gives 7):
  1. **Import list.** Keep both: main's `isHeavyRawRun, isAdmittedWrapperRun, isDirectTaskInvocation, backgroundedDirectTaskReason`, then the branch's `usageReportSecretReadReason`.
  2. **After the backgrounded-verification describe.** Keep both: main's 3785 heavy-spellings describe, then the branch's usage-report describe. Both sides stop partway through an `it`, so insert `  });\n});\n` between them; the shared tail closes the branch block.
  3. **Inside `denies we:scripts/pr-land.mjs for a delivery-agent session`.** Take the **branch** side (an added #3321 fixture comment).
  4. **The `never fires … other dispatch kind` command list.** Take the **branch** side (the same line plus a trailing comment).
  5. **End of file.** Keep both: main's three #2108 review-r6 describes, then `});\n`, then the branch's #3629 and #3644 describes.
- Resolved this way, the test passes **756/756** against the merged guard-bash on main's tree.

**Worker steps**
1. Add `we:scripts/lib/usage-report-secret-paths.mjs` verbatim from `ff1618065`.
2. `git merge-file` `we:scripts/guard-bash.mjs` with base = `c6d02e777`'s copy. Resolve all 4 conflicts to the branch side.
3. `git merge-file` `we:scripts/__tests__/guard-bash.test.mjs` with base = `c6d02e777`'s copy. Resolve as listed above, adding the two closing-brace separators in conflicts 2 and 5.
4. Run `node --check` on both files, then the test file (expect 756 passing), then the full gate.
