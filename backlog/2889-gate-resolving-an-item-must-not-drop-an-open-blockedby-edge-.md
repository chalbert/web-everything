---
bornAs: x7dsrn2
kind: task
status: open
dateOpened: "2026-08-02"
tags: [governance, check-standards, backlog-integrity]
---

# Gate: resolving an item must not drop an open blockedBy edge in the same diff

A `check:standards` rule (and a `PreToolUse(Edit|Write)` backlog deny for shift-left) that **errors** when a
single diff flips an item's `status:` to `resolved` AND removes a `blockedBy` entry in the same edit —
**UNLESS** the removed target is itself already `resolved`. Real prerequisites are recorded even after the
blocker resolves (per `we:docs/agent/backlog-workflow.md`), and the sanctioned
`we:scripts/backlog.mjs resolve` transition never touches `blockedBy`.

## Why (the #1002 defect this prevents)

On resolving #2840, the diff deleted `blockedBy: ["2785"]` while #2785 was still `status: open` — the item's
own anchor + body still cited "blockedBy #2785 … landing first", and the follow-on `2892` re-declared the
same edge, so the file contradicted itself. Nothing caught it because the resolve was a hand edit, not the
sanctioned CLI transition. This gate makes the drop mechanically visible: dropping a live (open-target) edge at
resolve is an error the author must justify (the blocker really is gone) or reinstate.

## Scope

- Detect base-vs-head in a backlog item: `status:` changed to `resolved` AND a `blockedBy` array element
  removed.
- Error unless every removed target is `status: resolved` on the head tree.
- Wire into the whole-tree `check:standards` run and the `PreToolUse(Edit|Write)` backlog deny path (memory
  rule #43).

Prevention filed against #1002's blocking fix 2 (dropped `blockedBy` on resolve). Mechanical,
committee-clearable.

## Design

The rule is a **base-vs-head** check, which makes it structurally unlike almost every other
`check:standards` backlog rule — those are pure functions of ONE item's current content. Two seams already
exist for exactly this shape; reuse them rather than inventing a third.

**Whole-tree half — reuse the #3026 provenance gate's diff machinery.** `we:scripts/check-standards.mjs`
already resolves a diff base and reads a base→working-tree diff for the provenance gate (~L1243–1280):
`execFileSync('git', ['merge-base', 'origin/main', 'HEAD'])`, then
`git diff --unified=0 <base> -- <dirs>`. Copy that posture, including its two disciplines:

- **Fail LOUD, never silent.** When the merge base cannot be resolved it emits a `provenance-gate-unscoped`
  warning saying the check did NOT run, rather than reporting clean. A gate that cannot compute its scope must
  never read as green — a fresh clone with no `origin/main` legitimately hits this.
- **Base → WORKING TREE**, not base → HEAD, so an uncommitted hand-edit is gated too. That matters here: the
  #1002 defect was a hand edit, and a base→HEAD-only check would miss it until after commit.

Widen its pathspec to include `backlog` (today it diffs `docs` and `scripts`).

**The predicate itself belongs in `we:scripts/check-standards-rules.mjs`** as a pure function taking
`(baseText, headText, statusByNum)` and returning findings — so it is fixture-unit-testable with no git.
`validateBacklogItem` (~L168) is the wrong home: it sees one item, current-state only, and has no base. The
`statusByNum` input is already assembled in `we:scripts/check-standards.mjs` (~L554, `backlogCtx.kindByNum` /
`parentByNum` are built the same way) — build a `statusByNum` beside them.

**Shift-left half — `we:scripts/backlog-guard.mjs`.** This is the `PreToolUse(Edit|Write)` backlog deny path
already wired in `we:.claude/settings.json` (the `Edit|Write` matcher runs `we:scripts/guard-lane.mjs`,
`we:scripts/lint-locus-prefix.mjs --pre`, `we:scripts/check-memory.mjs --pre`, `we:scripts/backlog-guard.mjs --pre` and
`we:scripts/guard-backward-edge.mjs`).
It already has everything this needs: `--pre` mode, `proposedContent(ev)` (which applies an `Edit`'s
`old_string`→`new_string` to the on-disk file to get the post-edit text), `split()` for the frontmatter, and
`deny(msg)` (stderr + `exit 2`). The base text for a `--pre` check is the **on-disk file**, not `origin/main`
— that is the right base for "does this single edit drop the edge", and it needs no git call in the hot path.

**The exemption is the whole rule.** Error only when a removed `blockedBy` target is NOT `status: resolved`
on the head tree. That is why the rule needs the tree's statuses and cannot be a per-file check. Note the
asymmetry deliberately: the sanctioned `we:scripts/backlog.mjs resolve` transition never touches `blockedBy`,
so a correctly-performed resolve can never trip this — every trip is a hand edit.

**Order matters:** land the pure predicate + its unit fixtures first, then the whole-tree wiring, then the
`--pre` deny. Wiring the deny before the predicate is fixture-proven means every agent in the repo eats
false denials from a hook they cannot easily bypass.

## Done when

1. `npx vitest run check-standards` covers the pure predicate with four fixtures, all four required: (a)
   `status: open → resolved` + a removed `blockedBy` whose target is `open` → **error**; (b) the same removal
   where the target is `resolved` → **clean**; (c) a `blockedBy` removal with NO status change → clean; (d) a
   status change to `resolved` with `blockedBy` untouched → clean. Fails before, passes after. (Tier 1.)
2. A replay of the #1002 defect: reconstruct the #2840 resolve edit (`status: resolved` while deleting
   `blockedBy: ["2785"]` with #2785 still `open`) as a fixture pair and assert the predicate errors on it.
   This is the one case the item exists for, so it is named separately rather than folded into (1). (Tier 1.)
3. `npm run check:standards` is GREEN on the tree as it stands with the rule wired — no historical item trips
   it. If any does, it is triaged on the item before landing, not suppressed. (Tier 1.)
4. `node we:scripts/backlog-guard.mjs --pre` fed a hook-event JSON whose proposed content performs the same
   drop exits **2** with a message naming the dropped target; fed the resolved-target variant it exits 0.
   One cheap command per direction, no judgment. (Tier 2.)
5. The gate says so when it cannot run: with no resolvable `origin/main`, the whole-tree half emits a named
   "did NOT run" warning rather than reporting clean — mirroring the `provenance-gate-unscoped` warning in
   `we:scripts/check-standards.mjs`. (Tier 3 — read the warning text at the new rule's base-resolution
   catch block.)
