---
bornAs: x1d4k2v
kind: decision
parent: "2445"
size: 3
status: resolved
priority: low
dateOpened: "2026-07-11"
dateResolved: "2026-07-16"
graduatedTo: 2530
codifiedIn: "docs/agent/platform-decisions.md#agent-runner-cli-backend"
preparedDate: "2026-07-16"
researchTopic: claude-cli-agent-runner-headless-contract
relatedReport: reports/2026-07-12-claude-cli-agent-runner-headless-contract.md
tags: [plateau-loop, agent-runner, claude-cli]
---

# Plateau Loop phase-1 agent-runner shape — CLI-spawn contract, steering, and auth

Define the agent-runner interface (spawn/steer/stop/resume/observe) with the claude CLI backend: `-p`
stream-json spawning, mid-turn steering, kill+resume redirects, subscription auth only; SDK/API-key
backend deferred behind the same interface.

## Ruling (ratified 2026-07-16)

All three forks ratified **at their recommended defaults** — each survived an independent skeptic + a
fresh-context two-confusion screen (two were strengthened by the attack, none overturned):

- **Fork 1 → (a)** `steer(text)` promises **boundary-delivery, queued, non-dropping** (stdin impl); hook-gate
  mid-turn delivery is a deferred enhancement behind the same op.
- **Fork 2 → (a)** headless permissions = a static per-task-type `--allowedTools` baseline **+ the repo's
  existing non-blocking write-time deny gates** (composes with #883, does not replace it); the human-blocking
  UI-approval branch is excluded.
- **Fork 3 → (a)** stop = **graceful-boundary-first, escalate to `SIGTERM` on timeout**; `--resume` continues a
  clean pause, a redirect fresh-spawns.

Plus the two research-settled invariants: CLI-spawn on subscription (SDK is a later API-key backend), and a
backend-agnostic interface. **Codified in** `we:docs/agent/platform-decisions.md#agent-runner-cli-backend`;
the runner interface itself is built by **#2530** (Slice C).

> **Un-deferred + prepared (2026-07-16, operator call).** The 2026-07-11 defer ("no consumer yet — wait
> for daemon operating evidence") is lifted: epic [#2527](/backlog/2527-plateau-loop-autonomous-ai-build-queue/)
> greenlit the **supervised builder** ([#2530](/backlog/2530-build-endpoint-supervised-builder/)), which
> spawns agents — the consumer the defer was waiting for. The daemon (#2449) spawns no agents, so its
> operating evidence would not shape this contract anyway; the evidence that matters (quota walls, CLI
> contract drift, steering reach, auth path) is already banked below. Prepared here to prepared-fork DoR;
> the call itself is still open — ratify via `/next decision`.

> **Prep assessment (banked 2026-07-12, `/prepare all`):** the docs survey is published at
> [/research/claude-cli-agent-runner-headless-contract/](/research/claude-cli-agent-runner-headless-contract/)
> (facts verified against the official docs; report `we:reports/2026-07-12-claude-cli-agent-runner-headless-contract.md`).
> Findings that reshape the forks: (1) **the setup-token spike is resolved** — `claude setup-token` is a CLI
> credential; Agent-SDK subscription use is undocumented and terms-restricted, so a subscription-funded runner
> spawns the CLI and the SDK is a later API-key backend (this *dissolves* the old spike-fork — see *Settled by
> research*); (2) `--input-format stream-json` is a **documented CLI channel** — since v2.1.205 a message sent
> mid-turn stays queued and runs as its own turn, a non-destructive same-process boundary channel; the
> PreToolUse deny-with-reason signal is an earlier but best-effort second channel and the two **compose**, and
> kill+`--resume` is the hard-redirect op, not a steer channel (this *shapes Fork 1*); (3) headless `-p`
> **aborts** on an unresolved permission (no prompt path), so every spawn needs a *closed* permission
> resolution, and a steer-via-deny gate must deny exactly once and pass the retry (this *shapes Fork 2*);
> (4) `we:scripts/guard-bash.mjs:410-414` proves the deny-with-reason wire shape in production; the in-repo
> claude-spawn precedent is `plateau:tools/dev-panel/vite-plugin.ts:404-457` (spawn `-p --output-format
> stream-json`, `--resume`, `SIGTERM`) — the proven half the runner generalizes.

## Red-team risks to fold into the forks (2026-07-11)

- **Subscription quota is a hard wall for a resident spawner.** A coordinator spawning agents continuously
  hits weekly/session caps in ways interactive use doesn't, and the pipeline then stalls on a rate limit.
  Every fork's default must keep quota-exhaustion an *observable* runner state, never a silent stall — see
  *Supported by default → quota-stall*.
- **The CLI contract is observed behavior, not an API.** `-p --output-format stream-json`, hook-gate denial
  injection, and `--resume` semantics ship breaking changes without notice. The runner must pin the tested
  CLI version + a spawn smoke-test and surface a mismatch — see *Supported by default → contract-drift budget*.
- **Steering only reaches an agent when it acts.** An agent deep in reasoning or writing prose is unreachable
  until the next turn boundary (queued-stdin) or its next tool call (hook-gate); kill+`--resume` discards
  in-flight work. Fork 1 rules on the *delivery guarantee* and treats early (mid-turn) delivery as best-effort.
- **The setup-token auth path is a CLI credential, not an SDK contract.** Resolved *against* an SDK phase-1
  backend (see *Settled by research*); a later SDK backend uses API-key auth behind the same interface.

## The question

The coordinator spawns Claude agents as supervised children. Phase 1 runs on the user's subscription, which
rules out the Agent SDK (API-key only per its auth docs) — so the backend spawns the `claude` CLI (`-p
--output-format stream-json`, `--resume`, `--model`, `--allowedTools`/`--permission-mode`), the pattern
`plateau:tools/dev-panel/vite-plugin.ts:404-457` already proves. This decision fixes the runner *interface* so
an SDK/API backend can slot in later without UI or orchestration changes. Three forks remain (steer delivery
guarantee, headless permission model, stop/redirect semantics); the auth backend and the interface's
backend-agnosticism are settled by research.

## Settled by research (forced invariants — not forks)

- **Auth backend = spawn the CLI on subscription.** `claude setup-token` mints a one-year OAuth token the CLI
  honors on Pro/Max; the Agent SDK documents API-key auth only and Anthropic's terms restrict third-party
  subscription use. The excluded branch (SDK on subscription in phase 1) is *broken*, not merely worse — so
  this is ratified, not forked. The SDK is a later **API-key** backend behind the same interface (it unlocks
  `interrupt()`, native queued input, `canUseTool`, `setModel()`), never the phase-1 path.
- **The interface is backend-agnostic.** `spawn/steer/stop/resume/observe` are named as backend-neutral ops so
  the SDK backend slots in later with no UI or orchestration change — the whole reason this is a *contract*
  decision and not just "spawn the CLI". Forced by the epic's later-backend goal.

## Fork 1 — the `steer(text)` delivery guarantee

*Fork exists:* the two coherent delivery guarantees cannot both hold — `steer()` either promises "lands, at
the next turn boundary, never dropped" or "lands as soon as the agent next acts, best-effort" — a consumer
plans differently for each, and one is a superset the CLI cannot actually deliver reliably. (Re-cast from a
channel fork per the two-confusion screen: the *channel* — queued-stdin vs hook-gate deny — is the impl; the
consumer-visible ruling is the **guarantee**.)

- **(a) boundary-delivery, queued, non-dropping** — `steer()` promises the text runs as its own turn at the
  next turn boundary and is never silently lost; it does NOT promise mid-turn interruption (that's Fork 3's
  `stop`). Impl: keep the child's stdin open in `--input-format stream-json` and write a queued
  `{"type":"user",…}` message. **DEFAULT.**
- (b) earliest-possible, best-effort — `steer()` promises to inject as early as the agent's next tool call
  (impl: PreToolUse deny-with-reason), accepting that it silently misses long pure-reasoning stretches and
  that a repeat-deny can abort the session.

**Default (a).** A consumer needs a channel it can *rely on* over one that lands sooner but may drop; (a) is
the only guarantee the documented CLI contract actually backs. Mid-turn earliness is offered later as an
*enhancement impl behind the same op* — a hook-gate that must still honor (a)'s never-drop floor and clear its
own spike (deny-once-and-pass-the-retry, catch-all matcher, operator-text framing). kill+`--resume` stays the
hard-redirect op (Fork 3), separate from `steer()`.

```ts
// Fork 1 (a) — steer promises boundary delivery; the impl is a queued user message on the open stdin.
proc = spawn(claudeBin, ['-p', task.prompt, '--output-format', 'stream-json',
                         '--input-format', 'stream-json', '--model', task.model], { stdio: ['pipe', 'pipe', 'pipe'] });
steer(text) { proc.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n'); }
// (b) contrast impl — earlier but best-effort, a PreToolUse deny (we:scripts/guard-bash.mjs:410-414 wire shape):
//   { hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: <operator text> } }  // deferred enhancement
```

`Skeptic: SURVIVES (near-precedent).` Attacked as "(a) is useless against a looping turn": that case is Fork
3's `stop`, not `steer`; and "ship (b) as primary" reintroduces the repeat-deny abort. Honest caveat the
skeptic surfaced — folded: (a) leans heavily on a *documented CLI contract*, so it is closer to
settled-by-precedent than a wide-open call; it stays a fork because (b) is a genuinely different, buildable
guarantee a consumer could reasonably want.
`Screen: flagged(impl) → fixed.` The screen caught the original framing ruling on the *channel* (impl); re-cast
to rule on the consumer-visible **delivery guarantee**, leaving stdin-vs-hook as the impl that must satisfy it.

## Fork 2 — the headless permission model

*Fork exists:* `-p` aborts on any *unresolved* permission — a resolution path that can leave one unresolved (a
gate that WAITS on a human mid-run) is broken; a non-blocking resolution and a human-blocking one cannot both
be the authoritative path without the blocking one aborting the session on latency.

- **(a) static per-task-type `--allowedTools` baseline + the repo's existing non-blocking write-time
  PreToolUse gates** — the allowlist fast-paths the safe calls; the *already-deployed* deterministic
  deny-with-reason hooks (`we:scripts/guard-bash.mjs`, lane-guard, locus-prefix) gate every risky action
  in-process with NO human wait. A deny *is* a resolution (fact 3: it reaches the model, which routes around
  it), so nothing goes unresolved and the session stays abort-proof — and this is *strictly more*
  abort-resistant than a bare allowlist, which hard-aborts on the first unlisted tool. **DEFAULT.**
- (b) per-tool approval routed to the Loop UI that WAITS for a human click — richer, but a slow/absent answer
  aborts the headless session, and it re-introduces a live interactive dependency the phase-1 builder (WIP=1,
  confirm+spend-gated *at launch*) doesn't need.

**Default (a).** The launch gate (eligibility + confirm + spend guard) plus the constellation's existing
write-time deny hooks already give per-action, deterministic, non-blocking supervision — the runner *composes
with* that gate, it does not replace it or move all gating to launch. A bare static allowlist is dominated (it
forces the under-provision-aborts / over-provision-is-theater dilemma); the *human-blocking* UI hook is the
excluded branch. A UI approval may still be added later as a non-blocking *notify-and-veto* (never a blocking
wait).

```ts
// Fork 2 (a) — allowlist baseline + inherit the repo's non-blocking write-time deny gates (no human wait).
const PROFILES = { build: { allowedTools: ['Read','Edit','Write','Bash(git *)','Bash(npm *)'], mode: 'acceptEdits' } };
spawn(task, p = PROFILES[task.kind]) => [..., '--allowedTools', p.allowedTools.join(','), '--permission-mode', p.mode];
// every spawned agent runs under the SAME PreToolUse hooks the repo already enforces (guard-bash etc.):
//   deny → { permissionDecision: 'deny', permissionDecisionReason: <why> }  // deterministic, in-process, recoverable
```

`Skeptic: REFUTED → default flipped.` The skeptic showed a bare static allowlist is dominated (under-provision
→ hard abort on an unlisted tool; over-provision / `bypassPermissions` → the allowlist is theater), and that
the rejected (b) was a strawman (only the *human-blocking* variant aborts). Flipped: the default now *requires*
the non-blocking deterministic policy gate, not "layered on later". **Statute-overlap — reconciled:** the
codified claim would be "a subscription-funded headless agent spawn ships a closed, non-blocking permission
resolution". Grepped `we:docs/agent/platform-decisions.md`; the same-turf rule is the **write-time shared gate**
(a PreToolUse hook that scans + denies at write time, #883). No collision — the runner *inherits and composes
with* that gate rather than defining a rival mid-run policy, and the codified anchor says exactly that.
`Screen: clear.` Consumer-visible (the tool/capability envelope an agent runs under differs observably) and
merit-bearing under free-build (abort-safety + recoverability vs a bare allowlist's brittle envelope).

## Fork 3 — stop / redirect semantics

*Fork exists:* a turn in flight can't be both let-finish and hard-killed; a stop that can only wait for a
boundary can't preempt a looping turn (which never reaches one) — exactly what a *supervised* stop must do — so
boundary-only is broken as the sole mechanism.

- **(a) graceful-boundary stop, escalating to `SIGTERM` on a timeout; `--resume` only for a clean continue,
  fresh-spawn for a redirect** — try to end at the next boundary (clean, no truncation); if the turn hasn't
  yielded within a timeout (looping / runaway), hard-kill. Continue an intentionally-paused session with
  `--resume <session>`; on a *redirect* (killed because it derailed), **fresh-spawn** rather than `--resume`
  (which would re-inject the poisoned context). **DEFAULT.**
- (b) hard `SIGTERM` first, always — preempts immediately but eats the undocumented mid-turn-truncation risk
  even when the turn was seconds from a clean boundary.

**Default (a).** Escalate-not-hammer: graceful first so a turn about to exit cleanly isn't truncated for
nothing, SIGTERM as the guaranteed backstop so a loop still gets preempted. `resume` continues; redirect
fresh-spawns. Discarded side effects are cheap **because edit-work lands in a throwaway lane clone**
(#2183/#2190) — a killed turn's half-written files never touch a durable tree; that dependency is what makes
"discard is cheap" true, so it is cited, not assumed.

```ts
// Fork 3 (a) — graceful-then-SIGTERM stop; resume=continue, fresh-spawn=redirect.
stop()          { endStdin(); const t = setTimeout(() => proc.kill('SIGTERM'), GRACE_MS); onTurnEnd(() => clearTimeout(t)); }
resume(text)    { spawn(claudeBin, ['-p', text, '--resume', sessionId, '--output-format', 'stream-json', ...]); } // clean continue
redirect(text)  { proc.kill('SIGTERM'); spawn(claudeBin, ['-p', text, '--output-format', 'stream-json', ...]); }  // fresh, no poisoned resume
```

`Skeptic: SURVIVES-WITH-AMENDMENT.` The bare "SIGTERM-first, WIP=1 makes discard cheap, `--resume` to redirect"
default was amended on three counts the skeptic proved: (1) **stop** = graceful-boundary-first, escalate to
SIGTERM on a timeout (don't truncate a turn about to exit); (2) **redirect** ≠ `--resume` — a turn killed for
looping must NOT be resumed (it re-injects the loop); fresh-spawn on a direction change, `--resume` only after
a clean pause; (3) the "cheap discard" claim is only true via the **lane-clone** dependency (#2183/#2190) —
now cited. Pure boundary-only (the old (b)) stays rejected (can't preempt a loop). No statute overlap; no
authority citation. `Screen: clear.` Consumer-visible (post-stop state + latency differ observably) and
merit-bearing under free-build (preemption-with-cleanliness vs brittle hammer).

## Supported by default (not forks)

- **`observe()` — a typed event stream** demuxed from `-p --output-format stream-json` NDJSON: `system/init`
  (session id), text deltas, tool events, final `result`. The one read surface all three forks feed.
- **Per-spawn `--model`** — exposed as the platform-config hook for later configurable / non-Claude models
  (works under one subscription today).
- **Quota-stall as an observable state** (red-team #1) — a rate-limit / quota-exhaustion surfaces as a distinct
  `observe()` event + a runner state, so the Loop UI pauses rather than silently stalling. A required property
  of *every* fork's default, not a fork.
- **CLI contract-drift budget** (red-team #2) — the runner pins the tested `claude` CLI version + runs a spawn
  smoke-test and surfaces a version mismatch as a runner error. Required property.

## Decision preview (glance table)

| Fork | The call | Default | Main alternative (excluded) |
|---|---|---|---|
| 1 | `steer(text)` delivery guarantee | **(a) boundary-delivery, queued, non-dropping** (stdin impl) | (b) earliest-possible, best-effort (hook-gate) — silently drops during reasoning, can abort |
| 2 | headless permission model | **(a) static allowlist + the repo's non-blocking write-time deny gates** | (b) human-blocking UI approval — a slow answer aborts the session |
| 3 | stop / redirect semantics | **(a) graceful→SIGTERM stop; resume=continue, fresh-spawn=redirect** | (b) SIGTERM-first always — truncates a turn about to exit cleanly |

*Settled by research (ratify, don't debate):* auth backend = CLI-spawn on subscription (SDK is a later API-key
backend); the interface is backend-agnostic. On ratify, `codifiedIn` records the runner interface module + a
`we:docs/agent/platform-decisions.md` anchor for "a subscription-funded headless agent spawn uses the CLI
backend behind a backend-agnostic interface, gating actions through the constellation's existing non-blocking
write-time deny hooks (composes with #883, does not replace it)".
