---
type: decision
workItem: task
parent: "1038"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: 1201
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-observable-state-registry.md
tags: []
---

# webcases observable-state registry semantics for then.observe grounding

**Prepared (2026-06-20).** No observable-state registry exists yet — the webcases validator grounds
five of six requirement slots hard but leaves `then.observe` un-groundable. The three forks below are
grounded in a prior-art survey published as [`/research/observable-state-registry/`](/research/observable-state-registry/)
(session report `we:reports/2026-06-20-observable-state-registry.md`), each carrying a recommended
default in **bold**. The web platform already ships the vocabulary; this decision picks how WE adopts it.

## Ratified ruling (2026-06-20)

All three forks ratified at their **bold default** — `A / A / A`:

- **Fork 1 · Home → A, co-locate observables on the protocol record.** An observable has no identity
  outside the protocol that exposes it, exactly as a `given.value` has none outside its intent→dimension
  (`we:webcases/requirementValidator.ts:91-101`); `then.observe` resolves *within* the already-resolved
  `then.protocol`. One source of truth, no flat-namespace collisions, rides the `registries.protocols`
  seam already injected. The standing *bias toward separation* governs **independent** concerns — this is
  a dependent sub-entity, so the precedent overrides. **Confidence: High.**
- **Fork 2 · Grammar → A, typed `{ id, kind: 'state' | 'event', platform? }`.** `kind` is the load-bearing
  read-vs-await signal the #1162 case→test bridge must execute (`we:webcases/compileRequirement.ts:65`);
  a flat string list starves the one consumer. `kind` is a **closed** two-value enum (the platform offers
  exactly two observation modes); `platform` is the optional ARIA token / `:state()` ident / DOM event
  type, native-first, omitted for protocol-internal observables. **Confidence: Med-high** (residual: a
  finer state-subtype is carried by `platform`, not a third `kind`).
- **Fork 3 · Rollout → A, progressive grounding.** `then.observe` grounds **hard** (`error`) when the
  resolved protocol *declares* an `observables` list and the token is absent; stays `info` when the
  protocol declares none. Honors *most-permissive default* + *graceful-degradation*; flag-day (B) would
  break the shipped fixture (`we:webcases/__tests__/requirementValidator.test.ts:30`) for no migration
  gain. **Confidence: High.**

Graduated to the build slice filed in **§Graduation**. Reusable principle worth remembering: *a dependent
sub-entity co-locates on its parent registry record and resolves nested, mirroring `given.value`;
separation-bias is for independent concerns only.*

## The axis

The validator (`we:webcases/requirementValidator.ts`) grounds every typed requirement slot HARD against
a live, injected registry — `role`→roster, `given.{intent,dimension,value}`→`we:intents.json` (nested,
`we:webcases/requirementValidator.ts:91-101`), `when.event`→`we:semantics.json`, `then.protocol`→
`we:protocols.json`, `then.tier`→the fixed `L1/L2/L3` vocab — so an unresolved reference fails *at author
time*. The one exception is **`then.observe`** (the observable state or event the protocol exposes that
the conformance case asserts): it falls through to an `info` finding because `we:protocols.json` models no
observable states (`we:webcases/requirementValidator.ts:115-125`). The concern decomposes into three
orthogonal axes the survey surfaced: **home** (where the observable vocabulary lives), **grammar** (the
shape of an observable entry), and **rollout** (how grounding turns hard without breaking shipped
requirements). The one consumer — the case→test bridge — emits `<!-- assert: protocol observe tier -->`
(`we:webcases/compileRequirement.ts:65`) and cannot execute that directive without knowing whether to
*read a state* or *await an event*, which is what makes the grammar axis load-bearing rather than
cosmetic.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
| --- | --- | --- | --- |
| 1 · Home | **Co-locate observables on the protocol record** | Standalone `we:observables.json` | High |
| 2 · Grammar | **Typed `{ id, kind: 'state'\|'event', platform? }`** | Flat string list | Med-high |
| 3 · Rollout | **Progressive (hard where declared, info otherwise)** | Flag-day hard-fail | High |

## Fork 1 — Home of the observable vocabulary

*Fork-existence:* a genuine either/or — observables live in exactly one place; the two homes cannot both
be the source of truth, and one branch is flawed. The standing *bias toward separation* argues for a
standalone registry, creating real tension with the precedent below.

The `given` side of a requirement resolves **nested** — intent → its dimension → that dimension's value
(`we:webcases/requirementValidator.ts:91-101`) — never against a flat global `we:values.json`, because a
value has no identity outside its dimension. The `then` side is symmetric: an observable has no meaning
outside the protocol that exposes it (`committed` means nothing without `change-tracking`).

- **A — Co-locate on the protocol record (recommended).** Each protocol file
  (`we:src/_data/protocols/<id>.json`) declares its `observables`; `then.observe` resolves *within* the
  already-resolved `then.protocol`, exactly as `given.value` resolves within its intent→dimension. One
  source of truth, no namespace collision (`expanded` on two protocols are two distinct entries), and it
  rides the `protocols` registry the validator already injects — no new seam. The `validation` protocol
  summary already narrates *"Observable states/events per level"* in prose
  (`we:src/_data/protocols/validation.json`): co-location types what the protocol already claims.
- **B — Standalone `we:observables.json` registry.** *Rejected:* a second source of truth that must be
  kept in sync with the protocol it back-points to, plus a flat global namespace where the same token
  collides across protocols. It also breaks the `given`/`then` symmetry of the validator for no gain.

## Fork 2 — Grammar of an observable entry

*Fork-existence:* a genuine either/or — an entry has exactly one schema; the flat and typed shapes cannot
coexist, and the flat shape is flawed against the one consumer.

The platform draws a hard line the slot's doc-comment conflates ("a protocol-observable state/event"):
WAI-ARIA *states* (`aria-expanded`, `aria-busy`, read) and custom states (`CustomStateSet` →
`:state(committed)`, read) are steady conditions; DOM *events* (`toggle`, `change`, awaited) are discrete
occurrences. The bridge must emit a different machine operation for each.

- **A — Typed `{ id, kind: 'state' | 'event', platform? }` (recommended).** `kind` is required — it is
  the read-vs-await signal the case→test bridge (#1162) needs to execute `<!-- assert -->`
  (`we:webcases/compileRequirement.ts:65`). `platform` is the optional ARIA token / `:state()` ident /
  DOM event type, aligning each entry to platform vocabulary where one exists (native-first); omitted for
  a protocol-internal observable with no platform equivalent.
- **B — Flat string list (`observables: ["expanded", "committed"]`).** *Rejected:* simplest, but cannot
  tell the bridge whether to read a state or await an event — it starves the one downstream consumer of
  the signal that makes the assertion executable. Membership-grounding without `kind` is a half-measure.

*Sub-decision (low stakes, default settles it):* `kind` is a closed two-value enum (`state` | `event`),
not an open set — the platform offers exactly these two observation modes.

## Fork 3 — Rollout / grounding severity

*Fork-existence:* a genuine either/or — grounding either degrades gracefully or it doesn't; the flag-day
branch is flawed because it breaks shipped, currently-valid requirements.

The item's goal is for `then.observe` to ground hard (forced invariant — *that* it grounds is not in
question). The fork is *how the transition lands* across the 33 existing protocols, none of which declare
observables yet.

- **A — Progressive grounding (recommended).** `then.observe` grounds **hard** (`error`) when the
  resolved protocol *declares* an `observables` list and the token isn't in it; it stays an `info`
  finding when the protocol declares none (un-annotated → pending, today's behavior). Honors the
  *most-permissive default* and *graceful-degradation* rules: a protocol opts into hard grounding by
  declaring its observables.
- **B — Flag-day hard-fail.** *Rejected:* every requirement referencing a not-yet-annotated protocol
  fails until all 33 protocols declare observables — including the shipped test fixture
  (`we:webcases/__tests__/requirementValidator.test.ts:30`, `observe: 'invalid-state-announced'`). A
  breaking change to a shipped validator for no migration benefit over A.

---

## Context

### Supported by default (not decisions)

- **`then.observe` grounds hard eventually** — the item's stated goal; a forced invariant, ratify.
- **WE-layer `@webeverything` protocol data** — the observable registry is conformance vocabulary on the
  `then`/protocol seam, mirroring `given`/intent. Not an intent dimension (not UX vocabulary).
- **Injected, never imported** — the validator's existing `registries` pattern is unchanged; observables
  ride `registries.protocols`.
- **Empty `observe` stays an `error`** — already shipped at `we:webcases/requirementValidator.ts:116`.

### Classification pass (7 questions)

Which layer? → protocol (WE-layer). Protocol or intent dimension? → protocol (verification target, not
UX axis). Expose the whole axis? → open per protocol (default-less core, each declares its own set).
Fixed mechanic or dimension? → `kind` fixed-modeled, the *set* open per protocol. DI-injectable? →
already, via `registries.protocols`; co-location adds no new seam. Most-permissive default? → progressive
grounding. Seam between intents? → N/A (the `then`/protocol seam mirrors `given`/intent).

### Graduation (post-ratify)

A `blockedBy` chain in build order, each slice agent-ready: extend the protocol schema +
`RequirementRegistries` → add `observables` to the protocols that have them (`validation`,
`change-tracking`, `audit-trail` first) → flip `then.observe` to progressive-hard in the validator →
thread `kind` through the `<!-- assert -->` directive for the #1162 case→test bridge. Resolving this
turns the Cases-Spec slice's last coverage gap (#1038) into a small task.
