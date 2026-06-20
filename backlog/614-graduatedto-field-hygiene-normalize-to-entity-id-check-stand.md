---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# graduatedTo field hygiene — normalize to entity-id + check:standards rule

The #607 audit found graduatedTo is pervasively polluted: many entries hold multi-sentence implementation narratives instead of an entity id, and conventions are mixed (project:webcompliance vs bare webcompliance vs we:webcompliance/gate.ts vs prose). Project-id spelling also diverges between a project-creation item and its slices (weblifecycle #353 vs lifecycle #380/#391; webaudit #357 vs audit-trail #399), defeating entity-graph joins and the audit's lineage walk. Add a normalizer + a check:standards rule constraining graduatedTo to {project:|protocol:|intent:|block:|adapter:}<id> or a repo path, moving any narrative to the body. Unblocks reliable G3 lineage analysis.

## Progress

**Resolved 2026-06-14.** Built the machinery + ran the safe migration; the large narrative→body
relocation is spun off as **#619** (it's ~74 rows of judgment-bearing prose moves, not size-3).

Surveyed all 423 `graduatedTo` values: 210 already conforming (`none` 143, typed-id 39, repo-path 34),
41 safe auto-fixes, 7 registry-collision ambiguities, ~165 prose/narrative.

- **`we:scripts/normalize-graduated.mjs`** (new; `npm run normalize:graduated`) — classifies every value
  (none / typed / path / fix-bare / fix-anchor / review-*) and `--write` applies only the unambiguously
  safe transforms: a bare id resolvable in exactly one registry → `<kind>:<id>`, and a clean
  `<reg>.json#<id>` anchor → `<kind>:<id>`. Multi-registry collisions are disambiguated by an explicit
  per-item map keyed off each item's title (`Build the … runtime block` → `block:`, `Candidate standard
  … intent` → `intent:`). **Ran it: 48 values typed** (40 bare + 1 anchor + 7 disambiguated), e.g.
  `disclosure`→`intent:disclosure`, `weblifecycle`→`project:weblifecycle`, `lifecycle`→`block:lifecycle`
  (the apparent #353-vs-#380 "divergence" was a real project/block namespace pair the prefix disambiguates,
  not a misspelling). typed 39→87.
- **check:standards rule tightened** — `isCanonicalGraduated` (in we:check-standards-rules.mjs, unit-tested)
  requires the value to LEAD with a resolvable ref (`none` / resolving `<kind>:<id>` / repo-path / bare
  registry id; a trailing annotation is tolerated). we:check-standards.mjs emits **one aggregated warning**
  (not per-item — that would flood) listing the 74 still-non-canonical items and pointing at the
  normalizer + #619. The existing `<kind>:<id>`-resolution error (#247) is unchanged.
- **Docs** — canonical grammar recorded in `we:docs/agent/backlog-workflow.md` close-out step. **Tests** —
  6 new `isCanonicalGraduated` cases; `scripts/__tests__` 165 green. `check:standards` 0 errors.
