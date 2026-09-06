---
kind: story
size: 3
status: open
dateOpened: "2026-09-06"
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
