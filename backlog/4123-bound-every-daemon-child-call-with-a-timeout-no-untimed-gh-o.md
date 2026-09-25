---
bornAs: xe3plfl
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/review-label-provider.mjs", "we:scripts/lib/main-staleness.mjs", "we:scripts/conveyor/stuck-pr-watch.mjs", "we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/pass-daemon.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Bound every daemon child call with a timeout — no untimed gh or git on any daemon tick path

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Findings D9, R4, F1, P2, N1 (just speed it up). Untimed execFileSync/spawn calls on tick paths: we:scripts/lib/review-label-provider.mjs lines 116-138 (shared by review round/status tagging and parked-pr-conflict-watch writes); we:scripts/lib/main-staleness.mjs assertMainNotStale line 160 (git fetch per repo per fix-dispatch tick); we:scripts/conveyor/stuck-pr-watch.mjs lines 77, 100, 125; we:skills-src/conveyor/runner.mjs run() lines 312-321; every gh/git call in we:scripts/merge-ai-prs.mjs and quietGit in we:scripts/lane-drain.mjs (only the 45-min pass kill bounds them). One hung gh freezes the whole daemon, and pass-daemon only logs a lost lease, it never kills the child (we:skills-src/conveyor/pass-daemon.mjs 127-143). Fix shape: route through resolveChildTimeoutMs() plus killSignal SIGKILL, the pattern already in we:scripts/conveyor/reconcile-pass.mjs line 96; add a lint that fails a new untimed child call under we:scripts/conveyor/ and we:skills-src/conveyor/. Done when: the lint passes on the tree; a test per module proves a stubbed hung child is killed at its bound; LIVE proof: a daemon tick run against a gh stub that sleeps forever ends within its bound (log excerpt in the PR).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
