---
bornAs: xctebq6
kind: story
size: 3
parent: "2948"
status: open
dateOpened: "2026-08-06"
tags: []
scope:
  - we:docs/agent/backlog-workflow.md
  - we:scripts/backlog/scaffold.mjs
  - we:scripts/backlog/__tests__/scaffold.test.mjs
  - we:scripts/backlog/__tests__/frontmatter.test.mjs
  - we:scripts/audit-backlog-health.mjs
  - we:scripts/__tests__/audit-backlog-health.test.mjs
  - we:skills-src/next-backlog-item/SKILL.md
---

# Acceptance criteria on items, written to be proven not judged

Every item states how it will be proven done, on a determinism ladder: an executable check first, an observable artifact second, a prose claim with an exact place to look last. Criteria are authored at file time and committed, so the implementing lane cannot set its own bar, and the review reads a named list instead of re-deriving what could be wrong.

## Sizing note (2026-08-14, prepare pass) — size 3, basis stated

**Basis:** 7 named files across 3 independent, mechanical clusters, none crossing a subsystem boundary and none needing new infra:

1. `we:scripts/backlog/scaffold.mjs` + its 2 test files (`we:scripts/backlog/__tests__/scaffold.test.mjs`, and `we:scripts/backlog/__tests__/frontmatter.test.mjs` — a *real* consumer this prepare pass found: its `renderItem` test at we:scripts/backlog/__tests__/frontmatter.test.mjs:220 asserts the digest paragraph is the *last* thing in the rendered output, which the new skeleton breaks by construction).
2. `we:scripts/audit-backlog-health.mjs` + one new test file for the new exported predicate (this script currently has **no** test file — see *Interface and protocol* below).
3. One prose line in `we:skills-src/next-backlog-item/SKILL.md`.

Each cluster follows an exact existing precedent already in the target file (the `FORK_TELLS`/G4/G5 tells-array shape, the `BACKTICK`+`isPathToken` path-detection helpers, `isExecKind` reuse) — no new data shape, no schema change, no cross-repo edge. Three independent-but-small clusters is a size step above a single-cluster `size:2` (compare [#3091], 4 files/1 discipline) and well under the should-split `size:13` band — **3**.

## Why this is a review-cost item

**Measured 2026-08-14** (grep count over we:backlog/*.md for a leading `## Acceptance` or `## Done when` heading, current counts, superseding the item's original 2026-08-06 figures which are now stale): **410 of 3074** items (13.3%) carry either a `## Acceptance` or a `## Done when` section — 312 `## Acceptance`, 98 `## Done when`, zero overlap. Scoped to the set this item's own flag will actually gate — **open, non-decision items**: only **140 of 427** (32.8%) carry either heading at all, and heading-presence alone does not mean the content inside is tier-1 (see *Delivery shape*). The dev-ready bar asks for "clear acceptance criteria" (we:docs/agent/backlog-workflow.md:551) and `/resolve` re-checks them, but the only gate-enforced goal field is the lead-paragraph digest. So a juror today has nothing to check *against*, and open-ended "find what's wrong with this diff" is the most expensive mandate you can give a model.

Pre-registered criteria change the shape of the review: each juror checks a named list plus anything catastrophic, instead of re-deriving the space of possible defects. That is a much shorter read and a much shorter argument — the biggest token lever after cutting the always-on lens set. It also **dissolves the scope question mechanically**: a finding that traces to a criterion is in scope, one that does not is a carve-out by construction (#2950), with no judgment call.

This cashes in a call already settled on #2636 — *"early human alignment (jury pre-registered at prepare)"* — and is the item-side half of #2638's prepare-time charter.

## The determinism ladder

Write criteria as high on this ladder as the item allows:

| tier | form | who checks it |
|---|---|---|
| 1 · executable | a named command that fails before and passes after — a test, a `check:standards` rule, a webcase, a visual baseline diff | nobody. It is green or it is not |
| 2 · observable | a named artifact or state: a file at a path, an endpoint returning X, a pattern present or absent | one cheap command, no judgment |
| 3 · assertable | a prose claim plus the exact place to look (*`resolveRoster` returns an empty roster for care `none`*) | a juror must read — costly, so cap these |
| — | anything vaguer ("improves clarity", "handles errors properly") | not a criterion. Rewrite it or drop it |

**Every item carries at least one tier-1 criterion, or an explicit line saying why it cannot** (doc-only, pure design judgment). That single requirement does most of the work: it forces the author to think about proof at file time, when it is cheap and convergent, rather than at review time, when it is a negotiation.

**The section is titled `## Done when`, not `## Acceptance` — decided, not a style pick.** `we:scripts/lib/citation-check.mjs:281-288` (#3026) already names `## Done when` (alongside `## Design`) a standing *provenance-lint escape zone*: a heading under which citing a not-yet-real path/symbol needs no `(proposed)` marker, because "the item will WRITE" it. `we:docs/agent/conventions.md:134` states the same convention independently. Tier-1/2 criteria on an unbuilt item routinely cite paths that don't exist yet (this item's own criteria below cite a test file this item creates) — writing them under `## Acceptance` gets no such escape today, and PROVENANCE gate scope is heading toward `backlog/` (`we:scripts/check-standards.mjs:1139` — "#3026 stays open for the backlog half"; currently `docs/agent/**` + `leash: spec` only, not yet `backlog/`). `## Acceptance` is not migrated repo-wide by this item (312 existing items keep it, and the new check accepts either heading — see *Interface and protocol*); only the convention this item teaches, going forward, changes name.

## Authoring, not self-certifying

Criteria are authored **at file time** by a single agent — shaped by the lens set (what would correctness need to see, what would conformance need to see) but written in one pass, not a fan-out. Writing criteria is convergent and cheap; only judging them is worth a jury. A committee-authored variant is worth trying at `high` care later, using the same care band data.

**The implementing lane must never write its own criteria.** Same anchoring problem the `dismissed-findings` signal exists to catch: an author who sets the bar sets it where the work already is. Criteria live on the item, committed to git, so weakening them is a visible diff rather than a private judgment.

Cap the count at 3–5 so this does not become its own ceremony. Start as a convention with a `check:health` flag; promote to a `check:standards` error once the backlog has caught up.

## The decided design — a `check:health` CANDIDATE flag, not a gate, not guidance-only

Three shapes were possible: (a) a `check:standards` **error** that blocks landing, (b) a `check:health` **CANDIDATE flag** — informational, never fails a build, the same posture G3–G7/D1–D3 already use — or (c) prose guidance only, with nothing computed. **(b), decided, not left open**: (a) is ruled out on measurement — see *Delivery shape*, it would redden at least ~67% of open non-decision items on day one (likely higher once heading-presence-without-tier-1-content is counted), exactly the "lands red" failure mode the prepare brief warns against. (c) is ruled out by #2607: whether an `## Acceptance`/`## Done when` section exists, and whether it contains a backticked, path-or-command-shaped token, is exactly the kind of thing a script decides — judgment stays only in *is this specific criterion actually good enough*, which the flag never claims to answer (CANDIDATE, per the G-series convention it copies). The phased promotion the item already named — flag now, `check:standards` error later, once the backlog has caught up — stays as stated; this section just names why (b) is the only shape that survives contact with the current corpus.

**A real, still-open sub-decision this prepare pass could not close on evidence alone** (named, not silently picked — see below under *Interface and protocol*, "Gating population"): whether the flag scopes to `status:open && isExecKind` (broad, no new import, matches this script's existing self-contained style) or to the true readiness-engine Tier A / dev-ready set (accurate to the item's own "dev-ready item" framing, but requires this frontmatter-parsing script to also load we:src/_data/backlog.js's tier computation — a second item-loading path in one script, the exact drift shape #3099's "reuse `coversFile`/`normScope`" rule warns against for scope matchers). Recommended default: the broad proxy, narrowed later by measurement — the same path G3 took (350 → 41 hits once its subject was narrowed, we:docs/agent/backlog-workflow.md:382).

## Interface and protocol

New `A1` flag in we:scripts/audit-backlog-health.mjs, matching the shape every G/D/O flag there already uses (`flags` object, `desc` map, `section()` renderer — we:scripts/audit-backlog-health.mjs:349,531,553-554):

- **Docblock** (we:scripts/audit-backlog-health.mjs:24-56, the `G1…D3` list) gains an `A1` entry, same one-paragraph style as `G4`/`G5`.
- **Predicate**, exported (unlike every existing helper in this file, which is unexported — needed so a new test can import it directly, since this script has no test file today):
  ```js
  // A1 missing-done-when-proof — an OPEN, non-decision item (isExecKind) whose body has neither a
  // `## Done when` nor legacy `## Acceptance` heading, OR has one with no backticked, path/command-shaped
  // token (reusing BACKTICK + isPathToken, the same D1 uses to decide a citation "looks real") and no
  // explicit exemption phrase ("doc-only", "design judgment", "no tier-1"). CANDIDATE, like G3/G4/G5 — a
  // hit is a card to add a tier-1/2 criterion to, or exempt, never a verdict.
  export function missingDoneWhenProof(it) { … }  // -> { hit: bool, reason: 'no-section' | 'no-executable-token' | null }
  ```
  Reuses `BACKTICK` (we:scripts/audit-backlog-health.mjs:116) and `isPathToken` (we:scripts/audit-backlog-health.mjs:157) rather than a new detector — the same reuse `sectionRanges`/`suppressionReason` already model for D1 (we:scripts/audit-backlog-health.mjs:221,233).
- **Gating population**: `status === 'open' && isExecKind(it.kind)` (imported already, we:scripts/audit-backlog-health.mjs:72) — see the named sub-decision above.
- **Registration**: push into `flags.A1` in the per-item loop alongside G4/G5 (we:scripts/audit-backlog-health.mjs:388-413 is the pattern to copy); one `desc.A1` line (we:scripts/audit-backlog-health.mjs:531); one `section('A1', …)` call beside D1–D3 (we:scripts/audit-backlog-health.mjs:558-560).
- **No `check:standards` wiring yet** — `check:health` is a standalone, always-exit-0 report (confirmed: no `process.exit` anywhere in we:scripts/audit-backlog-health.mjs). That is what makes shape (b) safe to land today.

## Build / Tasks

1. we:docs/agent/backlog-workflow.md — add the determinism-ladder table, the ≥1-tier-1 rule, the cap, the authoring rule, and the `## Done when` (not `## Acceptance`) heading convention, near the existing "clear acceptance criteria" bullet (we:docs/agent/backlog-workflow.md:551) and the `## Build`/`## Acceptance` digest note (we:docs/agent/backlog-workflow.md:250).
2. we:scripts/backlog/scaffold.mjs — `renderItem` appends a `## Done when` skeleton (one `**Executable**` TODO line) after the digest paragraph.
3. we:scripts/backlog/__tests__/scaffold.test.mjs — assert the skeleton is present in `renderItem`'s output.
4. we:scripts/backlog/__tests__/frontmatter.test.mjs — fix the assertion at line 220 (`expect(out).toMatch(/\n[^\n#-].*\n$/)`, "a non-empty digest paragraph at the end") to match the new trailing content instead of assuming the digest is the last line.
5. we:scripts/audit-backlog-health.mjs — add `missingDoneWhenProof` (exported), wire `A1` per *Interface and protocol* above.
6. we:scripts/__tests__/audit-backlog-health.test.mjs (new) — unit-test `missingDoneWhenProof` against fixture item bodies: no section → hit; section with no backticked token → hit; section with a real command → no hit; exemption phrase present → no hit.
7. we:skills-src/next-backlog-item/SKILL.md — one line in the selection step (near we:skills-src/next-backlog-item/SKILL.md:107-109) preferring a candidate with a `## Done when`/`## Acceptance` tier-1 entry as a tie-break. Deliberately left as prose/judgment here, not wired into we:scripts/readiness/engine.mjs's ranking — that would be the mechanical version and is a reasonable follow-on, but is excluded from this item to keep it to one gate (we:scripts/audit-backlog-health.mjs) rather than two.

we:scripts/backlog.mjs (the only ES importer of we:scripts/backlog/scaffold.mjs, we:scripts/backlog.mjs:41) is a deliberate exclusion from scope: it only consumes `renderItem`'s return value and neither its own tests nor its CLI surface inspect body content beyond the digest, so the skeleton addition needs no edit there.

## Delivery shape

Lands as one PR, incrementally safe: `check:health` never fails a build (confirmed above), so `A1` can go live against the true current corpus and burn down over time — no fixture gaming needed. **Measured baseline the flag will report on day one** (2026-08-14, we:backlog/*.md): of **427** open, non-decision items, only **140 (32.8%)** carry a `## Acceptance` or `## Done when` heading at all; the true "has a tier-1/2-looking entry inside it" count is smaller still (heading presence was the cheap, honest measurement taken here — the backtick-token heuristic wasn't run corpus-wide to avoid over-claiming precision this prepare pass didn't verify). A `check:standards` **error** version of the same check would today fail at least ~67% of open non-decision items — confirms landing as a non-blocking flag first is not caution for its own sake, it is the only shape that doesn't land red.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs scaffold --kind=story …` produces an item whose body contains a `## Done when` section; a vitest case in we:scripts/backlog/__tests__/scaffold.test.mjs asserts it, and we:scripts/backlog/__tests__/frontmatter.test.mjs's trailing-content assertion is updated to match, not deleted.
2. **Executable** — we:scripts/__tests__/audit-backlog-health.test.mjs asserts `missingDoneWhenProof` hits on a body with no `## Done when`/`## Acceptance` section, hits on one with the section but no backticked token, and does not hit on one with either a real command or an exemption phrase.
3. **Observable** — `npm run check:health` prints an `A1` section and count against the real corpus (baseline ≈287 of 427 open non-decision items, per *Delivery shape*), giving a number to burn down.
4. **Executable** — `npm run check:standards` reports 0 errors.
