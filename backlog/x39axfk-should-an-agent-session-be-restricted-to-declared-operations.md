---
kind: decision
status: open
dateOpened: "2026-08-18"
tags: [governance, operations, safety, agent-surface, prompt-injection, lanes]
---

# Should an agent session be restricted to declared operations, with bash denied by default

Operator direction, 2026-08-18: *"I want ai to only be able to use pre define operation and not any
bash, and eventually use vm for lanes."* Epic #3029 already declares operations and generates their
callers, and a landed memory note forbids hand-rolling around a missing one — but nothing RESTRICTS a
session to them. `we:.claude/settings.json` carries 20 allow rules and `deny: []`. This decides
whether the restriction becomes real, what happens to work no operation covers yet, and whether lane
isolation moves to VMs.

## Why now, and the measurement that motivates it

The operator's stated worry is not repo blast radius (solo dev, non-prod) but **what an agent session
can be induced to do** — prompt injection, specifically. That risk does not shrink as the project
grows safer; it grows as the agent gets more autonomous. An agent restricted to declared operations
has a bounded, auditable action surface; one with bash does not.

Measured against this very session, which is the honest baseline: of all the work performed, exactly
ONE class of action went through a declared operation (`review-pr`, four runs). Everything else was
raw bash — `git`, `npm`, `vitest`, `sed`, `python3`, `apt`, `curl` — plus repo scripts invoked
directly (`we:scripts/backlog.mjs`, `we:scripts/lane-pool.mjs`, `we:scripts/check-standards.mjs`,
`we:scripts/lint-locus-prefix.mjs`). Six
operations exist (`claim`, `dispatch-lane`, `gate-health`, `review-pr`, `review-prep`,
`suggest-next`). The distance between "operations exist" and "operations are the only surface" is
therefore very large, and any plan that ignores that will stall on its first uncovered task.

## The forks

**Fork 1 — what does the restriction actually deny?**
- (a) Deny `Bash` outright; every action must be a declared operation.
- (b) Deny by default with a narrow allowlist (read-only inspection: `git status`, `git log`, test
  runners) — the agent can still SEE, but cannot ACT outside an operation.
- (c) Keep bash, add deny rules only for the destructive verbs.

(a) is the stated goal and the only one that actually bounds the surface; (b) is the only one that is
plausibly reachable soon given the coverage measurement above; (c) does not address injection at all,
since the damage from an induced action is rarely a single obvious verb.

**Fork 2 — what happens when no operation covers the work?**
This is the fork that decides whether (a) is livable. The landed memory note
`no-hand-rolling-around-a-missing-operation` already says a confirmed gap should be BUILT, never
worked around. Under a real bash denial that stops being guidance and becomes the only path:
- (a) The session halts and files a missing-operation item. Correct, and slow.
- (b) The session may declare and generate a new operation in-session, then use it.
- (c) An explicit, logged break-glass that a human approves per use.

**Fork 3 — VM per lane.**
Today lanes are local clones sharing one filesystem and one credential set. A VM per lane isolates
blast radius and makes the credential question per-lane rather than per-machine — which is exactly
the seam the cloud-VM work this session ran into (`gh` unauthenticated, only the session connector
holding a credential). Worth deciding whether this is the same programme or a separate one; the
answer changes whether the operation surface must be remote-callable from the start.

## What this decision does NOT settle

The enforcement MECHANISM. A `deny` rule in settings, a `PreToolUse` hook (#2788 already implements a
tree-write backstop of that shape), and a harness-level permission mode are three different
implementations with different bypass properties. Choose the policy here; the mechanism is its own
item once the policy is ratified.

## Done when

1. A ruling on Fork 1 and Fork 2 is recorded here with its reason, and Fork 3 is either folded in or
   split out with a named successor item.
2. If the ruling is (a) or (b), a follow-on implementation item exists naming the mechanism, and a
   COVERAGE item exists for the gap between today's six operations and the actions a session actually
   needs — measured, not assumed.
3. The `no-hand-rolling-around-a-missing-operation` memory note is re-read against the ruling and
   updated if the ruling changes what a session should do when it hits a gap.
