---
bornAs: x0uad06
kind: story
size: 3
parent: "3931"
status: open
blockedBy: ["3932"]
scope: ["we:scripts/operations/item-activity.mjs", "we:scripts/operations/item-activity-io.mjs", "we:scripts/operations/__tests__/item-activity.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Add review-job records as an agent-activity source; join sessions + jobs to a PR/card by id

Post-#2674 (merged today), PR reviews run as detached node jobs (we:scripts/operations/review-job.mjs), not `claude --bg` sessions, so #3932's session-slug resolver (we:scripts/operations/agent-activity.mjs, once built) never sees them — no row in `claude agents --json`, no session transcript. Add the job-record store (we:scripts/operations/review-job-store.mjs's `listReviewJobAgents`/`listAgentsWithReviewJobs`; record shape `{slug, pr, repo, pid, startedAt, cwd, actorId?}` at `.operations/review-jobs/<slug>.json`) as a join source alongside `claude agents --json`, matched by the same `review-<pr>` slug (we:scripts/conveyor/session-slug.mjs) #3932 already uses for sessions. Expose the joined result filterable by ONE pr or card, not the whole listing: `node we:scripts/operations/run.mjs item-activity --pr=<n>` or `--card=<id>` (JSON, read-only). Each row: run kind (build/fix/ci-heal/review/prepare), state, startedAt/lastEventAt, outcome (we:scripts/operations/completion-store.mjs once done), and a transcript pointer — a Claude/Codex session's `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`, or for a review job, its own log (we:scripts/operations/review-job-store.mjs#jobLogPath) plus the nested per-round juror transcripts we:scripts/operations/review-loop-cli.mjs's we:scripts/lib/judge-spawn.mjs mints. Blocked by #3932, the base join resolver this extends — #3932 predates #2674 and never enumerates review jobs as a source; this card is that gap, plus the single-pr/card query shape #3932's own full-listing output does not give. Filed under #3931 (the existing 'Live agent activity on /wip cards' epic already owns this exact join problem); this is the narrower, review-job-aware, non-live slice needed now, not a duplicate of #3932/#3935 — those still own the fuller live L1/L2/L3 build. Related, not duplicated: #3477 (transcript-based introspection at session close — a different consumer of the same transcripts), #2753 (session-free conveyor — why review moved off sessions), #4091 (resolved — chat-spawn link, a different session-provenance join).

## Done when

1. **Executable** — we:scripts/operations/__tests__/item-activity.test.mjs passes under `npx vitest run` with
   fixtures for: a `review-<pr>` review-job record (`.operations/review-jobs/<slug>.json`) with a live pid,
   joined by PR to a card via the supplied PR→card map; a dead-pid job record pruned, never returned as live;
   a `claude agents --json` session row joined by PR/card the way #3932's resolver already does; a card/PR
   with both a review job and a fixer session returned as two rows, not one overwriting the other; a `--pr=`
   query with no match returning an empty list, not an error; and a `--card=` query resolving through the same
   PR→card map #3932 takes as input.
2. **Live** — with a real review job running on this machine (`node we:scripts/operations/review-job.mjs run
   --pr=<n> --repo=<owner/repo>`, or an in-flight one from the resident review daemon), `node
   we:scripts/operations/run.mjs item-activity --pr=<n> --json` returns a row for it with `role: review`,
   `state`, `startedAt`, and a transcript pointer that resolves to a real, non-empty file on disk (its job log,
   or a juror's session transcript) — proven on that live PR, not only on fixtures.
