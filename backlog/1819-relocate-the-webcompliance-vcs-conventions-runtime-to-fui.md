---
kind: story
size: 2
parent: "1294"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1294
tags: []
---

# Relocate the webcompliance VCS-conventions runtime to FUI

Discovered during #1814: webcompliance also ships we:webcompliance/conventions/vcs.ts — a self-contained VCS-conventions runtime (resolveVcsConventions + checkBranchName/checkCommitMessage/checkPullRequest + platformDefaultVcsConventions) that violates #1282 but sits outside the gate/waiver/audit cascade (no imports, fully independent). Relocate it to fui:webcompliance/ (with its tests), then delete the WE copy — a small standalone subsystem move, parallel to the gate cascade. Its conformance shape (config → pass/fail checks) is facts→verdict-like; fold into the webcompliance suite or its own when conformance is wired.

## Progress (batch-20260626-1811-1817-1819)

- Verbatim move (zero-import file, so no contract wiring): `we:webcompliance/conventions/vcs.ts` → `fui:webcompliance/conventions/vcs.ts`, header updated to note the #1282/#1819 relocation. The `conventions/` subdir is preserved, so the `../gate.resolvePolicy` `@link` and the test's `../conventions/vcs` import stay valid.
- Test moved: `we:webcompliance/__tests__/vcs-conventions.test.ts` → `fui:webcompliance/__tests__/vcs-conventions.test.ts` (13 cases, all green in FUI).
- Deleted both WE copies; the now-empty `we:webcompliance/conventions/` dir is gone. WE `webcompliance/` now holds only the pure `we:webcompliance/contract.ts` (#1808). Grep confirmed no other WE reference; WE was path-import only (no index re-export), so FUI's barrel is unchanged — vcs stays independent of the gate/waiver/audit cascade, to fold in when conformance is wired.
- Gates: WE `check:standards` **0 errors**; FUI `check:standards` clean for the changeset (no webcompliance findings).
