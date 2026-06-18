---
type: decision
workItem: story
size: 2
status: resolved
codifiedIn: docs/agent/platform-decisions.md#project-protocol-bar
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "project:weblifecycle"
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-domain-entity-lifecycle-placement.md
crossRef: { url: /research/domain-entity-lifecycle/, label: "Prep survey — domain-entity lifecycle placement" }
tags: [decision, lifecycle, weblifecycle, protocol, layer-placement, governance, exercise-app-discovery]
---

# Retroactively ratify the weblifecycle project + lifecycle protocol placement

**Prepared 2026-06-14 — ready to ratify.** No greenfield design — this **ratifies shipped code**.
Grounding: the placement test codified by [#409](/backlog/409-decision-master-detail-intent-vs-project/)
(re-run by #467), plus a focused prior-art
survey published at [`/research/domain-entity-lifecycle/`](/research/domain-entity-lifecycle/) (session
report `we:reports/2026-06-14-domain-entity-lifecycle-placement.md`). **2 forks**, each carrying a **bold**
recommended default; both default to *ratify-as-shipped*, both high-confidence — the survey **confirmed**
the design rather than reshaping it, which is the expected outcome for a ratification.

## Why this is a decision

Governance gap from the [#607](/backlog/607-audit-all-resolved-backlog-items-against-the-guiding-princip/) audit
(G3, downgraded slip→drift). #353
minted a new WE **project** (`weblifecycle`) **and** a **protocol** (`lifecycle`) inline from loan-exercise-app
work, same-day open→resolved, with **no governing `type:decision`** — its own body listed the placement as an
open question (*"Project + Protocol, or an intent?"*; *"vs `webstates`"*). Sibling discoveries turned out
governed in prose/epic (#355 by #409; #357 by the #314 charter), but `weblifecycle` never was. The carve-rule
("a fork lives in a `type:decision`, never inline") co-dated the commit, so it is **drift, not a clean slip** —
but the entity stays ungoverned. This item files the missing decision. **No reversal of #353.**

## The axes

The single open question (*Project + Protocol, or an intent?*) decomposes into two orthogonal placement axes,
each pinned to the shipped artifacts and the codified test:

- **Is it a Project at all, or does it fold into `webstates`?** `webstates` is reactive state *primitives*
  (signals/stores/schemas, [we:src/_data/projects.json:58](../src/_data/projects.json#L58)); the shipped
  `weblifecycle` ([we:src/_data/projects.json:253](../src/_data/projects.json#L253)) is *domain workflow state* —
  a different altitude with its own provider/interchange contract. → **Fork 1**.
- **Is the contract a Protocol, or an Intent?** The `lifecycle` protocol
  ([we:src/_data/protocols.json:143](../src/_data/protocols.json#L143)) fixes a `CustomLifecycleProvider` registry
  + a portable transition map (status set; each transition `from → to` + optional guard + actor/role) + an
  observable `{ entity, from, to, actor, at }` event ([we:src/_includes/project-weblifecycle.njk](../src/_includes/project-weblifecycle.njk)
  §`protocol-lifecycle`). That is a technical interchange contract, not a UX preference. → **Fork 2**.

The **placement test** (the lens) is codified by #409: a Project+Protocol is justified iff there is a real
**contract** — *a provider seam OR an interchange schema*; otherwise it is "just an intent" (*"not every gap is
a project"*). #409 already **named** lifecycle as one of the four that legitimately passed; #616 supplies the
explicit ratification. The boundary (what lifecycle does **not** own) is already settled in the shipped
contract and is context, not a fork: authorization → [Web Guards](../src/_data/protocols.json#L120);
persistence → the entity's own concern; audit → composes via the event ([#357]); status render → the
`status-indicator` **intent** (`realizesIntent`). This is the correct UX/technical split (intent-UX-only).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Project, or fold into `webstates`?** | Standalone `weblifecycle` **project** (separate altitude + distinct contract) | Fold into `webstates` | **High** |
| **2 — Protocol, or intent?** | A **Protocol** (`lifecycle`); the UX half is the separate `status-indicator` intent | A plain intent | **High** |

---

## Fork 1 — Standalone project, or fold into `webstates`?

**Crux:** does a domain entity's guarded status machine earn its own project, or is it part of the reactive-state
project? Refs: `webstates` ("reactive state primitives", [we:src/_data/projects.json:58](../src/_data/projects.json#L58));
`weblifecycle` ([we:src/_data/projects.json:253](../src/_data/projects.json#L253), self-described as *"distinct from
Web States … the domain object's workflow state"*).

- **A — Standalone `weblifecycle` project. ✅ default.**
  The placement test passes on the provider-seam disjunct (`CustomLifecycleProvider`) *and* the interchange-schema
  disjunct (the portable transition map) — #409's exact criteria. A domain-entity status machine is a different
  *altitude* from reactive primitives (one tracks an entity's lifecycle through guarded role-scoped transitions;
  the other observes transient mutation), and the prior art treats it as its own concern (SCXML/XState statecharts,
  FSM-for-entity-lifecycle). Bias-toward-separation: keep the two homes apart; the contract shapes differ.
- *Rejected* — **B, fold into `webstates`.** Conflates two altitudes and two contract shapes (a transition-map
  interchange + provider vs reactive signals/stores). `webstates` has no transition/guard/actor model, and the
  audit-trail composition seam (the lifecycle *event*) is lifecycle-specific. Folding would overload `webstates`
  and bury the provider contract — the same over-engineering #409 refused in the other direction.

## Fork 2 — Protocol, or intent?

**Crux:** is the lifecycle contract a technical interchange (Protocol) or a UX concern (Intent)? Refs:
`lifecycle` protocol summary ([we:src/_data/protocols.json:143](../src/_data/protocols.json#L143)); the boundary
table in [we:src/_includes/project-weblifecycle.njk](../src/_includes/project-weblifecycle.njk) (*Transition event →
Protocol; Status display → Status Indicator intent*).

**What the protocol covers — the smallest interoperable core, NOT a full workflow engine.** The contract
fixes exactly *one seam* (the summary's own words: *"and nothing else"*): a declarative **status set** + a
**transition map** (each transition `from → to`, an optional **guard predicate**, the permitted **actor/role**),
resolved by a swappable **`CustomLifecycleProvider`** registry, plus one observable **event**
`{ entity, from, to, actor, at }` per transition. That is the *data contract* — what transitions exist and
who/when — never the *machinery* (how they execute) and never the *UX* (how state shows). A workflow engine
(XState, a BPM server, a hand-rolled switch) plugs in *behind* the provider; the transition map is the only
lock, data-defined and portable. This is why the answer is a Protocol and not "a full workflow standard":
the scope is deliberately the minimal portable interchange, the same altitude as W3C **SCXML** (parse the
transition structure; let the engine decide what guards/actions *mean*).

**Concrete example — a loan, showing in-scope vs out-of-scope.** The protocol owns the declarative map:

```json
{
  "entity": "loan",
  "states": ["draft", "submitted", "underwriting", "approved", "funded", "closed", "rejected"],
  "transitions": [
    { "from": "draft",        "to": "submitted",    "actor": "applicant" },
    { "from": "submitted",    "to": "underwriting", "actor": "system" },
    { "from": "underwriting", "to": "approved",     "actor": "underwriter", "guard": "creditCheckPassed" },
    { "from": "underwriting", "to": "rejected",     "actor": "underwriter" },
    { "from": "approved",     "to": "funded",       "actor": "officer",     "guard": "fundsAvailable" },
    { "from": "funded",       "to": "closed",       "actor": "system" }
  ]
}
```

Firing `underwriting → approved` emits `{ entity:"loan#42", from:"underwriting", to:"approved", actor:"u_7", at:"…" }`.
What is **out of scope** here: *whether* `creditCheckPassed` actually holds for this actor (→ Web Guards'
`CustomGuardProvider`, async + server-authoritative), *where* the loan row is stored (→ persistence, the
entity's own concern), *recording* that the transition happened (→ audit-trail composes on the event, [#357]),
and *rendering* "Approved · next: Fund / Reject" (→ the `status-indicator` **intent**). The protocol is the
thin portable contract in the middle; everything else composes around it.

- **A — A Protocol (`lifecycle`), with the UX half as the separate `status-indicator` intent. ✅ default.**
  The contract fixes a *provider seam* + a *portable, data-defined interchange* + an *observable event* — the
  technical-contract signature, the same test that made realtime-transport "a Protocol, not an Intent." The survey
  confirms a transition map is a recognized interchange (W3C **SCXML**: parse the structure, let the engine decide
  what guards/actions mean — verbatim the "transition map is the only lock" split; **XState** = an engine that
  plugs in behind the provider). Intents are UX-only (no impl refs) — so the *current-state-and-next-actions*
  rendering is correctly the `status-indicator` intent, while the transition machinery is the Protocol.
- *Rejected* — **B, a plain intent.** Intents may carry no implementation refs (intent-UX-only); a provider
  registry + transition-map interchange + event contract is implementation by definition. Demoting it to an intent
  would strand the swappable-engine contract and the audit composition seam with no home, and would re-couple the
  UX render to the machinery the `status-indicator` split already separated.

## What ratifying this means (plan of record, for the decision turn)

- Ratify the placement **as shipped**: `weblifecycle` stays a standalone **Project** ([we:projects.json:253](../src/_data/projects.json#L253))
  owning the `lifecycle` **Protocol** ([we:protocols.json:143](../src/_data/protocols.json#L143)). No fold into
  `webstates`, no demotion to an intent. **No artifact change required** — this is a governance ratification.
- This item → `resolved`, `graduatedTo: weblifecycle` (the governed project), at the decision turn. **No reversal
  of #353.**
- Closes the #607 G3 finding for `weblifecycle` (drift → governed), mirroring how #467/#409 governed their
  exercise-app placements.

## Ruling (2026-06-14)

Both forks ratified **as-shipped**, both as recommended:

- **Fork 1 → A.** `weblifecycle` stays a **standalone Project** — a domain entity's guarded status machine is a
  distinct altitude from `webstates`' reactive primitives, and it passes the #409 placement test on *both*
  disjuncts (provider seam `CustomLifecycleProvider` + interchange schema, the portable transition map). No fold.
- **Fork 2 → A.** The contract is a **Protocol** (`lifecycle`), with the UX half as the separate
  `status-indicator` intent. Scope confirmed as the *smallest interoperable core* — declarative status set +
  transition map + provider seam + observable event, *nothing else*; the engine/guards/persistence/audit/render
  all compose around it (see the loan example above). Not a full workflow engine, not a plain intent.

No artifact change required (governance ratification only). **No reversal of #353.** Closes #607 G3 for
`weblifecycle`.
