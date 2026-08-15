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

## Preparation session (2026-08-15) — re-verified, still not build-ready

Ran the story-preparation checklist (`we:agent-memory-src/story-preparation-checklist.md`) against this
card. Re-checked the `blockedBy: ["1391"]` claim directly against both repos rather than trusting the prior
text:

- **#1391** (dev-browser shell epic) is still `status: open`. Its foundational slice **#1753** (S1 — the
  shell scaffold this card needs) is also still `status: open`, no `dateResolved`, every `## Done when` box
  unchecked. #1753 was itself only just brought to a fully decided, build-ready state today (2026-08-15,
  its own "Scope correction (verified against the tree, 2026-08-15)" note) — it has design, interfaces, and
  ordered tasks, but **zero code has landed** for it yet.
- Confirmed directly in the `plateau-app` checkout (`plateau:packages/dev-browser/`, HEAD `0d0ed9e`, matches
  `origin/main`): no `shell/` directory, no `BrowserWindow`/`WebContentsView` usage anywhere in
  `plateau:packages/dev-browser/src`, and no settings/config store of any kind exists yet
  (`grep -rl BrowserWindow packages/dev-browser/src` → empty; `find packages/dev-browser/src -iname "*shell*"`
  → only an unrelated vscode-extension test file,
  `plateau:packages/dev-browser/src/ide-bridge/vscode-extension/__host-tests__/real-suite/real-shell.test.cjs`).

**Conclusion: this card is not viable to bring to build-ready right now, and that is a real repo-state fact,
not a stale label.** There is no per-developer dev-browser settings surface anywhere in the tree yet — no
shell process, no settings file, no config loader — for a managed-policy layer to override. Writing real
`## Interfaces / protocol` signatures for it today would mean inventing a contract nobody has built, which
the checklist's grounding rule forbids ("cite `path:line` actually opened, never invent an interface you
have not read"). The `blockedBy: ["1391"]` edge already correctly captures this; no missing-blocker gap was
found, so no new backlog item was filed.

**Precise unblock trigger:** #1391 resolves once its S1 slice #1753 resolves (its `## Done when` boxes
checked, `dateResolved` stamped) — that is the first point a real dev-browser process and a place to hang
per-developer settings exist. Re-run this preparation once #1753 (or a later #1391 slice) lands; the reusable
part of the design already stands: apply the #2372 `DevMetricsPolicy` three-tier precedence shape (org
policy > machine > per-developer, see `we:analytics/dev-metrics.ts` `DevMetricsPolicy` +
`fui:plugs/webanalytics/devMetrics.ts` `resolveDevMetricsPolicy`) to whatever settings shape #1753 actually
ships, rather than to a guessed one.
