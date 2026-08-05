---
bornAs: x61vlkw
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# BLAST_RADIUS covers no operating-procedure source in WE — the .claude/skills pattern is dead code, and agent-memory has no pattern at all

BLAST_RADIUS in we:scripts/lib/review-escalation.mjs has no pattern that an operating-procedure edit can match. Its one skills pattern targets .claude/skills/, which in WE is a symlink to we:skills-src/, so git never reports a file beneath it and the pattern fires never; a skills edit scores on size alone. The agent-memory corpus has no pattern on either side, so a memory rule governing the land bar itself merges with no review label. Both reduce to one fix: register the -src directories git actually reports. Found by the 2026-08-04 red-team of #2572; the agent-memory half by the /review of PR #1045.

## The gap

`BLAST_RADIUS` ([`we:scripts/lib/review-escalation.mjs:78-85`](scripts/lib/review-escalation.mjs)) matches
`/(^|\/)\.claude\/skills\//` — "agent skills (the operating procedures)". `we:skills-src/` is not in the list
and matches no other pattern (`^scripts/`, `.githooks/`, `.github/`, the statute paths, the standards JSON).

**And in WE the one pattern that IS there fires NEVER (measured 2026-08-05).** The built directory is not a
directory: `we:.claude/skills` is a **symlink** to `we:skills-src/`, tracked by git as a single symlink entry
(`git ls-files '.claude/skills*'` returns exactly one path — the link itself, no files under it). So git can
never report a changed file as `we:.claude/skills/<anything>`; every real edit surfaces as `we:skills-src/…`.

Scored live, both rows on the **same** basis — `scoreEscalation({ changedFiles: [path], diffLines: 500 })`, the
~500-line edit this item is about. The `blast-radius` reason echoes the matched path back, written `<path>` here:

| changed-file path as git reports it | result |
|---|---|
| `we:skills-src/pr/SKILL.md` — what git actually emits (identically for `we:skills-src/jury/subject-jury.workflow.js` and `we:skills-src/conveyor/runner.mjs`) | `{escalate: true, careLevel: "low", reasons: ["size (500 ≥ 400 changed lines)"], signals: {size: 500}}` — **size alone**; blast-radius contributes nothing |
| `we:.claude/skills/pr/SKILL.md` — a shape git cannot emit here | `{escalate: true, careLevel: "high", reasons: ["blast-radius (<path>)", "size (500 ≥ 400 changed lines)"], signals: {blastRadius: ["<path>"], size: 500}}` |

Same skill, opposite band, decided only by whether the edit lands on the source or the build output — except
the build-output row is unreachable, so only the first row ever happens. Below the 400-line size threshold the
gap is total: at `diffLines: 12` the real path scores `{escalate: false, careLevel: "none", reasons: []}`, while
the unreachable built path would score
`{escalate: true, careLevel: "elevated", reasons: ["blast-radius (<path>)"], signals: {blastRadius: ["<path>"]}}`.

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

- `we:skills-src/` is itself registered in `BLAST_RADIUS`, so a skills edit scores blast-radius on **the path
  git actually reports**. The acceptance condition is that path, not parity with the built directory — a
  `.claude/skills/…` path never appears in a WE changed-file list, so "the two agree" would be vacuous here.
- `we:agent-memory-src/` is registered too, so a memory-corpus edit carries a `review:*` label at PR-open
  instead of merging silently. Register the built `.claude/agent-memory/` pattern alongside it for the repos
  where that directory is real — but, as in bullet 1, the WE acceptance condition is the `-src` path, since the
  built half is a symlink here.
- A test in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs)
  asserts, for **each** `-src` root, that `scoreEscalation` on a changed file beneath it reports `blast-radius` —
  scored on the path git reports — including the specific regression case: `scoreEscalation` on
  `we:agent-memory-src/land-on-no-regression-not-perfection.md` must not return `{escalate: false}` (the PR
  #1040 / #1043 / #1045 regression). Do **not** write a "source and build output land in the same band"
  assertion: both built halves are symlinks here, so it would pass against a path git never emits and lock
  nothing — the same false coverage this item exists to remove.
- Add the `-src` patterns; **do not** "simplify" by anchoring on `(^|\/)\.claude\/` instead. In WE every
  `.claude/` procedure directory is a symlink, so such an anchor is dead code here for exactly the reason above —
  it would ship the bug this item documents. Keep the existing built-path patterns too: they are live in
  plateau-app, where `.claude/skills` is a real directory.
- Check whether any other built/source pair in the repo has the same symlink shape before closing, and register
  the source half of each.
