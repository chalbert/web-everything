---
bornAs: xp7piyt
kind: story
size: 3
parent: "2612"
status: open
blockedBy: ["2749"]
relatedTo: ["2123", "2302", "883", "2677"]
dateOpened: "2026-07-28"
tags: [guard, pretooluse, enforcement, hook, main-session, conveyor]
scope:
  - we:scripts/guard-bash.mjs
  - we:scripts/__tests__/guard-bash.test.mjs
---

# Implement the PreToolUse tree-write backstop in we:scripts/guard-bash.mjs

Add the 4th banned-arm to we:scripts/guard-bash.mjs's pure reason() (ratified #2749): hard-deny a build that writes the shared PRIMARY tree at primary cwd — an npm run build, an fs-writing generator script, or a redirect/tee/sed -i into a primary path — a blacklist entry consistent with the existing banned-command table. Key on the TREE-WRITE, never on session identity (reported Bash cwd resets to primary between calls, #2335, so a cwd/identity gate would wedge a delegated subagent's lane-scoped verify). MAIN_SESSION_BUILD_OK=1 is the loud sanctioned one-off escape, mirroring MAIN_PUSH_OK/LANE_GUARD_OFF. Also add the WARN-only nudge for the un-decidable 'this session should have delegated' half (stderr warn, return null — never deny; a hard-deny there kills delegated builds). Pure + unit-tested in we:scripts/__tests__/guard-bash.test.mjs; fail-open on a guard fault. Folds under #primary-read-only-lanes-only (4th arm).
