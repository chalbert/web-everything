# Trace/replay substrate (webtraces + webevents) — prior-art survey for decision #992

> Prep research for [#992](/backlog/992-design-the-trace-replay-substrate-webtraces-webevents-the-14/)
> (the [#140](/backlog/140-dev-surface-product-feature-matrix/) keystone). Published as the `/research/`
> topic **trace-replay-substrate**. No design exists yet; this survey grounds the forks ahead of the call.

## The concern

webtraces and webevents are `concept` projects with no design item. [#140](/backlog/140-dev-surface-product-feature-matrix/)
identifies a **trace/replay artifact** — *a declared state snapshot + an ordered action trace* — as the
single substrate that unblocks three of its features: **6 state explorer**, **9 dev error-repro**, **10
in-context bug report** ("Build once" — #140 line 70). The keystone question: what *is* that artifact, and
**what makes replaying it deterministic** — specifically, is webevents' injector-scoped event identity
*load-bearing for replay determinism* (the fork #992 names)?

## What already exists in the tree (no design needed — compose, don't reinvent)

The replay record's parts are **already specified** across four projects. The survey's first finding is that
almost nothing here is greenfield except the **envelope that binds them into one replayable artifact**:

| Part of a replay record | Already specified by | Where |
|---|---|---|
| **State snapshot** (declared initial state) | webcontexts SSR serialization (`<script type="context">`, shared JSON format with webstates SSR) | `we:src/_includes/project-webcontexts.njk:225-245`; plug `we:plugs/webcontexts/` |
| **State-transition journal** (the deterministic layer) | webstates **`ChangeRecord`** `{ path, op, oldValue, newValue, source, timestamp, version }` + `CustomChangeStrategy` | `we:src/_includes/project-webstates.njk:136`, `we:src/_includes/project-webstates.njk:167` |
| **State↔trace correlation** (already wired!) | webstates `ChangeSource.traceparent` — optional W3C Trace Context link from each change to the initiating span | `we:src/_includes/project-webstates.njk:149` |
| **Action identity** (which action, told apart from collisions) | webevents `listenForScoped` — injector-resolved typed event class, `instanceof`-discriminated | `we:src/_includes/project-webevents.njk:14`, `we:src/_includes/project-webevents.njk:164` |
| **Span / trace timeline** | webtraces `trace-observability` protocol — OTel/W3C-aligned spans, `trace(value)` / `effect(operation)` | `we:src/_includes/project-webtraces.njk:69-101`; protocol `we:src/_data/protocols.json:37-43` |
| **Immutable operational history** (don't duplicate) | webaudit `AuditEvent` — already *reuses* the ChangeRecord shape; `correlationId` links a webtraces span | `we:src/_data/protocols.json:154` |
| **Durable outbox / replay** (out of scope here) | webreliability owns it (per #011 Option A) | `we:src/_data/protocols.json:63` |

So the substrate is a **composition**, not a new state-diff format. webstates already carries
`traceparent` on every change — the state↔trace seam #992 worries about is *already drawn*. The only new
contract is the **session-replay envelope** that bundles `snapshot + ordered trace + change-journal +
correlation ids` into one artifact.

## Web prior art — three replay paradigms, and which fits

The web survey (Redux DevTools, rrweb, replay.io, event sourcing) returns **three** distinct ways to make
replay deterministic — this reshapes the named binary fork into an A/B/C:

- **A. State-diff re-application (rrweb-style).** Record a full initial snapshot, then every subsequent
  mutation as a timestamped delta; replay re-applies each delta *in order, executing no application JS*.
  Deterministic **by construction** — "rrweb doesn't execute any JavaScript during replay … records the
  creation of the dropdown DOM nodes rather than replaying the original JavaScript." Lightweight; captures
  *what changed*, not *why*. **Maps directly to the webstates `ChangeRecord` journal.**
- **B. Action re-fold through pure handlers (Redux / event-sourcing).** Record actions; replay by
  re-running them through the reducer. Deterministic **only because reducers are pure** — "each state
  transition is deterministic and pure, [so] it becomes possible to record every action and state change
  and replay actions to reproduce bugs." Captures behavior; here **event identity is load-bearing** (an
  action must re-dispatch to the right handler). Fragile if any handler is impure / async-timing-dependent.
- **C. Runtime deterministic re-execution (replay.io).** Record *all* sources of non-determinism (network,
  user events, thread interleaving) at the runtime level and re-execute. Gold-standard determinism but
  **heavyweight** — a recording runtime. #140 explicitly scopes this **out**: feature 9 is a "lightweight
  **local, semantic** repro (declared state + action trace), not a sampled DOM video … *Not a Sentry
  competitor*" (#140 line 61).

**Reading for WE:** the #140 constraint (lightweight, local, semantic) rules out **C**. Between **A** and
**B**: a self-describing WE app *already emits* its state transitions as `ChangeRecord`s with `traceparent`,
so **A** is deterministic for free and needs no purity assumption. **B**'s value is *comprehension* — the
action trace tells a human *which action caused which diffs* — which webevents identity + webtraces spans
supply as the **annotation layer over** the journal, not as the replay mechanism.

## The answer to #992's named fork

**Is webevents event-identity load-bearing for replay determinism? — No for determinism, yes for
correlation.** Determinism is anchored on the webstates `ChangeRecord` journal (paradigm A): re-applying
recorded diffs is deterministic without re-running handlers, so the replay does not depend on resolving an
event's injector-scoped class. webevents identity *is* load-bearing for the **comprehension/correlation**
layer — it's how a span (webtraces) labels *which* action (told apart from same-named collisions across
teams, per `listenForScoped`) produced the journal entries underneath it. The artifact carries **both**
layers; only the journal is the determinism anchor.

## Classification (per-fork pass)

- **Layer:** the envelope is a **Protocol** (a conformance record independent tools — explorer, repro,
  bug-report exporter — read), composed of existing protocols. Not a Block (no runtime engine minted here),
  not an Intent (no UX "what").
- **Protocol vs intent dimension:** genuinely a protocol — multiple independent consumers (state explorer,
  error-repro, bug-report capture, and any third-party devtool) must read the same record shape; that's the
  interop story a protocol exists for.
- **Home:** webtraces is already "execution flow monitoring + distributed tracing," OTel/W3C-aligned — a
  session-replay record *is* an ordered trace + a correlated snapshot. Minting a new `webreplay` project
  fragments for no interop gain.
- **Separate-and-decouple:** honored by *referencing* the four existing protocols rather than absorbing a
  state-diff format into webtraces. The envelope is thin: snapshot ref + ordered span list + journal ref +
  correlation ids.

## Forks this grounds (full shape in #992)

1. **Determinism anchor — A state-diff journal (default) / B action re-fold / C runtime re-exec (rejected,
   out of scope).** Answers the named event-identity question.
2. **Home of the session-replay envelope protocol — webtraces (default) / new webreplay project / split.**

## Sources
- [Redux time-travel debugging (studyraid)](https://app.studyraid.com/en/read/12414/400817/time-travel-debugging-in-redux) · [Redux DevTools (hmos.dev)](https://hmos.dev/en/how-to-time-travel-debugging-at-redux-devtools)
- [rrweb README](https://github.com/rrweb-io/rrweb) · [How session replay works — Observer (dev.to)](https://dev.to/yuyz0112/how-does-session-replay-work-part2-observer-4jmg) · [rrweb replay docs](https://github.com/rrweb-io/rrweb/blob/master/docs/replay.md)
- [Replay.io — Recording and Replaying](https://blog.replay.io/recording-and-replaying) · [Effective Determinism](https://medium.com/replay-io/effective-determinism-54cc91f5693c)
- W3C Trace Context · OpenTelemetry (already cited in `we:src/_includes/project-webtraces.njk`)
</content>
