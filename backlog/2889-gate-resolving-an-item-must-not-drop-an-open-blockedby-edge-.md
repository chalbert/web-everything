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

## Why (the PR #1002 defect this prevents)

(Every `#1002` on this card means **GitHub PR** #1002 — `git log` carries *"Merge pull request #1002"* and
*"Address #1002 review — … restore blockedBy 2785 …"*. Backlog item #1002 is an unrelated, resolved
plugs-test-coverage epic. Corrected 2026-08-21 by the independent review; the bare form was exactly the
ambiguity the #3026 provenance gate exists to catch.)

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

Prevention filed against **PR** #1002's blocking fix 2 (dropped `blockedBy` on resolve). Mechanical,
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

**State how `--pre` sources `statusByNum`, because "reuse the pure predicate" hides it.** The whole-tree half
gets the map free from an already-loaded corpus; the hook runs on every `Edit`/`Write` and must not scan
`backlog/` to answer one question. The cheap answer is a per-target lookup — glob `we:backlog/<N>-*.md` for
each REMOVED target only (usually one file, never the corpus) and read its `status:` with the module's
existing `fmField` helper. Make the predicate take `statusByNum` as a `(num) => status` **lookup function**
rather than a prebuilt `Map`, so the whole-tree half passes a map read and the hook passes a lazy glob, and
neither half pays the other's cost.

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

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — Independently verified against git history: commit 5d1fe454 ('Address #1002 review — ... restore blockedBy 2785 ...') shows we:backlog/2840-*.md shipped its 2026-08-02 resolve WITHOUT `blockedBy: ["2785"]` while we:backlog/2785-*.md was still `status: open` (it resolved 2026-08-08, six days later) — the card's grounding narrative is factually true, and Done-when item 2 requires reproducing this exact historical pair as a fixture before landing, which is the mutation/reversion-style check the taxonomy asks for, just deferred to build time.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The gate is inherently diff-scoped (base-vs-head on a single edit), not a corpus-wide text-pattern lint, so it structurally cannot mass-fire the way we:backlog/3015's pattern set did; Done-when item 3 additionally requires `npm run check:standards` green with the rule wired before landing, triaging any historical trip rather than suppressing it.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified all paths that flip `status` to `resolved` funnel through one function: we:scripts/backlog/frontmatter.mjs#applyTransition (never touches `blockedBy`), called both by we:scripts/backlog.mjs's direct `resolve` CLI and by we:scripts/lane-drain.mjs#resolveLandedItem (which shells out to `node we:scripts/backlog.mjs resolve`) — no other write path exists that could legitimately drop a `blockedBy` entry on resolve, so the card's 'every trip is a hand edit' claim has no missed consumer.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card specifies one shared pure predicate `(baseText, headText, statusByNum)` in we:scripts/check-standards-rules.mjs reused by both halves, which is the right shape, but never spells out how the `--pre` hot path in we:scripts/backlog-guard.mjs is meant to source `statusByNum` for the removed target(s) without scanning the whole backlog corpus on every Edit/Write (the whole-tree half gets it for free from an already-loaded corpus at we:scripts/check-standards.mjs:780). A minimal per-target lookup (glob `we:backlog/<N>-*.md`) is the obvious cheap answer and is consistent with 'no git call in the hot path,' but the card leaves this seam's contract implicit rather than stated.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when items 1, 2, and 4 require both directions (error case AND clean case) for every mechanism with named fixtures, 'fails before, passes after,' plus item 5's fail-loud requirement on an unresolvable base — exactly the discipline that would have caught the second-wave 'provable no-op' defects (#3004/#3095) this repo already hit once.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Item 5 requires the whole-tree half to emit a named 'did NOT run' warning (mirroring `provenance-gate-unscoped`) rather than reading clean when the base can't be resolved; the `--pre` half already fails via `deny()` (stderr + exit 2), which is visible by construction.

**Corrections applied by this review:**

- The card's '#1002' citations ("the #1002 defect this prevents," "#1002's blocking fix 2") refer to GitHub PR #1002, not backlog item #1002 — git log shows 'Merge pull request #1002' and 'Address #1002 review — ... restore blockedBy 2785 ...'; backlog item #1002 (we:backlog/1002-plugs-test-coverage-spec-conformance-integration-stress-audi.md) is an unrelated, already-resolved 'Plugs test-coverage' epic, so as written the citation is ambiguous/misleading in exactly the way this repo's own provenance gate (#3026) exists to catch.
- The card says a `statusByNum` map must be 'built beside' `kindByNum`/`parentByNum` in `backlogCtx` (~we:scripts/check-standards.mjs:554) — but a `statusByNum` map already exists verbatim at we:scripts/check-standards.mjs:780 (built for the existing stale-block guard); the correct instruction is to reuse/relocate that existing map, not construct a new one.

The design is grounded in a real, git-verifiable defect (confirmed via commit 5d1fe454e — "Address #1002 review — ... restore blockedBy 2785 ..." shows #2840 shipped without `blockedBy: ["2785"]` while #2785 was still open, later restored), correctly identifies and cites the two existing integration seams (the #3026 provenance-gate diff machinery in `we:scripts/check-standards.mjs`, and the `we:scripts/backlog-guard.mjs` `--pre` deny path wired at memory rule #43), correctly establishes that every sanctioned resolve path (direct CLI and the drain's `resolveLandedItem`, which shells out to the same CLI) converges on `applyTransition`, which never touches `blockedBy` — so the "every trip is a hand edit" premise holds — and specifies red/green fixtures for both halves plus a fail-loud posture, which is exactly the anti-decorative-guard discipline this repo's own risk taxonomy (we:backlog/3103) calls for. The one real defect in the preparation is citation-level: it calls the grounding incident "the #1002 defect," but git history shows "#1002" there means GitHub PR #1002, not backlog item #1002 — which already exists as an unrelated, already-resolved epic (we:backlog/1002-plugs-test-coverage-spec-conformance-integration-stress-audi.md). That ambiguity doesn't affect the design's mechanics.

_Recorded through the declared `review-prep` operation._
