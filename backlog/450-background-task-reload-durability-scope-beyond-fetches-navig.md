---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
tags: [block, background-task, durability, background-fetch, navigation-guard, design-decision]
relatedProject: webintents
relatedReport: reports/2026-06-13-background-task-reload-durability.md
crossRef: { url: /blocks/background-task-surface/, label: Background Task Surface }
---

# Background Task reload-durability: scope beyond fetches + navigation-guard interaction

## Ruling (2026-06-13)

Both recommended defaults ratified, with two refinements:

- **Fork 1 → A.** `durability: reload` is defined **only** as transfer-backed durable *execution*
  (Background Fetch + SW adapter). Non-fetch long tasks stay route-only + the navigation guard. Durable
  *state* (checkpoint/resume) is a **distinct future guarantee**, not a redefinition of `reload`.
  - *Amendment 1 — reserve the term, don't ship a dead enum value.* `durability: resumable` is
    **reserved in the design/docs** as the future home for durable-state, but the **shipped config enum
    stays `route | reload`**. Declaring a config value the runtime can't yet satisfy would let authors
    set it and get nothing; the reservation alone is enough to stop `reload` from being later redefined.
- **Fork 2 → relax by default + mandatory degradation re-arm.** Arming `durability: reload` suppresses
  `navigationGuard: warn` for that task (author may force it back on). Where Background Fetch is
  unavailable and the tier degrades to route-only, the guard **re-arms** — a fixed mechanic, independent
  of the default polarity. `durability` and `navigationGuard` stay **independent dimensions**; durability
  only *derives* the guard's default, it does not merge with it.
  - *Amendment 2 — make the derivation observable, build-side.* Because the re-arm depends on a runtime
    feature-detect (is Background Fetch available at arm-time?), #134 must **feature-detect Background
    Fetch at arm-time** and make the re-arm **observable** (the guard visibly re-engages on the
    route-only fallback path). Not a fork — a build constraint this ruling creates.

**Unblocks #134** (clears its `450` blocker edge). Recorded above; the dimension graduates to the
standard when #134 builds it (`graduatedTo: none` on this decision item — the ruling is the artifact).

**Grounding.** Carved off **#134** (the `durability: reload` tier); #134 can't be built while these two
forks sit in its body (its 2026-06-10 pre-flight note released it from a batch for exactly this reason:
"unresolved design fork, no lean … needs a decision before building"). The owed platform-substrate pass
is published at
[/research/background-task-reload-durability](/research/background-task-reload-durability/) (report:
[we:2026-06-13-background-task-reload-durability.md](reports/2026-06-13-background-task-reload-durability.md)),
and **it dissolves OP-1's "no-lean" framing**: the survey shows the two branches aren't "small vs big
scope of one token" — they are **two different durability *guarantees*** (durable *execution* vs durable
*state*) that deserve two different tokens. That converts OP-1 into a clean default. **Both forks below
now carry a bold recommended default.**

## Axis framing

The decision decomposes into two coupled axes, both grounded in the shipped baseline:

- **Axis 1 — durable scope.** `durability` is a config dimension of the background-task intent,
  deliberately deferred to this tier — the baseline `BackgroundTasksConfig` carries no `durability` key
  ("`durability` lives in the #134 reload tier, not here" —
  [we:types.ts:114-139](blocks/background-task-surface/types.ts#L114)). The crux: the only native
  continue-while-closed substrate is [Background Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API),
  which models **transfers** only. The survey confirms **no native API runs arbitrary client-side
  compute in the background across a reload** (SW killed ~30s idle / 5min per event; Workers die with
  the page). The non-fetch option (checkpoint→IndexedDB→resume) is a **categorically weaker, different
  guarantee** — durable *state*, not durable *execution*.
- **Axis 2 — guard interaction.** The route-only baseline arms a beforeunload + Navigation-API confirm
  while tasks are active ([fui:BackgroundTasksElement.ts:332-359](blocks/background-task-surface/BackgroundTasksElement.ts#L332));
  `navigationGuard` is an independent boolean dimension ([we:types.ts:125](blocks/background-task-surface/types.ts#L125)).
  The crux: when work provably survives a reload, the warn-on-leave prompt (#129) double-signals — does
  arming `durability: reload` relax it?

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — durable scope** | **A · `durability: reload` = transfer-backed durable execution now; non-fetch becomes a distinct future `durability: resumable` (checkpoint/resume), not a rival definition** | B · define a non-fetch durable path under the same `reload` token | High — platform survey: no native durable-compute API; checkpoint/resume is a different guarantee |
| **2 — guard interaction** | **Relax `navigationGuard: warn` by default when `durability: reload` is armed; re-arm on degradation to route-only** | Keep `durability` and `navigationGuard` fully independent (warn stays unless explicitly disabled) | Medium-high — relax is sound UX; degradation re-arm closes the safety gap |

## Fork 1 — durable scope: transfer-backed execution vs a non-fetch durable path

**Crux.** The Background Task Intent covers "any long task", but Background Fetch only durably continues
**transfers**, and the survey confirms there is **no native home for durable non-fetch compute**. So
the tier's end-state genuinely differs by branch — *but the real distinction is the guarantee, not the
scope*: durable **execution** (work continues while you're away) vs durable **state** (work pauses; a
save-point survives; the user resumes on return). See the
[report](reports/2026-06-13-background-task-reload-durability.md) finding tables.

- **A — `durability: reload` = transfer-backed durable execution; non-fetch is a separate token
  (default).** Define `durability: reload` only against the native continue-while-closed substrate
  (Background Fetch + SW adapter). Non-fetch long tasks stay route-only + the navigation guard. Honest
  to the platform; smaller, verifiable scope; the intent's "any long task" narrows to "any long
  *transfer*" for *this* tier. **If** the resumable story is ever wanted, it becomes a **distinct
  `durability: resumable`** value with explicit checkpoint/resume (durable *state*) semantics — not
  folded into `reload`.
- **B — define a non-fetch durable path under the same `reload` token.** Add a checkpoint/resume (or
  worker + persisted-state) mechanism and call it `durability: reload` too. Matches the intent's "any
  long task" wording literally, but **conflates two different guarantees** under one word: an author
  arming `durability: reload` would expect background continuation and get only crash recovery. Far
  harder to verify (no SW/Background-Fetch parallel) and an overclaim.

**Default: A.** The platform offers exactly one continue-while-closed substrate (transfers); naming the
tier after it is honest and verifiable. The broader ambition isn't forfeited — it's *renamed*: durable
*state* gets its own honest token (`durability: resumable`) rather than diluting `reload`. Recommend
**pre-naming `durability: resumable` in the dimension's vocabulary now, building it later** (keeps #134
buildable; reserves the honest term).

*Rejected — B:* folding two guarantees into one token is the overclaim the native-first stance forbids
; a different guarantee deserves a different name, not a redefinition.

## Fork 2 — does `durability: reload` relax `navigationGuard: warn`?

**Crux.** When work provably survives a reload, the warn-on-leave prompt (#129) warns about a loss that
won't happen — a double-signal on a genuinely durable task.

- **Relax by default (default).** Arming `durability: reload` suppresses `navigationGuard: warn` for
  that task — no need to warn about losing work that survives. The author can still force the warn.
- **Keep both fully independent.** Warn stays unless explicitly disabled; safer-by-rote but
  double-signals on a genuinely durable task, and pushes the coupling onto every author.

**Default: relax by default**, with a **mandatory degradation re-arm**: where Background Fetch is
unavailable and the tier falls back to route-only, the guard **re-arms** (the work no longer survives) —
this re-arm is a *fixed mechanic*, independent of the default polarity. Relax is the most-permissive,
least-noisy choice, and the degradation re-arm makes it safe.

*Rejected — keep-independent-by-default:* it institutionalizes a redundant prompt on durable tasks and
makes every author hand-wire the relaxation; the degradation re-arm already covers the only case where
the warn is still needed.

*Coupling note (bias toward separation upheld):* `durability` and `navigationGuard` stay **independent
dimensions** — durability only *derives the guard's default*, it does not merge with it
. The author retains override of both.

## Per-fork classification (the 7-question pass)

Applied to the `durability: reload` tier (full detail in the
[report](reports/2026-06-13-background-task-reload-durability.md)):

1. **Layer:** the `durability` dimension + `withReloadDurability` trait = standard (WE
   `blocks/background-task-surface` + the background-task intent); the Background-Fetch/SW adapter (real
   impl) → Frontier UI.
2. **Protocol/intent dimension:** a **dimension** (`durability: route → reload → future resumable`).
   The Background-Fetch substrate is an **implementation** satisfying the tier, registered as a
   capability resolver impl — *not* a new protocol.
3. **Expose the whole axis:** yes — `durability`'s values are each legitimate end-states, so it stays a
   configurable dimension.
4. **Fixed mechanic vs dimension:** `durability` is a dimension; **graceful degradation to route-only
   when Background Fetch is absent is a fixed mechanic** (and Fork 2's guard-re-arm trigger).
5. **DI-injectable:** yes — the durability adapter is injected behind a capability resolver; absence
   degrades to route-only.
6. **Most-permissive default:** **native-first overrides** here — `durability` defaults to `route`
   (baseline) and `reload` is the author's opt-in enhancement, not a baseline dependency
  . Within the guard sub-axis, the least-noisy choice (relax) wins.
7. **Seam between intents:** background-task (`durability`) × navigation-guard (#129) × loader
   (rehydrated state). Fork 2 *is* that seam — resolved by default-derivation, not a merge.

## Concrete refs

- Parent tier: [we:134-background-task-reload-durable-tier.md](/backlog/134-background-task-reload-durable-tier/)
  (open questions, lines 26-28; pre-flight fork note, lines 35-48; `blockedBy: ["128","135","450"]`).
- Baseline config (no `durability` key) + guard boolean:
  [we:types.ts:114-139](blocks/background-task-surface/types.ts#L114).
- Route-only guard impl (beforeunload + Navigation-API confirm):
  [fui:BackgroundTasksElement.ts:327-359](blocks/background-task-surface/BackgroundTasksElement.ts#L327).
- Baseline & guard items: [#128](/backlog/128-background-task-status-bar-block/) (route-only baseline),
  [#129](/backlog/129-navigation-guard-intent/) (`navigationGuard: warn` → navigation-guard intent).
- Prior-art survey: [report](reports/2026-06-13-background-task-reload-durability.md) ·
  [/research/ topic](/research/background-task-reload-durability/).

Note: #134 also needs a real-browser/SW **verification strategy** for the durability claim (its
pre-flight point 2) — a build-harness concern, not a fork, and not part of this decision.
