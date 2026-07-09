---
kind: story
size: 3
status: open
dateOpened: "2026-07-09"
tags: []
---

# Purge stale primary-backlog-mutation guidance and harden the BACKLOG_MUTATE_OK override

#2219/#2302 settled the read-only-primary invariant (no backlog splice on primary, ever) but two holes remain: (1) we:skills-src/batch-backlog-items/SKILL.md and we:docs/agent/backlog-workflow.md STILL tell agents that we:scripts/backlog.mjs claim/resolve/retype/scaffold are guard-clean and run on primary; (2) the #2302 guard (we:scripts/guard-bash.mjs) advertises a BACKLOG_MUTATE_OK escape that lets any session mutate primary anyway (used in error 2026-07-09). Purge the stale docs to point pack-phase + lifecycle mutations at a lane, and remove or narrow-and-log the override so primary stays read-only in fact, not just by convention.
