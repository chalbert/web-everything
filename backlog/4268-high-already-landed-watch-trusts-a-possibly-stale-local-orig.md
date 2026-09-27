---
bornAs: xr27kat
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/already-landed-watch.mjs", "we:scripts/conveyor/reconcile-pass.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# HIGH: already-landed-watch trusts a possibly-stale local origin/main, risking closing a still-needed PR

HIGH — can close/resolve the wrong PR. Still-open Codex advisory finding from chalbert/web-everything#2769's FINAL review round (codex-correctness/correctness, [PLAUSIBLE]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies for this specific consumer.

FINDING: we:scripts/conveyor/already-landed-watch.mjs's runAlreadyLandedWatch defaults readPlan to runReconcilePass in we:scripts/conveyor/reconcile-pass.mjs, whose enrichPrsWithAlreadyLandedFacts calls fetchRef for only the PR's own ref, then reads main's ref PURELY LOCALLY via readMergeBase/readChanges/findMatchingCommit — with no git fetch of main anywhere in this path and no staleness guard of its own. we:scripts/conveyor/reconcile-fix-dispatch.mjs DOES run an assertMainNotStale guard before its own call into the same reconcile pass (used for a DIFFERENT purpose — the stacked-base conflict-fix cap's resolveMainSha), and we:scripts/conveyor/reconcile-pass.mjs's own comment on its main-sha resolver claims origin/main is kept fresh by that SAME guard — but we:scripts/conveyor/already-landed-watch.mjs is invoked as its own standalone CLI/watch and never goes through we:scripts/conveyor/reconcile-fix-dispatch.mjs, so it never benefits from that guard. If origin/main is stale in whatever checkout runs this watch, the already-landed detector can find a file 'landed' against a main that has since moved on, and running it with --apply then closes a PR that is still genuinely needed and resolves its backlog card.

EVIDENCE: grepped we:scripts/conveyor/already-landed-watch.mjs on origin/main for a main-refresh/fetch call — none exists; confirmed its runAlreadyLandedWatch export is referenced only from its own test file and its own CLI entrypoint, never from we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs, so the daemon-side staleness guard never runs before this watch's own reads.

PREVENTION (from the reviewer, still owed): before trusting containment for an apply-mode close, refresh/pin main (or reuse the same staleness guard) inside we:scripts/conveyor/already-landed-watch.mjs's own invocation path, and add a regression test with a stale local main plus a remote revert that must block closure.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
