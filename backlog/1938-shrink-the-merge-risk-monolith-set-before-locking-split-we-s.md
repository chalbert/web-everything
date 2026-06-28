---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Shrink the merge-risk monolith set before locking — split we:src/_data/adapters.json to per-entry + regenerate-on-merge for generated _data artifacts

Precursor to #1935's lock mechanism: shrink the at-risk file set by changing FORMAT, not by locking — but only for files that are *genuinely* split-able or *purely* derived (skeptic-corrected; see #1935 Fork 2). Two moves:

**(1) Split `we:src/_data/adapters.json`** (a small `[{id,title,items[]}]` nested-group array) into per-entry files, the #1145/#1146/#1157 pattern, so lanes touching their own adapter are disjoint by construction. It then leaves the lock-set.

**(2) Establish "regenerate-on-merge" ONLY for the PURE-derived artifacts** — files a deterministic generator reproduces from source: `we:src/_data/referenceIndex.json` (`we:scripts/gen-reference-index.mjs`, "do not edit by hand"), `we:src/_data/capabilityWorkedExample.json` (`_generatedBy`), and **only the fenced `AUTO-GENERATED` inventory sub-block of `we:AGENTS.md`** (`we:scripts/gen-inventory.mjs`). The broker regenerates these from merged inputs once, post-merge. They leave the lock-set as outputs.

**Do NOT regenerate-on-merge — these stay LOCKED (③):** the curated-sweep inputs `we:src/_data/benchmarkCorpus.json`/`benchmark*.json`, `we:src/_data/workbenchTools.json`, `we:src/_data/workbenchFeatures.json` carry `selectionCriteria`/`lastSwept` and are **hand-curated** (no pure generator reproduces a human's corpus-membership call) — keep them in `touchesMonolith` (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:101`), don't delete. Likewise `we:AGENTS.md`'s hand-authored **prose body** stays locked (only its inventory sub-block is regenerated).

Net: only adapters (①) + the three pure-derived (②) leave; the ③ static denylist shrinks to ~11 files (the irreducible structured docs/config `we:src/_data/traits.json`, `we:src/_data/capabilityMatrix.json`, `we:src/_data/docs.json`, `we:src/_data/webhandlers.json`, `we:src/_data/webportals.json`, `we:vite.config.mts`, `we:tsconfig.json`, `we:AGENTS.md` prose + the curated-sweep `benchmark*`/`workbench*` set).

## Progress
- **Status:** resolved
- **Branch:** main
- **Done:**
  - **(1) Split `we:src/_data/adapters.json` → per-entry.** New `we:src/_data/adapters/` dir: a `we:src/_data/adapters/_groups.json` (3 groups: order + title + description) + one per-adapter spec file (7), each carrying its `category` group back-ref. New shared assembler `we:scripts/lib/adapters-loader.cjs` — `loadAdapters()` returns a byte-shape-identical nested-group array; `loadAdapterItems()` returns the flat pagination set with `category`/`categoryTitle`. New `we:src/_data/adapters.js` 11ty global. Deleted the former monolith. Rewired every direct reader: `we:.eleventy.js` (flatAdapters collection + watch target now the dir), `we:scripts/check-standards.mjs`, `we:scripts/__tests__/check-standards.test.mjs`, `we:scripts/normalize-graduated.mjs` (added an `adapter` loader branch). The `adapter:<id>` graduatedTo anchor stays **virtual** (the file is gone — exactly like the post-#882 blocks split).
  - **(2) regenerate-on-merge precision.** The mechanism for the 3 pure-derived (`we:src/_data/referenceIndex.json`, `we:src/_data/capabilityWorkedExample.json`, the `we:AGENTS.md` inventory block) already ships from #1935. #1938 sharpened the `we:AGENTS.md` split in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`: the **AUTO-GENERATED inventory block** is a derived artifact (regenerated once); the **hand-authored prose body** is a ③-locked monolith (serial lane). Dropped the former adapters monolith from all three denylist prose lists (probe schema, probe prompt, HARD RULES) and noted `we:src/_data/adapters/` is per-entry/disjoint.
  - **Verified:** `check:standards` 0 errors; the 22-test check-standards unit suite green; live dev server (no restart) renders all 3 groups + all 7 adapter detail pages (200). Assembler reproduces the old data exactly (group/item equality asserted; no `category` leak in the grouped view).
- **Next:** none — done.
- **Notes:** Cleared `blockedBy: ["1935"]` (satisfied — #1935 resolved). Per-adapter granularity = the adapter ITEM (lanes touch their own adapter); items sort by id within group, groups by explicit `order` — the only cosmetic delta is the `syntax` group now lists `declarative-component` before `functional-component-adapter` (was reverse), harmless.
