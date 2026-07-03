---
name: local-gate-green-ci-red-untracked-artifacts
description: "check:standards green locally but CI red usually = untracked local files inflating inventory/existence checks; commit the paired artifacts, don't regenerate"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a5f7cf89-0373-43cb-99ac-a68b813bb5d2
---

When `npm run check:standards` (or the vitest suite) is **green locally but red on CI** — especially "AGENTS.md inventory is stale" or "backlog item relatedReport does not exist" — the cause is almost always **untracked files in your working tree** that the local gate reads but origin's clean CI checkout lacks. Reports (`reports/*.md`), research-topic specs (`src/_data/researchTopics/*.json`), and their `research-descriptions/*.njk` are the usual culprits: authored locally, referenced by items, never committed. Your local `renderInventory()` counts them (e.g. 262 topics) so `AGENTS.md` looks fresh; CI's clean tree counts fewer (234) so the committed `AGENTS.md` reads stale.

**Why:** the WE gate reads the *working tree*, so a dirty tree with untracked artifacts masks a drift that only surfaces on a fresh clone (CI). Regenerating `AGENTS.md` on the dirty tree does nothing — it just re-writes the same inflated count. This cost a long debugging hunt in the #2138 queue session (2026-07-02) before the untracked `researchTopics/*.json` were spotted.

**How to apply:** when CI is red on an inventory/existence check but local is green, FIRST run `git status --short` / `git ls-files -o --exclude-standard` over `reports/`, `src/_data/researchTopics/`, `src/_includes/research-descriptions/` (and any dir the inventory counts) — **commit the untracked paired artifacts**, don't reach for `gen:inventory`. Same root cause as [[shared-index-commit-race]] family (dirty-tree vs committed-state divergence) but a distinct axis: *untracked* (never-committed) artifacts, not staged-hunk races. The #2160 fix (commit missing reports) and its follow-on (commit the paired topic specs) are the worked example.
