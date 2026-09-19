---
kind: story
size: 5
parent: "x4v2xe4"
status: open
relatedTo: ["xc1u3pi", "xcqg649", "xaypr56"]
scope: ["we:scripts/operations/decisions-in-flight.mjs", "we:scripts/operations/decisions-in-flight-io.mjs", "we:.claude/commands/wip.md", "we:.claude/commands/status.md", "we:scripts/operations/__tests__/decisions-in-flight.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Report which pending decisions bear on the work in flight mechanically, and have /wip and /status print it

`/wip` and `/status` are model-composed today: the session reasons about which open decisions matter, which is exactly the judgment the operator wants off it. Add a declared `decisions-in-flight` operation that answers "which open decisions block or bear on the work currently in flight, which are ready to ratify and which are not", ranked, short and renderable verbatim. `/wip` and `/status` then PRINT its output, the way a "needs you" list should come only from `we:scripts/operations/operator-queue.mjs`. The orchestration session must not derive that list itself.

## Shape

- **Name:** `decisions-in-flight` (operation), CLI `node we:scripts/operations/run.mjs decisions-in-flight`. Read-only, `compute` steps only.
- **In-flight set:** open PRs mapped to the items they deliver (`we:scripts/lib/open-pr-items.mjs`, `deliveredItemNumsFromPr`, the readiness ranker's own extractor), plus backlog items with `status: active`.
- **Bears on:** an open `kind: decision` item D bears on an in-flight item X when D is in X's transitive `blockedBy` chain (**blocks**), is X's `parent` or an ancestor epic (**frames**), or is listed in X's `relatedTo` (**related**, ranked lowest). Edges come from the backlog loader (`we:src/_data/backlog.js`), the same machinery readiness uses. Never a second edge parser.
- **Ready to ratify** = `preparedDate` set and the decision's forks parsed. Both come from the decision record, not from reading prose.
- **Ranking:** blocks before frames before related; within a class, the leverage number readiness already computes (`transitiveUnblocks * 1000 + directUnblocks`, via `suggest-next`). Reuse it, do not re-derive.
- **A decision prepared on an open PR is not on `main` yet.** The #3675 case (its `preparedDate` lived on PR #2339 until it merged) shows it: read from `origin/main`, such a decision looks unprepared. Annotate it "prepared on open PR #N, not yet on main" using the same PR-to-item mapping, so `/wip` neither hides it nor calls it unprepared.
- **Output:** a structured verdict plus a verbatim-renderable markdown block, in the way `we:scripts/operations/operator-queue.mjs` renders its buckets. `/wip` and `/status` print it under a `Decisions bearing on this work` section and are told not to add, drop or reorder rows.

## One decision-record source: yes, shared with the docket

This can and should share the docket's data layer, so ONE decision-record source feeds the page, `/wip`, and (later, if the operator wants a "decisions ready to ratify" bucket) the operator queue. The pure record builder is `we:scripts/lib/decision-docket-data.mjs` (`buildDecisionRecord`, `parseDecisionBody`, `parseForkSection`). The IO half (`buildData`, `readBacklogFile`, reading through `git show <ref>:<path>`) currently lives inside `we:scripts/gen-decision-docket.mjs`, which is a CLI; extract it into a lib both callers import. **Do not write a second parser for decision cards.** The operator-queue bucket is not part of this slice; it only has to stay possible.

## Where /wip and /status actually live

- Tracked sources: `we:.claude/commands/wip.md` and `we:.claude/commands/status.md`. `we:skills-src/` has no `wip` or `status` skill. The command files are deployed to a synced copy under the operator's home `.claude/commands` folder by `we:scripts/bootstrap-session.mjs` (`npm run bootstrap install`).
- **The deployed copy drifts, and in a way the session-start check does not report.** Today the deployed `wip` command is AHEAD of the tracked one: it carries a 32-line "supervisor / delegation tag" block the tracked source lacks (the deployed file is dated Sep 15). The session-start check reported only two untracked extras (the `continue` and `handoff` commands), not content drift. So step one is to reconcile that block into the source (or deliberately drop it) BEFORE any redeploy; otherwise a deploy silently deletes it.
- **A related mismatch to fix in the same edit:** the "needs you" list is said to come only from `operator-queue`, but neither the tracked nor the deployed `wip` or `status` command mentions `operator-queue` (a text search finds 0 hits in all four files), so that convention lives only in session practice. Make `/wip` and `/status` print the operator queue's output verbatim for `⚠ Needs you`, in the same change.

## Irreducible judgment stays out

The operation reports what bears and what is ready. It does not decide what the operator should rule next or recommend a default; the forks already carry a bold default from the prepare pass. The session may still comment, but not choose the list.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/decisions-in-flight.test.mjs` passes; its cases fail before: a decision in an in-flight item's transitive `blockedBy` chain is reported as **blocks**; a parent epic's decision as **frames**; a prepared decision with parsed forks is ready and an unprepared one is not; a decision prepared on an open PR carries the "pending on PR" annotation; ranking follows class then leverage; the same fixture yields the same output twice; no second card parser exists (a test asserts it imports the shared record builder).
2. **Probed live** — with the real repo state, the operation lists #3675 as bearing on the work that references it, "pending on PR" before that PR merges and "ready to ratify" after, with no model in the path.
3. `we:.claude/commands/wip.md` and `we:.claude/commands/status.md` print the operation's output verbatim, and the reconciled deployed copy has no content the source lacks.
