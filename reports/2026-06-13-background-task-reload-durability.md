# Background Task reload-durability — scope & guard interaction (prep research for #450)

**Date:** 2026-06-13
**Backlog:** [#450](../backlog/450-background-task-reload-durability-scope-beyond-fetches-navig.md)
(decision) · unblocks [#134](../backlog/134-background-task-reload-durable-tier.md) (the
`durability: reload` tier build) · baseline [#128](../backlog/128-background-task-status-bar-block.md),
guard [#129](../backlog/129-navigation-guard-intent.md)

## The question

The Background Task Surface ships a **route-only** baseline: a task survives SPA route changes
in-memory, but a full reload or tab close loses in-flight work; `navigationGuard` arms a
beforeunload + Navigation-API confirm to *gate* that loss rather than recover from it
([we:types.ts:119-139](../blocks/background-task-surface/types.ts#L119),
[fui:BackgroundTasksElement.ts:332-359](../blocks/background-task-surface/BackgroundTasksElement.ts#L332)).
The `durability` dimension is explicitly deferred to the #134 reload tier
([we:types.ts:117](../blocks/background-task-surface/types.ts#L117)). #450 carves the two forks that gate
that build: **(OP-1) durable scope — transfers-only vs a non-fetch durable path; (OP-2) does arming
`durability: reload` relax `navigationGuard: warn`?**

OP-1 was framed as "the real either/or, no lean." This survey runs the owed platform-substrate pass
and **dissolves that framing**: the two branches are not "small vs big scope of one token" — they are
**two different durability *guarantees*** that deserve two different tokens, which gives OP-1 a clean
default (A now; B as a *distinct* future tier, not a competing definition of `reload`).

## Prior-art survey — what the platform actually guarantees

Full agent survey grounds the table below; the decisive distinction is **durable *execution*** (work
continues while you are away) vs **durable *state*** (work pauses; only a save-point survives).

| Primitive | Guarantee | Runs arbitrary compute? | While tab closed | Support |
|---|---|---|---|---|
| **Background Fetch** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API), [spec](https://wicg.github.io/background-fetch/)) | Browser/OS owns a **transfer**; continues while page **and** SW are closed; SW re-hydrated via `backgroundfetchsuccess` + `waitUntil` | **No** — predetermined `Request`/`Response` pairs only | **Continues** | Chromium-only, not Baseline |
| **Service Worker** lifetime ([MDN PWA guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)) | Event-driven; killed ~30s idle / 5min per event | No long compute host | n/a | Baseline |
| **Background Sync / Periodic Sync** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)) | Defer network work until connectivity; best-effort, SW-driven, time-capped | No | Best-effort wake | Chromium-only |
| **Web Locks** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)) | Cross-context coordination only; lock dies with its context | n/a | **No** (released on close) | Baseline |
| **Checkpoint → IndexedDB → resume** ([checkpoint-restart](https://www.sciencedirect.com/topics/computer-science/checkpoint-restart)) | Periodic save-points; **resume from last checkpoint when the user returns** | Yes (it's just your code persisting state) | **Paused** — nothing runs | Universal (IndexedDB) |

### The two findings that settle OP-1

1. **There is no native API that runs arbitrary client-side computation in the background surviving a
   reload/close.** Every platform background primitive is transfer-shaped, network-defer-shaped, or
   push-shaped — all SW-event-driven and time-capped. Web Workers die with the page; the SW is killed
   at ~30s idle / 5min per event. So "run my long compute while the user is away" is **not a thing the
   platform offers.**
2. **Checkpoint/resume is a fundamentally *weaker, different* guarantee than Background Fetch.**
   Background Fetch = **continue-while-closed** (durable execution, browser-owned). Checkpoint→IndexedDB
   = **pause + resume-on-return** (durable *state*; zero progress while away, the user re-runs from the
   last save). Labeling both `durability: reload` would let an author expect background continuation and
   receive only crash recovery — an overclaim.

This is the reshaping: OP-1 is not "bound the tier vs extend it." It is "ship the honest
continue-while-closed tier now (`durability: reload`, transfer-backed), and *if* the resumable story is
ever wanted, give it its own honest token (`durability: resumable` / checkpointed) — never fold a
different guarantee into the same word."

### Vocabulary worth borrowing (no invented jargon)

- **durable execution** (continues while closed) vs **durable state** (pauses, state survives) — the
  framing axis.
- **`durability: reload`** = transfer-backed continue-while-closed (Background Fetch).
- **`durability: resumable`** (proposed future value) = checkpointed / resume-on-return (IndexedDB
  state rehydration). Community terms: *checkpoint / checkpoint-restart*, *resumable*, *state
  rehydration*.
- **functional event + `waitUntil`** — the SW re-hydration mechanism.

## Recommendation (grounds #450)

1. **Fork 1 (OP-1) — scope: ship A now; B is a distinct token, not a rival definition.**
   `durability: reload` is defined as **transfer-backed durable execution** (Background Fetch + SW
   adapter), honest to the only native continue-while-closed substrate. Non-fetch compute does **not**
   get folded in; *if* wanted later it becomes a separate **`durability: resumable`** value with
   explicit checkpoint/resume (durable *state*) semantics. Keeps #134 buildable and verifiable without
   overclaiming.
2. **Fork 2 (OP-2) — relax `navigationGuard: warn` by default when `durability: reload` is armed**, and
   **re-arm the guard on degradation** to route-only (where Background Fetch is unavailable, the work no
   longer survives, so the warn must return).

## Per-fork classification (the fixed 7-question pass)

Applied to the `durability: reload` tier:

1. **Layer:** the `durability` dimension + `withReloadDurability` trait = standard (WE
   `blocks/background-task-surface` + the background-task intent); the Background-Fetch/SW adapter (real
   impl) → Frontier UI. ([we:types.ts:117](../blocks/background-task-surface/types.ts#L117) already scopes
   `durability` to the #134 tier.)
2. **Protocol or intent dimension?** A **dimension** of the background-task intent (`durability: route`
   baseline → `reload` tier → future `resumable`). The Background-Fetch substrate is an
   **implementation** that satisfies the tier, registered as a capability resolver impl — *not* a new
   protocol ([[feedback_impl_is_not_a_standard]]).
3. **Expose the whole axis?** Yes — `durability` is a real axis whose values are each legitimate
   end-states (route / reload / resumable), so it stays a configurable dimension.
4. **Fixed mechanic vs dimension?** `durability` is a dimension; **graceful degradation to route-only
   when Background Fetch is absent is a fixed mechanic** (and the trigger for OP-2's guard re-arm).
5. **DI-injectable?** Yes — the durability adapter (Background Fetch + SW) is injected behind a
   capability resolver; absence degrades to route-only.
6. **Most-permissive default?** Here the **native-first** principle overrides the most-permissive
   default: `durability` defaults to `route` (baseline), and `reload` is the author's **opt-in
   enhancement** — the platform's durable answer is an enhancement, not a baseline dependency
   ([[feedback_native_first_default]]). Within the *guard* sub-axis, the most-permissive choice is to
   not double-signal (relax) — see Fork 2.
7. **Seam between intents?** background-task (`durability`) × navigation-guard (#129, `warn`) × loader
   (rehydrated state). Fork 2 *is* that seam. **Bias toward separation upheld:** keep `durability` and
   `navigationGuard` independent dimensions; durability only *derives the guard's default* (relax) — a
   default-derivation, not a merge. The author can still force either.

## Confidence

- **Fork 1: high.** The platform survey is unambiguous — no native durable-compute API exists, and
  checkpoint/resume is a categorically different guarantee. Ship-A-now with B as a distinct token is the
  honest call; the only judgment is whether to pre-name `durability: resumable` (recommended: name it,
  don't build it).
- **Fork 2: medium-high.** Relaxing the warn is sound UX (don't prompt about loss that won't happen),
  and the degradation re-arm closes the safety gap. The residual judgment is purely default polarity
  (relax-by-default vs keep-independent); both are safe, and the degradation re-arm makes relax safe.
