---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/land-overlap-yield.mjs", "we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-overlap-yield.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Deterministic integration test: overlap-yield window derived from a real git-history config commit before/after the ready label

Follow-up from we:backlog/4314-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md, guard 2 (prevention owed by chalbert/web-everything#2831's independent review, referencing we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md:40): "Require a deterministic integration test with a configuration commit created before the ready label and merged afterward; derive the historical value from main's integration history or persist the epoch's deadline."

## Background
we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md (Design, rule 6 / windowMsAtLabelTime) derives a PR's overlap-yield window from we:scripts/drain-overlap-yield-config.json as it stood in WE main's git history at the PR's own readyAt(X) label time — never the live value — so a later widening of windowMinutes cannot resurrect an already-expired yield. Its own Test plan item 4 covers this with a FAKE git-history reader (an injected function returning canned values for canned timestamps), never a real git repository with a real settings-file commit before the label and another after. This finding asks for that: a true integration-level test.

## Design gist
A test (real, not simulated) that: (1) creates a throwaway git repo (or a fixture worktree of this one) with an initial commit to we:scripts/drain-overlap-yield-config.json at time T0 setting windowMinutes to some value W1; (2) computes/derives a readyAt(X) timestamp T1 > T0 that only sees W1 in history; (3) commits a SECOND change to the same config file at T2 > T1 widening windowMinutes to W2; (4) asserts windowMsAtLabelTime (we:scripts/conveyor/land-overlap-yield.mjs), when asked for the window in effect AT T1, returns W1-derived milliseconds, not W2s, i.e. it reads the historical commit at-or-before T1, never the current HEAD.

## Edge cases the test must cover
- No commit to the config file at all before T1 (file never existed at that point in history): falls back to the code default, per the design.
- A malformed config-file commit at some point in history (invalid JSON, or a field failing validation) that predates T1: the read falls back to the code default for that lookup, not to the file/commit AFTER it.
- A shallow clone of the fixture repo (git rev-parse --is-shallow-repository true): the design says "unreadable/shallow uses the smaller of current and default, with a warning" — the test proves this exact behavior, not merely "does not crash".
- The exact commit AT T1 (not before, not after) is the one whose config value should apply — an off-by-one boundary test.

## Test plan
One new test file or a new describe block co-located with we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs, using a real temp git repo (node:child_process git init / git commit -m, or the repo's existing git-fixture test helper if one already exists — check for one under we:scripts/__tests__/lib/ before writing a new one). This is explicitly the INTEGRATION test the unit-level fake-reader tests in we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md do not provide; it must exercise the real git-backed reader implementation, not an injected stub.

## Why filed, not built here
we:backlog/4314-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md's own MVP built a different guard (finding 4, in we:scripts/operations/completion-store.mjs, an unrelated file); this finding is its own self-contained integration-test task against already-shipped and already-resolved we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md code, filed separately per this repo's single-responsibility/small-file preference rather than folded into an unrelated change. Its own `Done when` is left as the standard un-prepared placeholder on purpose — like every mechanically-filed card, it gets its own PREPARE pass when a delivery agent picks it up.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
