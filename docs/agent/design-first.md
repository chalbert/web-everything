# Design-First — The Website IS the Spec

> Tier-1 reference. Read before adding or changing any block, plug, or intent.

The documentation website (`src/_data/*.json` + `src/_includes/*-descriptions/*.njk`) is the **source of truth**. Implementation follows the documented API — if something isn't documented yet, **document it first**, then implement.

## The method (every standard)

Author **every** standard the same way. Four steps, research → plan, *before* any `*.json`/`.njk` is written:

1. **Research prior art & feature scope.** Browser standards (MDN / WHATWG / W3C — current, draft, proposal), established libraries (e.g. Floating UI, Mousetrap), framework patterns (React, Vue, Angular, Solid), and the benchmarks tracked in `references.json` (MD3, Carbon, Radix, Fluent, Apple HIG, WAI-ARIA). **Reuse established terminology** — don't coin a new term when the platform already has one.
   
   **Produce a feature-inventory table:** List every candidate capability the standard might cover. For each feature, assign a **disposition** — `built-in` (we implement in the default), `adapter` (delegate to a third-party lib via an adapter), or `compose` (defer to an existing WE standard, cross-referenced) — plus a **tier** (`1` = ship now, `2` = basic built-in / better via adapter, `3` = defer / adapter-only). This makes scope reviewable at a glance and forces overlap analysis to be concrete. **Adopt a native-first default:** when the web platform provides a standard (CSS Anchor Positioning, Popover API, etc.), the built-in/default implementation should extend and lean on it; third-party libs are opt-in enhancements via adapters, not the baseline.
2. **Verify overlap & relationship.** Grep the existing registries **one entry at a time** (`intents.json`, `blocks.json`, `plugs.json`, `adapters.json`, `projects.json`, `semantics.json`). Classify the new thing against what exists:
   - **duplicates** → stop; extend the existing entry instead.
   - **extends / specializes** an existing standard → note the parent.
   - **composes-with** an existing standard → cross-reference both ways (e.g. positioning composes with Web Portals for top-layer).
   - **net-new** → proceed.
   Watch for phantom references — a name used by an adapter/registry/glossary term but defined nowhere (define it, don't re-invent it).
3. **Determine semantics (term-first).** Identify the terms the standard introduces. Every new term **must** be added to `semantics.json` (AGENTS.md hard rule 3). Flag collisions with existing terms (e.g. *virtual element* already means comment markers in Web Directives — pick a distinct name).
4. **Plan, then design-first.** Write a plan naming **which layer(s)** to create (see cheat-sheet below) *and* the plugs/implementations that follow. When a standard exists so **many libraries/vendors can interoperate** (e.g. positioning engines, keyboard handlers), prefer a **registry + provider-contract plug** design ("one engine, all consumers delegate via the injector chain") with thin adapters — **do not reimplement** the third-party lib. Draft the spec **with open questions**, capture unresolved forks as **open decisions written into the plan with a recommended default in bold** (not rapid-fire popups), and iterate in **plan mode** before writing anything. Then implement and run the **Definition of Done** (AGENTS.md): `gen:inventory` if you added a block/plug/intent, `check:standards`, affected tests.

## Materialization strategy (plan → discrete homes)

When a standard's design is large (UX catalog, multiple axes, cross-cutting composition), the plan will be too big to keep in context. **Materialize it into discrete, real homes and refine there**, rather than keeping everything in the plan file.

The validated pattern:

1. **Identify discrete deliverables** from the planning phase (research report, intent, block, glossary terms, research topic, etc.).
2. **Extract to their real files** in priority order:
   - Research-heavy standards → `reports/{date}-{title}.md` (assessment, catalogues, citations, research grounding). A major discovery → also add a `researchTopics.json` entry + corresponding `.njk` description.
   - JSON artifacts → `src/_data/{intents,blocks,semantics,etc}.json` (one entry per layer).
   - Descriptions → `src/_includes/{block,plug,research}-descriptions/{id}.njk` (overview, tables, features, interface).
3. **Refine in place.** The website files (`.json` + `.njk`) are the source of truth — edit them directly, not the plan. Plans are scaffolding; website is the spec.
4. **Track decisions.** For standards with many open decisions, add a **Next Steps** section to the report documenting outstanding phases, and an **Open Points Register** listing what's pending decisions (`🔶 DECIDE`), conflicts (`⚠ CONFLICT`), rough edges (`🔨 ROUGH`), or reconciliation needs (`⚠ RECONCILE`). Include the decision ID, condition, and current recommendation. **Then register those open points in the backlog** — one `backlog/<id>.md` per thread with `relatedReport` pointing at the report (the website tracker; see [backlog-workflow.md](backlog-workflow.md)). Lead the report with a clear `# Title` + a one-line `**Point:**` so it can also be mirrored as a pointer item.

**When to materialize:**
- If the plan exceeds **~500 lines**, extract research / roadmaps into a report. Keeps plan focus tight.
- If the standard introduces **5+ new terms**, materialize them into `semantics.json` as you discover them (not all at once).
- If you uncover a **major discovery** (e.g. a composition pattern shared across multiple standards), create a research topic with a dedicated `.njk` page.

**Example:**
Validation standard research (UX catalog, axis analysis, cross-cutting metas) → extract to `reports/form-validation-standard-assessment.md` + research topic `validation-meta-intent-composition` + intent entry `validation` in `intents.json` + semantics terms + block metadata. Refine each in place. Plan stays lean as an index / decision tracker.

### Which layer? (taxonomy cheat-sheet)

| If the thing is… | It's a… | Lives in |
|---|---|---|
| A cross-cutting domain / mission | **Project** | `projects.json` (+ `project-*.njk`) |
| A conformance contract owned by a Project (interfaces, registries, observable states/events) | **Protocol** | `protocols.json` (registry only); body lives in the owning `project-*.njk`. Catalog at `/protocols/`. |
| A declarative UX/UI profile (the "what") | **Intent** | `intents.json`. Catalog at `/intents/`. |
| A reusable implementation (the "how") | **Block** | `blocks.json` (+ `block-descriptions/{id}.njk`) |
| A patch/extension to a browser primitive | **Plug** | `plugs.json` (+ `plug-descriptions/{id}.njk`) |
| A bridge to a third-party library | **Adapter** | `adapters.json` (+ `adapter-descriptions/{id}.njk`) |

> **Blocks ship code; Protocols ship contracts.** If the entry has no runnable
> implementation — only interfaces, registry shapes, observable states and events that
> independent vendors must satisfy — it is a **Protocol**, not a Block. Protocols are
> always owned by a Project; their normative body lives inside the owning
> `project-{id}.njk` under a stable `<section id="protocol-{slug}">` anchor, and the
> `protocols.json` entry is metadata only (used by the `/protocols/` tile index).

**When to create a new project vs adding to an existing one:** A new project is warranted when the concern is genuinely cross-cutting and _would outgrow_ the host project's scope. Ask: "Could this standard apply outside the host project's domain?" If yes — and especially if it may attract its own registries, plugs, and blocks — give it its own project. Example: error recovery applies to HTTP, database, computation, and any mechanism failure — placing it under Web Resources would have constrained it artificially.

A standard often spans layers: an **intent** declares it, a **block** implements it (`implementsIntent`), an **adapter** bridges a library to it. Plan the whole set in step 4.

## Before implementing
1. Check if it's documented in `src/_data/blocks.json` / `plugs.json` / `intents.json`.
2. Read the design in `src/_includes/{block|plug}-descriptions/{id}.njk`.
3. Follow the documented API; consult the `designDecisions` field for rationale. If you disagree with a decision, **discuss with the user before changing it**.

## Block Standard vs. Implementation (Critical Distinction)

**In Web Everything (the standard):**
- ✅ Define **contracts** — registry names, interface shapes, observable states/events, usage patterns
- ✅ Define **decision points** — "teams can register strategies X, Y, or custom Z"
- ✅ Show **pseudocode/signatures** — demonstrate the interface with minimal-to-no impl details
- ✅ Link to **provider patterns** — "CustomCommitmentPolicyRegistry holds providers that implement CommitmentPolicy"
- ❌ Do NOT ship concrete implementation code (FullCommitmentPolicy, DeferredCommitmentPolicy class bodies, etc.)

**In Frontier UI (and other adapters/projects):**
- ✅ Implement concrete strategies (FullCommitmentPolicy, DeferredCommitmentPolicy, SeverityGatedCommitmentPolicy, etc.)
- ✅ Register providers in the registry
- ✅ Bootstrap DI with sensible defaults
- ✅ Add tests, examples, framework-specific bindings

**Example:** The Validation block defines `CustomCommitmentPolicyRegistry` + `CommitmentPolicy` interface (what must exist, what methods, what they return). Frontier UI provides `FullCommitmentPolicy` (write on every input) and `DeferredCommitmentPolicy` (buffer until blur). A hypothetical "OptimisticCommitmentPolicy" could be added by another team — the block never needed to define it.

This keeps the standard lean, stable, and extensible. Implementations compete/vary; the contract stays fixed.

## Data files (canonical specs — query per-entry, don't load whole)

| File | Holds |
|------|-------|
| `blocks.json` | Block registry: id, type, status, traits, webStandards, events, designDecisions, implementsIntent |
| `intents.json` | UX protocols: dimensions, contract description, designSystemResearch, lifecycle events |
| `plugs.json` | Core primitive specs: exports, usage, designDecisions |
| `semantics.json` | Glossary — see [conventions.md](./conventions.md) |
| `references.json` | External benchmarks by category |
| `traits.json` · `adapters.json` · `projects.json` · `demos.json` | Supporting registries |

## Research before designing a new block
- **Web standards**: MDN, WHATWG, W3C (current, draft, proposal).
- **Framework patterns**: React, Vue, Angular, Solid, etc.
- **Terminology**: reuse established terms from standards and major frameworks.

## Adding a protocol

A **Protocol** is a conformance-only contract — interfaces, registry shapes, observable states/events, design decisions — that independent vendors implement. Protocols are **owned by a Project**, never by a Block. The Project page is the canonical home; `protocols.json` is just the discovery surface that backs the `/protocols/` tile index.

1. Identify (or create) the **owning Project**. The owner is the cross-cutting domain whose mission the contract serves (e.g. Error Recovery → Web Reliability, Validation → Web Validation). If no existing project fits, create one — see "When to create a new project" above.
2. Add an entry to `src/_data/protocols.json` with:
   - `id` (kebab-case), `name`, `summary` (one line), `status` (lifecycle).
   - `ownedByProject` — must resolve in `projects.json`.
   - `realizesIntent` — optional; if the protocol gives the technical contract for a UX intent, link it.
   - `anchor` — the in-project section id (default `protocol-{id}`).
3. Write the **normative body inside the owning `project-{ownedByProject}.njk`** under `<section id="{anchor}" class="section-card">`. Include: contract overview, interface shapes (TypeScript), registry usage pattern, observable states/events, design decisions, web standards alignment. Use the same "contracts only, no concrete implementations" rule as blocks.
4. Add any new terms to `semantics.json`.
5. Concrete implementations of the protocol live in **Blocks** (or adapters/projects like Frontier UI). A block that implements a protocol declares `implementsProtocol: "{protocol-id}"` alongside `implementsIntent`.

## Adding a block
1. Add entry to `blocks.json` (id, name, status, type, summary, exports, sourcePath, dependsOn, `webStandards`, `designDecisions`, optional `frameworkComparison`).
2. Create `src/_includes/block-descriptions/{id}.njk` with: overview, **Web Standards Alignment** table, **Framework Research** table (if applicable), features, usage, API reference, exports.
   - **Contracts only:** Define registry names, interface signatures, observable states/events, observable attributes.
   - **Pseudocode/usage patterns:** Show how providers register and are resolved, but do not ship concrete provider implementations (those belong in adapters/projects like Frontier UI).
   - **Examples of what to include:** "Implementations must provide a `CommitmentPolicy` with `shouldCommit(fieldId, value, context): boolean` method." Or: "Built-in strategies: `full` (write on input) and `deferred` (buffer until blur). Custom strategies can be registered via `CustomCommitmentPolicyRegistry.register(name, provider)`."
   - **Examples of what to exclude:** Full class bodies for `FullCommitmentPolicy extends CommitmentPolicy { shouldCommit(...) { return true; } ... }` — that's Frontier UI's job.
3. Add any new terms to `semantics.json`.

## Adding a plug

When a plug enables **many independent components to delegate to a single provider** (e.g. positioning engines, keyboard handlers, context resolution), use the **registry + provider-contract pattern**: define a `Custom[Name]Registry` global plug that hosts a `Custom[Name]` base class/interface. Each provider (built-in, or third-party via an adapter) implements that one contract and registers by name. Components resolve the registry and call the one interface — so the app ships **one** engine, not duplicates bundled per vendor.

When the registry holds **ordered, competing handlers** (e.g. error recovery, expression parsers, route matchers), use the **first-that-accepts** pattern: the registry iterates registered items in definition order; each item exposes a `try*()` method returning a result or `null`; the first non-null result wins and iteration stops. Registration order is intentional priority — document it. This avoids a custom chain object; the registry's own `values()` iterator is the chain.

Example: `CustomPositioningRegistry` + `CustomPositioner` contract. The default provider drives native CSS Anchor Positioning; `CustomPositioner` is what every adapter (Floating UI, etc.) satisfies. A component never imports Floating UI — it resolves the registry and delegates.

1. Add entry to `plugs.json` (id, name, type, summary, status, projects). 
2. Create `src/_includes/plug-descriptions/{id}.njk` with: overview, **Web Standards Alignment** table, interface/contract definition, **feature inventory** (if applicable), usage (registered + resolved), design decisions (why a registry; native-first rationale; composition boundaries with other standards).
3. Update `plugs/bootstrap.ts` if it becomes a global.
4. Create thin **adapters** that implement the contract; each adapter is an `adapters.json` entry + `adapter-descriptions/{id}.njk` explaining how it bridges the third-party lib to the plug's interface.

## Adding an intent
Intents are **JSON-only** — there is no `intent-descriptions/` njk dir; the spec renders from an inline HTML `description` field. **Intents describe the UX contract only.** Do not include implementation details (conformance tiers, DI concerns, type shapes, registries) — those belong in the block description.

1. Add entry to `intents.json`:
   - `id`, `name`, `status` (lifecycle — see below), `summary` (one line).
   - `dimensions` — named axes, each `{ description, values: [...] }`. The dimensions ARE the UX protocol's vocabulary. **Required (at least one).** `check:standards` warns if missing.
   - `description` — inline HTML describing the UX contract: message placement (where do users see output?), severity/outcome (what does each level mean?), interaction states (what can users observe?), composition with other intents. Include a per-level vocabulary that describes what users see/do at control/group/form/nested levels. Do NOT include conformance tiers, DI concerns, type shapes, or registry patterns — move those to the block.
   - Optional: `events` (lifecycle events the intent emits, described at a high level), `designSystemResearch` / `uxResearch` (benchmark comparison), `researchGaps` (open questions).
2. Add any new terms to `semantics.json`.
3. Link implementing blocks back via `implementsIntent: "{id}"` in `blocks.json`.

> **Catalog auto-renders.** The `/intents/` tile catalog reads `intents.json` directly — no extra registry file to maintain. Tiles show name, status badge, summary, and the intent's dimension keys as chips; search filters across name/summary/dimension keys. Keep `summary` scannable (one line, vocabulary-rich) so search hits it. Prefer reusing established `dimensions` key names across related intents where it makes sense (e.g. `level`, `modality`, `mode`, `strategy`, `placement`) so the catalog stays coherent — but introduce a new key freely when the UX axis is genuinely new.

## Table formats (njk)
```html
<h3>Web Standards Alignment</h3>
<table><tr><th>Standard</th><th>Status</th><th>How We Adopt It</th></tr>
  <tr><td><a href="https://...">API</a></td><td>Baseline 2024</td><td>…</td></tr></table>

<h3>Framework Research</h3>
<table><tr><th>Framework</th><th>Key Patterns Adopted</th></tr>
  <tr><td><a href="https://...">React Router</a></td><td>Loaders, outlets, useParams</td></tr></table>
```

## Block types & status
- **Types**: Store · Parser · Behavior · Directive · Component · Module.
  - **Behavior** — CustomAttribute attached to a DOM element. Cannot act standalone; requires an element host. Use for capabilities that augment existing elements (type-ahead on a listbox, broadcast on a button).
  - **Module** — Standalone injectable service or logic unit. Resolved from the injector chain, not bound to a DOM element. Use for services that are _called by_ other blocks (Resource Loader querying a retry handler).
  - A block that "needs to be added to a DOM element to do anything" → **Behavior**. A block that "is instantiated and called by another block" → **Module**. A standard that "defines what other implementations must satisfy" is **not a block** — it is a **Protocol** (see Adding a protocol below).
- **Status — one canonical lifecycle for blocks AND plugs** (and intents, demos, resources, states):
  `concept` (planned, ~10%) → `draft` (partial, ~50%) → `experimental` (works, unstable, ~60%) → `active` (ready, 100%).
  - ❌ Do **not** use `implemented`, `stable`, `done`, `planned`, `wip` — these are deprecated synonyms; `check:standards` rejects them. (`implemented` → `active`.)
  - Research topics use a separate axis: `open` / `resolved`.
  - `poc` exists only at the coarser **project** level (`projects.json`), not for blocks/plugs.

## Reference benchmarks (keep Intents comprehensive supersets)
Material Design 3 · Carbon (IBM) · Radix UI · Fluent 2 · Apple HIG · WAI-ARIA. Tracked in `references.json`.

## Documentation Standards (11ty/Nunjucks)
- Content lives in `src/_data/*.json`; render with `.njk`. Use `{% highlight "typescript" %}` for code; keep snippets short to avoid horizontal overflow.
- Project page = high-level mission + grid of cards; sub-spec pages = dedicated detail pages.
