---
bornAs: x61vlkw
kind: task
status: resolved
dateOpened: "2026-08-05"
dateResolved: "2026-08-05"
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

## Resolved 2026-08-05 — all five Done-when bullets delivered

Delivered in PR #1048. `BLAST_RADIUS` in [`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs)
now scores **all four spellings** of both agent-behaviour trees, from **two** patterns — one per home, each pairing
the two trees and each with an optional trailing separator:

| Spelling | Pattern | Why it must score |
|---|---|---|
| `we:skills-src/…`, `we:agent-memory-src/…` | `(^\|\/)(skills\|agent-memory)-src(\/\|$)` | the SOURCE trees — what a WE diff of a rule's *content* actually carries. **This is the acceptance condition** (bullets 1–2) |
| `we:skills-src`, `we:agent-memory-src` (no trailing slash) | same pattern, via the `$` alternative | the source tree as a **leaf** — swapping the real directory for a link is one diff path at mode `120000` |
| `we:.claude/skills/…`, `we:.claude/agent-memory/…` | `(^\|\/)\.claude\/(skills\|agent-memory)(\/\|$)` | the link spelling as a **real tracked directory** — live in plateau-app, and in any repo that never relocated the tree |
| `we:.claude/skills`, `we:.claude/agent-memory` (no trailing slash) | same pattern, via the `$` alternative | the **symlink blob itself** — git emits the link node when the link is created, repointed or deleted |

Grounded independently while reviewing **PR #1044**, which proposed the memory half alone and was closed in
favour of this item; its review comment carries the panel verdict and the reproductions.

### On bullet 4 — the `we:.claude/` anchor was kept, but it did NOT replace the `-src` patterns

Bullet 4 says to add the `-src` patterns and **not** to "simplify" by anchoring on `(^|\/)\.claude\/` instead.
That instruction is followed exactly: the `-src` patterns are the acceptance condition and they are registered;
the `.claude/` anchor is **kept alongside** them, never in place of them, exactly as the bullet's own last
sentence requires ("Keep the existing built-path patterns too: they are live in plateau-app").

One factual refinement to the bullet's reasoning, found by the review and worth recording because it is the
whole reason the anchor is not inert: **the `.claude/` anchor is not entirely dead code in WE.** It is dead for
paths *beneath* the link — git never descends a symlink, so no diff path begins `we:.claude/agent-memory/…` here:

```
$ printf 'b\n' >> .claude/agent-memory/rule.md      # write THROUGH the link
$ git diff --name-only
agent-memory-src/rule.md                             # ← the source spelling, always
```

But the **link node is itself a diff path**. `we:.claude/skills` is tracked at mode `120000`; repointing it
(`we:.claude/skills → ../some-other-tree`) or deleting it is a one-line commit whose diff path is exactly
`we:.claude/skills`. Every pattern used to require a trailing `/`, so that commit scored `{escalate: false}` —
a change that swaps the entire operating-procedure tree the agent loads, with no reviewer. The trailing
separator is now optional (`(\/|$)`), which closes it. The same hole existed one directory over — replacing the
real `we:skills-src` directory with a link emits the bare leaf `skills-src` — so the source patterns carry the
optional separator too.

The anchor is narrowed to the two procedure directories (`(skills|agent-memory)`), so it does **not** sweep in
`we:.claude/settings.json` or `we:.claude/commands/`. Bullet 2's built-half registration is delivered by the same
anchor: an earlier cut of this PR registered the source spelling only, reasoning that the link spelling "can fire
nowhere" — half right, and therefore wrong. "Nowhere" was scoped to WE: `we:.claude/skills/` was kept precisely
because plateau-app has 2 real tracked files under it, and the same argument applied to
`we:.claude/agent-memory/` proves the opposite of what was claimed — a sibling repo keeping agent memory as a
real directory had **zero** coverage. That is the PR #1040 / PR #1043 / PR #1045 hole, relocated one repo over.
Both trees now share one anchor, so neither can be registered without the other.

### Bullet 3 — the test asserts on the paths git reports

[`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs) pins
every spelling of both trees — including the bare symlink leaves, `plateau-app/.claude/agent-memory/…`, the
root-anchored `we:.claude/skills/…` positive (so the `^` branch of `(^|\/)` keeps a live fixture), and the named
regression case asserting `scoreEscalation` on `we:agent-memory-src/land-on-no-regression-not-perfection.md`
escalates and earns `review:pending` at PR-open. No "source and build output land in the same band" assertion was
written, per the bullet's explicit warning. Negative cases keep the optional separator from swallowing a sibling
name (`we:.claude/skills-notes.md`, `we:skills-src-notes.md`).

### Bullet 5 — the other source/build pair with the same shape

`we:agent-memory-src/` was the other source/build pair with this symlink shape, registered in the same change.

The three prose enumerations of the surface set were updated in the same change so the spec cannot drift from the
code that reads it: the cross-repo bullet and `scoreEscalation`'s reason doc in
[`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs), and the `blast-radius` token
description in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) — the
machine-diffable spec whose per-entry prose *is* its meaning (#2564/#2566). Leaving the contract reading
"(scripts, skills, hooks, CI, standards defs)" is the same drift class this item exists to fix, one level up.

### Left open — filed, not left in prose

Because this item resolves here, an obligation left only in this closing note would leave the backlog at merge.

- The **tier question**: the newly-registered trees score `review:pending`, which is agent-clearable, so an agent
  can still clear a diff to the very rule it is governed by — **#xn4b7xp**.
- `we:AGENTS.md`, `we:CLAUDE.md`, `we:.claude/settings.json`, `we:.claude/commands/` and non-statute
  `we:docs/agent/` remain unregistered behaviour-defining surfaces — **#x853s5c**, which `blockedBy`-waits on
  **#xzsnnta**, the carved-out design call: enumerate the named paths, or invert the `we:.claude/` anchor to
  default-deny so the next unregistered surface fails closed instead of open.
- Every pattern here protects a surface the gate **reads**; nothing protects what the required check *resolves
  to* when it runs — the manifest, the lockfile CI installs from (`npm ci` reads it strictly), and the vitest /
  playwright configs that decide which tests are collected. All four still score `false` — **#x9mmdu2**, which
  states the rule rather than a path list. A first cut of that widening was made in this PR's round 4 on a
  wrong premise (that `npm test` is the script CI runs — no workflow invokes it) and was carved back out.
- The drain's content-resolve write-back emptied this very item to 0 bytes on the rebase that produced
  `836ae978`, where the pure merge library replays the same stages cleanly — **#2923** (a sibling lane filed the
  same incident first; the verified reproduction localising it to the write-back path is folded into that item).
- [`we:scripts/lib/invariant-catalogue.json`](scripts/lib/invariant-catalogue.json) still claims the lane guard
  exempts agent memory (removed 2026-07-09; the guard denies it) — **#xl1ru2l**.
