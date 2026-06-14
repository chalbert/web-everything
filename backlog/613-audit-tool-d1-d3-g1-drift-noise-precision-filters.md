---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Audit tool: D1/D3/G1 drift+noise precision filters

Tighten the drift and edge-gap checks in scripts/audit-backlog-health.mjs, per the #607 audit (D1: 9 hits / 0 true dead-refs; G1: 104 hits / 0 slips). D1: suppress paths governed by negation (assertion-of-absence, 'there is no plugs/package.json'), a write/emit verb (runtime output), or build-card deliverable prose ('a page at X' = will-create); resolve bare suffixes against the dir named nearby and split slash-joined enumerations against src/_data/. D3: aggregate per-project (resolved count + live surface) not per-item, and separate intentionally-pending status (webplugs correctly 'concept' pending #606) from stale drift. G1: drop per/ruled-by/after/once, keep gated-on/depends-on/requires/builds-on — 104 to single digits.

## Progress

**Resolved 2026-06-14.** All three precision filters landed in `scripts/audit-backlog-health.mjs`;
measured against the real backlog (602 items):

- **D1: 8 → 0** (every hit was a false positive, now resolved or suppressed). Two new resolution
  gaps — `resolvesAsEnumeration` (slash-joined `blocks/intents/plugs/protocols/projects.json` → five
  real `src/_data/*.json`) and `resolvesAgainstDir` (a bare suffix like `adapters/eslint.mjs` joined
  to a dir named in the *same section*, `scripts/validation-normalize/`; caught #236 and #449) — plus
  `suppressionReason` over the 60 chars before the path: **absence** (`no \`plugs/package.json\``, #606),
  **generated** (`writes \`reports/…burndown.json\``, #435), **planned** (`a page at \`demos/converter.html\``,
  #038). Sections are split heading-by-heading so a dir only resolves a ref in its own section.
- **D3: 18 per-item → 6 per-project.** Now aggregated by `relatedProject` after the loop: a project
  missing from `projects.json` is a dangling ref; a `concept` project with ≥ `STALE_RESOLVED_MIN` (5)
  resolved items is stale drift (webblocks/webadapters/webintents/webtraits/webdocs/webvalidation).
  Intentionally-pending concept projects with little resolved work are excluded — `webplugs` (0
  resolved, pending #606) and `webcases` (3 resolved, too thin) no longer flag. Candidate pool; the
  judgment layer confirms (slips-ledger #617 ratified 4 of the 6).
- **G1: 104 → 14 (4 active + 10 INFO).** `PROSE_PREREQ` now keeps only real gate verbs
  (`gated on`/`depends on`/`requires`/`builds on`/`needs`/guarded `blocked on/by`); dropped `per`/`ruled
  by` (lineage) and `after`/`once` (temporal) which were 97 of 104 hits. `blocked on/by` is skipped when
  another `#M` sits within 40 chars to its left (citation, not a fresh edge); both-ends-resolved demotes
  to INFO (sorted last, excluded from the active count).

`npm run check:standards` green (0 errors). No test harness existed for this tool and none was added
(read-only devtool; verified against the #607 false-positive corpus above).
