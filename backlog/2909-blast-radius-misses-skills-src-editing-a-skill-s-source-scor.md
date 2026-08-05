---
bornAs: x61vlkw
kind: task
status: open
dateOpened: "2026-08-05"
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

**Sharper than "rarely fires" — in WE the built-path pattern fires NEVER (measured 2026-08-05).** The built
directory is not a directory: `we:.claude/skills` is a **symlink** to `we:skills-src/`, tracked by git as a
single symlink entry (`git ls-files '.claude/skills*'` returns exactly one path — the link itself, no files
under it). So git can never report a changed file as `we:.claude/skills/<anything>`; every real edit surfaces as
`we:skills-src/…`. Scored live:

| changed-file path as git reports it | `scoreEscalation` |
|---|---|
| `we:skills-src/pr/SKILL.md` — what git actually emits | `{escalate: false, careLevel: "none", reasons: []}` |
| `we:.claude/skills/pr/SKILL.md` — a shape git cannot emit here | `{escalate: true, careLevel: "elevated", reasons: ["blast-radius"]}` |

So this is not an asymmetry between two live paths — **the only skills pattern in `BLAST_RADIUS` is dead code in
this repo**, and skills have no blast-radius coverage at all. It is NOT dead everywhere: `.claude/skills` is a
real directory in plateau-app, where the same regex is live (and absent entirely in frontierui) — which is why
the fix is to add the source paths, not to replace the built ones.

### The agent-memory corpus is missing on BOTH sides (found by the `/review` of PR #1045)

The skills case has a dead pattern. The agent-memory corpus has **no pattern at all**: `agent-memory` appears
nowhere in `we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs` or
`we:scripts/lib/gate-config.mjs`, so neither `we:agent-memory-src/` nor `we:.claude/agent-memory/` matches
anything. `scoreEscalation` returns `{escalate: false, humanRequired: false}` and `producerReviewLabel` returns
`null`, so the PR merges with no `review:*` label and no reviewer ever sees it.

Same symlink shape as skills: `we:.claude/agent-memory` → `we:agent-memory-src/`, read through
`~/.claude/projects/<key>/memory`. So both surfaces reduce to the same one-line fix — **register the `-src`
directories**, since those are the only paths git ever reports.

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
