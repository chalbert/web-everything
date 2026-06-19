---
type: decision
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#composition-artifact-ownership"
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-trace-replay-substrate.md
tags: []
---

# Design the trace/replay substrate (webtraces + webevents) — the #140 dev-surface keystone

**Prepared 2026-06-19.** No design exists yet; the two forks below are grounded in a prior-art survey
published as the [`/research/` topic **trace-replay-substrate**](/research/trace-replay-substrate/)
(session report `relatedReport`). The survey's headline reframes the item: the replay record's *parts are
already specified* across four projects, so the substrate is a **composition**, not greenfield — the only
new contract is the thin **session-replay envelope**. Each fork carries a **bold** recommended default.

## The axis

A "trace/replay artifact" (declared state snapshot + ordered action trace, per
[#140](/backlog/140-dev-surface-product-feature-matrix/) features 6/9/10) decomposes into parts that
**already exist** in the tree — the survey's first finding:

- **Snapshot** — webcontexts SSR serialization (`<script type="context">`, JSON format shared with webstates
  SSR): `we:src/_includes/project-webcontexts.njk:225-245`; plug `we:plugs/webcontexts/`.
- **State-transition journal** (the deterministic layer) — webstates `ChangeRecord {path, op, oldValue,
  newValue, source, timestamp, version}` + `CustomChangeStrategy`: `we:src/_includes/project-webstates.njk:136`,
  `we:src/_includes/project-webstates.njk:167`.
- **State↔trace correlation — already wired** — webstates `ChangeSource.traceparent` links each change to
  the initiating span: `we:src/_includes/project-webstates.njk:149`.
- **Action identity** — webevents `listenForScoped`, injector-resolved typed event class, `instanceof`-discriminated:
  `we:src/_includes/project-webevents.njk:14`, `we:src/_includes/project-webevents.njk:164`.
- **Span timeline** — webtraces `trace-observability` protocol (OTel/W3C-aligned, `trace()`/`effect()`):
  `we:src/_includes/project-webtraces.njk:69-101`; `we:src/_data/protocols.json:37-43`.
- **Immutable history (don't duplicate)** — webaudit `AuditEvent` already *reuses* `ChangeRecord`;
  `correlationId` links a span: `we:src/_data/protocols.json:154`.

Two things therefore remain genuinely open: **what anchors replay determinism** (which answers the item's
named "is webevents event-identity load-bearing" question), and **which project owns the new envelope
protocol**. Everything else is *supported by default* (below the divider).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Determinism anchor | **A — state-diff journal (webstates `ChangeRecord`); event-identity is correlation-only, not load-bearing for determinism** | B — action re-fold through pure handlers | High |
| 2 · Home of the session-replay envelope protocol | **webtraces owns it, composing the four parts by reference** | new `webreplay` project | Med-high |

## Fork 1 — what anchors replay determinism?

*Fork-existence:* the determinism guarantee must rest on **exactly one** canonical source — you either treat
recorded **state diffs** as ground truth (re-apply them) **or** recorded **actions** as ground truth (re-run
them); the two cannot both *be* "the determinism anchor" (a real either/or). This is the item's named fork —
"is webevents event-identity load-bearing for replay determinism" — sharpened by the survey's three
paradigms (rrweb / Redux / replay.io).

Crux: a self-describing WE app *already emits* its state transitions as `ChangeRecord`s carrying
`traceparent` (`we:src/_includes/project-webstates.njk:136`, `:149`), so the journal is available with no new
capture machinery.

- **A — state-diff re-application (rrweb model). [recommended]** Replay re-applies recorded `ChangeRecord`s
  to the snapshot, **executing no application JavaScript** — deterministic *by construction*, needs no
  purity assumption. **Consequence: event identity is NOT load-bearing for determinism**; webevents
  `listenForScoped` identity stays as the *correlation* layer (which action caused which diffs), surfaced on
  the webtraces span. Tradeoff (merit): captures *what changed*, not a re-execution of *why* — correct for
  #140's "lightweight local semantic repro, not a DOM video" scope (#140 feature 9).
- **B — action re-fold through pure handlers (Redux/event-sourcing model).** Replay re-runs recorded actions
  through their handlers; webevents injector-scoped identity *is* load-bearing (re-dispatch must hit the
  right handler). Tradeoff (merit): captures behavioral re-execution, but determinism holds **only if every
  handler is pure and async-timing-independent** — a guarantee WE cannot make for arbitrary app code, so the
  anchor is fragile. *Rejected as the anchor* (it remains a valid optional behavioral-replay mode layered on
  top of A).
- **C — runtime deterministic re-execution (replay.io model).** Record all non-determinism sources and
  re-execute. *Rejected: out of scope* — a recording runtime is the heavyweight DOM-video class #140
  explicitly excludes (feature 9: "Not a Sentry competitor").

**Recommended: A.** Determinism anchors on the webstates change-journal; webevents event-identity is
load-bearing for **correlation/comprehension only**, not determinism. *Red-team note for the decider:* the
attack on A is "then why keep the action trace at all?" — answer: the action trace is the human-meaningful
layer (the explorer/bug-report UX in #140 features 6/10) that *labels* the journal; A keeps it as annotation,
it does not drop it.

## Fork 2 — which project owns the session-replay envelope protocol?

*Fork-existence:* the envelope (`snapshot ref + ordered span list + change-journal + correlation ids`) is a
single new contract that must have **exactly one** owning project — webtraces and a new `webreplay` project
cannot both declare it (a real either/or).

Crux: the parts are owned by webcontexts/webstates/webevents/webtraces already; only the *binding envelope*
is new. webtraces is already "execution flow monitoring + distributed tracing," OTel/W3C-Trace-Context
aligned (`we:src/_includes/project-webtraces.njk:2`, `:95-101`).

- **webtraces owns it, composing the others by reference. [recommended]** A session-replay record *is* an
  ordered trace (spans) + a correlated state snapshot — squarely webtraces' charter. Envelope stays thin:
  it references the webcontexts snapshot, the webstates journal, and the webevents-identified spans rather
  than redefining any. Tradeoff (merit): keeps the four protocols decoupled and composed (the standing
  separate-and-decouple bias) with no new project surface.
- **New `webreplay` project.** *Rejected:* replay is a *consumer composition* of trace + state + events, not
  a new vendor-interop surface — minting a project fragments the constellation for no interop gain
  (minimize-lock-in: a protocol is the single escapable lock, never reached for casually).
- **Split the envelope across webtraces + webstates.** *Rejected:* a single artifact with two owners has no
  canonical schema home; the journal already lives in webstates and is *referenced*, so no ownership split
  is needed.

**Recommended: webtraces owns the session-replay envelope protocol**, composing webcontexts (snapshot),
webstates (journal — the determinism layer), webevents (action identity — correlation), and its own spans.

---

## Ratified — 2026-06-19

Both defaults ratified after an inline + skeptic-sub-agent red-team. Confidence: Fork 1 **High**,
Fork 2 **Med-high**.

**Fork 1 — determinism anchor: A (state-diff re-application), AMENDED.** Replay re-applies recorded
webstates `ChangeRecord`s to the snapshot, executing no application JS; webevents event-identity is the
**correlation** layer, not the determinism mechanism. B (action re-fold) is **not** the anchor but
remains a valid *optional* behavioral-replay mode layered on top.

*Amendment from the red-team* (skeptic landed a bounded-scope point; `ChangeRecord` is self-describedly
*"a lossy lingua franca for observation"* with no RFC-6902 `test`/precondition op —
`we:src/_includes/project-webstates.njk:132`,`:135`). A is deterministic **over journaled state only**,
not unconditionally "by construction." The envelope contract MUST therefore carry:
1. **A snapshot↔journal consistency precondition** — the snapshot reference includes a version/hash
   (`ChangeRecord.version` already exists as a causal/optimistic-concurrency token, `:144`) that the
   journal asserts it applies onto; replay refuses (or flags) a drifted snapshot rather than applying
   diffs blindly.
2. **An explicit off-journal-state boundary** — non-journaled state (imperative DOM focus/scroll, refs,
   non-store locals) is **out of replay scope** by contract. For faithful repro of off-journal effects,
   the optional B behavioral-replay mode (re-fold actions through handlers) is the documented escape
   hatch — there, webevents identity *is* load-bearing.

So the corrected answer to the item's named fork: **event-identity is not load-bearing for
*journaled-state* determinism; it is load-bearing for (a) correlation/comprehension and (b) the optional
B behavioral-replay mode.** (webstates already anticipates this: `ChangeSource.channel` includes a
`'replay'` value, `:148`.)

**Fork 2 — envelope home: webtraces.** webtraces owns the thin **binding/ordering envelope** (ordered
session of spans + correlated refs to the webcontexts snapshot, the webstates journal, and the
webevents-identified spans), redefining none of the four referenced schemas. The journal **payload
schema stays owned by webstates** and is referenced, not absorbed — this is the seam the skeptic's
"owner chosen by the annotation" attack missed: the envelope's *own* substance is the ordered timeline
(a trace concept), while the determinism payload it points at lives in webstates. Because the envelope
is thin, OTel/W3C span-schema evolution in webtraces does not churn replay-artifact stability (the
cadence-collision the split option suffers). `webreplay` rejected (fragments the constellation for no
interop gain — minimize-lock-in); split rejected (no canonical schema home).

## Context

### Supported by default (not decisions)

- **Compose the four existing parts; do not mint a new state-diff format.** Reinventing the journal would
  duplicate webstates `ChangeRecord` and webaudit `AuditEvent` (`we:src/_data/protocols.json:154`) — a
  forced invariant, not a choice.
- **webevents identity = the correlation annotation** on each span (told apart from same-named cross-team
  collisions, the exact problem `listenForScoped` solves). Follows from Fork 1-A.
- **Snapshot source = webcontexts SSR serialization** (`<script type="context">`) plus webstates store
  serialization; the envelope adds only a *manifest* of which injectors/stores to capture, not a new
  serializer.
- **Durable outbox/replay stays webreliability**, not this envelope (#011 Option A); this artifact is the
  *local, in-session* record, not a durable transport.

### Relationships & graduation

- **Demand:** [#140](/backlog/140-dev-surface-product-feature-matrix/) features 6 (state explorer), 9 (dev
  error-repro), 10 (in-context bug report) — "Build once." State already introspectable via
  [#092](/backlog/092-provider-consumer-graph-platform-manager/) /
  [#400](/backlog/400-verify-extend-we-introspection-to-emit-provider-consumer-edg/).
- **Parent:** [#991](/backlog/991-standards-concept-to-built-surfacing-audit-close-the-gap-bet/)
  surfacing audit (webtraces/webevents are GAP `concept` projects with no owner).
- **Graduation (on ratification):** spin out a `blockedBy` build chain — (1) the webtraces session-replay
  envelope protocol contract + conformance vectors; (2) flip webtraces/webevents `concept → poc` once the
  contract lands; (3) the #140 feature builds (6/9/10) ride the envelope. These are separately-prioritized
  builds, not authored here.
</content>
