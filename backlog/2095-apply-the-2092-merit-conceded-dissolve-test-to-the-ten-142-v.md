---
kind: decision
size: 5
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-06"
dateResolved: "2026-07-06"
graduatedTo: none
codifiedIn: one-off
relatedTo: ["2091", "2092", "142"]
preparedDate: "2026-07-04"
tags: [validation-gate, dissolve-test, batch-confirm, decision]
---

# Apply the #2092 merit-conceded dissolve test to the ten #142 validation gates

Run the #2091 fresh-context screen (verdict-specialized per #2092) over the prepared #142-family validation gates.
For each: strip timing/named-substrate/demand and decide conditional-vs-conceded merit. Flat-merit-conceded →
dissolve to accepted-on-merit + `blockedBy`/trigger, human turn compressed to a single batch-confirm over the
dissolved set (**not** an auto-resolve); conditional-merit → keep as a gate, reshaped to lead with the merit
unknown.

## Archetype — a validation-gate *disposition*, not a fork

This item **applies an already-ratified test** (#2092, ratified 2026-07-02, codified in
[we:docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md)) to a fixed set of sibling gates. It rules
on **nothing new** — there is no excluded/broken branch and no either/or, so it is *not* a `## Fork N` decision and
not its own validation gate; it is the **screen-output disposition** #2092's own Disposition explicitly handed off
("a follow-up runs the fresh-context screen per card"). Its prepared shape is therefore the **verdict table + the
batch-confirm list** below — the single human action is *one batch-confirm nod* over the dissolved set plus
*ratifying the one reshaped keep* (#1648). Per #2092's guard, dissolve **compresses** the human turn to a
batch-confirm; it never auto-resolves.

## Digest + verdict

**Screen applied → 10 DISSOLVE / 1 KEEP** over the 11 in-scope open gates.

**Scope correction (the "ten" in the title is stale).** The listed range #1633–#1650 + #1931 spans **19 files**,
but **8 are already `status: resolved`** (decided 2026-06-23, mostly graduated to builds) and out of scope: #1634,
#1636, #1640, #1642, #1643, #1644, #1645, #1647. The real in-scope set is the **11 `status: open` `kind: decision`
gates**: #1633, #1635, #1637, #1638, #1639, #1641, #1646, #1648, #1649, #1650, #1931. ("Ten" = the ten #142-pool
gates; #1931 is a webintents-family gate pulled in by analogy — it already carries `blockedBy: ["1930"]`.)

**Prior-art delta.** The test itself is settled (#2092); the delta here is purely *classificatory* — each open
gate's own body already states its merit as **conceded** ("the delta is genuine / real / on-moat, so **don't drop
it**") with only substrate/timing/demand left, which is the #2092 tell of flat-merit-conceded → dissolve. The lone
exception (#1648) states its merit as **conditional** on a data-model facet that may not exist.

## Verdict table

| # | Gate | Verdict | Merit conceded ✓ / conditional unknown | `blockedBy` / trigger if dissolved |
| --- | --- | --- | --- | --- |
| 1633 | Render-cause & perf inspector | **DISSOLVE** | conceded — "the portability delta is genuine, so don't drop it"; residue = trace/render-correlation substrate | trace substrate emits action/state transitions + render-correlation hook; + a real redundant-render case |
| 1635 | Ownership-aware routing in context | **DISSOLVE** | conceded — "real and on-moat (clean delta, keystone)"; residue = no owner model until roster populated | ownership/persona roster populated |
| 1637 | Capability-matched task queue | **DISSOLVE** | conceded — "real and on-moat … gate it hard"; residue = over-build ordering vs routing | #1635 shipped + proven routing value |
| 1638 | In-context annotation/discussion threads | **DISSOLVE** | conceded — "durable-anchor delta is the whole point"; residue = node-identity substrate + demand | stable node-identity scheme; + demand |
| 1639 | Semantic handoff packets between roles | **DISSOLVE** | conceded — "the generalization is real and on-moat"; residue = design after #1631 proves shape | #1631 proves the concrete shape + shared capture substrate |
| 1641 | Declared-rule → test-coverage gap surfacer | **DISSOLVE** | conceded — "delta is uncontested (no tool measures declared-rule coverage)"; residue = rule→test mapping | declared-rule model populated + test→rule mapping substrate |
| 1646 | Scenario/fixture library (doubles as E2E) | **DISSOLVE** | conceded — "real (clean delta, on-moat)"; residue = capture substrate + dual-use demand | shared capture substrate (co-built w/ #1631/#1649); + demand |
| **1648** | **PII & sensitive-data flow map** | **KEEP (reshape)** | **conditional** — on-moat delta "depends on the declared state model carrying visibility/persistence/egress facets **that may not exist yet**" | *stays a gate* — body reshaped to LEAD with "does the declared model carry these facets?" |
| 1649 | Branch-and-run diff in the dev browser | **DISSOLVE** | conceded — "real (clean delta, on-moat)"; residue = capture substrate + timing | shared capture/introspection substrate (co-built w/ #1631/#1646) |
| 1650 | Safe-edit sandbox emitting a PR | **DISSOLVE** | conceded — "standard-based angle genuinely differentiating"; residue = heaviest build + prereq | #095 standard-gated emit path settled |
| 1931 | Runtime register-API for custom intents | **DISSOLVE** | conceded — shape ratified upstream (#1913 + `@property`), "no design choice remains, only timing" | already `blockedBy: ["1930"]`; + a **named** dynamic-host consumer (plugin host / user-dashboard / multi-tenant) |

## Batch-confirm list (the single human action)

**DISSOLVE — nod once** (→ each lands *accepted-on-merit* + the `blockedBy`/trigger above; **not** auto-resolved):
**#1633, #1635, #1637, #1638, #1639, #1641, #1646, #1649, #1650, #1931** (10 gates). Grouped by their ordering
mechanism: a **capture/introspection substrate cluster** co-built once (#1633, #1638, #1639, #1646, #1649); an
**ownership-model chain** (#1635 → #1637); and **other named-substrate blocks** (#1641, #1650, #1931).

**KEEP as a gate — ratify the reshape:** **#1648** — its body leads with the merit unknown ("does the declared
state model carry visibility/persistence/egress facets to derive from? — else that classification is the real
prerequisite"), staying a live ratify turn rather than a dissolve.

**Skeptic:** SURVIVES (fresh-context refutation pass, default = KEEP-on-doubt, applied per-gate). No false dissolve
found: a grep for the conditional-merit tell ("may not exist yet / no WE advantage / the real prerequisite") hits
**only #1648** across all 11 gates; each of the 10 DISSOLVE cards states its merit as flatly conceded
("real/genuine/on-moat, so don't drop it") with a *named-substrate or demand* residue, not a facet-existence
unknown. The two flagged for scrutiny confirm as **timing/prereq**, not merit: #1639's prereq #1631 is *already
resolved* (graduated to #1663), and #1650's prereq #095 is *already resolved* (graduated to `we:scripts/autofix/engine.mjs`
+ `npm run autofix`) — so their ordering edges are real `blockedBy` DAG edges, largely already satisfiable, which
*strengthens* DISSOLVE. #1648 is correctly and uniquely KEEP (its moat evaporates without a state-model facet that
may never exist). **Framing (Pass B):** confirmed a validation-gate *disposition*, not a `## Fork N` — the
dissolve/keep criteria are #2092 (resolved, codified at [we:docs/agent/backlog-workflow.md:380,398](../docs/agent/backlog-workflow.md#L380)),
executed here, not invented; the single human action stays a batch-confirm nod + the #1648 keep-ratify, never an
auto-resolve. Scope count verified exact (8 resolved out-of-scope, 11 open in-scope).

## Downstream

On the human's single batch-confirm: the 10 dissolved gates are spliced to *accepted-on-merit* with their
`blockedBy`/trigger (a mechanical status/edge write, per gate, via the lane→PR path — not an auto-resolve); #1648's
body is reshaped to lead with the facet-existence unknown and stays `open`. This clears the #142-family gate queue
to a single conditional gate + a set of trigger-blocked accepted builds.

---

Applies #2092 (merit-conceded dissolve test) via the #2091 fresh-context screen; disposes the #142 validation-gate
family. No new web survey — the test is already researched and ratified; this is its classificatory application.
