---
kind: decision
parent: "2612"
status: open
dateOpened: "2026-07-28"
relatedTo: ["2123", "2302", "883", "2677"]
tags: [conveyor, main-session, enforcement, hook, pretooluse, guard, decision]
---

# Enforce main-session-never-builds: a PreToolUse build-guard gate

The conveyor's main session is meant to be judgment, conversation, and delegation **only** — it dispatches subagents to build and never builds itself. But today's lane guard ([we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs), #2123/#2302) only blocks *edits* to the primary checkout; it does not stop the main session from *building* via scratchpad tooling, `node` scripts, multi-step bash, or artifact generation. So in practice the main session keeps doing mechanical work itself instead of delegating. Discipline has failed repeatedly, so this decides the enforcement **approach** — not whether to enforce.

## The problem

The main session's job in the conveyor is judgment, operator conversation, and delegation: it decides readiness, reviews escalations, ratifies forks, and dispatches one background agent per launch entry. It is **not** supposed to build. Building is what the per-lane delivery agents are for.

The enforcement we have stops the wrong thing. [we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) is a `PreToolUse(Edit|Write)` hook that denies edits to the primary (non-lane) checkout, and [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) denies a direct `main` push and primary-cwd backlog mutations (#2302). Both close the *edit-to-primary* hole. Neither closes the *build-in-the-main-session* hole: the main session can still run generator/analysis scripts, write files under the scratchpad, drive multi-step bash pipelines, and generate artifacts — all mechanical work that should have been delegated to a subagent.

The gap shows up as repeated operator frustration — "I see a lot happening in the main session", "you should have delegated the work to a subagent", "how can we enforce the main session to stop building itself". The ask is explicit: a **deterministic enforcement mechanism**, because relying on the model's discipline to self-restrict has failed more than once.

## Why this is a decision (the fork)

Enforcement is settled; the enforcement **mechanism** has a genuine fork. The three candidate approaches trade off differently on how hard the guarantee is, how much machinery it costs, and how it interacts with the legitimate work the main session must still be allowed to do. Laid out below; **not ruled here** — left for `/prepare`.

### (a) A PreToolUse build-guard hook

In the primary / non-lane session, a `PreToolUse` hook **denies** mutating/building actions and **allows** only a whitelist. Deny:

- `Bash` that writes files or runs generator/analysis scripts
- artifact generation
- git mutations

Allow (the whitelist — the legitimate main-session surface):

- state reads — `conveyor-state`, `dispatch-plan`, `lane-pool status`, `gh … list/view`, `git log`
- [we:scripts/conveyor/queue.mjs](../scripts/conveyor/queue.mjs) operations
- subagent dispatch

This is the direct analogue of the existing lane/write guards: same `PreToolUse` seam, extended from *edit-to-primary* to *build-in-main-session*. It gives a hard, deterministic guarantee at the tool-call seam.

**Open sub-question (defer to /prepare):** whitelist vs blacklist for classifying `Bash` commands — a small allow-list of known-safe read/dispatch commands (deny by default, safest but can block a novel-but-legitimate read) versus a deny-list of known-building patterns (allow by default, more permissive but leakier). And **hard-deny vs warn**: a hard block at the seam versus a reminder the session can override (weaker, but no false-positive wedge).

### (b) Move all conveyor tooling into the runner / a subagent

Relocate the status-board generator, reap/scan scripts, and the rest of the conveyor's local tooling into the headless runner or a delegated agent, so the main session has **nothing local left to run**. Enforcement by *absence* rather than by *gate*: you can't build in the main session if the build tools don't live there. This composes with the mechanize-the-core direction (#2677 / #2701) — the same move that lifts orchestration off the single serial session also removes the main session's ability to do the mechanical work by hand.

### (c) Advisory-only

A reminder or warn, no hard gate. The weakest option, and likely rejected on the merits: discipline (an advisory the model is trusted to honor) is exactly what has **already failed repeatedly** here. Recorded for completeness so the fork is honestly framed, not to be adopted.

## The tension the gate must not break

Whatever the approach, the main session has legitimate needs it must keep. It must still be able to:

- **read state** — `conveyor-state`, `dispatch-plan`, `lane-pool status`, `gh … list/view`, `git log`
- **dispatch agents** — spawn the per-lane delivery/probe subagents
- **publish the status artifact** — the operator-facing conveyor board
- **run the queue verbs** — [we:scripts/conveyor/queue.mjs](../scripts/conveyor/queue.mjs), the queue operations the operator drives

A guard that blocks these breaks the conveyor. So the classification is the crux of (a): the deny rule has to carve these out precisely, which is why the whitelist-vs-blacklist sub-question is load-bearing and not cosmetic.

## Settling authority (points toward (a) — but the ruling is /prepare's)

The repo's **hookable-vs-judgment** discipline is the cite: a **script-decidable** rule becomes a **deterministic hook**, and footguns are caught **at write-time** (deny-at-the-seam), not documented-around after the fact. "Is this main-session action a build?" is a classification a hook can make deterministically at the `PreToolUse` seam — so by this discipline it should be a hook, not a prose norm the model re-honors each turn.

- **[we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)** (#2607) — script-decidable → a deterministic tested script; judgment stays in context. This is the delivery-loop application of the hookable-vs-judgment rule, and it is exactly the surface this decision sits on.
- **The shared-gate write guard** ([we:scripts/lint-locus-prefix.mjs](../scripts/lint-locus-prefix.mjs) `--pre`, #883) — the precedent for *footguns-first, deny-at-write-time*: a `PreToolUse(Edit|Write)` hook scans the proposed content and denies at the seam rather than failing the gate afterward. Approach (a) is the same pattern aimed at *building* instead of *content*.
- **The lane guard** ([we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) / [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs), #2123/#2302) — the direct sibling this extends: it closes edit-to-primary; this decision is about closing build-in-main-session with the same `PreToolUse` mechanism.

By this authority (a) is the natural landing spot, and (b) is a complementary structural move (remove the tools) rather than a rival gate. But the classification detail, the whitelist-vs-blacklist call, and the hard-deny-vs-warn call are real and un-ruled — this item states the fork and the leaning; the ruling is deferred to `/prepare` + ratify.

## Relationships

- **Parent #2612** — the conveyor skill (interim main-session lane operator); this enforces its "main session is the operator seat, not a builder" invariant. (Sibling epic **#2677** mechanizes the core and delegates per-lane orchestration — approach (b) here overlaps that direction.)
- **relatedTo #2123 / #2302** — the lane guard work ([we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) / [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs)) this extends from edit-to-primary to build-in-main-session.
- **relatedTo #883** — the shared-gate write-time hook, the deny-at-the-seam precedent approach (a) mirrors.
