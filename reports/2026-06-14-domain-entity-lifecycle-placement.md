# Domain-entity lifecycle — placement grounding (ratify the `weblifecycle` project + `lifecycle` protocol)

**Date:** 2026-06-14
**Grounds:** decision [#616](../backlog/616-retroactively-ratify-the-weblifecycle-project-lifecycle-prot.md) — retroactively ratify the placement minted inline by [#353](../backlog/353-candidate-standard-lifecycle-workflow-state-domain-entity-stat.md). G3 governance finding from the [#607](../backlog/607-audit-all-resolved-backlog-items-against-the-guiding-princip.md) audit (slip→drift). No reversal of #353.
**Type:** ratify-shipped-code. The entity already exists; this report grounds *whether the placement is correct*, not a greenfield design.

## Why this is a decision at all

#353 minted a new WE project (`weblifecycle`) **and** a protocol (`lifecycle`) in a single same-day open→resolved pass, sourced from loan-exercise-app work. Its own body left the placement as an explicit open question — *"Project + Protocol, or an intent?"* and *"vs `webstates`"* — and the carve-rule ("a fork lives in a `type:decision`, never inline") landed in the *same commit*, so the entity shipped ungoverned. Sibling exercise-app discoveries turned out governed in prose/epic (#355 by decision #409; #357 by the #314 charter), but `weblifecycle` never was. #616 closes that gap by ratifying the placement against the codified placement test — the same test #467 (responsive-layout) and #409 (master-detail) ran.

## The shipped artifacts (what we're ratifying)

- **Project** — `weblifecycle` / "Web Lifecycle", status `concept`, in [src/_data/projects.json:253](../src/_data/projects.json#L253). Self-described as *"a domain entity's lifecycle … distinct from Web States (reactive state primitives) and from a region's lifecycle (Web Guards): the domain object's workflow state."*
- **Protocol** — `lifecycle`, status `draft`, `ownedByProject: weblifecycle`, `realizesIntent: status-indicator`, in [src/_data/protocols.json:143](../src/_data/protocols.json#L143). Contract: *declarative status set + transition map (each transition: `from → to`, optional guard predicate, permitted actor/role), resolved by a swappable `CustomLifecycleProvider` registry; the transition map is the only lock — data-defined and portable, so a workflow engine (XState, a BPM server, a hand-rolled switch) plugs in behind the provider.* Every transition emits an observable `{ entity, from, to, actor, at }` event — the composition seam for audit-trail (#357) and reporting.
- **Normative body** — [src/_includes/project-weblifecycle.njk](../src/_includes/project-weblifecycle.njk) §`protocol-lifecycle`, with the boundary table: Transition event → Protocol; Authorization → 🔗 compose Web Guards; Status display → 🔗 Status Indicator intent.

## The placement test (internal precedent)

[#409](../backlog/409-decision-master-detail-intent-vs-project.md) codified the test verbatim: the four prior exercise-app standards (lifecycle #353, status-indicator #354, audit #357, decision #355) *"each became a Project + Protocol because each had a real **contract**: a provider seam (`CustomLifecycleProvider`, `CustomAuditProvider`) or an interchange **schema** (`DecisionRecord`)."* Master-detail had **none**, so it stayed a plain intent — *"not every gap is a project."* [#467](../backlog/467-decision-responsive-container-query-layout-placement.md) applied the same lens to responsive layout (no provider/schema → extend intents, no new project).

Run against `lifecycle`, the test passes cleanly and on **both** disjuncts:
- **Provider seam** — `CustomLifecycleProvider` (swappable registry, default → project override → custom plug), the same shape as `CustomGuardProvider` / `CustomAuditProvider`.
- **Interchange schema** — the declarative status set + transition map is a portable, data-defined contract that a workflow engine plugs in behind without touching the entity.

So #409 already *named* lifecycle as a legitimate Project+Protocol; #616 only supplies the missing explicit ratification.

## Prior-art survey — does the contract design hold up?

The protocol's load-bearing claim is that the **transition map is a portable interchange** any engine can resolve. The survey confirms this is exactly how the established prior art works, which is what justifies the **Protocol** classification (a technical interchange contract, not a UX preference):

1. **A transition map *is* a recognized interchange format.** The W3C standardized statechart serialization as **SCXML** (2015): an engine parses the structure, validates it, and *"lets the calling code decide what guards mean and what actions do"* — precisely the lifecycle protocol's "transition map is the only lock; the provider resolves the rest" split. SCXML is the canonical precedent that a declarative state/transition document is portable across engines and platforms (Apache Commons SCXML for Java, SCION for the web). ([SCXML](https://github.com/GnomesOfZurich/scxml), [statecharts.dev](https://statecharts.dev/resources.html))
2. **The swappable-engine premise is real.** **XState** is a JS/TS statechart engine that adheres to the SCXML spec — a concrete instance of "a workflow engine plugs in behind the provider." BPM servers and hand-rolled switches are the other end of the same swap. ([xstate](https://xstate.js.org/api/), [state machine tools](https://statecharts.online/chapters/09-tools-and-frameworks.html))
3. **The domain-entity framing is the textbook FSM use case.** An FSM models *"the lifecycle of one thing in response to events"* — a permit application, a benefits claim, a procurement contract, an accreditation request — *"an enumerated set of states known at implementation time."* This is exactly `weblifecycle`'s scope (loan, policy, claim, order, ticket). ([USPTO: FSM for workflows](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12141754), [Use State Machines!](https://rclayton.silvrback.com/use-state-machines))
4. **Actor/role-on-transition is standard.** Roles are routinely *"defined to execute each transition, controlling who can shift assets from one state to another"* — validating the `actor/role` field on each transition (with the *whether-allowed* decision correctly delegated to a guard, not owned here).
5. **The boundary against process orchestration is principled.** FSMs are *"more constrained than BPMN: an FSM is in one state at any given time, while BPMN allows a workflow to be in multiple states."* So a domain-entity lifecycle (single status at a time) is a different, narrower concern than multi-token process orchestration — supporting "fix one seam and nothing else," and confirming `weblifecycle` should not absorb a process-engine scope.

**Net:** the prior art reshapes nothing about the placement — it *confirms* the design is a recognized, portable interchange contract with a swappable engine, which is the signature of a **Protocol**, and that a domain-entity status machine is a distinct concern from both reactive primitives and process orchestration.

## Classification (per-fork pass)

- **Which layer?** A technical contract (provider seam + portable interchange schema + observable event), not a UX preference → **Protocol**, owned by a **Project**. The UX half (current state + next actions) is already the separate `status-indicator` **intent** (`realizesIntent`) — correct UX/technical split per *intent-UX-only*.
- **Protocol or intent dimension?** Protocol — it fixes a provider contract and a data-defined interchange, the same test that made realtime-transport "a Protocol, not an Intent."
- **DI-injectable?** Yes — `CustomLifecycleProvider` is a runtime-DI seam consulted by the running app, the legitimate registry pattern (not a devtools-only provider).
- **Seam between concerns / bias-to-separation?** Authorization → Web Guards; persistence → the entity's own concern; audit → composes via the transition event; status render → `status-indicator` intent. Each is a separate home; lifecycle owns only the transition map + event. Honours separation bias.
- **vs `webstates`?** Separate project. `webstates` is reactive state *primitives* (signals/stores/schemas, [projects.json:58](../src/_data/projects.json#L58)); a domain-entity lifecycle is *domain workflow state*, a layer above with a distinct provider/interchange contract. Folding would conflate two altitudes — separation bias says keep apart, and the contract shapes differ.

## Recommended ruling (for the decision turn)

Ratify the placement **as shipped**: `weblifecycle` stays a standalone **Project** owning the `lifecycle` **Protocol**; no fold into `webstates`, no demotion to an intent. File the `type:decision` lineage so the entity is governed. No reversal of #353; no artifact change required beyond linking this ratification.

## Sources

- [SCXML — State Chart XML (W3C interchange format)](https://github.com/GnomesOfZurich/scxml)
- [Statecharts — resources & glossary](https://statecharts.dev/resources.html)
- [XState API](https://xstate.js.org/api/)
- [Best state machine tools and frameworks](https://statecharts.online/chapters/09-tools-and-frameworks.html)
- [USPTO — Finite state machines for implementing workflows for data objects](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12141754)
- [Richard Clayton — Use State Machines!](https://rclayton.silvrback.com/use-state-machines)
