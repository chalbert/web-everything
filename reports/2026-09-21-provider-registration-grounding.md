# Provider registration for mechanical dispatch — grounding for #3658

Date: 2026-09-21. Session: prepare-3658. Prototype branch read at `origin/lane/mechanical-dispatcher`
`13affbab1`; main read at `18798aec3`. Every file under `we:scripts/operations/dispatch-provider*`,
`we:scripts/operations/*-wrapper.mjs` (fix, ci-heal, prepare-scope, prepare-decision),
`we:scripts/operations/codex-delivery-provider.mjs`, `we:scripts/lib/dispatch-contracts.mjs` and
`we:scripts/lib/codex-model-routing.mjs` was read with `git show origin/lane/mechanical-dispatcher:<path>`:
none of them is on main.

## 1. The card's claim, tested

The card says every new provider hand-edits one shared table (`DISPATCH_PROVIDER_REGISTRY`), so an
Antigravity provider collides with other lanes. **Half true.**

- `DISPATCH_PROVIDER_REGISTRY` (`we:scripts/operations/dispatch-provider-registry.mjs:77`) is keyed by
  **launch kind** — `build`, `prepare`, `fix`, `prepare-decision`, `ci-heal`. Its key set is closed:
  every key must be a member of `LAUNCH_KINDS` (`we:scripts/operations/dispatch-lane.mjs:188`, six members),
  and the file throws at module load if one is not (`:129-145`). Five of six kinds already have a row. The
  table can grow by exactly one more row (`investigate`).
- That table **already removed** the collision the card describes. Its own docblock (`:8-16`) and the
  `we:scripts/operations/dispatch-lane-io.mjs` extraction note say so: five lanes were each adding an `if (kind === …)` arm to the
  router in one 2000-line file. After the extraction on 2026-09-12 (`62f4ce383`), the four sibling kinds
  landed the same day as one import plus one row each (`49c46c3d2`, `20129c38e`, `5f6e6ba0c`, `00e81eacb`).
- **An Antigravity (or any new vendor) provider is not a row in that table.** A vendor is the CLI that runs
  the agent. It lives on a different axis, in three parallel tables inside the wrappers, plus the contracts:

| Where a new vendor must be added today | File (prototype branch) | Size of file |
| --- | --- | --- |
| `DELIVERY_AGENT_PROVIDERS` + a ~90-line `CODEX_PROVIDER`-shaped object | `we:scripts/operations/deliver-item-wrapper.mjs:830`, `:920` | 1856 lines |
| `FIX_AGENT_PROVIDERS` + `FIX_CODEX_PROVIDER`-shaped object | `we:scripts/operations/fix-dispatch-wrapper.mjs:392`, `:465` | 852 lines |
| `CI_HEAL_AGENT_PROVIDERS` + `CI_HEAL_CODEX_PROVIDER`-shaped object | `we:scripts/operations/ci-heal-dispatch-wrapper.mjs:443`, `:508` | 862 lines |
| `PROVIDERS`, `EXECUTORS`, `EXECUTOR_PROVIDERS`, `EXECUTABLE_PROVIDER` | `we:scripts/lib/dispatch-contracts.mjs:40-50`, `:759` | — |
| the cascade names vendors inline (`['gemini','antigravity']`, `'codex'`) | `we:scripts/lib/provider-routing.mjs:423`, `:452`, `:500-512` (identical on main) | — |

  `we:scripts/operations/prepare-scope-wrapper.mjs:218` and `we:scripts/operations/prepare-decision-wrapper.mjs:416` have a Claude provider only, no
  vendor table.

So the collision surface for "add Antigravity" is real, and wider than the card says: three wrappers of
850–1850 lines, each gaining a vendor object and a table row, plus the contracts. It is just not the table
the card names.

## 2. The three tables are forced equal — so per-kind capability cannot be stated

*Corrected after the skeptic pass.* The first draft said nothing checks that the three vendor tables hold the
same keys. That was wrong: the wrapper tests assert it
(`we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs:653`,
`we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs:590`, both
`expect(Object.keys(…)).toEqual(DELIVERY_AGENT_PROVIDER_NAMES)`). So a vendor added to one table only fails
CI. The real consequence is the opposite one: every vendor must cover every kind, so "this vendor runs
`build` and `fix` but not `ci-heal`" cannot be expressed. Two smaller facts stand: the error text of
`resolveFixAgentProvider` and `resolveCiHealAgentProvider` lists the **build** table's keys as the legal set
(`we:scripts/operations/fix-dispatch-wrapper.mjs:482`, `we:scripts/operations/ci-heal-dispatch-wrapper.mjs:524`),
and one `deliveryAgent:` marker applies to all three kinds
(`we:scripts/operations/delivery-agent-marker.mjs:4-6`). Once a vendor may lack a kind, the marker needs a
rule for that case — the card's Fork 4.

## 3. What main has

- The `provider` port (#3579): `we:scripts/operations/dispatch-lane-io.mjs:956`, one implementation,
  `defaultClaudeProvider` (`:1016`).
- `DELIVERY_AGENT_PROVIDERS` exists on main too (`we:scripts/operations/deliver-item-wrapper.mjs:776`), but
  its `codex` entry is a stub that throws "no real implementation yet" (`:760-766`). No fix or ci-heal
  vendor tables, no kind registry, no `we:scripts/lib/dispatch-contracts.mjs`.
- `we:scripts/lib/provider-routing.mjs` is on main and identical to the prototype copy.

## 4. In-repo precedent

- **Per-entry files + a glob loader**: `we:src/_data/researchTopics.js` (#1145: the 336 KB single JSON was
  "the highest-churn registry"; per-file means "two parallel-batch lanes preparing different topics never
  collide"), `we:src/_data/blocks/` (#882), `backlog/*.md`. These are data, read by 11ty and CJS loaders,
  not executable modules.
- **Static import + keyed table**: `we:scripts/operations/run.mjs:97` `OPERATIONS` — the repo's busiest
  executable registry (51 commits since 2026-08-01) is one import and one row per operation.
  `DISPATCH_PROVIDER_REGISTRY` copies it, as do `we:scripts/lib/constellation-repos.mjs` and
  `we:scripts/lib/poc-branches.mjs` (the latter moved its table to JSON so it can be **written by a command**).
- **Statute on shared files**: `#merge-risk-optimistic-with-targeted-lock` sorts a shared file into
  ① splittable collection → split per entry; ② purely derived → regenerate on merge; ③ irreducible
  registration monolith → locked. A keyed manifest with distinct-key adds "merges optimistically" behind a
  duplicate-key lint.

## 5. Prior art (survey)

Verified by fetching the page this session:

- **ESLint flat config** moved from name-based plugin discovery to explicit imported plugin objects. Its
  own post: "one of our biggest regrets about eslintrc was recreating the Node.js `require` resolution in a
  custom way" (eslint.org/blog/2022/08/new-config-system-part-2).
- **Vercel AI SDK `createProviderRegistry({ anthropic, openai })`** — an explicit object of imported
  providers; ids are `providerId:modelId` (ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry).
- **Python entry points** — packages advertise objects in an `entry_points.txt` manifest; the host finds
  them without importing them; "if different distributions provide the same name, the consumer decides how
  to handle such conflicts" (packaging.python.org/en/latest/specifications/entry-points).

From the survey, not re-fetched this session:

- **Go `database/sql`** — drivers self-register by an `init()` side effect (`import _ "…/pq"`); `Register`
  panics on a duplicate name. Explicit import still decides what is linked.
- **Java `ServiceLoader`** — manifest files under `META-INF/services`; a bad entry raises
  `ServiceConfigurationError` during iteration.
- **VS Code extensions** — a declarative extension-manifest `contributes` section the host reads without running
  the extension; code loads lazily on activation events.
- **pytest / pluggy** — entry-point group `pytest11` plus explicit `-p` and `conftest.py`.
- **Vite / Rollup** — plugins are an explicit array in the config; no discovery.
- **Backstage new backend system** — features added with explicit `backend.add(import(…))`; package
  discovery is an opt-in extra.

The pattern: discovery is used where **third parties** install plugins the host cannot know about (Python
packages, VS Code marketplace). Where one team owns every plugin in one repo, the ecosystem trend runs the
other way — explicit imports (ESLint's reversal, Vite, AI SDK, Backstage's default). Every system that
self-registers still keeps **trust and ordering out of the plugin**: VS Code's marketplace, not the
manifest, decides what is installed; `database/sql` has no priority; the AI SDK caller picks the model.

## 6. What this reshapes

The card's fork "self-registering vs hand-edited table" is really four questions: which axis (kind or
vendor), how a vendor is collected (discovery or an explicit index), what a descriptor may say about itself
(mechanics vs trust), and what an item's vendor marker does when that vendor cannot run a kind. See the
card's forks.

## 7. What the skeptic pass and the screen changed

- **Routing ids.** The router recommends `gemini | codex | both | claude`
  (`we:scripts/lib/provider-routing.mjs:5`); `antigravity` is provenance under the `gemini` route
  (`EXECUTOR_PROVIDERS` in `we:scripts/lib/dispatch-contracts.mjs:46-50`). A descriptor's `routingProvider`
  is therefore a provenance id, and the router's own groups decide which route a vendor can serve.
- **No import cycle.** Deriving `EXECUTABLE_PROVIDER` inside `we:scripts/lib/dispatch-contracts.mjs` would
  create two import cycles and put spawn code in a pure library. The capability filter goes at the dispatch
  boundary instead, and the registry is imported only by wrappers and the run entry points.
- **Broken-descriptor handling** was re-classed from a fork to "settled by precedent" (the kind registry's
  own load-time check rules it), with the blast radius stated: the operation table in
  `we:scripts/operations/run.mjs` is not affected.
- **Citation scope.** `#merge-risk-optimistic-with-targeted-lock` is analogy, not authority (its clause is
  about the npm manifest). The uncited sibling `#conveyor-dispatch-calls-the-declared-operation` is now
  reconciled: spawn adapters run only inside the wrapper the dispatch sink launches.
- **Cost-phrased reasons removed** from Forks 1 and 2 (the screen's Q2), and one live choice hidden in a
  "supported by default" line — a marked vendor that cannot run a kind — became Fork 4.
