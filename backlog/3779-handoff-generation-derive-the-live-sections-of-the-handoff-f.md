---
bornAs: xde32mt
kind: epic
parent: "3383"
status: open
scope: ["we:.claude/commands/handoff.md", "we:.claude/commands/continue.md", "we:scripts/operations/run.mjs", "we:scripts/operations/handoff-home.mjs", "we:scripts/lib/git-transport-branch.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Handoff generation: derive the live sections of the handoff from state, keep only decisions and rules by hand

FOUND 2026-09-20. The orchestrator handoff is a single file in the operator's Claude directory, outside the repository and outside git, so it has no history. The /handoff command overwrites it each session (version 9 became version 10 today). Version 10 is 47 lines, 1180 words and 8600 bytes, while the /handoff command asks for "under 500 words", so the limit was exceeded by more than two times.

The command's own text has the model compose the file from live `gh` output at write time, and /continue then tells the next session not to trust the file's pull request statuses and to re-derive them. So the part that looks generated is already treated as untrustworthy.

What version 10 holds, and what is derivable: the header (session counts), PLAN (open pull requests and their status), IN FLIGHT (workers with session ids, briefs, result paths) and the queue lines are derivable from state: open PRs, the agents rows, the dispatch record and result files, the operator queue. GOAL, GOTCHAS, DECISIONS WAITING and STANDING RULES are judgment or standing text that a person or the orchestrator keeps.

OVERLAP, NAMED. #3759 (track adapter: handoff in source, id-less lines rejected) already brings the /handoff and /continue commands into source, and its open point 1 leans "generate the planned-work part of the handoff from the unified planned list". This card is the smaller delta: the LIVE sections (open pull requests, sessions, in-flight workers, result files, queue), the size cap, and where the file lives and how it is versioned. If the design reviews find these are one design, fold this card into #3759. It also depends on the start-of-session state pass card filed alongside: the generator should read from the same sources as that report, not from a second reader.

DESIGN TO SETTLE.
1. The split of the file: a generated block that is rewritten on every write, never hand-edited and stamped with its time, versus a small hand-kept part with decisions and standing rules. One file with a marked generated block, or two files. Recommendation: two files, so the generator can never overwrite a hand-kept line.
2. Which sections are script-decidable (open PRs, session table, in-flight workers from the dispatch record and result files, the cleared queue, the operator queue output) and which are not (goal, gotchas, why). Whether "decisions waiting on the operator" is derivable from the decision docket or stays hand-kept.
3. In-flight workers: the source is the dispatch record plus result files plus agents rows, not the model's memory. It needs the dead-row rule from the dead-session-rows card filed alongside and the liveness rule in #3775, so an idle or dead row is not listed as working.
4. Where it lives and how it is versioned. Today it sits outside the repository because the repository's guard blocks edits in the primary checkout (per the /handoff text). Options: keep it outside and write one dated copy per version, so version 10 does not vanish when version 11 is written; track the hand-kept part in source; keep the generated snapshots as gitignored sidecars. The file holds no secrets by rule but does hold personal paths.
5. The size cap is enforced by the generator (fail the write when the hand-kept part is over N words), because the 500-word rule is an instruction today and was exceeded.

ADDED 2026-09-21 (operator ruling). The words below were typed by the operator in the orchestrating session; they are quoted, not paraphrased. The operator asked: "Shouldn't it be tracked? On the ops branch?" **Ruling:** the handoff file must be TRACKED, on an `ops/*` branch, and moved OUT of `~/.claude/`. This settles design point 4 (where it lives and how it is versioned) in favour of tracked-in-git, over the "keep it outside" and "gitignored sidecar" options. **The existing pattern to reuse:** the remote already has `ops/pr-views` and `ops/review-requests` (verified with `git ls-remote`), written through `we:scripts/lib/git-transport-branch.mjs` (verified: it exists on `main`). **Why out of `~/.claude/`:** Claude Code's own path gate prompts on every read, edit or write of a file under a `/.claude/` path, and no allow rule or hook can silence it. Only a path rewrite that takes the file out of `.claude/` does. The header of the operator's `claude-sot-redirect` hook (#2266; in the hooks folder of the operator's Claude directory, outside this repository) records this. Verified by reading it: the gate "sits ABOVE the settings/hook allow pipeline" and keys on the path. **Consequence for the commands:** `/continue` and `/handoff` must stop hard-coding a path; where the file lives is read from one place, not typed into each command. Design points 1, 2, 3 and 5 are not touched. The card's status is unchanged.

## Done when

1. **Executable** — a test runs the generator over fixtures (a `gh` listing, agents rows, a result-file directory, an operator queue text) and asserts the generated block lists the open pull requests, the sessions and the in-flight workers, two runs over the same input are byte-identical, and it names no pull request or worker that is not in the inputs.
2. **Executable** — a test asserts that a hand-kept part over the word cap fails the write.
3. **Executable** — a test asserts the tracked /handoff command text calls the generator and no longer asks the model to compose pull request statuses (the command is tracked in source by #3767 and #3759).
4. **Human verify** — a version produced this way carries every fact the live sections of version 10 held.

## Slice A: location

Landed in PR #2392 on 2026-09-21. The drain then resolved this whole card on land (`drain: resolve #3779 on land (#2748)`), which was premature: only this slice shipped. The operator asked for it to be reopened, and it is an epic now (a sized story cannot also have children; the review follow-ups are the child card filed under it). Builds design point 4 only, as ruled on 2026-09-21. Design points 1, 2, 3 and 5 (the generator, the generated and hand-kept split, the in-flight source, the word cap) stay unbuilt until #3775 and #3776 settle; the Done-when list above is theirs.

What ships: `we:scripts/operations/handoff-home.mjs` with three verbs. `path` prints the working copy (`~/workspace/.operations/handoff/`, outside `~/.claude/`). `pull` fast-forwards it from `origin/ops/handoff`. `push` commits both files (the snapshot and the operator's rules file) onto `ops/handoff` through `we:scripts/lib/git-transport-branch.mjs`, the same transport as `ops/review-requests` and `ops/pr-views`. The transport gained one opt-in, `createIfAbsent`, so the first push can start the branch as an orphan. `push` never forces, refuses when the remote moved since the last pull, and runs a publish gate first: `scrubPublish` on both files, and on a PUBLIC repository also any personal home-directory path. The repository is PUBLIC, so the first real push is the operator's call, not an agent's.

Done when (slice A):

1. **Executable** — the suite `we:scripts/operations/__tests__/handoff-home.test.mjs` passes under `npx vitest run` against real git (a temp bare origin): `path` output, `pull` into an empty and into a populated directory, a first `push` that creates `ops/handoff` holding exactly the two files, a second `push` that lands a fast-forward commit, a `push` refused on a diverged remote with the remote and the working copy left untouched, and a `push` refused when the scrub flags a file.
2. **Executable** — running `we:scripts/operations/handoff-home.mjs` with the verb `path` prints a directory that ends in `/workspace/.operations/handoff` and contains no `/.claude/`.
3. **Executable** — `grep -c handoff-home` reports at least 1 for each of `we:.claude/commands/continue.md` and `we:.claude/commands/handoff.md`, and neither file types an absolute directory for the handoff files (the commands ask `path`, run `pull` before reading and `push` after writing).
4. **Human verify** — the operator decides whether the handoff may go to a branch of a PUBLIC repository, then runs the first `push`.
