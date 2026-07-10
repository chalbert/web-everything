---
kind: story
size: 8
parent: "2193"
status: active
scaffoldedBy: "manifest-pr-body"
dateScaffolded: "2026-07-10"
dateOpened: "2026-07-10"
tags: [lane, pr-flow, merge-queue, drain, manifest]
---

# Move the lane-manifest off the tree into the PR body (kill the rebase-drop step + merge-commit bloat)

The couple metadata (`repos`, `blockedBy`, `merge-risk`) is **drain-only orchestration metadata**, but it rides
`we:.lane-manifest.json` — a **tracked file at the repo root**. Because every lane writes the same path, every open
lane PR conflicts with `main` on that one shared path (#2198), which forced the `rebase-drop-manifest` step
(`we:scripts/lib/rebase-drop-manifest.mjs`). That step is named "rebase" but fabricates a **merge commit**
(`git commit-tree <tree> -p <base> -p <laneRef>`) and **re-runs every drain pass** while a lane stays open — so each
pass stacks another merge on the prior tip. Result: a PR that did two commits of real work shows a dozen
"drain: rebase … drop transient manifest" merges (observed on #361: 8 commits ahead of main, only 2 authored).

## The metadata belongs on the PR, not in the code

Confirmed shape:
- **The producer already opens a ready-to-merge PR while the item is queued** (`we:scripts/pr-land.mjs`,
  `--label-on-green`). A PR carrier exists the whole time the item sits in the queue.
- **Every manifest consumer is the drain** — `readManifestOffRef` for `blockedBy` ordering
  (`we:scripts/lane-drain.mjs`), `parseManifest` at `drain-one`, and the escalation scorer. Nothing else reads it.

So the metadata is landing-orchestration state about the PR; it should live **on the PR**, not committed into the
tree. Move it into the **PR body** as a fenced ` ```json lane-manifest ` block (structured payload — repos, blockedBy,
merge-risk — is more than flat labels can carry). Keep a minimal label as the fast couple-key for planning if the
drain wants to avoid reading every candidate body.

## Scope

- **`we:scripts/pr-land.mjs`** — when composing the PR body, embed the manifest JSON in a delimited block instead of
  relying on a tracked file. (The producer computes the same manifest it does today via `we:scripts/readiness/lane-manifest.mjs`.)
- **`we:scripts/lane-drain.mjs`** — read the manifest from the PR body (`gh pr view <n> --json body`, parse the block)
  instead of reading `we:.lane-manifest.json` off the lane ref. Map queued entry → PR#.
- **`we:scripts/lane-manifest-write.mjs`** — stop writing/`git add`ing the tracked file into the lane commit.
- **`we:scripts/lib/rebase-drop-manifest.mjs` / `we:scripts/lib/rebase-drop-content.mjs`** — the manifest-drop reason
  disappears. `we:scripts/lib/rebase-drop-content.mjs` still has an independent job (auto-resolve non-overlapping
  real-file content conflicts), so keep that path but remove the manifest-specific branch; retire
  `we:scripts/lib/rebase-drop-manifest.mjs`'s manifest handling once no lane carries the file.
- **Tests** across the above; update `scoreEscalation` (`we:scripts/readiness/review-escalation.mjs`) to source the
  manifest from the PR body.

## Migration / in-flight lanes

Queued lanes at cutover still carry a tree-committed `we:.lane-manifest.json`. The reader must accept **both** sources
for one drain cycle (PR body first, fall back to the tree file) so the queue doesn't strand; drop the file-fallback
once the queue has fully turned over. `we:.lane-manifest.json` was never gitignored and stays that way, but is simply
no longer produced.

## Why this supersedes the rebase-vs-merge patch

An alternative fix is to make `we:scripts/lib/rebase-drop-manifest.mjs` a *true* rebase (replay authored commits onto
base, force-push) so the history stays at 2 commits. That fixes the bloat symptom. Moving the metadata off the tree
removes the **cause** — the shared-path conflict — so the entire rebase-drop step becomes unnecessary. Prefer the
root fix.

Related: #2198 (the rebase-drop step this retires), #2193 (drain-converge epic), #2163/#2174 (the durable-manifest
design being relocated), #2288 (JIT numbering).
