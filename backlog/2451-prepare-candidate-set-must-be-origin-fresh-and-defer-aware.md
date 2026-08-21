---
bornAs: xwjx23w
kind: story
size: 3
status: open
dateOpened: "2026-07-12"
tags: [prepare, readiness, freshness, defer, tooling]
scope:
  - we:scripts/readiness/
  - we:scripts/check-readiness.mjs
  - we:.claude/skills/prepare-decision-item/SKILL.md
  - we:scripts/backlog.mjs
  - we:scripts/__tests__/backlog-cli-snapshot.test.mjs
---

# /prepare candidate set must be origin-fresh and defer-aware

Close the gap that let `/prepare all` (2026-07-12) prepare-hold and nearly stamp two decisions carrying a standing operator defer: make the prepare flow (a) read candidate bodies at the origin/main tip, never a possibly-stale primary tree, and (b) screen out — or at least surface — decisions whose body carries an operator-defer block or a defer-scoped `priority: low`. Today `we:scripts/readiness/engine.mjs`'s `priority: low` filler exclusion applies only to Tier A, so deferred Tier-B decisions still enter the prep candidate pool.

## Why (the 2026-07-12 near-miss)

A `/prepare all` session built its candidate set and read #2444/#2446 from the primary checkout, which was stale — a concurrent session had landed `eff5725a` (re-scope #2445; operator-defer blockquotes + `priority: low` on both decisions). The session prepare-held both, ran the full research spend, and authored prepared-fork bodies before a skeptic sub-agent reading the *current* file surfaced the defer. The stamp was averted, but every guard fired late: nothing in the candidate-set step reads origin-fresh bodies or respects defer markers.

## What to change

- **`we:scripts/readiness/engine.mjs` (Tier-B filler gap):** the `isFiller` (`priority === 'low'`) exclusion filters only `tierAopen`; apply an equivalent screen (or an explicit `deferred` surfacing) to the Tier-B decision projection so `check:readiness --select` stops offering defer-parked decisions as prep candidates. Keep them visible under a "deferred" label rather than silently hidden — `priority: low` is "pickable, out of auto-select" by ruling.
- **`we:.claude/skills/prepare-decision-item/SKILL.md` (step 1):** require a `git fetch origin` + candidate-body reads at the origin/main tip (or inside the freshly-refreshed lane), and add a hard step-1 check: a body carrying a `**Deferred (… operator call)**` block is excluded from the candidate set — an operator defer is binding on prep, not just on ratification.
- **`prepare-hold` guard (optional hardening):** `node we:scripts/backlog.mjs prepare-hold <NNN>` could warn (not block) when the target's origin-tip body carries a defer block, catching the case where a session bypasses the skill.

## Grounding

- `we:scripts/readiness/engine.mjs` — `isFiller` applied to `tierAopen` only; `tierB` projection has no `priority: low` exclusion.
- `we:scripts/check-readiness.mjs:91-110` — the #2204 fetch-first fix fast-forwards local main before *ranking*, but nothing protects the later per-item body reads during prep authoring.
- Prep-assessment notes on [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/) and [#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/) record the near-miss this item closes.

## Design

**The engine change is a three-line mirror of the Tier-A shape that already exists.**
`we:scripts/readiness/engine.mjs:189-193` reads today:

```js
const isFiller = (it) => it.priority === 'low';
const tierAopen = open.filter((it) => it.tier === 'A');
const tierA = tierAopen.filter((it) => !isFiller(it)).sort(rank).map(project);
const filler = tierAopen.filter(isFiller).sort(rank).map(project);
const tierB = open.filter((it) => it.tier === 'B').sort(rankB).map(project);   // ← no filler split
```

Split `tierB` the same way — `tierB` (non-filler, `rankB`-sorted) plus a new `tierBDeferred` group — and add
`tierBDeferred: tierBDeferred.length` to the `counts` object at `:214`. **Demote, do not hide:** `priority: low`
is ruled "pickable, out of auto-select" (#1620), and the existing `filler` group is the precedent — it is
returned, counted, and rendered, just not offered as agent-ready. Do the same here rather than dropping the
items from the projection.

The loader (`we:src/_data/backlog.js:735-737`) already computes `countLowDecision` / `pointsLowDecision` /
`countLowPreparedDecision` for exactly this population, so the Prioritisation tab's numbers and the CLI's new
group are derived from the same predicate and cannot disagree. **Do not add a second `isLow` definition.**

Render it in `we:scripts/check-readiness.mjs` beside the existing `filler` block at `:312-314`, and mirror the
two list-shaping passes the filler group already gets (`dropHeld` at `:142`, `dropPr` at `:160`) so a
prepare-held or in-PR deferred decision does not reappear in the new group.

**There is a SECOND consumer of `selection.tierB`, and it must not be left asymmetric.**
`we:scripts/operations/suggest-next.mjs` — the `/next decision` path — reads `selection.tierB` straight into
its board at `:157` and forwards `selection.filler` at `:158`, then picks from `board.tierB` at `:250`. Split
the engine's `tierB` and this consumer silently inherits the *right* behaviour (it stops offering deferred
decisions) but gains **no** way to surface them, while `check-readiness --select` gets a labelled section.
Forward `tierBDeferred` here the same way `filler` is forwarded, and give it the same
"nothing ready, but deferred items exist" fallback message the filler branch already has at `:315-316`. Its
suite `we:scripts/operations/__tests__/suggest-next.test.mjs` covers the Tier-A filler case but has no
Tier-B `priority: low` case, and its Tier-B assertion derives its expectation from `computeSelection` itself
— so it will not redden either way. That is why criterion 3 below names it explicitly.

**The freshness half is skill-side, and the fetch guard it needs already exists.**
`we:scripts/check-readiness.mjs:104-112` calls `checkMainStaleness({ autoFf: true })` and **hard-stops**
(`exit 3`) on `--select`/`--json` when the tree is still stale. So step 1 of the skill is already protected
*when it goes through the CLI*. What is unprotected is the **later per-item body reads** during authoring —
step 3 onward in `we:.claude/skills/prepare-decision-item/SKILL.md`, which happen in a lane clone the skill
never tells the preparer to re-fetch. The edit is to that skill: require the candidate bodies to be read at
the `origin/main` tip (or inside a freshly-fetched lane), and state it as a hard step-1 check, not advice.

**The defer marker has a concrete shape to match.** The blocks the 2026-07-12 near-miss missed were written
by commit `eff5725a` as a blockquote opening `> **Deferred (2026-07-11 red team — operator call).**` — i.e.
a line matching `/^>?\s*\*\*Deferred \(/m`. Both of *those* instances have since been removed (#2444
resolved on ratification, #2446 re-worded), but the pattern is **not** extinct in the corpus:
`we:backlog/2531-saas-cost-build-control-governance-for-the-autonomous-builde.md:13` reads
`**Deferred (2026-07-16, operator call).**`, matching verbatim. It is `kind: epic`, so it is not a Tier-B
prep candidate and cannot serve as the fixture — a build must still author its own — but do not grep the
corpus, find that one hit, and conclude either that the pattern is dead or that a live decision carries it.

**Scope note on the third bullet.** The `prepare-hold` warning is marked optional in *What to change* and
should stay optional: `prepareHold` (`we:scripts/backlog.mjs:518-528`) does not read the item body at all
today, only `resolveFile` for existence. Adding an origin-tip body read to it turns a local, offline-safe
token write into a network-dependent one. If it is built, it warns and never blocks.

## Done when

1. **Executable — the Tier-B filler gap is closed.** Run, from the WE checkout root:

   ```
   npx vitest run scripts/readiness/__tests__/engine.test.mjs
   ```

   It passes with a case feeding `computeReadiness` two Tier-B decisions, one `priority: low`, and asserting
   the low one appears in `tierBDeferred` and **not** in `tierB`, while the other appears in `tierB`. Fails on
   `main` today — both land in `tierB`.
2. **Executable — the demote-not-hide invariant is pinned.** The same suite asserts the deferred decision is
   still *present* in the returned report (it is not filtered out of existence) and that
   `counts.tierBDeferred` equals its length — so a later change cannot quietly turn the demotion into a
   removal.
3. **Observable — BOTH consumers surface the group, not just one.** `npm run check:readiness -- --select`
   prints a labelled deferred-decisions section when any open Tier-B item carries `priority: low`, in the
   same style as the existing filler section, and those decisions no longer appear in the Tier-B ranking
   above it. **And** `we:scripts/operations/suggest-next.mjs` forwards `tierBDeferred` into its board
   alongside `filler`, so `/next decision` reports "deferred decisions exist" rather than silently showing
   an empty Tier-B pool. Five open decisions carry `priority: low` on the current tree
   (#1648, #2298, #2299, #2300, #2446), so both surfaces have live input to check against.
4. **Assertable — the skill's step 1 is defer-binding and origin-fresh.**
   `we:.claude/skills/prepare-decision-item/SKILL.md` step 1 states, as a hard check rather than a
   suggestion, (a) that candidate bodies are read at the `origin/main` tip or in a freshly-fetched lane, and
   (b) that a body carrying a `**Deferred (…)**` block is excluded from the candidate set because an operator
   defer binds prep, not only ratification. Read those two sentences in the file's *Quick path* section.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — Verified against git history: commit eff5725a (2026-07-11) added `> **Deferred (2026-07-11 red team — operator call).**` to we:backlog/2444-*.md and we:backlog/2446-*.md alongside `priority: low`, matching the card's account exactly. we:backlog/2446-*.md is still open and still carries `priority: low` today, so the near-miss population is live, not hypothetical.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Corpus check confirms the population is real and small: 5 open `kind: decision` items currently carry `priority: low` (we:backlog/1648-*.md, we:backlog/2298-*.md, we:backlog/2299-*.md, we:backlog/2300-*.md, we:backlog/2446-*.md). The card doesn't state this count explicitly but grounds itself in one live instance (#2446), which is sufficient given the fix's small, mirrored shape.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card's grounding only traces we:scripts/check-readiness.mjs as a consumer of `computeSelection().tierB`. A second, unmentioned ES-import consumer exists: we:scripts/operations/suggest-next.mjs:149,157 (powering `/next decision`) reads `selection.tierB` straight through into its own `board()` output, and forwards `selection.filler` (line 158) but has no equivalent for the new `tierBDeferred` the card proposes. we:scripts/operations/__tests__/suggest-next.test.mjs exercises the Tier-A `priority: low` filler case (line 70/117) but has no equivalent case for a Tier-B `priority: low` decision, and its Tier-B assertion (line 105) derives its expectation from `computeSelection` itself rather than a hardcoded list, so it won't redden either way — the interaction is simply untested. Net effect if built exactly as scoped: `/next decision` also stops offering deferred items (a correct, welcome side-effect), but has no path to surface them as 'deferred' the way we:scripts/check-readiness.mjs's dedicated section does — an asymmetry the card never discusses.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #1/#2 specify an explicit `we:scripts/readiness/__tests__/engine.test.mjs` case feeding `computeReadiness` two Tier-B decisions and asserting the split (`tierBDeferred` vs `tierB`) plus `counts.tierBDeferred` — a real seam-level test, not just an executable-CLI claim.
- **population** (addressed; strategy: name the population each threshold guards) — The population (`priority === 'low'` Tier-B decisions) is defined by literally reusing the existing `isFiller` predicate/semantics that #1620 already established for Tier-A, and the card explicitly forbids inventing a second `isLow` definition, pointing at the loader's existing predicate in we:src/_data/backlog.js — consistent, non-divergent population.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The engine-side half has a real, named test (see `interface` above), but the skill half — the piece that actually closes the origin-freshness gap during authoring — is enforced only as prose ('a hard check, not advice') in we:.claude/skills/prepare-decision-item/SKILL.md, with done-when #4 satisfied by grepping for two sentences existing, not by any mechanism that can redden on a stale read. The card is aware of this (the optional `prepare-hold` warn-on-defer hardening in we:scripts/backlog.mjs is explicitly proposed as a bridge) but marks that hardening optional, so the required scope ships with no deterministic backstop if a session skips or misreads the skill text — the same class of failure (a stale local read outrunning a text-only process) that produced the 2026-07-12 near-miss in the first place.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #2 explicitly pins 'demote, do not hide': the deferred decision must still appear in the returned report and `counts.tierBDeferred` must equal its length, guarding against a later change silently turning the demotion into a removal — mirrors the existing `filler` precedent at we:scripts/readiness/engine.mjs:189-193.

**Corrections applied by this review:**

- The card's citation `we:src/_data/backlog.js:734-737` for `countLowDecision`/`pointsLowDecision`/`countLowPreparedDecision` is off by one line — those three predicates actually sit at lines 735-737; line 734 is `pointsLowAgentReady`, a different (Tier-A) predicate not among the three named.
- The claim 'there is no live example in `backlog/` to test against' for the `/^>?\s*\*\*Deferred \(/m` pattern is not quite accurate: we:backlog/2531-saas-cost-build-control-governance-for-the-autonomous-builde.md:13 currently reads `**Deferred (2026-07-16, operator call).**`, matching the regex verbatim — though since it's `kind: epic` rather than `kind: decision`, it doesn't serve as a Tier-B prep-candidate fixture, so the card's underlying advice (author a purpose-built fixture) still stands.

The engine/skill design is a precisely-grounded, minimal fix (every cited line number and the motivating incident checked out against the live repo, and the bug is live today — 5 open Tier-B decisions currently carry `priority: low`) but the grounding pass missed a second direct consumer of the field it's reshaping, and the skill-side half of the fix is enforced only by prose.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** All three points verified and applied:

- **consumer (was NOT addressed)** — confirmed. `we:scripts/operations/suggest-next.mjs:157` forwards
  `selection.tierB` and `:158` forwards `selection.filler`; `:250` picks from `board.tierB`. *Design* now
  names it as the second consumer and criterion 3 requires both surfaces, not just `check-readiness`.
- **line ref 734 → 735-737** — confirmed against `we:src/_data/backlog.js`; `:734` is `pointsLowAgentReady`.
  Corrected in *Design*.
- **live `**Deferred (` example** — confirmed at
  `we:backlog/2531-saas-cost-build-control-governance-for-the-autonomous-builde.md:13`. *Design* now says the
  pattern is live in the corpus (on an `epic`, so still not usable as the fixture) instead of claiming it is
  extinct.
- **decorative-guard (NOT addressed) — accepted as a real residual, not fixed here.** The review is right
  that the skill-side half ships with no deterministic backstop. Promoting the optional `prepare-hold`
  warn-on-defer to required would turn a local, offline-safe token write into a network-dependent one (see
  *Scope note*), which is its own tradeoff and not this card's to make silently. Left as stated: the engine
  half carries the tier-1 proof; the skill half is tier-3 by nature, and the hardening stays optional.
