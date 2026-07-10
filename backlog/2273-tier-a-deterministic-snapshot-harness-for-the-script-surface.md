---
kind: story
size: 5
parent: "2268"
status: resolved
blockedBy: []
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-10"
graduatedTo: "we:scripts/__tests__/golden-corpus-snapshot.test.mjs"
tags: []
---

# Tier-A deterministic snapshot harness for the script surface, wired into CI

Snapshot-test the deterministic script layer skills sit on — we:scripts/backlog.mjs (scaffold/resolve/settle), the we:scripts/check-*.mjs gates, and the hooks (we:scripts/lint-locus-prefix.mjs, we:scripts/guard-bash.mjs, we:scripts/guard-lane.mjs) — against the golden corpus: input fixture in, assert exit code + resulting file content. Folds in #2086 (batch carry-forward/reopen unit tests). Runs green in CI so any script change proves it breaks no historical case.

## Progress

- Built we:scripts/__tests__/golden-corpus-snapshot.test.mjs — replays all 92 fixtures in we:scripts/golden-corpus/* (mined by #2270) against the REAL exported pure decision function each script/hook calls: applyTransition/applySettle (backlog claim/resolve/release/settle), decide (guard-bash), laneGuardDecision (guard-lane), scanRepoLocusPrefixes (lint-locus-prefix), checkBudget (check-memory). backlog-created (no historical "before" to replay — first-appearance commits carry no CLI args) is checked structurally instead; backlog-settle (0 mined fixtures currently) is wired inert-until-seeded. A closing test cross-checks we:scripts/golden-corpus/index.json's counts against what's actually on disk. 97 assertions, all green.
- Built we:scripts/__tests__/backlog-cli-snapshot.test.mjs — the #2274 ephemeral-throwaway-clone substrate applied to the CLI itself: mkdtempSync + a copy of the real we:scripts/ tree (so we:scripts/backlog.mjs's own ROOT resolves inside the throwaway clone, never the real repo), spawns the REAL `node we:scripts/backlog.mjs <verb>` subprocess, asserts its actual process exit code + the resulting file on disk. 9 hand-authored smoke cases (claim/resolve/release/settle, the #911 decision-codification refusal, the #658 epic no-open-slice refusal — a CLI-only guard applyTransition doesn't own) — kept separate from the full corpus replay because the CLI stamps dates from the wall clock, so it can't byte-for-byte reproduce a historically-dated fixture the way the pure-function layer can.
- The harness itself caught a real regression while being built: the hook-guard-lane corpus's agent-memory-edit-in-primary fixture still asserted the PRE-#2123-tightening allow, stale against we:scripts/guard-lane.mjs's 2026-07-09 "agent memory is NOT exempt" policy change (same day, landed after #2270's mine). Fixed the miner's hardcoded template (we:scripts/mine-golden-corpus.mjs) and the on-disk fixture to deny, matching current behavior.
- Small refactors in service of the harness (no behavior change): extracted applySettle as a pure export in we:scripts/backlog/frontmatter.mjs — we:scripts/backlog.mjs's settle() and we:scripts/mine-golden-corpus.mjs's self-validation replay both now call it instead of each carrying its own copy of the same regex transform. Exported checkBudget from we:scripts/check-memory.mjs and added the IS_CLI entry-point guard (mirrors we:scripts/guard-bash.mjs) so importing it for that pure function no longer also runs the full sweep / --pre gate / exit call as an import side effect.
- #2086 (batch carry-forward/reopen unit tests) was independently resolved earlier the same day with its own extracted, unit-tested module (we:scripts/readiness/carry-forward.mjs + we:scripts/readiness/__tests__/carry-forward.test.mjs) — nothing left to fold in here.
- `npm test -- run` and `npm run check:standards` both green.
