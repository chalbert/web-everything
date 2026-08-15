---
bornAs: x46a4zo
kind: story
size: 8
parent: "2444"
status: resolved
priority: low
dateOpened: "2026-07-12"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: 2530
tags: []
---

# Plateau Loop: agent-runner build — spawn the local claude CLI as supervised children

Build the phase-1 runner once #2444 decides its shape: spawn the local claude CLI (-p --output-format stream-json) on the user subscription as supervised child workers behind a stable runner interface. Gated on the #2444 decision.

## Resolved without a build — already delivered by #2530 (2026-08-15 preparation finding)

Prepared for build per `we:agent-memory-src/story-preparation-checklist.md` and found **not viable to build
as scoped: the literal ask already shipped.** #2444 ratified 2026-07-16
(`we:docs/agent/platform-decisions.md#agent-runner-cli-backend`); its own ruling text says *"the runner
interface itself is built by #2530 (Slice C)"* — and #2530 delivered exactly that, the same day: a
`spawn`/`steer`/`stop`/`resume`/`observe` runner spawning the `claude` CLI (`-p --output-format
stream-json`, `--input-format stream-json`, `--resume`) as a supervised child on the user's subscription,
implementing all three of #2444's ratified forks (queued-stdin `steer`, allowlist + inherited write-time
deny gates, graceful→SIGTERM `stop` with fresh-spawn-on-redirect) — live at
`plateau-app:src/build-runner/runner.ts` (merged 2026-07-16, commit `ca99a29`; independently reviewed,
commit `44dfc8b`), consumed by `plateau-app:src/build-runner/build-action.ts` behind `POST
/api/backlog/build`. Re-running this card as scoped would rebuild an existing, reviewed, live runner.

**This is not the end of the runner story, only of this card's literal ask.** #2530's runner is wired to
exactly one caller — `plateau-app`'s per-click, human-confirmed build endpoint. The conveyor's headless
runner (`we:skills-src/conveyor/runner.mjs`, #2702) still can't spawn agents itself — per
`we:skills-src/conveyor/SKILL.md` a live main session executes its surfaced dispatch on demand (the named
"interim bridge"), and #2753 / #3102 both still cite *this card's number* as the critical path to
zero-session delivery. That remaining gap is real but is a different, undecided shape (does the conveyor
get its own WE-native runner, or call `plateau-app`'s cross-process — a genuine fork, not a rebuild) — filed
as **#3118** (`session-free-conveyor-where-does-headless-agent-spawning-liv`), parented under #2753.
**#2753 and #3102 should point their critical-path line at #3118, not this card, once it lands.**
