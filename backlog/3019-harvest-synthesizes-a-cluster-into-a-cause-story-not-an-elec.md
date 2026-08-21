---
bornAs: xtmnc5b
kind: story
size: 5
status: open
blockedBy: ["3016"]
dateOpened: "2026-08-08"
tags: []
---

# Harvest synthesizes a cluster into a cause-story, not an elected representative

Fork 2 of #2978 rules that recurrence diagnoses a common cause rather than merely ranking. Today a cluster emits one representative (the longest summary), which elects the best-described SYMPTOM, and --min-sessions filters low-count clusters out of the candidate list entirely. Carry every member (with its quoted turn) into the harvest, synthesize a design-level story naming the cause, route single grounded notes to memory and clusters to we:backlog/, and delete the admission floor.

## Sequencing — this rides on #3016, which is not landed

`#3016` (blocked on the resolved `#3015`) is what adds the grounding fields — the quoted turn and the
transcript pointer — to the pool entry schema. **Today no such field exists**: `ALLOWED_KEYS` in
`we:scripts/conveyor/learnings-drop.mjs:60` is exactly `['kind', 'summary', 'area', 'suggestion']` (plus the
`ts` envelope), and `validateEntry` (`:103`) rejects any key outside it — that allow-list *is* the privacy
boundary, so a quoted turn cannot be smuggled through it. `#3018` states the same dependency and carries a
`blockedBy: ["3016"]` edge for it; **this card now carries the same edge** (added during preparation — the
first draft named the dependency in prose only, which the independent review correctly called out). Build order: #3016 first, then
this. Without it, "carry every member with its quoted turn" degrades to "carry every member with its own
`summary`/`suggestion`/`session`", which is worth having but is not what the fork ruled.

## Design

Three separable changes, in the order they compose.

**1 — stop electing a representative, in `we:scripts/conveyor/learnings-dedup.mjs`.** `dedup()` (`:72`)
already clusters correctly (complete-link, no chaining) and already carries `summaries`, the distinct
`suggestions`, and the distinct source `sessions`. What it drops is the **member records themselves**: the
shaped output picks `rep` — the longest summary (`:86-88`) — and takes `kind`/`area`/`summary`/`suggestion`
from it. That is the election this card removes. The change is to carry `members: c.members` (the validated
entries, each with its own `session` and `ts`) alongside what is already emitted, so the harvest reads every
member rather than one stand-in. `kind`/`area` may keep coming from the representative — they are cluster
keys by construction (`isNearDup`, `:60`, requires both to match), so no information is lost there. It is
`summary`/`suggestion` that must stop standing for the cluster.

**2 — delete the admission floor, in `we:scripts/conveyor/learnings-harvest.mjs`.** `harvest()` (`:151`)
ranks by `sessions` then `count`, then filters `ranked.filter((c) => c.sessions >= minSessions)` (`:156`).
Deleting the filter is the whole change; **keep the sort**, which is the ranking half the fork explicitly
preserves. `minSessions` and `belowFloor` come out of `stats` (`:158-166`), the `--min-sessions` flag comes
out of the CLI (`:303`) and out of the non-JSON summary line (`:317`). Callers to sweep: the
`--min-sessions=2` example at `we:skills-src/harvest-learnings/SKILL.md:26`, the "left in the pool" line in
its Report template, and the "do NOT archive if you left candidates below the recurrence floor" paragraph in
its Step 4 (`we:skills-src/harvest-learnings/SKILL.md:156`) — that paragraph's reasoning survives (see
#3017) but its trigger does not. One more, outside the harvest skill:
`we:skills-src/closing-session/SKILL.md:140-144` explains the session-slug requirement *in terms of* the
`--min-sessions=2` floor, so its wording goes stale in the same change.

**One consequence worth filing rather than solving here.** Deleting the floor means every cluster — not just
the recurrent ones — reaches the skill's step-2 red-team, which spawns a budgeted skeptic per candidate. The
per-run candidate volume and its cost go up. That follows from #2978 Fork 2's ratified ruling, not from this
card's design, so it is not this card's defect; file it as a follow-on rather than re-litigating the floor.

**3 — the synthesis is judgment, so it lives in the skill, not the script.** Naming a common cause from N
members is not script-decidable, so per `#deterministic-core-thin-judgment` the core's job ends at "here is
every member of this cluster" and the skill's step 2/3 prose does the rest: read the members, name the
cause, and route — a **cluster** to `we:backlog/` as a design-level story naming that cause, a **single
grounded note** to memory. Do not add a synthesis function to the script.

## Done when

1. **tier 1 — every member survives clustering.** `we:scripts/__tests__/learnings-dedup.test.mjs` asserts a
   cluster of three entries emits all three member records (each with its own `summary`, `suggestion`,
   `session`), not one representative plus a summaries array. Fails before — `dedup()` shapes a single
   representative.
2. **tier 1 — the admission floor is gone.** `we:scripts/__tests__/learnings-harvest.test.mjs` asserts that
   `harvest(entries, { minSessions: 2 })` still returns the one-session cluster — the option no longer
   filters anything — while the sort still puts a three-session cluster above it, and that `stats` carries
   no `belowFloor`/`minSessions`. Fails before — today `:156` drops it and `:158-166` reports it as
   below-floor.
3. **tier 2 — `minSessions` has no live readers, in scripts OR skills.** A grep for `minSessions` and
   `min-sessions` across `we:scripts/` and `we:skills-src/` returns nothing outside a deliberate deprecation
   note: the flag, the `stats.belowFloor` field, the CLI parse, the summary-line branch, the
   `we:skills-src/harvest-learnings/SKILL.md` examples and Report template, and the
   `we:skills-src/closing-session/SKILL.md` explanation are all updated together, not left as dead config.
4. **tier 2 — the skill teaches synthesis, not election.**
   `we:skills-src/harvest-learnings/SKILL.md` step 2/3 instructs the reader to read every member and name
   the common cause, its Report template no longer reports a below-floor count, and
   `npm run skills:sync:check` exits 0.
5. **tier 3 — routing matches the fork's ruling**: a cluster routes to `we:backlog/` as one story naming the
   cause; a single grounded note routes to memory. Stated in the skill in those words, so the two
   destinations are not left to the reader's discretion.

The commands that decide 1-4:

```
npx vitest run scripts/__tests__/learnings-dedup.test.mjs scripts/__tests__/learnings-harvest.test.mjs
grep -rn "minSessions\|min-sessions" scripts/ skills-src/
npm run skills:sync:check
```

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — Every cited line (we:scripts/conveyor/learnings-drop.mjs:60/103, we:scripts/conveyor/learnings-dedup.mjs:60/72/86-90, we:scripts/conveyor/learnings-harvest.mjs:151/156/158-166/303/317) matches the live repo exactly, and the design's core claim ('carry every member... never an elected representative... no admission floor... single grounded note → memory, cluster → we:backlog/') is a near-verbatim restatement of the ratified #2978 Fork-2 text at we:docs/agent/platform-decisions.md#memory-admission-verified-grounding, independently re-verified against the live doc.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card correctly diagnoses that it rides on #3016 (open, blockedBy #3015 which is resolved) and that #3018 encodes the same dependency as a `blockedBy: ["3016"]` frontmatter edge while this card's own frontmatter does not — the card even says so ('this card does not, and probably should') but ships without adding the edge. See finding below.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Checked both ways: ES-import consumer we:scripts/conveyor/close-session-sweep.mjs explicitly whitelists (kind, area, summary, suggestion, count, summaries, suggestions) from dedup()'s output and does not spread the object, so adding `members` is additive and safe; subprocess/CLI callers were grepped (we:package.json's `harvest` script, we:scripts/conveyor/tick-core.mjs) with no hardcoded --min-sessions usage found outside the two skill docs. One prose caller (we:skills-src/closing-session/SKILL.md:142) was missed by the card's own 'Callers to sweep' narrative — see finding below — though the card's own tier-2 grep Done-when check still covers it.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Read the live we:scripts/__tests__/learnings-dedup.test.mjs and we:scripts/__tests__/learnings-harvest.test.mjs: today's dedup tests assert only the representative's summary/summaries, never a `members` array, and the harvest test at line 137-148 asserts `stats.belowFloor`/`stats.minSessions` and that below-floor entries are filtered out of `candidates` — the exact opposite of what the card's Done-when requires. The specified tier-1 tests are real red→green transitions, not decorative.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — Deleting the admission floor means every cluster (not just those meeting the old recurrence bar) now reaches the skill's Step 2 red-team, which spawns one budgeted panel-fanout skeptic per candidate (`--max-total-budget-usd=6`) — the card does not measure or discuss the resulting per-run candidate-volume/cost increase. This is inherited from #2978's already-ratified 'no admission floor' policy rather than introduced by this card, so it is not this card's defect to fix, but it is worth a follow-on card.

**Corrections recommended:**

- none — the preparation held up as written.

The design accurately reflects #2978 Fork 2's ratified text almost verbatim, every cited line number and file matches the live repo, and the specified Done-when tests are real (verified against current test files, not decorative) — the two gaps found are a self-diagnosed but unfixed missing `blockedBy: ["3016"]` edge and an incomplete "callers to sweep" enumeration that the card's own mechanical grep check still catches.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

- **interface** — accepted. The `blockedBy: ["3016"]` edge is now in the frontmatter, so the dependency the
  card described in prose is mechanically enforced.
- **consumer** — accepted. `we:skills-src/closing-session/SKILL.md:140-144` is added to the callers-to-sweep
  list and to Done-when criterion 3.
- **unmeasured-impact** — accepted as a *follow-on*, not folded in: the cost of red-teaming every cluster
  once the floor is gone follows from #2978 Fork 2's ratified ruling, not from this card's design. Recorded
  in *Design* above so whoever builds it files the follow-on rather than quietly re-introducing a floor.
