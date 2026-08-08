---
name: harvest-learnings
description: Harvest the cross-session learnings pool — read every session's dropped observations at once, dedup across sessions, red-team what recurs, and route survivors to backlog items or agent memory via the normal lane → PR. This is the ONLY place learnings are judged; sessions merely collect. Use when the user wants to "harvest the learnings", "run the harvest", "triage the feedback pool", "what has the pool accumulated", or when a close reports the pool is deep/stale. NOT a session close (that only emits) and NOT the product-side owner-review screen (#2610).
---

# Harvest — the periodic adjudication pass over the learnings pool

**The rule this skill exists to enforce: collection is not adjudication.** A session — main loop or
subagent — records *what it observed* and stops. It never decides what the observation is worth. Worth is
decided **here**, once, over the whole pool. Three reasons the judgment does not live at session close:

1. **A subagent cannot run a close.** Curation at close meant a delivery agent's observation only counted
   if some *other* session later closed cleanly.
2. **A session that never closes loses everything it noticed.**
3. **Dedup-from-a-sample-of-one.** "Is this a fresh angle or a covered cluster?", "is it narrow/rare or
   recurring?" — the red-team's own filters are recurrence questions one session structurally cannot
   answer. A pool answers them with a count.

Eventually this generalizes to the multi-tenant shape (#2610): many people experience, one owner
adjudicates. The single-tenant harvest is deliberately the same pipeline, so nothing has to be rebuilt.

## Step 1 — read the pool (deterministic, no judgment)

```bash
npm run harvest -- --json                 # candidates + stats over the whole pool
npm run harvest -- --min-sessions=2       # only what ≥2 distinct sessions independently hit
```

`we:scripts/conveyor/learnings-harvest.mjs` is the deterministic core (per
[platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)):
it reads every `*.jsonl` in the machine pool (`$LEARNINGS_POOL`, else `~/.claude/conveyor/learnings`) —
one fixed directory outside any working copy, so a lane clone's drops and the primary checkout's are the
**same** pool — re-applies the write-seam scrub (defence in depth),
clusters near-duplicates **across sessions**, and ranks by `sessions` (distinct sessions) before `count`
(raw entries). **Do not re-derive any of that in context** — read its output.

An **empty pool is the common, correct outcome.** Say so and stop; nothing observed since the last harvest
is not a failure.

Each candidate carries: `kind`, `area`, `summary`, `suggestion`, `count`, `sessions`, plus every distinct
member `summaries`/`suggestions` — a member's own suggestion is never dropped in favour of the
representative's.

## Step 1b — corpus health (moved here from the close, #1878)

```bash
npm run reflect
```

Propose-only: index headroom, corpus skew, orphans, near-duplicate topic files, index pressure. **Writes
nothing.** This used to run at every session close, which was the same mistake in miniature — "is this a
near-duplicate?" is a judgment over the whole corpus, re-decided pointlessly once per session. It belongs
next to the red-team below, where its output is actually used: index pressure decides the budget filter,
and its near-duplicate list is the dedup filter's starting point.

## Step 2 — red-team each candidate (the judgment half)

One skeptic sub-agent per candidate, **mandate = kill it, default REJECT**, reject on any uncertainty.
Sonnet is fine — it's bounded. A candidate must clear all five:

- **Grounding** — is the lesson *true*, or just asserted? The pool carries no transcript and no evidence
  field, so the harvest cannot re-ask "quote the turn that established this" the way the old in-session
  red-team could. It asks the version it *can* verify: **name a concrete in-repo artifact that corroborates
  the claim** — a file whose content shows the friction, a commit or PR that hit it, a backlog item that
  records it. Open the artifact and confirm it says what the candidate says. **No corroborating artifact →
  the candidate may not route to memory.** It can still become a backlog item (an item is a *proposal* that
  gets reviewed; a memory entry is a *standing instruction* every future session obeys), or stay in the pool
  until it recurs with something citable attached. This is the one filter that is not about worth — a
  candidate can be recurring, novel, and in-budget, and still be wrong.
- **Dedup against existing memory** — a fresh *angle* on a cluster `MEMORY.md` already covers, rather than
  a new axis? → reject.
- **Budget/eviction** — would adding it evict a stronger existing entry (index at/near cap)? → reject.
  Escalate to a 3-vote panel **only** when this filter fires.
- **On-disk sufficiency** — does the lesson already live where anyone working that area will see it, and is
  it narrow/rare? → reject.
- **Recurrence** — this is the filter the close never had. `sessions: 1` is a hypothesis, not evidence.
  A single-session candidate needs a *stated* reason it will recur, or it stays in the pool for next time.

**A rejected candidate is not deleted.** It stays in the pool unless it was clearly noise — a later harvest
may see it recur, and recurrence is exactly the evidence that would change the verdict.

## Step 3 — route the survivors

Same routing rule as ever: **a finding with a fix or an owner → `we:backlog/`; a reusable principle or a
"how the user wants you to work" lesson → agent memory.**

Both land through the **normal lane → PR** transport, never a direct write to the primary tree. Take the
lease first — the same `acquire` form `/drain` and `/merge` use:

```bash
LANE=$(node scripts/lane-pool.mjs acquire --purpose=harvest --session=<harvest-session-slug> --json)
# → {lane, path, …}; cd into .path, do the routing work there
node scripts/lane-pool.mjs release --lane=<lane> --session=<harvest-session-slug>
```

**Never pick a lane off `status --json` instead.** A lane you did not lease can be `acquire`d out from under
you by a concurrent agent, and `acquire` runs `git checkout -B --force` + `git clean -fd` on the clone — which
destroys the uncommitted routing work mid-run (this is item **#2955**).

- **Backlog** — scaffold the item in the lane (`node scripts/backlog.mjs scaffold …`) with a real ≤100-word
  digest. `kind: friction | missing-convention` with a concrete fix usually lands here.
- **Memory** — write the file + its index pointer line, per the memory-management policy. Only for a
  candidate that cleared the **Grounding** filter with a named artifact; cite that artifact in the entry.
- Then `we:scripts/pr-land.mjs` from the lane.

## Step 4 — archive what you acted on

```bash
# --files= is the exact `files[]` array step 1's --json printed. Copy it; do not re-list the directory.
node scripts/conveyor/learnings-harvest.mjs --archive --stamp=<YYYY-MM-DD> \
  --files="<file1.jsonl,file2.jsonl,…>"
```

Archiving is the **acknowledgement**, never a side effect of reading — run it only after the survivors are
actually routed and the PR is open. Files move to `<pool>/harvested/<stamp>/`, so a re-run never
re-processes them and the trail stays inspectable.

**Archive only what step 1 actually read — the bound is required, not a nicety.** Steps 2–3 take minutes,
and the red-team subagents *themselves* emit into the pool while they run. Anything appended after step 1
was never adjudicated, and an archived entry is invisible to every future harvest. So `--archive` refuses to
run unbounded: pass `--files=` (preferred), or `--before=<the ISO time of the step-1 read>` as the mtime-cutoff
alternative. It also **exits non-zero if the pool directory does not exist** — that means you resolved the
wrong pool, not that there is nothing to archive.

**If you deliberately left candidates un-acted (below the recurrence floor), do NOT archive** — archiving
would silently discard exactly the observations you decided to wait on.

## Report

```
## Harvest

**Pool:** <N entries across M sessions, oldest Xd — or "empty">
**Candidates:** <K ranked; J below the ×N-session floor, left in the pool>
**Survived red-team:** <name each, with sessions×count and its grounding artifact — or "none (the common outcome)">
**Routed:** <backlog #NNN… / memory <slugs> (each with the artifact that grounded it) — via PR #NNN, or "nothing to route">
**Archived:** <stamp + how many files, or "not archived — candidates deliberately deferred">
```

## Boundaries

- **Never emit from here.** This skill only reads and adjudicates. Observations are dropped by
  `we:scripts/conveyor/learnings-drop.mjs` at the moment they happen, by whoever hit them.
- **No app-specific or session-specific carve-outs.** If an observation is urgent, the fix is a shorter
  harvest cadence, not a bypass — a bypass re-imports judgment into the sessions.
- **The pool is untracked and machine-local by design.** A cheap in-the-moment append cannot afford a
  lane→PR; the durable artifacts this skill lands are what reaches git. It lives outside every working copy
  precisely so it is **per machine, not per clone** — a repo-anchored pool forks silently per lane clone.
- **Nothing routes to memory on the pool's word alone.** The pool is an unverified report; agent memory is a
  standing instruction. The Grounding filter is the seam between the two.
