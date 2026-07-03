---
kind: story
size: 5
status: resolved
blockedBy: ["2183"]
relatedTo: ["1933", "1950", "2174", "2162", "104"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [workflow, lanes, drain, pr-flow, partition-removal]
---

# /workflow drops disjoint-partition; fans out ready-to-merge PRs

Spin-off (b) of #2183, and the **F3-first slice** (`/workflow` before the serial paths). Implements
directions 1–3 of #2183 for the parallel path: `/workflow` stops integrating inline and instead fans out
one **ready-to-merge PR per item**; the drain (separate, optional) serialises the landing.

## What is stripped (F2 = drop, reverses #1933)

With PR-per-item + a serial drain that rebase-retries on conflict, "git is the arbiter" is complete, so the
whole disjoint-partition subsystem in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`
is retired:

- the **probe → partition** split (concurrent vs serial) and its confidence/monolith/merge-risk predicate;
- the **serial lane** (Phase 4a) — every item now runs in its own lane;
- the **write-time file-lock layer** (#1945/#1936 reservations, fence, heartbeat) — no concurrent
  direct-merge means no clean-but-wrong-merge race to lock against;
- the **inline integrator** (Phase 4b–4h): merge-each-repo, rebase-retry, id-collision heal, derived regen,
  reconcile, reopen-unlanded, publish-main — all of it moves to the drain (`we:scripts/lane-drain.mjs`,
  which already does id-heal via `we:scripts/pr-land.mjs` #2071, derived regen #2173, reopen-on-fail #2175).

A light probe is retained ONLY to detect the non-WE constellation repos an item spans (`extraRepos`) so the
right lane pools are provisioned and per-repo refs pushed — cross-repo items become one PR per repo, landed
impl-first/WE-last by the drain via the `we:.lane-manifest.json` (#2163) each WE PR carries.

## New producer contract

- **Claim-in-lane, not central-pre-claim-on-main.** No `lane/_base` ref, no pre-claim commit to (local)
  main. Each item's lane clone resets to `origin/main`, runs `we:scripts/backlog.mjs claim` → work →
  `resolve` → commit → writes its manifest → opens its PR. Because the claim/resolve ride the PR, an item
  that fails in-lane is never left `active` on main (the #2072 reopen problem disappears).
- **Fan out ready-to-merge PRs.** Each pushed lane ref opens a PR via `we:scripts/pr-land.mjs --no-wait`
  (opens, does not merge) and is labelled `ready-to-merge` (F1). The `we:.lane-manifest.json` rides the WE
  PR's commit for the drain's blockedBy ordering.
- **Zero commits to main; no drain launched.** The producer completes when every item is an open
  ready-to-merge PR. Correct with no drain running — the PRs sit until some drain (`/drain`, `/merge`, or CI
  auto-merge) lands them; local `main` pulls after each merge.
- A "don't re-offer" signal for the SAME checkout's next readiness pack is a local (uncommitted)
  `we:queued.json` entry per PR'd item — visible to `readiness`/`claim` offline (Rule #105) without churning
  main history.

## Acceptance

- A `/workflow` run completes with **all items as open ready-to-merge PRs** and **zero commits to `main`**;
  nothing blocks on a drain.
- The partition/serial/lock machinery is gone from the orchestrator (probe kept only for repo detection).
- With no drain running, the PRs are valid and land later on the next `/drain` (blockedBy-ordered) or `/merge`.

## Residuals (tracked elsewhere)

- The drain still discovers via the main-committed `we:queued.json`; teaching it to discover **labelled open
  PRs** is #2188 (F1 convergence). Until then, `/merge` lands the PRs unordered (fine for independent items);
  a blockedBy chain waits for #2188 or is drained by hand in order.
- Cross-session double-claim (two sessions both pick one open item, since the claim now rides a PR instead of
  a main commit) is a known residual for the per-path routing slice #2190 to address.
