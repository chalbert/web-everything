---
bornAs: xluje5a
kind: story
size: 3
status: open
dateOpened: "2026-08-07"
tags: [gate, docs, skills]
---

# Resolve relative markdown links in docs/agent and skills-src at the gate

Nothing in `check:standards` resolves a relative markdown link against the filesystem — the only link lint
is a backlog-body regex that never touches disk. A scan of `we:docs/agent/` + `we:skills-src/` finds 50 of
129 relative links dangling from the tracked path, across 22 files. 46 of those are one systematic pattern:
a skill linking three levels up to `we:docs/agent/`, which is correct through the `we:.claude/skills`
symlink but one level too deep from `we:skills-src/`. So the first job is not a sweep, it is a ruling on
which view is canonical; the gate then enforces whichever it is.

## Why this is not just "fix 50 links"

`we:.claude/skills` is a symlink to `we:skills-src`, so every skill file has two valid depths to the repo
root. An agent loads a skill through the symlinked path (3 levels deep), where a three-dot link resolves
correctly. A human, GitHub, or any editor reads the tracked path (2 levels deep), where the same link points
above the repo root and 404s.

Both readerships are real, so "the links are broken" is only true from one of them. The 46 are not rot —
they are the tracked spelling of a link that works where agents actually read it. Pick the canonical view
before writing any gate, or the gate will mass-rewrite links that were never wrong at runtime.

## Scope

- **Rule the fork first.** Either (a) the tracked path is canonical → rewrite the 46 to two-dot form and
  require the tracked spelling, or (b) the symlinked runtime view is canonical → the gate resolves skill
  links through the symlink and the tracked view stays "wrong" by design. (a) is the bold default: it makes
  the tracked file self-consistent and needs no symlink present to validate.
- **The gate.** Resolve every relative markdown target under `we:docs/agent/` and `we:skills-src/` from the
  file's real on-disk path; error on a non-existent target. Fold into the existing `check:standards` walk.
- **Exempt site routes.** A link ending in a slash is an 11ty rendered route, not a file. 4 exist today;
  they must not be flagged.
- **Fix the genuinely stale targets** the scan finds beyond the symlink class — **7, not 4**, on the
  2026-08-21 re-measure (see *Reproduce*). Beyond the `exec-kind` test target this bullet was written for:
  `we:docs/agent/backlog-workflow.md` links `we:backlog/070-jsx-directive-sugar.md` with a missing `../../`,
  it and `we:docs/agent/conventions.md` both link `we:src/_data/blocks.json` at the wrong depth,
  `we:docs/agent/vision-tiers.md` and its `we:skills-src/review-design/SKILL.md` twin target a
  `we:src/_data/intents.json` that no longer exists, and two skill files link renamed-`bornAs` backlog
  filenames.
- **Rule the cross-repo relative link.** `we:docs/agent/platform-decisions.md` carries
  `[fui:.github/workflows/ci.yml](../../../frontierui/.github/workflows/ci.yml)` — a *clickable relative*
  target that walks out of this repo. The "not a cross-repo resolver" non-goal below covers **scheme-prefixed**
  (`fui:`/`plateau:`) targets, not a plain relative path that happens to cross a repo boundary, and
  `we:docs/agent/conventions.md` says cross-repo paths are plain text with the prefix. So this is either a
  convention violation to fix or an exemption to state — decide it rather than letting the resolver decide it
  by accident.

## Non-goals

- **Not the section-anchor half.** The review that surfaced this also proposed resolving cited skill section
  ids to real headings. Those are prose labels, not markdown anchors, and matching them needs a heading
  convention that does not exist. File separately if wanted.
- Not a link check over `we:backlog/` bodies — `findBadBodyLinks` already owns that corpus.
- Not a cross-repo (`fui:` / `plateau:`) resolver.

## Reproduce

Walk `we:docs/agent/` + `we:skills-src/` for markdown links whose target is relative, resolve each against
the containing file's real directory, and bucket the misses into: ends with a slash (site route, ignore),
resolves after dropping one leading level (the symlink-view class), and everything else (stale). Current
counts: 129 links, 75 resolve, 4 site routes, 46 symlink-view, 4 stale.

## Provenance

Surfaced by the converge review of #1068, where three independent jurors each proposed a relative-link gate.
It is the ONLY one of 86 proposed preventions from that review that survived a red-team pass — the rest were
already-covered, already-open, PR-local fixes, or gates that would have been red on day one against the
existing corpus.

## Design

**The seam — and the trap in the obvious one.** `we:scripts/check-standards.mjs` already walks `docs/agent/`
for the citation gate: `scanDir('docs/agent/', ['.md'])`, alongside `backlog/`, `agent-memory-src/`,
`reports/` and the two `src/` research dirs. **Do not reuse `scanDir` for `we:skills-src/`.** It is a single
`readdirSync` with no recursion, and the two trees have different topologies: `we:docs/agent/` is **flat**
(19 `.md` files at the top level), while every skills-src markdown sits one level down as
a per-skill subdirectory of `we:skills-src/` — **0 of 33** files are at the top level. A literal `scanDir('skills-src/',
['.md'])` therefore walks nothing, and `check:standards` would report a green **0 errors** while half this
item's stated scope was never read. That is worse than no gate: it certifies a tree it never opened.

The recursive walker to model instead is already in the same file — `walkMjs`, which recurses
`['scripts', 'skills-src']` for the `.mjs` rules. Use that shape for the markdown walk.

Follow the file's established scan shape rather than inlining a walker: a pure module under
`we:scripts/lib/` exporting a collector + a message renderer (the `we:scripts/lib/utc-day-slice-scan.mjs` and
`we:scripts/lib/stdout-flush-scan.mjs` pattern), wired into `we:scripts/check-standards.mjs` in its own `try`/`catch` with
**per-hit attributed** findings (`{ kind, fix, file, line }`) — an unattributed finding reds a concurrent
session under `--scope=<slug>` and is demoted to a note under `--local --files=<lane set>`.

**Resolution rules the collector needs, in order.** Skip absolute (`/`), protocol (`http:`, `https:`, `mailto:`)
and pure-fragment (`#…`) targets. Strip any `#fragment` before resolving (the section-anchor half is an explicit
non-goal). Skip a target ending in `/` (an 11ty rendered route). Resolve what remains against the containing
file's **real on-disk directory**, and error when it does not exist.

**Two classes the first draft will get wrong, both visible in the current corpus.**

- **Placeholder targets.** Several links are illustrative rather than real — `[…](backlog/<id>.md)`,
  `[…](../reports/<living-report>.md)`. A resolver must treat an angle-bracket placeholder segment as
  documentation, not a dangling link, or the gate lands red on correct prose.
- **Renamed `bornAs` targets.** Two skill files link at `../../backlog/<bornAs-id>-<slug>.md` filenames that no
  longer exist because the item was renumbered to `NNN-slug`. These are genuine rot and the interesting class:
  they are what a build fixes, and they argue for resolving `we:backlog/` targets by item **id** rather than by
  exact filename.

**Re-measure before writing the gate — the filed counts are stale.** The body's *Reproduce* section records
129 links / 4 site routes / 46 symlink-view / 4 stale. A re-run on 2026-08-21 over the same two trees finds
**229** relative links: 164 resolve, 6 site routes, **47** symlink-view, and 12 non-resolving. Of those 12: 3
are the placeholder class (an `<id>`-templated backlog target, an `index-x` sample inside a
documentation-format example, a `<living-report>`-templated reports target), 2 are the renamed-`bornAs` class, and the remaining 7 are genuine rot —
including `we:docs/agent/backlog-workflow.md` and `we:docs/agent/conventions.md` both linking
`we:src/_data/blocks.json` at the wrong depth, `we:docs/agent/vision-tiers.md` linking a
`we:src/_data/intents.json` that no longer exists, and the `exec-kind` test target the body already names. The *shape* of the finding holds — the
symlink-view class still dominates — but any criterion keyed to the old numbers is already wrong. The fork
below is unchanged by the re-measure.

**The fork is still live and is the first job.** `we:.claude/skills` is a symlink to `we:skills-src`, so a skill
file has two valid depths to the repo root. `(a) tracked path is canonical` remains the bold default (the file
is then self-consistent and validates with no symlink present); `(b) symlinked runtime view is canonical` means
the resolver drops one leading level for `we:skills-src/**`. **Rule it before writing the resolver** — the two
choices differ by ~47 rewritten links.

## Done when

- `npx vitest run` over a new pure-collector test in `we:scripts/lib/__tests__/` fails before and passes after,
  covering: a resolving relative link (clean), a dangling one (error), a `#fragment`-only target (skipped), a
  target with a `#fragment` suffix (fragment stripped, file resolved), a trailing-slash site route (skipped),
  an `http(s)`/`mailto` target (skipped), an angle-bracket placeholder (skipped), and a `we:skills-src/**` link
  under whichever canonical view the fork rules.
- **A fixture exercises the directory WALK, not just the collector on synthetic paths**: a temp tree shaped
  one markdown file nested a directory deep under `we:skills-src/`, carrying one dangling link, asserted to produce a finding. A flat
  `readdirSync` implementation reddens on this and passes every other bullet — which is precisely why the
  bullet exists, and why "adding a link and re-running the gate" (below) is not sufficient on its own.
- `npm run check:standards` on the current tree reports **0** errors from the new rule — meaning the ruled fork
  has been applied to the corpus in the same change (the ~47 symlink-view links rewritten under (a), or the
  resolver taught to drop a level under (b)) and every genuinely stale target fixed. A gate that lands red is
  not a gate.
- The rule catches a fresh break: adding a link to a nonexistent file in any `we:docs/agent/**` or
  `we:skills-src/**` markdown file makes `npm run check:standards` exit non-zero, naming the file and line.
- The ruling itself is written down — which view is canonical, and why — in the item body or the statute, so a
  later reader does not re-derive it from the rewritten links.
- Nothing under `we:backlog/` is newly linted (`findBadBodyLinks` in `we:scripts/check-standards-rules.mjs`
  still owns that corpus) and no `fui:`/`plateau:` target is resolved — both are stated non-goals above.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: mutation/reversion check ahead of the build) — Corpus counts (129→229 links) are independently corroborated by a fresh re-scan, but the card's 'seam' claim — that the existing scanDir('docs/agent/', ['.md']) walk in we:scripts/check-standards.mjs is 'exactly what a link resolver needs' — was never checked against skills-src/'s topology. Verified live by executing the exact scanDir logic: scanDir('docs/agent/', ['.md']) finds 19 files, the same flat helper over we:skills-src/ finds 0, because all 33 skills-src markdown files sit one level down in per-skill subdirectories (a per-skill subdirectory of we:skills-src/) while docs/agent/ is flat. This is introduced by this card's own Design-section reasoning (not pre-existing repo rot); it would be worse than the base (no gate) because a green 'check:standards: 0 errors' would falsely certify skills-src as validated when it was never walked; it is not parallelizable since it's the core wiring this card is building. Under the disposition rule this is a blocker: introduced=true, worseThanBase=true, parallelizable=false. Impact if unfixed: broken — half the goal's declared scope is silently unenforced, recoverable only if someone notices (the one safety net is Done-when bullet 3, which requires a fresh break inside we:skills-src/** to redden check:standards — since all real skills-src content is nested, a diligent manual test there would likely catch this, but the bullet reads as a manual check, not a checked-in regression fixture, so it is not guaranteed to run on every future change). Root cause: the design section pattern-matched to an existing gate that scans a similarly-named tree without confirming the second target tree shares that tree's flat topology — the same file (we:scripts/check-standards.mjs) already has a correct recursive walker (`walkMjs`, used for we:skills-src/ .mjs files at its rule-18 section) that the card never cites as the model for skills-src, even though it cites two OTHER recursive sibling modules (we:scripts/lib/utc-day-slice-scan.mjs, we:scripts/lib/stdout-flush-scan.mjs) for the collector's pure-module shape. Prevention: require Done-when bullet 1's test suite to include a fixture that exercises the actual directory-walk (not just the pure collector called on synthetic paths) over a nested a per-skill subdirectory of we:skills-src/-shaped file, so a flat re-implementation reddens automatically. Not currently captured in the card's listed fixture set (resolving/dangling/fragment-only/fragment-suffix/trailing-slash/http-mailto/placeholder/symlink-view) — must be filed/added before build.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Same evidence as the premise entry: a literal reuse of the cited flat scanDir pattern for skills-src/ enforces nothing on that entire tree (0 of 33 files reached) despite check:standards reporting green. The card's Done-when bullet 3 ('adding a link to a nonexistent file in any...we:skills-src/**...markdown file makes npm run check:standards exit non-zero') is the only stated safeguard against this, and it reads as a one-off manual verification rather than a fixture wired into the vitest suite required by bullet 1.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The 'npm run check:standards reports 0 errors' success criterion is only as meaningful as the population the rule actually walks. If that walk follows the cited flat scanDir pattern, the certified population silently narrows to docs/agent/'s 19 files and excludes all 33 of skills-src/'s nested files, so a passing '0 errors' would not mean what the Done-when bullet implies for the skills-src half of the title.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Measurement against the real corpus is genuine and independently corroborated: a fresh re-scan of we:docs/agent/ + we:skills-src/ found 227 relative links, 163 resolving, 6 trailing-slash site routes, and 47 links resolving after dropping one leading '../' level — matching the card's remeasured 229/164/6/47 almost exactly.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card explicitly sequences 'rule the fork first' before the resolver is written and requires the ruling be recorded in the item body or statute, avoiding a canonical-view/resolver disagreement built by two different people at two different times.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Per-hit attributed findings ({kind, fix, file, line}) plus Done-when bullet 3's 'naming the file and line' requirement mean a fresh break surfaces as a named, attributable check:standards error rather than failing silently.

**Corrections recommended:**

- The Scope section's "Fix the 4 genuinely stale targets" bullet is stale against the card's own Design-section remeasure (12 non-resolving, of which only ~4 are placeholder and ~2 are the renamed-bornAs class), which implies roughly 6 genuinely-stale targets to repair, not 4 — independently confirmed: beyond the cited we:scripts/__tests__/exec-kind.test.mjs example and the two bornAs ids (x27e4xs, xl5jroq), we:docs/agent/backlog-workflow.md also links `we:backlog/070-jsx-directive-sugar.md` with a missing `../../` prefix, we:docs/agent/vision-tiers.md and its we:skills-src/review-design/SKILL.md symlink-view twin both target a nonexistent we:src/_data/intents.json, and we:docs/agent/platform-decisions.md links a three-dot relative target into the frontierui repo as a clickable relative link — a cross-repo reference that also violates the repo's own 'cross-repo paths are plain text with the prefix' rule documented in we:docs/agent/conventions.md, rather than being exempted by the card's fui:/plateau: non-goal (which covers scheme-prefixed targets, not plain relative paths that happen to cross a repo boundary).

Corpus measurement and the canonical-view fork are unusually rigorous and independently corroborate almost exactly, but the card's cited "seam" (the flat `scanDir` helper in we:scripts/check-standards.mjs) is non-recursive and finds zero of skills-src/'s 33 markdown files when literally applied to that tree — a decorative-guard gap for half the card's own named goal that a builder could easily inherit from the citation as written.

**Findings applied after this review** (all accepted — the blocker-class one is the most valuable finding in
this batch): the cited `scanDir` seam is **non-recursive** and reaches 0 of the 33 markdown files under
`we:skills-src/`, so a literal reuse would report a green gate over a tree it never opened; the design now
points at `walkMjs` instead and a Done-when fixture exercises the walk, not just the pure collector. The
stale-target count is corrected from 4 to 7 and each named, and the clickable cross-repo relative link in
`we:docs/agent/platform-decisions.md` is now an explicit call rather than an accident of the resolver.

_Recorded through the declared `review-prep` operation (its own write to this card was clobbered by a
concurrent edit in this session; the section above is reconstructed verbatim from the operation's JSON
verdict, run id `review-prep-19619e6c`)._
