---
bornAs: xw9m2cf
kind: story
size: 5
status: open
dateOpened: "2026-07-12"
tags: []
---

# drain strategies: move hardcoded behavior to a config file surfaced in the plateau loop UI

Operator direction (2026-07-12, drain git-hygiene review): stop hardcoding drain strategy choices in we:scripts/merge-ai-prs.mjs and per-invocation flags — make them a declared config. Today the strategy knobs are scattered and code-fixed: rebase-drop on/off (`--no-rebase-drop`), land strategy (`gh pr merge --merge` vs `--squash`), watch interval, review-escalation overrides, repo scope. Fix shape: (a) a drain config file (repo-root, e.g. we:drain.config.json, schema-validated) that we:scripts/merge-ai-prs.mjs and the resident daemon (plateau:tools/drain-daemon, #2449) both read as the default strategy layer — CLI flags stay as per-invocation overrides on top, never the only way to choose; (b) surface the config in the plateau dev-panel drain-daemon loop UI (#2454's surface: status/history/controls) so the operator edits strategies from the browser — the panel writes the config file through the existing control endpoint (same loopback-only guard, plateau#21); (c) first strategies to carry: rebase-drop scope (item 2460 carries the new default), merge vs squash land strategy (the git-hygiene lever — squash collapses branch noise to one commit per PR on main), watch cadence. Cross-repo by nature (WE lander + plateau UI) — expect a coupled impl PR.
