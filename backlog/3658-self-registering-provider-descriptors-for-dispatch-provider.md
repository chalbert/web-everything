---
bornAs: x1o71ec
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-provider-registry.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/operations/dispatch-providers/fix.mjs", "we:scripts/operations/dispatch-providers/ci-heal.mjs", "we:scripts/operations/dispatch-providers/prepare.mjs", "we:scripts/operations/dispatch-providers/prepare-decision.mjs"]
dateOpened: "2026-09-13"
preparedDate: "2026-09-21"
preparedAgainstSha: "18798aec3835377c24a82133b5d87711dcfdb3e2"
tags: [dispatch, provider, registry, codex, antigravity, decision-prep]
relatedTo: ["3369", "3580", "3443", "3690", "3717", "3696", "3579"]
relatedReport: reports/2026-09-21-provider-registration-grounding.md
---

# Self-registering provider descriptors for DISPATCH_PROVIDER_REGISTRY, not a shared hand-edited table

Filed 2026-09-13 to stop provider lanes colliding on one hand-edited table. **Prepared 2026-09-21.** The
prep found that the card names the wrong table: `DISPATCH_PROVIDER_REGISTRY` is keyed by launch *kind*,
while a new agent *vendor* (Codex, Antigravity) lands in three other tables inside the wrappers. Four forks
follow, each with a bold default. The original filing is kept below under `## The idea (as filed)`.
Grounding: [report](/reports/2026-09-21-provider-registration-grounding.md) · research topic
[/research/dispatch-provider-registration/](/research/dispatch-provider-registration/).

## Why this is on the critical path

The operator queued this on 2026-09-21 as part of the delegation stack: it comes before adding an
Antigravity or Codex provider, so those lanes do not collide. Antigravity is the top capacity lever (#3696).
#3717 records a non-Claude route as `routed: <p>, executed: claude` until a non-Claude provider port exists,
and names #3443 and this card as the way there (#3717 step 6).

## What is true today — facts, not forks

Prototype branch read at `origin/lane/mechanical-dispatcher` `13affbab1`; main at `18798aec3`. Files marked
*(prototype)* are not on main.

- **The kind table.** `DISPATCH_PROVIDER_REGISTRY` *(prototype)*
  (we:scripts/operations/dispatch-provider-registry.mjs:77) maps a launch kind to its mechanical wrapper:
  `build`, `prepare`, `fix`, `prepare-decision`, `ci-heal`. It has no vendor field. Every key must be in
  `LAUNCH_KINDS` (we:scripts/operations/dispatch-lane.mjs:188, six members), checked at module load
  (`:129-145`). One more row (`investigate`) fills it.
- **It already solved the collision this card describes.** Its docblock (`:8-16`) records the problem:
  five lanes each adding an `if (kind === …)` arm to one router in one 2000-line file. After the extraction
  on 2026-09-12 (`62f4ce383`), four kinds landed the same day as one import plus one row each
  (`49c46c3d2`, `20129c38e`, `5f6e6ba0c`, `00e81eacb`). Whether those four lanes hit a textual conflict on
  the table was not measured.
- **A vendor is not a row in that table.** The item's `deliveryAgent:` marker is read by the kind's detached
  provider and passed on as `--provider=<name>` (we:scripts/operations/dispatch-providers/build.mjs:117-121);
  the `*-run.mjs` process then resolves the name. Adding a vendor today *(prototype)* means editing:
  - `DELIVERY_AGENT_PROVIDERS` in we:scripts/operations/deliver-item-wrapper.mjs (`:920`, file 1856 lines),
    plus a vendor object like `CODEX_PROVIDER` (`:830`, about 90 lines);
  - `FIX_AGENT_PROVIDERS` in we:scripts/operations/fix-dispatch-wrapper.mjs (`:465`, 852 lines), plus
    `FIX_CODEX_PROVIDER` (`:392`);
  - `CI_HEAL_AGENT_PROVIDERS` in we:scripts/operations/ci-heal-dispatch-wrapper.mjs (`:508`, 862 lines),
    plus `CI_HEAL_CODEX_PROVIDER` (`:443`);
  - `PROVIDERS`, `EXECUTORS`, `EXECUTOR_PROVIDERS` and `EXECUTABLE_PROVIDER` in
    we:scripts/lib/dispatch-contracts.mjs (`:40-50`, `:759`);
  - and, if the vendor is a new routing target, the router's cascade in we:scripts/lib/provider-routing.mjs,
    which names vendors inline (`:423`, `:452`, `:500-512`; on main too, identical). The router recommends
    `gemini | codex | both | claude` (`:5`); `antigravity` is recorded provenance under the `gemini` route
    (`EXECUTOR_PROVIDERS['gemini-direct-task']`), not a route of its own.
  The prepare wrappers are Claude-only (we:scripts/operations/prepare-scope-wrapper.mjs:218,
  we:scripts/operations/prepare-decision-wrapper.mjs:416).
- **The three vendor tables are held equal by tests, which also forces every vendor onto every kind.**
  The wrapper tests assert `Object.keys(FIX_AGENT_PROVIDERS)` and `Object.keys(CI_HEAL_AGENT_PROVIDERS)`
  equal the build table's names (we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs:653,
  we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs:590). So a vendor added to one table only
  fails CI. The flip side: a vendor that can run `build` and `fix` but not `ci-heal` cannot be expressed at
  all. The fix and ci-heal resolvers also print the *build* table's names as the legal set
  (we:scripts/operations/fix-dispatch-wrapper.mjs:482, we:scripts/operations/ci-heal-dispatch-wrapper.mjs:524).
- **Main.** The `provider` port (#3579) is in we:scripts/operations/dispatch-lane-io.mjs (`:956`) with one
  implementation, `defaultClaudeProvider` (`:1016`). Main's `DELIVERY_AGENT_PROVIDERS`
  (we:scripts/operations/deliver-item-wrapper.mjs:776) has a `codex` entry that is a stub and throws
  (`:760-766`). There is no kind registry, no fix or ci-heal vendor table and no dispatch-contracts module.

**Verdict on the card's claim:** the collision is real and wider than the card says, but it is on the
vendor axis, not in `DISPATCH_PROVIDER_REGISTRY`.

## Prior art, in one paragraph

Discovery is used where third parties install plugins the host cannot know about: Python entry points
(a manifest the host reads without importing), VS Code `contributes` manifests, Java `ServiceLoader`. Where
one team owns every plugin in one repo, the trend runs to explicit imports: ESLint flat config replaced its
name-based plugin loading and calls it "one of our biggest regrets", Vite and Rollup take an explicit plugin
array, the Vercel AI SDK takes `createProviderRegistry({ anthropic, openai })`, and Backstage made discovery
opt-in. No surveyed system lets a plugin declare its own trust or its own priority. In this repo,
one-file-per-entry plus a glob loader is proven for *data* (research topics #1145, blocks #882, backlog), and
a static import plus a keyed table is the pattern for *executable* registries (`OPERATIONS` in
we:scripts/operations/run.mjs:97, the kind registry itself). Details and URLs in the research topic.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — which table the ruling governs | **The vendor axis.** The kind table stays as it is (forced by the card's own goal) | Convert both tables | High |
| Fork 2 — how a vendor is collected | **One descriptor module per vendor, listed in one explicit static index** | Runtime directory discovery | Med-high |
| Fork 3 — what a descriptor may declare | **Mechanics only** — name, provenance id, the kinds it can run, its spawn adapters. Never trust, fitness or cascade order | Descriptor also declares fitness or rank | High |
| Fork 4 — a marked vendor that cannot run this kind | **Refuse for `build`; fall back to the default vendor for `fix`/`ci-heal`, recorded in its own fields** | Fall back (or refuse) for every kind | Med |

## Supported by default — not forks

Each has one coherent branch, or is settled by precedent. They are recorded so the ruling is complete.

- **The routing call stays the orchestrator's.** Which vendor runs a dispatch is decided by
  we:scripts/lib/provider-routing.mjs and `decideDispatchRoute` (we:scripts/lib/dispatch-contracts.mjs), by
  fixed criteria (#3717). The explicit operator override (`providerOverride` + reason) and the per-item
  `deliveryAgent:` marker stay where they are. A descriptor never makes, weighs or orders that call
  (`#model-routing` in we:docs/agent/backlog-workflow.md: the call is never delegated; context:
  [#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)).
- **Trust is earned from the trial record, not declared.** The unit `{provider, model, taskType}`, the
  evidence bar and who moves a level belong to #3690 (ratified by the operator 2026-09-21 as prepared; the
  record is being written) and to
  [#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria).
  This card does not touch them. Fork 3 keeps them out of descriptors.
- **Authority over what a delegated agent may DO stays with the typed-operation catalog**
  ([#agent-mutations-through-typed-operations](../docs/agent/platform-decisions.md#agent-mutations-through-typed-operations)).
  Registering a vendor grants it no operation.
- **One place starts a delivery agent.** Per
  [#conveyor-dispatch-calls-the-declared-operation](../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation),
  the conveyor starts agents only through the `dispatch-lane` operation. A descriptor's spawn adapter is
  called only from inside the wrapper that operation's sink launches, exactly where today's
  `CODEX_PROVIDER` runs. A descriptor is not a second dispatcher.
- **A broken descriptor fails loudly at load, naming the file (settled by precedent).** The kind registry
  already rules this for its own table: a bad row throws at module load (`:129-145`), "the one thing a mode
  knob must never do is silently pick a side" (`:182`), and "the sink refuses to be built at all rather than
  building one that quietly routes the wrong way" (`:215-217`). The vendor registry follows it: every
  descriptor is checked when the registry loads (`name` unique, `routingProvider` in `PROVIDERS`, every
  `kinds` key in `LAUNCH_KINDS`, every adapter has a `spawn`), and a failure throws a `TypeError` naming the
  file (each descriptor exports its own `file` from `import.meta.url`), the field and the rule. Skipping a
  bad descriptor, or checking it only on first use, would let a vendor vanish with nothing recording why.
  **Blast radius:** the registry is imported only by the wrappers and the `*-run.mjs` entry points, never by
  we:scripts/lib/dispatch-contracts.mjs or we:scripts/operations/dispatch-lane-io.mjs. So a bad descriptor
  stops every vendor run that resolves through the registry, and CI catches it first; it does not break the
  operation table in we:scripts/operations/run.mjs. The loader is owned by the dispatch work under epic
  #3383 / #3369; each vendor owns only its own descriptor file.
- **An unknown vendor name is refused by name before a lane is acquired.** Today's behaviour
  (we:scripts/operations/deliver-item-run.mjs:108-109) is kept. Under Fork 2 the check reads the registry.
- **The index is written by hand, with a completeness check.** Whether the static index is hand-written or
  generated is an implementation detail with identical runtime behaviour. Default: hand-written, plus a test
  that the index and the `agent-providers/` directory list the same vendors. By analogy only, the merge-risk
  statute
  ([#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md#merge-risk-optimistic-with-targeted-lock))
  treats distinct-key additions to a keyed package manifest as safe to merge optimistically; that clause is
  about the npm manifest, not a JS import list, so it is context, not authority. A duplicate name is caught
  by the load check above.
- **Where it is built: on the prototype branch, and it graduates with the wrappers.** The three vendor
  tables, the kind registry and we:scripts/lib/dispatch-contracts.mjs exist only on
  `lane/mechanical-dispatcher`, a declared POC branch
  ([#poc-branch-declared-delivery-mode](../docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode)).
  The refactor therefore lands there and reaches main through #3443's small reviewed slices, where the full
  review runs. Main's single `DELIVERY_AGENT_PROVIDERS` is replaced by the registry when the first wrapper
  that uses it graduates. The one exception: the ruling's codification in
  we:docs/agent/platform-decisions.md lands on main. This is sequencing, not a design choice.
- **Import direction, with no new cycle.** Wrappers and `*-run.mjs` import the registry; the registry imports
  the descriptors and `PROVIDERS`/`LAUNCH_KINDS`; descriptors import only shared spawn helpers (for example
  `persistSpawnFailure` in we:scripts/operations/minimal-context-provider.mjs, the detached primitives in
  we:scripts/operations/detached-dispatch.mjs), never a wrapper and never
  we:scripts/operations/dispatch-lane-io.mjs. Wrapper-local helpers a vendor object uses today (for example
  `recordScorecard` inside `CODEX_PROVIDER`) move to a shared module in the refactor.

## Fork 1 — Which table does the ruling govern?

**Fork-existence.** A forced invariant. The card's literal proposal, (c), is the **excluded branch**:
converting only the kind table cannot meet the card's own goal, because an Antigravity vendor is not a row in
it. (b) is excluded on cohesion: the kind vocabulary has one owner, and a kind descriptor would split it.

- **(a) The vendor axis only — recommended.** The ruling governs how an agent vendor registers. The kind
  table stays a closed, load-checked table.
  - It targets where the collision is (see *What is true today*).
  - The kind set has one owner. A kind exists because we:scripts/operations/dispatch-lane.mjs names it in
    `LAUNCH_KINDS`, `BRIEF_REQUIRED_BY_KIND` and `sessionSlugFor`. A kind descriptor could not make a kind
    exist on its own; the load check (we:scripts/operations/dispatch-provider-registry.mjs:129-145) already
    refuses any key the operation does not know. Self-registration there would give a file the look of
    ownership over a set it cannot change.
  - **Against it:** the kind table stays a central, hand-edited table — which is correct for a closed set
    with one owner.
- **(b) Both tables.** Rejected: a descriptor file per kind would split the kind's definition between
  we:scripts/operations/dispatch-lane.mjs (which owns the vocabulary) and a descriptor (which would appear to).
- **(c) The kind table only (the card as filed).** Rejected as the excluded branch: it leaves the vendor
  collision untouched.

**Default: (a).**

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The skeptic confirmed the core fact (the kind table has no
vendor field; a vendor enters through `--provider=` and the three wrapper tables) and re-classified the fork
as a scope correction plus a forced invariant rather than a weighed choice. The fork-existence line now says
so, and a cost-phrased "against" line ("its remaining growth is one row") was removed.

**Screen:** flagged(prio) → fixed. Q1 clear (anyone adding a kind or a vendor sees which table they edit).
Q2 flagged the same "remaining growth is one row" line as a cost argument; it is gone, and the downside is now
stated on merit.

## Fork 2 — How is a vendor collected into the registry?

**Fork-existence.** The options produce different runtime sets of execution paths and different things a
vendor can say. Under (b) the set is whatever files are present in a directory; under (a) it is what one
index imports; under (c) it is three tables forced equal, so every vendor covers every kind. They cannot all
be the rule.

- **(a) One descriptor module per vendor, listed in one explicit static index — recommended.** Each vendor
  is one file, `we:scripts/operations/agent-providers/<vendor>.mjs`, holding its per-kind spawn adapters
  (Fork 3). One small module, `we:scripts/operations/agent-provider-registry.mjs`, imports every descriptor
  statically and checks them at load. Every wrapper and every `*-run.mjs` selector resolves a vendor
  through it, per kind.
  - One definition per vendor, and each kind a vendor can run is a fact of that definition. "Antigravity runs
    `build` and `fix` but not `ci-heal`" becomes expressible.
  - The set of vendors that can run is visible in source and in the import graph, which the repo's own
    tooling reads (for example `@wired-by-*` markers and we:scripts/lib/skill-operation-wiring.mjs).
  - It matches the repo's pattern for executable registries (`OPERATIONS`, the kind table) and the prior art
    for single-owner repos (ESLint flat config, Vite, AI SDK).
  - **Against it:** a vendor is still named in one shared file, by one import and one array entry.
- **(b) Runtime directory discovery** (read the `agent-providers/` directory, `import()` each file).
  Rejected on merit:
  - The set of execution paths becomes "whatever files are present". A stray, half-written or leftover file
    in a lane becomes a live dispatch path with no line anywhere that says so.
  - The import graph no longer shows which vendors exist, so graph-derived checks go blind.
  - ESLint ran name-based discovery for years and reversed it.
- **(c) Keep three per-wrapper tables (today).** Rejected on merit: the tables are held equal by tests
  (we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs:653,
  we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs:590), so a vendor's per-kind capability
  cannot be stated — every vendor must cover every kind or none. A vendor's definition is also split across
  three places with no single one that is its definition.

**Default: (a).**

**Code shape** — Fork 2 (a), with the real port each adapter implements (`DeliveryAgentProvider.spawn`,
we:scripts/operations/deliver-item-wrapper.mjs):

```js
// we:scripts/operations/agent-provider-registry.mjs — THE INDEX. One import + one entry per vendor.
import { descriptor as claudeRestricted } from './agent-providers/claude-restricted.mjs';
import { descriptor as codex } from './agent-providers/codex.mjs';
import { descriptor as antigravity } from './agent-providers/antigravity.mjs';

// Checked at load: throws a TypeError naming descriptor.file on any bad entry (see Supported by default).
export const AGENT_PROVIDER_REGISTRY = buildAgentProviderRegistry([claudeRestricted, codex, antigravity]);

// Replaces DELIVERY_AGENT_PROVIDERS, FIX_AGENT_PROVIDERS and CI_HEAL_AGENT_PROVIDERS.
export function resolveAgentProvider(kind, name, registry = AGENT_PROVIDER_REGISTRY) { /* per kind; Fork 4 */ }
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The skeptic refuted a load-bearing fact in the first draft:
it said "nothing checks" the three tables agree, but two tests do (`:653`, `:590`). With that gone, (c)'s
rejection had shrunk to a maintenance cost, so it was re-grounded on expressiveness (the tests force full
coverage, so per-kind capability cannot be stated). The skeptic also showed that (b)'s "async `import()`
versus synchronous readers" argument was misattributed (those readers read the *kind* registry; vendor
resolution happens in the `*-run.mjs` processes), so it was deleted. It confirmed no new import cycle as long
as the registry is imported only by wrappers and `*-run.mjs`; that is now stated under *Supported by default*.

**Screen:** flagged(prio) → fixed. Q1 clear. Q2 flagged the same two reasons: (c)'s "must agree by
convention / code split across files" reads as upkeep, and (b)'s async point is a solvable build limit. Both
were rewritten or removed as above; what remains is merit (expressiveness, visibility of the live set).

## Fork 3 — What may a descriptor declare about itself?

**Fork-existence.** A forced invariant. (b) and (c) are **excluded**: a descriptor that declares its own
fitness or trust would certify itself, against the ratified rule that trust is earned from trial data and
promoted only by an explicit act (#3690;
[#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria)),
and one that declares its cascade position would move the routing order out of the router, against #3717's
fixed criteria.

- **(a) Mechanics only — recommended.** A descriptor declares facts about *how* the vendor runs, never how
  good it is:
  - `name` — the vendor name used by `--provider`, `DELIVERY_AGENT_PROVIDER` and `deliveryAgent:`;
  - `routingProvider` — the `PROVIDERS` id (we:scripts/lib/dispatch-contracts.mjs:40) this vendor records as
    provenance: `antigravity` for Antigravity, `codex` for Codex. Which *route* it can serve is not the
    descriptor's to say: the router's fixed `EXECUTOR_PROVIDERS` groups decide it (a `gemini` route is served
    by `gemini` or `antigravity`), and the router owns any tie-break. `both` has no executor and stays as
    today;
  - `kinds` — one spawn adapter per launch kind it can run. A kind with no adapter is a hard *cannot*: the
    router does not offer that vendor for that kind, and Fork 4 rules what an explicit marker does;
  - `sandbox` — informational facts only (for example, Codex runs with no network, per
    we:scripts/operations/codex-delivery-provider.mjs's header). No gate reads it.
  The `kinds` filter runs in one place: the `*-run.mjs` selector, through `resolveAgentProvider`, which is
  the only place a vendor is chosen today (the kind's detached provider passes `--provider=`,
  we:scripts/operations/dispatch-providers/build.mjs:117-121; the selector resolves it,
  we:scripts/operations/deliver-item-run.mjs:115-123). Neither we:scripts/lib/dispatch-contracts.mjs nor
  we:scripts/operations/dispatch-lane-io.mjs imports the vendor registry, so no import cycle forms and spawn
  code stays out of the pure library. The run record's `executedProvider: EXECUTABLE_PROVIDER`
  (we:scripts/operations/dispatch-lane-io.mjs:1303) is replaced by the vendor the child actually ran, as the
  child reports it back — not by a second filter at the boundary. Handing the router's `routed` answer to the
  child's `--provider` is a separate wiring step outside this card (#3717, #3443).
- **(b) The descriptor also declares fitness** (task types it is good at, a supervision level). Rejected as
  excluded: self-certification. Trust belongs to `{provider, model, taskType}` evidence in
  we:scripts/conveyor/run-scorecards.json, read by `selectSupervisionLevel`.
- **(c) The descriptor also declares a cascade rank or priority.** Rejected as excluded: the cascade order
  (Gemini/Antigravity, then Codex, then both, then Claude; we:scripts/lib/provider-routing.mjs:30-34) is
  router policy.
  Ranks spread across files would make the order depend on which files merged, and two equal ranks a silent
  tie.

**Default: (a).**

**Code shape** — Fork 3 (a) versus the rejected (b)/(c):

```js
// we:scripts/operations/agent-providers/antigravity.mjs — Fork 3 (a): MECHANICS ONLY.
export const descriptor = Object.freeze({
  file: import.meta.url,                     // for load-time error messages
  name: 'antigravity',
  routingProvider: 'antigravity',            // provenance id; the router maps route 'gemini' → {gemini, antigravity}
  kinds: Object.freeze({
    build: { spawn: antigravityBuildSpawn }, // DeliveryAgentProvider.spawn port
    fix: { spawn: antigravityFixSpawn },
    // no `ci-heal` → never offered for ci-heal; an explicit marker follows Fork 4
  }),
  sandbox: Object.freeze({ network: 'unverified' }), // informational; no gate reads it
});

// REJECTED — Fork 3 (b)/(c): the descriptor grading and ordering itself.
//   fitFor: ['bugfix', 'doc-fix'], supervision: 'spot-check', cascadeRank: 1,
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The skeptic broke the first draft's mapping: it had
`routingProvider: 'antigravity'` matching a route directly, but the router never recommends `antigravity`
(its set is `gemini | codex | both | claude`, we:scripts/lib/provider-routing.mjs:5), and
`EXECUTOR_PROVIDERS` maps many providers to one executor. It also showed that deriving `EXECUTABLE_PROVIDER`
inside the contracts module would create two import cycles and put spawn code in a pure library. The default
now matches routes through the router's own groups and does the capability filter at the dispatch boundary.
It also confirmed (b) and (c) are already excluded by #model-probation-graduation-criteria and #3717, so the
fork is a forced invariant. A second-round skeptic then found the boundary paragraph wrong: vendor selection
does not happen in we:scripts/operations/dispatch-lane-io.mjs (it imports the kind table, not a vendor registry, and hands no
route to the child). The paragraph now puts the filter in the `*-run.mjs` selector, the only place a vendor is
chosen.

**Screen:** clear, with one fix applied. Q1 and Q2 clear (both rejections are merit: self-certification, and
an order that depends on merges). The screen flagged an open "the router **may** filter by `kinds`" as a
choice left in prose; it now says the router filters.

## Fork 4 — What happens when an item's marked vendor cannot run this kind?

**Fork-existence.** One `deliveryAgent:` marker applies to `build`, `fix` and `ci-heal`
(we:scripts/operations/delivery-agent-marker.mjs:4-6). Once Fork 2 lets a vendor lack a kind, an item marked
`deliveryAgent: antigravity` can need a kind Antigravity cannot run. For one dispatch the branches cannot
coexist: the dispatch either runs on another vendor or does not run.

- **(a) Split by what the kind is for: refuse for `build`, fall back for repairs, and record it apart from
  routing — recommended.**
  - **`build`: refuse by name, before a lane is acquired.** The marker is "a per-item marker a human sets on
    purpose" to choose who *delivers* the item (we:scripts/operations/delivery-agent-marker.mjs:9-11). A
    vendor with no `build` adapter cannot honour that choice, and quietly delivering with Claude would replace
    it for the one kind the marker exists for. The error names the vendor and the kind, the same shape the
    selector already uses for an unknown name (we:scripts/operations/deliver-item-run.mjs:108-109).
  - **`fix` and `ci-heal`: fall back to `claude-restricted`.** A repair to an open PR should still happen; the
    marker's purpose (who delivers) is not at stake in a repair.
  - **Record it in its own fields:** `requestedVendor: <marked>, executedVendor: claude-restricted, reason:
    'no <kind> adapter for <marked>'`. These are kept apart from #3717's `routedProvider`/`executedProvider`
    (we:scripts/operations/dispatch-lane-io.mjs:1302-1303), which record the *router's* answer. A marker
    fallback must never be counted as a router delegation gap in the trial data. This follows #3717's rule
    that a fallback is recorded, never silent (backlog/3717 criterion 3), without reusing its fields.
  - **Against it:** a marked item whose vendor lacks `build` does not build until someone changes the marker.
    That is the intended outcome: the human's explicit choice is not overridden.
- **(b) Refuse for every kind.** Rejected: a repair of an open PR marked for a vendor without that repair
  kind could never run through the mechanical path, although nothing about who delivered the item is at
  stake in a repair.
- **(c) Fall back for every kind** (the first draft's default). Rejected: for `build` it silently replaces the
  human's explicit delivery choice, which is the marker's whole purpose; and the first draft wrote the
  fallback into `routed`/`executed`, mixing a marker gap into the router's accounting.

A per-kind marker (`deliveryAgent: { build: antigravity, fix: codex }`) is not a branch of this fork: it is a
compatible extension of the marker, and a kind it names can still lack an adapter, so it would still follow
(a). It is not proposed here.

**Default: (a).**

**Code shape** — Fork 4 (a):

```js
// we:scripts/operations/agent-provider-registry.mjs — called by each *-run.mjs selector.
export function resolveAgentProvider(kind, requested, registry = AGENT_PROVIDER_REGISTRY) {
  const d = Object.hasOwn(registry, requested) ? registry[requested] : null;
  if (!d) throw new TypeError(`unknown agent provider ${JSON.stringify(requested)} — one of ${Object.keys(registry).join('|')}`);
  if (d.kinds[kind]) return { requestedVendor: requested, executedVendor: requested, adapter: d.kinds[kind] };
  if (kind === 'build') {
    throw new TypeError(`agent provider ${requested} has no build adapter — the deliveryAgent marker cannot be honoured`);
  }
  const fallback = registry[DEFAULT_AGENT_PROVIDER_NAME];   // 'claude-restricted', which runs every kind
  return { requestedVendor: requested, executedVendor: fallback.name, adapter: fallback.kinds[kind],
    reason: `no ${kind} adapter for ${requested}` };
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Second-round skeptic, run on this fork alone after the screen
surfaced it. It confirmed a real fork (for one dispatch, run-elsewhere and don't-run cannot both happen) with
no statute overlap. It broke the first draft's all-kinds fallback on three points, each verified: `routed` is
the router's answer (we:scripts/operations/dispatch-lane-io.mjs:1293-1302), so writing a marker fallback there
would pollute the trial data; for `build`, fallback defeats the marker's purpose; and neither precedent the
draft cited reached the case (the marker reader's best-effort posture covers only an *unreadable* marker, and
#3717 step 6 is a stopgap for a missing port, not an explicit human choice). The default is now split by kind
with separate record fields, and the two mis-scoped citations were dropped.

**Screen:** flagged(prio) → fixed. Q1 clear (the operator, the item author and the run record all see the
outcome). Q2 clear for (a) versus (b): every reason is merit. Flagged on the old (c), a per-kind marker:
"changes the marker's shape" was a cost reason, and the option composes with (a) rather than competing. It is
now stated as a compatible extension, not a branch. The screen also noted the prose said the selector
resolves the vendor while the sketch put it in the registry; the sketch now says the selectors call it.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** for the work this decision authorizes, coarse and prefix-shaped —
`we:scripts/operations/agent-providers/` · `we:scripts/operations/agent-provider-registry.mjs` ·
`we:scripts/operations/deliver-item-wrapper.mjs` · `we:scripts/operations/fix-dispatch-wrapper.mjs` ·
`we:scripts/operations/ci-heal-dispatch-wrapper.mjs` · `we:scripts/operations/deliver-item-run.mjs` ·
`we:scripts/operations/fix-run.mjs` · `we:scripts/operations/ci-heal-run.mjs` ·
`we:scripts/operations/dispatch-lane-io.mjs` · `we:docs/agent/platform-decisions.md`. All but the last are on
the prototype branch. A buildable child carved at resolve time takes its own slice: the registry +
descriptors child takes `we:scripts/operations/agent-provider-registry.mjs` +
`we:scripts/operations/agent-providers/` + the three wrappers + the three run entry points; a routing child
(the capability filter and the `routed`/`executed` record) takes `we:scripts/operations/dispatch-lane-io.mjs`;
the codification takes `we:docs/agent/platform-decisions.md`. The frontmatter `scope:` above was set at
filing and names the kind table; under Fork 1 (a) it is not the build scope.

## The idea (as filed)

we:scripts/operations/dispatch-provider-registry.mjs's DISPATCH_PROVIDER_REGISTRY is a single frozen object literal every new mechanical-dispatch provider must be hand-edited into (its own docblock already names the cost: five copies of the same conditional branch and five env reads all land on the same handful of lines in the same 2000-line file, so unrelated lanes serialize on a textual conflict that has nothing to do with the work). Propose replacing the shared-object-literal shape with a self-registering descriptor pattern: each provider module (we:scripts/operations/dispatch-providers/*.mjs) exports its own {kind, provider, modeEnv, defaultMode} descriptor, and the registry discovers/imports them rather than being centrally hand-edited -- the same registry shape this repo already uses at we:scripts/lib/poc-branches.mjs (a frozen table plus pure fail-closed lookups, written via a declared registration step rather than hand-edited) and at we:scripts/lib/constellation-repos.mjs.

Evidence this is a live collision surface, not speculative: two independent sessions were both touching provider/judge-dispatch-related files concurrently tonight (2026-09-13) -- this session modifying we:scripts/lib/codex-judge-spawn.mjs twice (a model-pinning fix and a tool-free mislabeling fix) on lane/mechanical-dispatcher, and a peer session (webeverything-85, PR #2115) independently adding the same file as new work targeting main. One real file overlap was found on we:scripts/lib/codex-judge-spawn.mjs itself. A self-registering descriptor pattern for DISPATCH_PROVIDER_REGISTRY would reduce exactly this class of concurrent-provider-integration collision for the dispatch-provider registry specifically.

Raised jointly: webeverything-85 (a peer session working PR #2115) independently proposed this same restructuring and agreed it is structurally right, but flagged -- correctly, per this repo's never-take-an-unprepared-decision doctrine (no ruling without a preparedDate) -- that it should be prepared and ratified as a decision, not built ad hoc. This card is filed jointly on that basis: webeverything-85 raised/agreed the direction, this session (epic #3383) is filing it through the declared operation. Needs a prepare pass before it is ready to ratify; not built here. *(Prepare pass done 2026-09-21.)*

**Note (prep, 2026-09-21):** the filed evidence is a collision on we:scripts/lib/codex-judge-spawn.mjs, the
review-judge seam — neither the kind table nor a vendor table. It shows provider work colliding in general;
it is not evidence about `DISPATCH_PROVIDER_REGISTRY` in particular.

## Done when

1. **Executable** — `grep -c '^## Fork ' we:backlog/3658-self-registering-provider-descriptors-for-dispatch-provider.md`
   prints `4` and the card carries `preparedDate` (failed before: zero forks, no `preparedDate`).
2. **Prepared, not ruled (2026-09-21).** Four forks are authored with bold defaults, a `Skeptic:` and a
   `Screen:` line each, and the research topic is published. The call stays the operator's; `status` stays
   `open`.
3. **At ratification:** the ruling is codified as a `we:docs/agent/platform-decisions.md` anchor and
   `codifiedIn` is set; the build is carved into children scoped per the touch-set above.
