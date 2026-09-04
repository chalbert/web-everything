---
kind: story
size: 5
parent: "3001"
status: open
blockedBy: ["xgfob3u"]
dateOpened: "2026-09-04"
relatedTo: ["3001", "3002"]
relatedReport: reports/2026-08-08-agent-command-surface-sizing.md
scope:
  - we:scripts/guard-bash.mjs
  - we:scripts/__tests__/guard-bash.test.mjs
tags: [guard, agent-surface, security]
---

# Flip we:scripts/guard-bash.mjs from a deny-list to a fail-closed allow-list for mutating commands

Follow-on build filed at `#3001`'s ratification (Fork 1: split by mutation — reads stay free and sandboxed;
anything that mutates state **outside the agent's own lane clone** goes only through a typed operation,
failing **closed**). This is the actual enforcement flip: today `we:scripts/guard-bash.mjs` is a **deny-list**
(an unlisted spelling is allowed by default); this item makes it an **allow-list** for the mutation class —
an unlisted mutating command is **refused** by default, not merely flagged. **Deliberately `blockedBy`
`#xgfob3u`** (closing the operation-catalog gaps) — flipping the guard closed before the catalog covers real,
currently-used mutating commands (raw `git push`, `git add`/`commit`, file writes/deletes/moves outside the
lane, `npm ci`, `curl`) would break live agent workflows on day one. This is a structural security change to
a write-time gate every session goes through; it needs its own careful scoping pass, not a rushed build
alongside the ratification PR.

## What this item is NOT

Not the operation catalog itself — that is `#xgfob3u`. Not a re-litigation of Fork 1's split-by-mutation
call, or Fork 2's capability-gap-via-learnings-pool call — both are ratified, cited at
`we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations`. Not a decision to widen scope
to the operator's own interactive session — that is the separate, still-open `#3188`.

## Scope of the actual build

1. **Define "mutates state outside the agent's own lane clone"** as a concrete, checkable predicate inside
   `we:scripts/guard-bash.mjs` — the guard already has some path/lane-aware logic to build on (the existing
   destructive-git-at-primary-checkout guard from `#3003`, and the lane-ownership primitives in
   `we:scripts/readiness/scope-lease.mjs`) rather than reinventing lane-boundary detection from scratch.
2. **Refuse, don't merely warn**, on a mutating command with no covering typed operation — matching Fork 2's
   `#3001` sibling ruling that a dispatched agent halts and surfaces a `missing-operation` finding
   (`we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md`) rather than being allowed
   through.
3. **A false-deny sweep before flipping the default.** The sizing report already found three false denies
   in the *current* deny-list guard during a single research session (an fd-dup pipe, a JS arrow function
   read as a redirect, `sed -n` misread as `sed -i`) — those exact classes must be fixed or the flip
   regresses real, common commands on day one.
4. **A staged rollout**, not a flag day: candidates include a warn-only shadow mode first (log what would be
   refused, without refusing), a scope carve-out for the operator's own interactive session (still governed
   separately by `#3188`), or a per-lane opt-in before the repo-wide default flips. This item's own job is to
   pick and justify the shape, not to assume one.

## Done when

1. **Executable** — a new test suite in `we:scripts/__tests__/guard-bash.test.mjs` (or a sibling file) that
   fails before this item lands and passes after: (a) a mutating command covered by a typed operation from
   `#xgfob3u`'s catalog is refused when run raw; (b) the same operation invoked through its typed path is
   allowed; (c) every real command class the sizing report's false-deny sweep found (fd-dup pipe, a JS arrow
   function in a quoted arg, `sed -n`) is proven NOT refused, so the flip does not reintroduce those.
2. **Observable** — running a raw, uncovered mutating command (e.g. `curl` against an arbitrary host, once
   `net.fetch` exists or as the deliberately-still-uncovered case if it does not) is refused with a message
   naming the missing operation, not silently allowed.
3. **Assertable** — the PR body names, for the record: the exact predicate chosen for "mutates state outside
   the agent's own lane clone," the rollout shape picked (shadow mode / scope carve-out / opt-in / flag day)
   and why, and a concrete list of the false-deny classes checked and fixed before the flip.
