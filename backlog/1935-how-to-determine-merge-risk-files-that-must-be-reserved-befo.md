---
kind: decision
parent: "1933"
status: open
dateOpened: "2026-06-28"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-merge-risk-file-determination.md
tags: []
---

# How to determine merge-risk files that must be reserved before a lane edits them

The central broker (`/backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua/`) is the sole integration + lock authority: agents work in lane clones, refresh from main, **reserve merge-risk files**, edit, commit, and push a temp branch to the broker, which merges + gates + pushes `main`. Files that are NOT merge-risk just rely on plain git merge (different-subject changes merge cleanly). This decision settles HOW a file is judged "merge-risk" — i.e. which files a lane must reserve before touching. It drives the reservation/lock slice of #1933.

Grounding note: WE's collection registries are already **per-entry files** (`we:src/_data/<registry>/<id>.json`, since #1145/#1146/#1157), so they are disjoint by construction — a lane writing its OWN entry never collides. The merge-risk set is therefore SMALL: only the residual non-collection shared surfaces. Prior art (optimistic vs pessimistic concurrency control; bors/GitHub/Zuul merge queues; the monorepo "serialize only the shared scope" critique; Perforce/Git-LFS file locking) is surveyed in `/research/merge-risk-file-determination/` (`we:reports/2026-06-28-merge-risk-file-determination.md`).

## Forks

This decision has two orthogonal questions. Fork 1 is the optimism axis (prevent vs detect-and-replay). Fork 2 is the lock-set-derivation axis (only relevant if Fork 1 chooses to lock at all). Forks A–D from the parent card are recombined into these two axes; the recommended path picks one default per axis.

### Fork 1 — Optimism axis: pre-lock vs git-conflict-as-the-signal

How does the broker avoid two lanes corrupting a shared file?

- **Option D — NO pre-lock; git is the conflict detector + replay.** Lanes never reserve; the broker merges one-at-a-time and a conflict means "redo that lane serially on the merged result" (exactly today's `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` rule). Simplest; zero coordination. But it is pure *optimistic* control — a collision is only found at merge, AFTER the lane spent a full gate, and a clean-but-wrong 3-way merge of a structured file can slip through entirely (the orchestrator's `multiLaneFiles` warning is post-hoc, not preventive).
- **Option PRE-LOCK — reserve merge-risk files before editing.** A lane claims the at-risk files up front; a second lane that needs a held file waits (or defers the item). Prevents the wasted-lane and clean-but-wrong cases for the locked set, at the cost of a reservation protocol.

**Recommended default: keep Option D as the FLOOR and ADD a pre-lock layer (do NOT pick D alone).** Optimistic merge stays the baseline for the vast disjoint majority (per-entry registries, own impl/demo/test/backlog files); pre-lock is layered on ONLY for the small at-risk set chosen by Fork 2. The DB literature's "combine both" and the monorepo "serialize only the shared scope" both land here: be optimistic by default, pessimistic on the few files where a wrong guess is expensive. Confidence: **high** (this is the established hybrid; pure D is a known under-prevention for structured files, pure pessimism is wasteful given per-entry disjointness).

> **RATIFIED 2026-06-28:** optimistic git-merge is the floor; a pre-lock layer is added for the small at-risk set. (D-alone rejected.) Lock-set derivation deferred to Fork 2.

### Fork 2 — Lock-set axis: how the at-risk set is derived (given we lock)

- **Option A — STATIC monolith denylist.** A fixed, hand-maintained list of known non-collection shared/structured files. Grounded to the tree, the list is: the single structured-config registries `we:src/_data/traits.json`, `we:src/_data/docs.json`, `we:src/_data/capabilityMatrix.json`; the nested-group registry `we:src/_data/adapters.json` (`items[]`); the single protocol docs `we:src/_data/webhandlers.json` and `we:src/_data/webportals.json`; the sweep/generated artifacts `we:src/_data/workbenchFeatures.json`, `we:src/_data/workbenchTools.json`, `we:src/_data/benchmarkCorpus.json` (and the other `benchmark*.json`), `we:src/_data/capabilityWorkedExample.json`; the DERIVED artifacts `we:AGENTS.md` and `we:src/_data/referenceIndex.json`; and the build config `we:vite.config.mts` and `we:tsconfig.json`. Simple, predictable, zero probe dependency — this is the existing effects-manifest "touchesMonolith" set made authoritative. Misses NOVEL collisions: two lanes both refactoring the same ordinary `*.ts` shared module are NOT on the list.
- **Option B — DYNAMIC double-declaration.** Reserve any file that ≥2 active lanes' predicted touch-sets both name. The broker already has each lane's touch-set: the #1933/#1147 probe (`PROBE_SCHEMA.predictedFiles` in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) estimates it. Catches real overlaps on ordinary files that A misses. But precision is bounded by probe accuracy — the probe is a documented LOWER BOUND ("work spills past the declared files"); a missed file silently degrades B back to Option D for that file.
- **Option C — HYBRID: static denylist UNION dynamic double-declaration.** Lock a file if it is on the static list OR ≥2 lanes declare it. Belt-and-suspenders: A guarantees the structurally-unmergeable set is always covered regardless of probe quality; B catches the novel ordinary-file overlaps A can't enumerate.

**Recommended default: Option C (static ∪ dynamic).** The static list is the always-on floor that does not depend on the probe (so a probe miss can never expose a known monolith); the dynamic layer extends coverage to the unenumerable long tail. This is precisely where both the "combine optimistic + pessimistic" DB conclusion and Zuul's "serialize declared dependencies" + the monorepo "shared scope" critique converge. Confidence: **medium-high** (C is the clear shape; the residual uncertainty is operational — how aggressively to trust the probe in B, and whether v1 ships A-only and adds B once probe accuracy is measured).

## Recommended path

| Axis | Options | Recommended default | Confidence | Grounding |
|---|---|---|---|---|
| Fork 1 — optimism | D-only vs D-floor + pre-lock | **D as floor + pre-lock layer** | high | DB "combine both"; monorepo "serialize only the shared scope"; per-entry registries already disjoint (#1145/#1146/#1157) |
| Fork 2 — lock-set | A / B / C | **C (static ∪ dynamic)** | med-high | static = Perforce/LFS "unmergeable files" + the existing `touchesMonolith` set; dynamic = Zuul "declared dependencies"; probe in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` |

**Net recommended mechanism:** optimistic merge stays the baseline; a lane RESERVES a file before editing it iff the file is on the static denylist (above) OR ≥2 active lanes' probed touch-sets both name it; a git conflict at merge remains the last-resort backstop (replay serially) for anything that slips past both. Open residue for the ratification turn: whether v1 ships **C** in full or ships **A-only first** and promotes to C once the touch-set probe's accuracy is observed in real lane runs (the probe-accuracy dependency is B's only real weakness — see `/research/merge-risk-file-determination/`).

See the prior-art survey: `we:reports/2026-06-28-merge-risk-file-determination.md` (`/research/merge-risk-file-determination/`).
