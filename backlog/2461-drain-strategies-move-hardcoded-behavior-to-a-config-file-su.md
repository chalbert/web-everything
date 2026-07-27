---
bornAs: xw9m2cf
kind: story
size: 5
status: open
dateOpened: "2026-07-12"
tags: []
scope:
  # WE lander + new declared drain-strategy config layer
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/drain-config.mjs
  - we:scripts/lib/__tests__/drain-config.test.mjs
  - we:drain.config.json
  - we:drain.config.schema.json
  # trust-chain roster: register the new lander-governing config artifact
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
  # plateau drain-daemon (reads config → pass-arg strategy) + dev-panel loop UI surface (#2454)
  - plateau:tools/drain-daemon/lib.mjs
  - plateau:tools/drain-daemon/lib.test.mjs
  - plateau:tools/drain-daemon/daemon.mjs
  - plateau:tools/drain-daemon/cli.mjs
  - plateau:tools/dev-panel/vite-plugin.ts
  - plateau:tools/dev-panel/drain-daemon.html
---

# drain strategies: move hardcoded behavior to a config file surfaced in the plateau loop UI

Operator direction (2026-07-12, drain git-hygiene review): stop hardcoding drain strategy choices in we:scripts/merge-ai-prs.mjs and per-invocation flags — make them a declared config. Today the strategy knobs are scattered and code-fixed: rebase-drop on/off (`--no-rebase-drop`), land strategy (`gh pr merge --merge` vs `--squash`), watch interval, review-escalation overrides, repo scope. Fix shape: (a) a drain config file (repo-root, e.g. we:drain.config.json, schema-validated) that we:scripts/merge-ai-prs.mjs and the resident daemon (plateau:tools/drain-daemon, #2449) both read as the default strategy layer — CLI flags stay as per-invocation overrides on top, never the only way to choose; (b) surface the config in the plateau dev-panel drain-daemon loop UI (#2454's surface: status/history/controls) so the operator edits strategies from the browser — the panel writes the config file through the existing control endpoint (same loopback-only guard, plateau#21); (c) first strategies to carry: rebase-drop scope (item 2460 carries the new default), merge vs squash land strategy (the git-hygiene lever — squash collapses branch noise to one commit per PR on main), watch cadence. Cross-repo by nature (WE lander + plateau UI) — expect a coupled impl PR.
