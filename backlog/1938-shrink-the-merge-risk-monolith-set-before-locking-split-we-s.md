---
kind: story
size: 5
status: open
blockedBy: ["1935"]
dateOpened: "2026-06-28"
tags: []
---

# Shrink the merge-risk monolith set before locking — split we:src/_data/adapters.json to per-entry + regenerate-on-merge for generated _data artifacts

Precursor to #1935's lock mechanism: shrink the at-risk file set by changing FORMAT, not by locking — but only for files that are *genuinely* split-able or *purely* derived (skeptic-corrected; see #1935 Fork 2). Two moves:

**(1) Split `we:src/_data/adapters.json`** (a small `[{id,title,items[]}]` nested-group array) into per-entry files, the #1145/#1146/#1157 pattern, so lanes touching their own adapter are disjoint by construction. It then leaves the lock-set.

**(2) Establish "regenerate-on-merge" ONLY for the PURE-derived artifacts** — files a deterministic generator reproduces from source: `we:src/_data/referenceIndex.json` (`we:scripts/gen-reference-index.mjs`, "do not edit by hand"), `we:src/_data/capabilityWorkedExample.json` (`_generatedBy`), and **only the fenced `AUTO-GENERATED` inventory sub-block of `we:AGENTS.md`** (`we:scripts/gen-inventory.mjs`). The broker regenerates these from merged inputs once, post-merge. They leave the lock-set as outputs.

**Do NOT regenerate-on-merge — these stay LOCKED (③):** the curated-sweep inputs `we:src/_data/benchmarkCorpus.json`/`benchmark*.json`, `we:src/_data/workbenchTools.json`, `we:src/_data/workbenchFeatures.json` carry `selectionCriteria`/`lastSwept` and are **hand-curated** (no pure generator reproduces a human's corpus-membership call) — keep them in `touchesMonolith` (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:101`), don't delete. Likewise `we:AGENTS.md`'s hand-authored **prose body** stays locked (only its inventory sub-block is regenerated).

Net: only adapters (①) + the three pure-derived (②) leave; the ③ static denylist shrinks to ~11 files (the irreducible structured docs/config `we:src/_data/traits.json`, `we:src/_data/capabilityMatrix.json`, `we:src/_data/docs.json`, `we:src/_data/webhandlers.json`, `we:src/_data/webportals.json`, `we:vite.config.mts`, `we:tsconfig.json`, `we:AGENTS.md` prose + the curated-sweep `benchmark*`/`workbench*` set).
