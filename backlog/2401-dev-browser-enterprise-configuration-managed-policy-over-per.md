---
kind: story
size: 5
parent: "1848"
status: open
blockedBy: ["1391"]
dateOpened: "2026-07-10"
tags: []
---

# Dev-browser enterprise configuration — managed policy over per-developer settings

A server-based managed-policy layer that overrides per-developer dev-browser settings on org-owned machines, reusing #2372's precedence shape. Home: plateau-app / packages/dev-browser (#2342). Gated on the dev-browser shell build (#1391) existing. Third of #1848's three named enterprise shapes (fleet policy shipped via #2372; SaaS account controls carved as sibling).

## Next

Blocked-in-fact on the dev-browser shell (#1391) — there is no managed dev-browser to configure until the
Electron shell lands. On unblock: define the managed-config schema (which per-developer dev-browser settings
an org can override), then apply the #2372 `DevMetricsPolicy` three-tier precedence shape (org policy >
machine > per-developer) to the shell's settings.
