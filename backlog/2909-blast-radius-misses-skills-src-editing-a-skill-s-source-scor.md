---
bornAs: x61vlkw
kind: task
status: resolved
dateOpened: "2026-08-05"
dateResolved: "2026-08-05"
tags: []
---

# BLAST_RADIUS misses skills-src/ and the whole agent-memory corpus — editing an operating procedure's source scores lower than editing its build output

scoreEscalation's BLAST_RADIUS list in we:scripts/lib/review-escalation.mjs matches the built skills directory but not we:skills-src/, its source — so a 500-line edit to we:skills-src/jury/subject-jury.workflow.js scores care band low while the same edit to the built file scores high. The agent-memory corpus is worse: neither we:agent-memory-src/ nor .claude/agent-memory/ matches any pattern, so a memory rule governing the land bar itself merges with no review label. Operating procedures are what blast-radius exists to catch. Found by the 2026-08-04 red-team of #2572; the agent-memory half by the /review of PR #1045.

## The gap

`BLAST_RADIUS` ([`we:scripts/lib/review-escalation.mjs:78-85`](scripts/lib/review-escalation.mjs)) matches
`/(^|\/)\.claude\/skills\//` — "agent skills (the operating procedures)". `we:skills-src/` is not in the list
and matches no other pattern (`^scripts/`, `.githooks/`, `.github/`, the statute paths, the standards JSON).

Measured on the same file at ~500 lines:

| Path | Band |
|---|---|
| `we:skills-src/jury/subject-jury.workflow.js` | `low` |
| `we:skills-src/conveyor/runner.mjs` | `low` |
| the built skill file under the skills directory | `high` |

Same skill, opposite band, decided by whether the edit lands on the source or the build output. Since the
source is where these are actually authored, the built-path pattern is the one that rarely fires.

### The agent-memory corpus is missing on BOTH sides (found by the `/review` of PR #1045)

The skills case is an asymmetry — the built path is covered, the source is not. The agent-memory corpus is a
**hole**: `agent-memory` appears nowhere in `we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs`
or `we:scripts/lib/gate-config.mjs`, so neither `we:agent-memory-src/` nor the built `.claude/agent-memory/`
matches anything. `scoreEscalation` returns `{escalate: false, humanRequired: false}` and `producerReviewLabel`
returns `null`, so the PR merges with no `review:*` label and no reviewer ever sees it.

Same read-path chain as skills: `~/.claude/projects/<key>/memory` → `.claude/agent-memory` → `agent-memory-src`.

Three PRs landed this way on 2026-08-05 — PR #1040, PR #1043, PR #1045 — all editing
`we:agent-memory-src/land-on-no-regression-not-perfection.md`, **the rule that defines the land bar itself**. PR
#1045 narrowed test 3 ("no weakened gate") and merged unreviewed *during* its own `/review`; the four-lens panel
returned `changes` on both mandatory lenses, after the merge. That is the bootstrap this gate exists to prevent:
relax the land bar with no review, then apply the relaxed bar to clear a real gate diff.

Note the tier question is open here in a way it is not for `skills-src/`: the land-bar rule is arguably
**statute**, not merely blast-radius — it is the operative bar for the engine-tier and blast-radius-only surfaces
that `humanRequired` deliberately leaves agent-clearable. Blast-radius (→ `review:pending`, agent-clearable) is
the floor this item delivers; whether the corpus also needs `isStatutePath` membership is a separate call, not
assumed here.

## Why it matters beyond the score

Today the `size` signal is the only thing parking these PRs, and it only fires above the 400-line
`diffLines` threshold ([`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json)).
A 300-line rewrite of the jury's roster resolution or the conveyor's runner reaches no reviewer at all. This
was surfaced while red-teaming a proposal to stop parking the `low` band — that proposal was struck, but the
blind spot it exposed is independent of it and outlives it.

## Done when

- `we:skills-src/` scores blast-radius wherever the built skills directory does, and the two agree for the same
  logical file.
- `we:agent-memory-src/` **and** `.claude/agent-memory/` both score blast-radius, so a memory-corpus edit carries
  a `review:*` label at PR-open instead of merging silently.
- A test in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs)
  locks source and build output to the same band for **both** pairs, so neither can drift apart again — including
  a case asserting `scoreEscalation` on `we:agent-memory-src/land-on-no-regression-not-perfection.md` does not
  return `{escalate: false}` (the PR #1040 / #1043 / #1045 regression).
- Check whether any other built/source pair in the repo has the same shape before closing — `.claude/` is the
  common parent for the built halves, so an anchor on `(^|\/)\.claude\/` scoped to the procedure directories may
  be a better fix than adding one regex per pair.

## Resolved 2026-08-05 — all four Done-when bullets delivered

Delivered in PR #1048. `BLAST_RADIUS` in [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs)
now scores **all three spellings** of both agent-behaviour trees:

| Spelling | Pattern | Why it must score |
|---|---|---|
| `we:skills-src/…`, `we:agent-memory-src/…` | `(^\|\/)skills-src\/`, `(^\|\/)agent-memory-src\/` | the SOURCE trees — what a WE diff of a rule's *content* actually carries |
| `we:.claude/skills/…`, `we:.claude/agent-memory/…` | `(^\|\/)\.claude\/(skills\|agent-memory)(\/\|$)` | the link spelling as a **real tracked directory** — live in plateau-app, and in any repo that never relocated the tree |
| `we:.claude/skills`, `we:.claude/agent-memory` (no trailing slash) | same pattern, via the `$` alternative | the **symlink blob itself** — git emits the link node when the link is created, repointed or deleted |

Grounded independently while reviewing **PR #1044**, which proposed the memory half alone and was closed in
favour of this item; its review comment carries the panel verdict and the reproductions.

**Bullet 2 is delivered in full**, for both the source spelling and `we:.claude/agent-memory/`. An earlier cut of
this PR registered the source spelling only, on the reasoning that the link spelling "can fire nowhere". That
reasoning was **half right and therefore wrong**, and the review caught it. What is true: git tracks a symlink as
a leaf blob and never **descends** it, so no diff path can begin with `we:.claude/agent-memory/…` *in this repo* —

```
$ printf 'b\n' >> .claude/agent-memory/rule.md      # write THROUGH the link
$ git diff --name-only
agent-memory-src/rule.md                             # ← the source spelling, always
```

What that misses, twice over:

1. **The link NODE is itself a diff path.** `we:.claude/agent-memory` is tracked at mode `120000`. Repointing it
   (`we:.claude/skills → ../some-other-tree`) or deleting it is a one-line commit whose diff path is exactly
   `we:.claude/skills` — and every pattern required a trailing `/`, so it scored `{escalate: false}`. That commit
   swaps the entire operating-procedure tree the agent loads, with no reviewer. The trailing separator is now
   optional (`(\/|$)`), which closes it.
2. **"Nowhere" was scoped to WE only.** `we:.claude/skills/` was kept precisely because plateau-app has 2 real
   tracked files under it — so the same argument applied to `we:.claude/agent-memory/` proves the opposite of what
   was claimed: a sibling repo that keeps agent memory as a real directory rather than relocating it had **zero**
   coverage. That is the #1040/#1043/#1045 hole, relocated one repo over. Both trees now share one `.claude/`
   anchor, so neither can be registered without the other.

Bullet 4 is discharged, and this item's own suggestion was **taken**: the fix is the `(^|\/)\.claude\/`-scoped
anchor, narrowed to the two procedure directories — `(skills|agent-memory)` — so it does **not** sweep in
`we:.claude/settings.json` or `we:.claude/commands/`. `we:agent-memory-src/` was the other source/build pair.

Bullet 3 is delivered: [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs)
pins every spelling of both trees — including the bare symlink leaves, `plateau-app/.claude/agent-memory/…`, the
root-anchored `we:.claude/skills/…` positive (so the `^` branch of `(^|\/)` keeps a live fixture), and the named
regression case asserting `scoreEscalation` on `we:agent-memory-src/land-on-no-regression-not-perfection.md`
escalates and earns `review:pending` at PR-open. Negative cases keep the optional separator from swallowing a
sibling name (`we:.claude/skills-notes.md`).

The three prose enumerations of the surface set were updated in the same change so the spec cannot drift from the
code that reads it: the cross-repo bullet and `scoreEscalation`'s reason doc in
[`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs), and the `blast-radius` token
description in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) — the
machine-diffable spec whose per-entry prose *is* its meaning (#2564/#2566). Leaving the contract reading
"(scripts, skills, hooks, CI, standards defs)" is the same drift class this item exists to fix, one level up.

The tier question (statute vs blast-radius for the land-bar rule) is left open, as this item states.

Adjacent defects surfaced in the same pass and **not** covered here, each now filed rather than left in prose:

- `we:AGENTS.md`, `we:.claude/settings.json`, `we:.claude/commands/` and non-statute `we:docs/agent/` remain
  unregistered behaviour-defining surfaces — **#x853s5c**.
- The drain's content-resolve write-back emptied this very item to 0 bytes on the rebase that produced `836ae978`,
  where the pure merge library replays the same stages cleanly — **#x0xlc1d**.
- [`we:scripts/lib/invariant-catalogue.json`](scripts/lib/invariant-catalogue.json) still claims the lane guard
  exempts agent memory (removed 2026-07-09; the guard denies it).
