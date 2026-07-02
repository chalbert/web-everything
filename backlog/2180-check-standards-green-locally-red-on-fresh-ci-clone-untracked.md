---
kind: task
status: open
relatedTo: ["2080", "2160", "2165", "2070"]
dateOpened: "2026-07-02"
tags: [ci, gate, dx, check-standards, derived-artifacts, pr-flow]
---

# check:standards passes locally but red on a fresh CI clone — untracked derived artifacts diverge local from CI

`npm run check:standards` validates the **working tree**, which on a dev machine carries **untracked derived
artifacts** that a fresh CI checkout lacks — so the gate is green locally and red in CI. This bit origin CI
**twice on 2026-07-02**: (1) ~24 `relatedReport`-referenced reports lived only as untracked files (#2160); (2)
the `we:AGENTS.md` inventory went stale against ~28 untracked research-topics, and every in-flight PR had to
re-run `gen:inventory` as `main` moved (it broke #4 and #11's `test` job). The reactive fix each time is "commit
the untracked files" — the systemic gap is that **local and CI validate different trees**.

**Options (pick one):** (a) a `check:standards` sub-check that fails if tracked-artifact inputs have **untracked
siblings** in the derived dirs (`we:reports/`, `we:src/_data/researchTopics/`, referenced by `relatedReport`);
(b) regenerate the `we:AGENTS.md` inventory **in CI** (or assert-only there) so drift never blocks a PR; (c) a
pre-push hook that runs the gate against a **clean `git stash`/temp checkout**. Goal: the divergence surfaces
before push, not as a red required `test` check that blocks the #2138 self-approved-PR flow (#2153).
