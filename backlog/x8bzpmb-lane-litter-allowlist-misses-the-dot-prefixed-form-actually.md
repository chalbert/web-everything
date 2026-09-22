---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/lib/lane-litter.mjs", "we:scripts/lib/__tests__/lane-litter.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Lane litter allowlist misses the dot-prefixed form actually written in practice

Live-caught 2026-09-22 investigating why we:scripts/conveyor/lane-pool-health-watch.mjs left 8 of 10 plateau-app lanes dirty: at least 2 of those (and several WE lanes too, e.g. lanes 1/11/20/27/28/30/44/48) have exactly ONE dirty file, we:.review-loop-output.json -- which LOOKS like it should already be safe litter. Confirmed directly: we:scripts/lib/lane-litter.mjs's LANE_RELEASE_LITTER_ALLOWLIST has the pattern we:review-*-output.json (no leading dot), and isAllowlistedLitterPath returns true for we:review-loop-output.json but false for we:.review-loop-output.json -- the exact real-world filename actually written in practice has a leading dot the pattern never accounted for. Same likely gap for the other three allowlisted patterns (we:.commit-msg.txt, we:.pr-body.md, we:.pr-body.txt, we:commit-msg-fix-*.txt) if their own dot-prefixed forms are ever written. Fix: add the dot-prefixed variant of each existing pattern as its own explicit new list entry, per this file's own stated philosophy ('extend this list, don't loosen the mechanism, if another safe pattern is found later') -- not a change to the generic glob-matching semantics. Deliberately does NOT add any pattern this session has not previously vetted as safe (several OTHER never-before-allowlisted scratch-looking files were also observed dirty, e.g. we:.pr-land-result.json, we:.open-pr-out.json, we:.delivery-commit-msg-*.txt, we:.prep-*.md/.txt -- left alone, not assumed safe, a human call for a future item if warranted).

## Progress

Correction: only 2 of the existing 5 patterns actually lacked a dotted form -- we:.commit-msg.txt, we:.pr-body.md, we:.pr-body.txt already start with a dot; only we:review-*-output.json and we:commit-msg-fix-*.txt did not. Added exactly those two as new dot-prefixed entries (we:.review-*-output.json, we:.commit-msg-fix-*.txt), not four. Confirmed by reintroduction: the new test fails against the pre-fix 5-entry list and passes with the fix. The no-directory-traversal guard (a slash-containing candidate never matches even a dotted pattern) is confirmed to still hold for the new entries too. 25/25 tests pass in we:scripts/lib/__tests__/lane-litter.test.mjs; the 40 tests in we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs (which shares this same allowlist) also still pass unchanged.

Deliberately did NOT add several other scratch-looking files also observed dirty during this investigation (we:.pr-land-result.json, we:.open-pr-out.json, we:.delivery-commit-msg-*.txt, we:.prep-*.md/.txt) -- none of these are a dotted form of an ALREADY-vetted pattern, so adding them would be a genuinely new safety judgment this item's own narrow scope does not make.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-litter.test.mjs` passes (25/25): the dot-prefixed form of we:review-*-output.json and we:commit-msg-fix-*.txt now matches (confirmed by reintroduction to fail without the fix); the un-dotted forms still match (this is an addition, not a replacement); the dotted pattern still respects the no-directory-traversal guard; the exact-list pin now includes both new entries.
