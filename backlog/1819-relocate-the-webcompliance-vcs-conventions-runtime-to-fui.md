---
kind: story
size: 2
parent: "1294"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Relocate the webcompliance VCS-conventions runtime to FUI

Discovered during #1814: webcompliance also ships we:webcompliance/conventions/vcs.ts — a self-contained VCS-conventions runtime (resolveVcsConventions + checkBranchName/checkCommitMessage/checkPullRequest + platformDefaultVcsConventions) that violates #1282 but sits outside the gate/waiver/audit cascade (no imports, fully independent). Relocate it to fui:webcompliance/ (with its tests), then delete the WE copy — a small standalone subsystem move, parallel to the gate cascade. Its conformance shape (config → pass/fail checks) is facts→verdict-like; fold into the webcompliance suite or its own when conformance is wired.
