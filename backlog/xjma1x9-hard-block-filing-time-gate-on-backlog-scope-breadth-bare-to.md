---
kind: story
size: 5
status: open
scope: ["we:scripts/backlog-guard.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/backlog/__tests__/backlog-guard-scope.test.mjs"]
relatedTo: ["2739", "2768", "3562", "3576"]
dateOpened: "2026-09-07"
tags: [scope, backlog-guard, check-standards, filing-time-gate]
---

# Hard-block filing-time gate on backlog scope breadth (bare top-level dir, or unjustified subdirectory)

#2768 (size 2) declared a bare `we:scripts/` scope entry — a repo-qualified prefix with zero path segments
beyond the top-level directory name — confirmed live to be holding 32-38 unrelated queued items on scope
overlap every tick, for an item whose real work touches a handful of files. `we:scripts/check-standards.mjs`'s
existing §6d-sexies lint (#2739) already flags this shape but only as a WARNING; #2768's entry sailed past it
with no consequence. This item upgrades the mismatch to a filing-time HARD BLOCK, tiered by breadth rather
than a flat ban.

## Grounding

`we:scripts/check-standards.mjs`'s §6d-sexies (#2739, resolved 2026-07-27) already flags ANY directory-level
scope entry (a repo-qualified prefix ending in `/`, at any depth) as a `check:standards` WARNING, cleared by
an escape-hatch `scopeRationale:` frontmatter note — warn-only by design so authors are never pressured to
under-scope. That precedent is real and working; reuse its shape and file rather than building a second
mechanism. The write-time hard-block enforcement point in this repo is `we:scripts/backlog-guard.mjs --pre`
(the PreToolUse Edit|Write deny-at-write-time hook wired in `we:.claude/settings.json`) — it currently has
ZERO scope-specific logic (confirmed by grep). Relates conceptually to #3562/#3576's leverage-ranked
auto-prepare-docket pipeline: an item that fails this bar is exactly what that pipeline already calls
`unshaped-no-scope` — not build-ready. This item is that pipeline's filing-time enforcement half, not a
disconnected new rule.

## The rule (tiered, not a flat ban)

1. **Bare top-level directory** (zero segments beyond the first directory name, e.g. `we:scripts/`) —
   ALWAYS REJECTED at filing time. Hard block, no `scopeRationale` escape hatch. Narrower than #2739's
   existing warn (which flags every trailing-slash entry) but stronger here: unwaivable.
2. **Single-file entry** (no trailing slash) — the preferred default, fine as-is, no justification required.
3. **Subdirectory entry, not bare-top-level** (one or more segments deep, e.g. `we:scripts/conveyor/`) —
   allowed, but the existing `scopeRationale:` note becomes MANDATORY rather than optional; missing it is now
   a hard rejection too, same enforcement strength as case 1 (upgrading #2739's warn to a block for this
   tier only). Whoever writes the justification should be steered — via the gate's own message text, a
   judgment note, not a mechanical check — toward the smallest reasonable directory that would suffice: if a
   narrower subdirectory would work, the note should explain why the broader one was actually needed, not
   just assert that a subdirectory is fine in general.

## Implementation shape

Enforce tiers 1 and 3 in `we:scripts/backlog-guard.mjs --pre`, alongside keeping `we:scripts/check-standards.mjs`'s
existing §6d-sexies lint for defense-in-depth/CI visibility. Make the whole policy configurable via an
env-var boolean toggle, following the existing `LANE_GUARD_OFF=1` convention in `we:scripts/guard-lane.mjs`
(e.g. `SCOPE_BREADTH_GUARD_OFF=1`) rather than hardcoding it with no override.

## Done when

1. **Executable** — a backlog item `Write` (new file) or `Edit` (existing file) that sets a bare top-level
   directory scope entry is denied by `we:scripts/backlog-guard.mjs --pre` with exit 2; a subdirectory entry
   with no `scopeRationale:` is denied the same way; a subdirectory entry WITH `scopeRationale:` and a
   single-file entry both succeed. `SCOPE_BREADTH_GUARD_OFF=1` bypasses all three.
2. `we:scripts/check-standards.mjs`'s §6d-sexies lint and its test (`we:scripts/__tests__/check-standards.test.mjs`)
   updated to match the new tiering (bare-top-level → err(), unjustified subdirectory → err()).
