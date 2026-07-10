---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
tags: [drain, rebase-drop, merge]
crossRef: { url: /backlog/2198/, label: "#2198 — the manifest-only rebase-drop this extends" }
---

# Safe-content rebase-drop: auto-resolve non-overlapping hunk conflicts in the drain

Extend the drain's rebase-drop (#2198) beyond the manifest-only case to any
provably-safe content conflict — non-overlapping hunks in the same file (e.g.
two `/slice` PRs each appending to `we:reports/YYYY-MM-DD-backlog-split-analysis.md`),
where a clean 3-way merge keeps both sides with no overlap. Only deterministic,
zero-judgment resolutions; genuine overlapping/semantic divergence still skips to
`/finish`.

## Why

The drain today auto-heals exactly ONE conflict: the shared
`we:.lane-manifest.json` (#2198). Every other `CONFLICTING` PR is skipped as
"left for its author," even when the conflict is trivially safe. Observed
2026-07-09: a batch produced ~5 `/slice` PRs (#307, #308, #310, #314, #316) all
`CONFLICTING` on ONE report file — each merely **appended its own verdict** to
`we:reports/2026-07-09-backlog-split-analysis.md`. A 3-way merge of two disjoint
appends has no real conflict; git only flags it because both touched the tail of
the same file. These stalled the queue and would each need a manual `/finish`
rebase for a resolution that is mechanically obvious (keep both).

## The deterministic-vs-judgment band (#51)

The drain is the **sole serial writer to main (#2290)** — it must stay minimal,
fast, and trust-critical, so it only does resolutions that are **provably safe
with zero judgment**. This item widens that band by ONE well-defined step, it does
not open the drain to creative merges:

- **In scope (auto-resolve):** a 3-way merge where every conflicting hunk is
  **non-overlapping** — the two sides changed disjoint line ranges (classic
  append/append, or edits to different regions). `git merge-file` / `merge-tree`
  resolves these without markers. The result is byte-identical to what a human
  would produce, so there is nothing to judge.
- **Out of scope (still skip → `/finish`):** any **overlapping** hunk — both
  sides changed the same lines — where choosing a resolution could silently drop
  someone's edit. That is semantic divergence, which stays a judgment call for a
  thinking session (the existing `/finish` boundary is unchanged). Completing
  half-done producer work (#2200) likewise stays with `/finish`.

## Design sketch

The plumbing already exists — rebase-drop rebuilds a tip onto main via
`merge-tree`/`commit-tree` with no checkout, and the #2311/#2310 review-editor
subagent already clones a PR branch, edits, and pushes back to the same branch.
So this is an extension of the classification, not new transport:

1. When a PR is `CONFLICTING` and NOT manifest-only, run the 3-way merge and
   inspect the conflict hunks (e.g. `git merge-tree --write-tree` + parse, or
   `merge-file` per path).
2. If **all** hunks are non-overlapping → take the clean union, rebuild the tip
   onto main (same no-checkout plumbing as #2198), push to the PR branch. The
   pushed tip re-runs the required `test` check and lands on a later `--watch`
   pass — exactly the manifest-drop cadence.
3. If **any** hunk overlaps → skip unchanged, `left for its author` / `/finish`.

Gate invariant preserved: the resolution is pushed to the **PR branch** and
re-runs `test` before the drain merges it — the drain never splices an
unverified merge straight to main. Guard flag mirrors #2198 (`--no-rebase-drop`
disables both, or a dedicated `--no-content-rebase-drop`).

## Acceptance

- A batch of append-only `/slice` PRs colliding on one report file lands via the
  drain with no manual `/finish`.
- An overlapping-edit conflict is still skipped and surfaced for `/finish` (no
  silent auto-resolve of semantic divergence).
- The pushed resolution re-runs `test` before merge (no un-gated content reaches
  main).
