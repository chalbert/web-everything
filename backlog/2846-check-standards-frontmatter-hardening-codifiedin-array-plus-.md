---
bornAs: xc85kg0
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [statute-lint, check-standards, prevention, frontmatter]
---

# check:standards frontmatter hardening: codifiedIn array plus an unknown-key allowlist

Two small frontmatter-validation gaps found on PR #982. First, `codifiedIn` is single-valued, so a decision codifying several anchors gets resolution and substance coverage under `check:statute` for only the lead anchor. Second, novel unread frontmatter keys (such as the removed `dateRatified`) pass unnoticed. Let `codifiedIn` accept an array so every codified anchor is covered, and add a front-matter key allowlist in `we:scripts/check-standards.mjs` that flags unknown keys.

## Gap

Two independent but trivially-related frontmatter holes:

1. **`codifiedIn` is scalar.** A decision that codifies several anchors (PR #982 adds four) can only name one in `codifiedIn`, so `check:statute` resolution + substance coverage runs against the lead anchor alone — the other three are uncovered.
2. **No key allowlist.** A novel, misspelled, or stale frontmatter key (the review found a removed `dateRatified`) is silently ignored by `we:scripts/check-standards.mjs` rather than flagged, so a typo'd or dead key never surfaces.

## Why it matters

Both let real metadata slip past the gate unread — coverage that stops at one anchor, and keys nobody validates. Closing them is cheap and makes the frontmatter contract total.

## Mechanical fix

1. Let `codifiedIn` **accept an array**, and run `check:statute` resolution + substance coverage over **every** listed anchor, not just the lead.
2. Add a **front-matter key allowlist** in `we:scripts/check-standards.mjs` that **errors** (or loudly flags) on any key outside the known set — catching novel/stale/typo'd keys such as `dateRatified`.

## Provenance

Captures two outstanding **minor** preventions (the codifiedIn-array minor and the front-matter-key-allowlist minor) from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), grouped as one item per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.

## Design

Two independent edits; do them in one item but in this order, because the second one's baseline is only
measurable once you have looked at the corpus.

### 1. `codifiedIn` accepts an array

The scalar assumption is hard-coded in a regex, not in a schema, so widening it means touching the one place
that reads the field for statute coverage plus the one place that reads it for citation ownership:

- **`we:scripts/lib/validate-rules-anchors.cjs`** — `CODIFIED_RE = /^codifiedIn:\s*["']?([^"'\n]+?)["']?\s*$/m`
  (~L18). This is a raw-text regex over the file, not a YAML read, so a block-sequence value is simply not
  matched and the item's statute coverage silently drops to zero. `collectCodifiedCites` (~L31) feeds
  `validateRulesAnchors` (~L48, the resolution gate) and the substance/orphan passes below it (~L112, ~L182).
  Widening here is the load-bearing half: resolution + substance must run **per anchor**, so the return shape
  becomes one cite per array element rather than one per file.
- **`we:scripts/lib/citation-check.mjs`** — `buildAnchorOwners` (~L90–110) iterates
  `for (const field of [it.codifiedIn, it.graduatedTo])` treating each as a scalar string. An array
  `codifiedIn` must contribute EVERY element to the anchor→owner map, or the #2821 attribution rule starts
  reporting false "attributed to a non-owner" findings the day the first array lands.
- **`we:scripts/check-standards-rules.mjs`** `validateBacklogItem` (~L168) is where the accepted SHAPE is
  declared: string **or** non-empty string[]. Note this is *not* the `scope` shape — `scope` is validated
  array-ONLY (`we:scripts/check-standards.mjs` ~L725 errors on a bare string), so it is a precedent for
  *validating* an array field, not for accepting either form.
- The loader (`we:src/_data/backlog.js`) spreads `...data` unchanged, so an array value reaches every consumer
  without a loader edit. `we:scripts/backlog.mjs`'s `resolve` verb writes the field (~L345) and stays
  scalar-writing — accepting an array does not require the CLI to mint one.

**Two more consumers, both reached by SUBPROCESS rather than by an ES import — miss these and the widening
half-lands:**

- **`we:scripts/backlog/frontmatter.mjs`** — the #911 resolve GATE.
  `validateCodifiedIn(value)` (~L172) opens with `(value ?? '').trim().replace(...)` and then regex-tests
  the result against `^docs\/[\w./-]+\.md(#[\w./-]+)?$`. An array has no `.trim`, and the value it is
  handed comes from `readField(content, 'codifiedIn')` (~L227), a scalar frontmatter read. So a decision
  carrying a legitimate ARRAY `codifiedIn` cannot be resolved through `node we:scripts/backlog.mjs resolve`
  at all — and the refusal message is `no codifiedIn`, which is loud but WRONG on an item that has one. This
  is the seam the whole widening exists to enable, so it is not optional follow-up.
- **`we:scripts/audit-backlog-health.mjs`** — the G7 rule (`cites a codified decision's #N but not its
  statute anchor`). It reads `d.fm.codifiedIn` (~L360) and then does `it.body.includes(anchor)` (~L362).
  With an array, `String.prototype.includes` coerces it to `"a,b"` and simply never matches — so G7 silently
  stops firing for every array-codified decision. No throw, no warning, just a rule that quietly does
  nothing.

Nothing on the tree carries an array `codifiedIn` today (450 items carry the scalar), so the widening is
purely additive and cannot regress an existing item — but it is also why neither of those two breakages is
visible until the first array lands.

### 2. The front-matter key allowlist

There is no key-allowlist anywhere in `we:scripts/check-standards.mjs` or
`we:scripts/check-standards-rules.mjs` today — unknown keys are simply spread through by the loader and
ignored. The natural home is `validateBacklogItem`, which is already pure and fixture-unit-tested.

**The one design constraint that will bite:** `validateBacklogItem` receives the LOADER's item, not the raw
frontmatter, and the loader (`we:src/_data/backlog.js`, ~L349–367) adds derived keys that are not frontmatter
(`id`, `num`, `slug`, `reportDate`) alongside ones that legitimately are (`title`, `summary`, `details`,
`scope`). A naive `Object.keys(item)` allowlist therefore has to allowlist the loader's own inventions,
which couples the gate to the loader's internals. Either pass the raw key list through `backlogCtx`
(the ctx object is built at `we:scripts/check-standards.mjs` ~L554 and already carries injected maps), or
re-read the frontmatter in the caller. Rule it explicitly; do not discover it mid-build.

**Measured baseline** (this tree, ~3.2k items — re-run the count rather than trusting the number, it drifts
with every drain; the per-key counts below reproduce exactly). This is what the allowlist has to be reconciled
against, and what makes the rule worth having. Keys used **once or twice** across the whole corpus, i.e. the exact
novel/stale/typo class the card is about:

`summary` (2) · `formerSlugs` (2) · `dateClosed` (2) · `triagedDate` (1) · `supersededBy` (1) · `workItem` (1)
· `relatedDecision` (1) · `relatedResearch` (1) · `reportDate` (1) · `parkedDate` (1) · `decidedDate` (1) ·
`relatedItem` (1)

Several are plainly wrong rather than merely rare: `relatedItem` against the corpus's `relatedItems`/`relatedTo`,
`parkedDate`/`decidedDate`/`dateClosed`/`triagedDate` against the corpus's `dateParked`/`dateResolved`
convention, and `reportDate` **shadowing a key the loader derives** (~L346) — the frontmatter value is
overwritten on every load, so it has never done anything. `dateRatified`, the key the PR #982 review found,
is no longer present anywhere. Every one of these must be either fixed or explicitly admitted BEFORE the rule
errors; shipping it as an error against an un-triaged corpus reds the gate for everyone.

## Done when

1. `npx vitest run rules-anchors` fails before and passes after, with a new case in
   `we:scripts/__tests__/rules-anchors.test.mjs` proving an ARRAY `codifiedIn` with two anchors produces
   resolution + substance findings for **both** — the second element is where the bug is, so a single-element
   array case does not count. (Tier 1.)
2. `npx vitest run citation-check` covers an array `codifiedIn` in `buildAnchorOwners`: both anchors map to
   the same owning item, and an attribution to that item via the SECOND anchor is not reported as a
   non-owner. (Tier 1.)
3. The RESOLVE seam round-trips: `npx vitest run frontmatter` covers `validateCodifiedIn` accepting a
   two-anchor array and rejecting an array with one bad element, and an end-to-end
   `node we:scripts/backlog.mjs resolve` against a fixture decision carrying an array `codifiedIn` succeeds.
   Without this the widening ships a field the sanctioned CLI cannot write. (Tier 1.)
4. `npx vitest run check-standards` covers the key allowlist in both directions — a fixture item with a
   known-key-only frontmatter is clean, and one carrying `dateRatified` produces exactly one finding naming
   the key. (Tier 1.)
5. `npm run check:standards` is GREEN on the whole tree after the rule lands — meaning every key in the
   measured-baseline list above was fixed at source or added to the allowlist with a reason. A run that is
   green only because the rule was shipped as a warning does NOT satisfy this; if the corpus triage is
   deferred, say so on the item and ship the rule warn-first explicitly. (Tier 1.)
6. `node we:scripts/audit-backlog-health.mjs` still reports G7 findings for a fixture decision whose
   `codifiedIn` is an array — i.e. the `it.body.includes(anchor)` coercion at ~L362 was fixed, not left to
   silently stop matching. (Tier 2.)
7. No item on the tree still carries `reportDate` in frontmatter, since the loader overwrites it — one
   `grep -c '^reportDate:' backlog/*.md` returns nothing. (Tier 2.)

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — Verified live: we:backlog/2851-*.md (the PR #982 review subject) is a resolved decision whose ruling adds four `we:docs/agent/platform-decisions.md` anchors but carries only a scalar codifiedIn — the exact gap the card describes, confirmed against the live repo, not just asserted.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Every measured-baseline number in the card (450 scalar codifiedIn items; formerSlugs/dateClosed=2; triagedDate/supersededBy/workItem/relatedDecision/relatedResearch/parkedDate/decidedDate/relatedItem/reportDate/summary counts) reproduces exactly against the live backlog/ corpus.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The design names exactly two read-side consumers (we:scripts/lib/validate-rules-anchors.cjs, we:scripts/lib/citation-check.mjs) reached by following ES imports, but a repo-wide grep for `codifiedIn` turns up we:scripts/backlog/frontmatter.mjs's #911 resolve-gate (readField/validateCodifiedIn/applyTransition), reached only via we:scripts/backlog.mjs's CLI subprocess path — the exact 'find consumers two ways' gap. Also missed: we:scripts/audit-backlog-health.mjs's G7 rule, which coerces codifiedIn to a string via `.includes()`.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when items 1–3 specify round-trip tests only for the resolution+substance seam and the citation-ownership seam; no round-trip test is specified for the resolve-gate seam (we:scripts/backlog/frontmatter.mjs), which is the seam I found actually broken.
- **population** (addressed; strategy: name the population each threshold guards) — The key-allowlist's guarded population is explicitly named and measured — every once/twice-used frontmatter key across the full backlog corpus, with each classified as wrong-vs-corpus-convention or legitimately rare.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #1 explicitly requires a two-anchor array test where 'the second element is where the bug is, so a single-element array case does not count' — a direct, deliberate guard against a decorative single-element test.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Done-when #4 explicitly forbids shipping the allowlist green-only-because-warn and requires either full corpus triage before erroring or an explicit warn-first admission on the item.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Within the two seams the card does design for, failures are loud (errors). But at the missed resolve-gate seam the failure is loud-but-WRONG (a misleading 'no codifiedIn' message on an item that has one), and at the missed audit-health G7 seam the miss is completely silent — the .includes(array) coercion never throws, it just stops matching.

**Corrections applied by this review:**

- The card's 'mirroring how scope is validated' parenthetical (Design §1) is inaccurate — scope is validated as array-ONLY in we:scripts/check-standards.mjs's §6d-sexies block (a bare string is rejected: 'scope must be an array of repo-qualified path prefixes'), never as 'string or non-empty string[]', so it is not really a precedent for codifiedIn's proposed scalar-or-array shape.
- The card's measured-baseline corpus size ('3191 items') is stale against the live tree (3162 backlog/*.md files today) — though every specific once/twice-used key count it cites still reproduces exactly, so the drift does not undermine any conclusion drawn from those numbers.

The corpus measurements (450 scalar codifiedIn items, the exact once/twice-used key frequencies, the #2851 live example of the gap) all verify exactly against the live repo, but the design's own "one place resolves + one place owns" consumer sweep is incomplete: it misses the #911 resolve-gate in we:scripts/backlog/frontmatter.mjs, which I empirically confirmed refuses to resolve a decision item carrying a legitimate array-form codifiedIn — breaking the exact new capability this card exists to add.

_Recorded through the declared `review-prep` operation._
