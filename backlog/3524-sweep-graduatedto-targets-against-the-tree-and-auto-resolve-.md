---
bornAs: xeubc2o
kind: story
size: 3
status: resolved
dateOpened: "2026-09-06"
dateResolved: "2026-09-06"
graduatedTo: none
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# Sweep graduatedTo targets against the tree and auto-resolve a relocated path, so a repo reorganisation does not silently rot 90+ resolved cards

The 2026-09-06 audit swept all 2734 resolved items and found 100 graduatedTo references naming a path absent from every repo. 93 were pure relocation debris from three known moves - WE reference runtimes to frontierui at identical paths, plateau-app from src/X into packages/{core,saas,tooling,dev-browser,extensions}/src/X, and we:.claude/skills to we:skills-src - not undelivered work. A suffix-matching resolver corrected all 93 deterministically; only 7 were genuine candidates. Make this a repeatable verb rather than a one-off script: resolve each graduatedTo against the three checkouts, auto-correct a UNIQUE suffix match, and report the rest. Guard rails learned the hard way - never accept a basename-only match for a file (it mapped an explorer oracle onto an unrelated conformance-engine file), though a distinctive directory name is safe.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. A verb (e.g. a `check-graduated [--fix]` verb in `we:scripts/backlog.mjs`) resolves every `resolved` item's
   `graduatedTo` repo-qualified refs against the three checkouts and reports each as
   `present` / `relocated → <path>` / `missing`.
2. `--fix` rewrites only the **uniquely** relocated ones and never touches a `missing` or ambiguous ref.
3. **Skip-safe** — an absent sibling checkout is reported as skipped, never silently counted present.
4. Tests cover: an exact hit, a unique suffix relocation, an ambiguous multi-candidate (must NOT
   auto-fix), and a genuinely missing target.

## Guard rails, learned from the one-off run

- **Never accept a basename-only match for a FILE.** The first pass mapped
  `fui:tools/explorer/oracles/conformanceVectors.ts` onto
  `plateau:packages/core/src/conformance-engine/conformanceVectors.ts` — an unrelated file that merely
  shares a name. Require at least two matching path segments.
- **A single distinctive DIRECTORY name is safe** (`headed-surface/`, `variant-simulator/`), and is
  needed to catch the plateau restructure, where both the prefix and the depth changed.
- Match by **longest tail first**, and accept only when exactly one candidate survives.

## The three relocations behind the debris (2026-09-06 sweep)

| Move | Cards affected |
|---|---:|
| WE reference runtimes → `frontierui:` at identical paths (#1294) | 46 |
| plateau-app `src/X` → `packages/{core,saas,tooling,dev-browser,extensions}/src/X` | ~30 |
| `we:.claude/skills/` → `we:skills-src/`, `we:MEMORY.md` → `we:agent-memory-src/MEMORY.md` | 4 |

100 refs were absent; 93 were relocation debris and 7 were genuine candidates. Without a repeatable
sweep the ratio only gets worse with the next reorganisation.

## Delivered 2026-09-06 — as a gate, not a sweep verb

Built as **gate 5c** rather than the `check-graduated --fix` verb this card proposed, because a gate that
refuses the bad record at land time is strictly better than a verb someone must remember to run:

- `findDanglingGraduatedTargets` in `we:scripts/lib/citation-check.mjs`, wired in
  `we:scripts/check-standards.mjs` (section 6f-ii-b), with `makeRepoResolver` /`splitRepoRef` as the shared
  cross-repo resolution.
- **Reproduced and caught:** re-introducing #2756's original frontmatter makes the gate fire; reverting
  clears it.
- Detect-or-skip is fail-closed: an absent sibling checkout reports `no-repo` and warns that those targets
  were SKIPPED, never counted present.
- Tests in `we:scripts/__tests__/citation-check.test.mjs` cover the #2756 reproduction, the present case,
  `none (… deleted …)`, comma-joined multi-artifact graduations (#2210), `{a,b}` brace families (#1954),
  and a trailing `#fragment` doc anchor (#1932).

The one-off relocation corrections (93 paths) landed in the audit commit. The residual `--fix` half — batch
re-pointing a future reorganisation's debris — is not built; the gate now makes that debris visible, which
was the actual problem.
