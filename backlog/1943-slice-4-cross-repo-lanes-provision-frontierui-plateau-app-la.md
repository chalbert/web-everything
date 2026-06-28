---
kind: story
size: 8
parent: "1933"
status: resolved
blockedBy: []
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Slice 4: cross-repo lanes — provision frontierui/plateau-app lane pools for constellation items

Extend the #1933 orchestrator (slice 3, #1942) to items whose impl spans the constellation (WE -> frontierui -> plateau-app). A single item often touches multiple repos, so a lane needs a clone of EACH affected repo, not just WE. we:scripts/lane-pool.mjs (slice 2) is already repo-parameterized (--repo/--origin/--reference/--name), so this slice wires the orchestrator to: detect an item's affected repos, provision a lane pool per repo, dispatch the agent across the coupled clones, and push + integrate each repo's lane/* independently. Slice 3 v1 may scope WE-only to ship sooner; this lifts that. Hard part: cross-repo atomicity — one logical change landing in two repos is two merges, so define the ordering/rollback story.

## Progress

- **Status:** resolved — cross-repo orchestrator shipped; new pure helpers verified (20/20) + wrapped-syntax
  parse OK; `check:standards` green (0 errors).
- **Branch:** main (commit on current branch per never-branch policy).
- **Done:** extended `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` from the WE-only
  slice-3 floor to the full constellation (#96 WE → frontierui → plateau-app):
  - **Constellation registry** (`REPOS`) + `INTEGRATION_ORDER = ['frontierui','plateau-app','we']` (WE last).
  - **Probe** now reports `extraRepos` (non-WE repos an item's impl spans); WE stays implicit (its
    `we:backlog/<NNN>.md` + `we:.claude/skills/batch-backlog-items/claims.json` always live in WE).
  - **Repo-qualified partition** — `filesOf` keys every file `"<repo>:<path>"`, so disjointness holds across
    repos (same path in two repos no longer collides; same path in one repo still does). `affectedReposOf` /
    `isCrossRepo` / `repoLanePlan` / `laneIndexOf` added (pure, unit-tested).
  - **Per-repo provisioning** — setup provisions a lane pool per affected repo (sized to items touching it,
    no over-provisioning) via the repo-parameterized `we:scripts/lane-pool.mjs`; returns `lanePools` per repo.
  - **Coupled-clone dispatch** — each concurrent item agent works one clone per affected repo, gates each
    repo with its OWN gate (WE/frontierui `check:standards`, plateau-app `build`), resolves in WE only after
    ALL repos green, and pushes `lane/<slug>-<n>` to EACH repo's own origin (`pushedRefs`).
  - **Integration impl-first / WE-last** — per item, merge impl repos first then WE; an impl failure STOPS
    the item before WE merges, so the resolve never lands → no false `resolved`.
  - **Cross-repo rollback** — a failed cross-repo item is recorded in `partialCrossRepo` (which repos landed,
    where it stopped) + left `carried`; un-merged lane refs stay durable on origin for re-attempt. WE-only
    failures still serial-replay (the slice-3 floor). `changedFiles`/`multiLaneFiles` are now repo-qualified.
- **Cross-repo atomicity story (the slice-4 hard part):** no distributed transaction — bound the damage by
  ORDERING. WE carries the `active→resolved` flip (the commit point) and lands LAST; impl lands first. Worst
  case = impl-landed-but-item-still-active (recoverable, surfaced in `partialCrossRepo`), never a false
  resolved. The #1869 reconcile is WE-authoritative (a landed WE resolve ⟹ impl landed under this ordering).
- **Verification:** a scratchpad node harness with 20 assertions (affected-repos ordering, repo-qualified
  disjointness, partition of overlapping vs disjoint cross-repo pairs, per-repo lane plan/index, ref ordering,
  monolith/confidence still force serial) + a wrapped-sandbox syntax check (the script needs the Workflow
  runtime + live remotes + impl-repo clones to run headless). Doc:
  `we:.claude/skills/batch-backlog-items/SKILL.md` execute-phase gained a "Cross-repo lanes" subsection;
  return-field list + the floor note updated.
- **Live validation (downstream, by design):** the first real cross-repo `/workflow` run is the live proof
  (epic #1933; the closing-session audit watches each run). Not gateable here.
- **Out of scope (follow-up):** auto-replaying a failed cross-repo item's coupled work across primary
  checkouts (v1 leaves it `carried` + durable refs); the pre-lock reservation layer (#1945).
