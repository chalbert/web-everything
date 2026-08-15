---
bornAs: x16hn7n
kind: story
size: 5
parent: "2444"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: the steer composer (#2773) ships and is used, and boundary-delivery steering is observed insufficient in real operator use"
priority: low
dateOpened: "2026-07-12"
tags: [plateau-loop, agent-runner, steer]
---

# Plateau Loop: agent steering — mid-turn hook-gate injection and between-turn kill/--resume

Originally: build headless steering for spawned workers — PreToolUse hook-gate injection mid-turn, and
kill-and-resume between turns — gated on the #2444 runner decision. **Parked 2026-08-15**: the card's two
halves turned out to be in two different, non-buildable-as-written states — see below.

## 2026-08-15 — prepared against the story-preparation checklist, found not build-ready, parked

Ran `we:agent-memory-src/story-preparation-checklist.md` against this card. #2444 (the gating decision)
ratified 2026-07-16, `codifiedIn: we:docs/agent/platform-decisions.md#agent-runner-cli-backend`, so the gate
this card names is clear — but verifying the claim against the *live* repo (checklist item 8) found this is
two different questions wearing one card, not one story.

### Half 1 — "kill-and-resume between turns" is DONE, shipped by #2530

[#2530](/backlog/2530-build-endpoint-supervised-builder-post-api-backlog-build-dra/) ("Build endpoint +
supervised builder", resolved 2026-07-16 — four days after this card opened) built the full ratified Fork
3(a) contract in `plateau:src/build-runner/runner.ts`:

- `stop()` — graceful stdin-close, escalate to `SIGTERM` after `GRACE_MS` (`plateau:src/build-runner/runner.ts:157-163`)
- `resume(text, task)` — continue a clean pause via `--resume <session>` (`plateau:src/build-runner/runner.ts:166-170`)
- `redirect(text, task)` — hard-kill + fresh-spawn, never `--resume` a killed turn (`plateau:src/build-runner/runner.ts:176-182`)

All three are unit-tested against a fake child in `plateau:src/build-runner/runner.test.ts`
(`describe('#2530 AgentRunner — resume vs redirect (Fork 3 a)')`, `plateau:src/build-runner/runner.test.ts:117-163`),
and the file is merged to `plateau-app`'s `main` (`44dfc8b build-runner: fold independent review —
state-machine + demuxer hardening (#2530)`). There is nothing left to build here — this half of the card is
stale, superseded by work that landed after the card was opened.

### Half 2 — "mid-turn hook-gate injection" has no consumer and no settled design

The ratified #2444 decision (Fork 1) named this explicitly as a **deferred enhancement**, not a committed
scope: *"(b) earliest-possible, best-effort... Mid-turn earliness is offered later as an enhancement impl
behind the same op — a hook-gate that must still honor (a)'s never-drop floor and clear its own spike
(deny-once-and-pass-the-retry, catch-all matcher, operator-text framing)."* Checking that against the repo
surfaces two separate problems:

**No consumer wants it.** The one epic that would consume steering is
[#2551](/backlog/2551-live-agent-supervision-surface/) ("Live agent-supervision surface"), sliced 2026-07-28
into #2773/#2778/#2772 — all still `status: open`, none built yet. #2773 ("Steer composer for a running
build") is the steer UI, and its scope is explicitly boundary-only: *"Give the operator a UI to send guidance
to a running agent, delivered at the next turn boundary and never dropped."* No mid-turn earliness is asked
for anywhere in that epic. Wider check: `steer()`/`resume()`/`redirect()` have **zero production call sites**
in `plateau-app` today (`grep`'d `plateau:src/`, non-test) — the only live caller of the runner is
`plateau:src/build-runner/build-action.ts`'s max-time kill-switch, and it calls `stop()` only. Even the
*already-shipped* boundary-delivery channel is unused in production yet.

**The design is not settled enough to hand to a builder** — writing real interfaces now would be picking a
fork silently (checklist item 4), not preparing one. Checking the repo's actual hook plumbing against the
three sub-questions the ratified decision itself named as unresolved:

- *catch-all matcher* — this repo's own hooks (`we:.claude/settings.json:23-58`) use narrow matchers
  (`Edit|Write`, `Bash`). A channel that must fire on literally the next tool call *of any kind* is a
  different, untested matcher shape.
- *per-spawn delivery* — that matcher block lives in the repo's own committed `we:.claude/settings.json`,
  read by every interactive session too. A steering hook must reach only a *supervised spawn*, not every
  session — whether that's a per-spawn `--settings` flag or a generated lane-scoped settings file is
  unverified against the current CLI.
- *deny-once-and-pass-the-retry* — the hook script is a fresh subprocess the CHILD spawns, sharing no memory
  with the runner (a separate Node process). The "pending steer text" needs an IPC handoff (e.g. a
  lane-scratch file the runner writes and the hook consumes-and-deletes once) — sketched here for the first
  time, never checked against a real run.
- *operator-text framing* — whether a `permissionDecisionReason` reads to the model as "an operator note, act
  on it" versus "action denied, try something else" is a live-agent behavior question. No amount of reading
  docs answers it; it needs a POC against a real spawned session.

Checklist item 8 asks for exactly this de-risking during preparation rather than during the build — but the
risk here doesn't reduce to a probe this session can run inside a doc-only prep lane (four open sub-questions,
one requiring a live-agent POC with a real spawned `claude -p` child). It needs its own spike turn before a
story can carry real interfaces, the same way #2444 itself needed a decision turn before #2530 could build.

### Disposition

Parked, not resolved — the idea isn't rejected, it genuinely has no consumer and no settled shape yet
(hold-model `maturityGated`: *"building now yields a worse artifact — you'd guess the shape, tune against
nothing, automate the unproven"*). Re-open when the trigger fires; the reopen work is a **spike** (settle the
four sub-questions above against a real spawned session), not a straight build.

**Reopen when** (`maturityTrigger` above): the steer composer (#2773) ships and is used, AND boundary-delivery
steering is observed insufficient in real operator use — e.g. an agent runs a long tool-call-free stretch and
the operator needs it interrupted before the next tool call. Until then the boundary-delivery channel costs
nothing, because there is no case yet where mid-turn earliness would have changed an outcome.

`size: 5` above priced both halves together; re-estimate at un-park, after the spike settles the shape — a
size assigned to an unresolved four-fork design would be a guess wearing a Fibonacci number.
