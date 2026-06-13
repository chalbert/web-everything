---
type: decision
workItem: story
size: 8
parent: "097"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-13"
preparedDate: "2026-06-12"
blockedBy: ["266", "094", "102"]
dateResolved: "2026-06-13"
graduatedTo: none
tags: [upgrader, codemod, migration, spec-versioning, breaking-change, machine-readable]
relatedProject: webadapters
relatedReport: reports/2026-06-12-upgrader-version-migration-codemods.md
crossRef: { url: /backlog/094-ai-upgrader-tools/, label: "AI upgrader MVP (#094)" }
---

# Upgrader version-migration codemods — upgrade code across standard/dependency versions

Grounded in the [version-migration codemods prior-art survey](/research/version-migration-codemods/)
([report](../reports/2026-06-12-upgrader-version-migration-codemods.md)) — Angular `ng update` /
`migrations.json`, OpenRewrite, jscodeshift. **No design exists yet, but both prerequisites this item
named already shipped:** the migration *descriptor format* is the resolved `changelog-manifest` protocol
([#102](/backlog/102-changelog-manifest-standard/)) and the *verify gate + provider registry* is
[#094](/backlog/094-ai-upgrader-tools/)'s `upgraderEngine`. So the decision reshapes from "build the
descriptor + engine" into **two design forks** — both with **bold** defaults below: **(1)** the
version-migration upgrader is a **mode/input-adapter of the existing engine**, not a distinct tool;
**(2)** migration transforms are **declarative-first with an imperative escape hatch** (the OpenRewrite
principle). The descriptor format and the verify gate are **ratifies, not forks**.

## Axis-framing

This is the *second* upgrade kind — "across standard/dependency versions" — vs #094's shipped
"legacy → standard" kind. The concern decomposes into three axes; the survey collapses one to a ratify and
leaves two real forks. The **descriptor axis is closed**: the "machine-readable change/migration descriptor
per release" #191 waited on *is* the `changelog-manifest` protocol ([protocols.json:86](../src/_data/protocols.json#L86)),
which already carries per-module entries keyed to semver severity **plus a migration linkage** referencing
the codemod with author/integrity trust — "consumed by upgraders (#094)" by its own ruling; #266 added the
semver-range axis (`compareSpecVersions` [capability-manifest/provider.ts:182](../capability-manifest/provider.ts#L182),
`featureAvailableIn` :193). The **engine/gate axis is closed**: #094 shipped `verifyUpgrade`
([upgraderEngine.ts:142](../blocks/renderers/upgrader/upgraderEngine.ts#L142)), the `upgrade()` orchestrator
(:216), and `CustomAnalyzerRegistry` (:72). What remains open is **placement** (Fork 1: a mode of that
engine vs a distinct tool) and **transform authoring** (Fork 2: declarative descriptor vs imperative codemod
reference). Angular's `ng update` supplies the version-gated, ordered, intermediate-spanning run loop that
maps onto #266's `compareSpecVersions`; OpenRewrite supplies Fork 2's declarative/imperative split.

### Recommended path at a glance

Ratify the two closed axes, then rule on the two forks. The **confidence** column says where judgment is
actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · placement** | a **mode + input-adapter of #094's `upgraderEngine`** (already-conformant source + `changelog-manifest` delta → same `verifyUpgrade` gate), with the analyzer/input seam named correctly as a **devtools provider seam** — not a runtime-registry standard like #052/#081 | a distinct version-migration tool | **Med-high** — anti-drift; #094's own follow-on says "shared core, different input adapter" |
| **2 · transform authoring** | **declarative-first** (engine interprets the descriptor for mechanical changes) **with an imperative codemod escape hatch** for the complex tail | imperative-only (codemod module per change) | **Medium** — OpenRewrite's ruling principle; most-permissive default |
| descriptor *format* | *(ratify)* consume the `changelog-manifest` protocol (#102) | design a new descriptor *(rejected — exists)* | **High** |
| verify *gate* | *(ratify)* reuse #094's `verifyUpgrade` (parse + round-trip + conformance) | a new gate *(rejected — exists)* | **High** |

## Ratify (not forks) — the descriptor format and the verify gate

- **Descriptor = the `changelog-manifest` protocol** ([#102](/backlog/102-changelog-manifest-standard/),
  resolved → [protocols.json:86](../src/_data/protocols.json#L86)). It already defines per-module change
  entries (severity + Keep-a-Changelog type) **and a migration linkage** (a breaking entry references the
  codemod that applies it, with author + integrity-hash trust). Designing a second descriptor would fork the
  single-source-of-truth and contradict #102's explicit "consumed by upgraders (#094)." *Consume it.*
- **Verify gate = #094's `verifyUpgrade`** ([upgraderEngine.ts:142](../blocks/renderers/upgrader/upgraderEngine.ts#L142)).
  A migrated call site is *offered* only if it re-parses, round-trips, and conforms — the propose-and-verify
  moat ([#089](/backlog/089-monetization-product-ideas/)) over Angular schematics / jscodeshift, which apply
  transforms without verifying. *Reuse it; don't build a new gate.*

## Fork 1 — placement: a mode of the existing engine, or a distinct tool?

**Crux.** #094's `upgraderEngine` is `analyze → generate → verifyUpgrade`, with a provider-injection seam
([upgraderEngine.ts:72](../blocks/renderers/upgrader/upgraderEngine.ts#L72)) and a neutral `ComponentIR`
(:32). The version-migration kind has the *same arc*; it differs only in **input** — an already-conformant
source plus a `changelog-manifest` delta, rather than legacy code. #094's own open follow-on already asked
this and leaned the same way ("upgraders are a *mode* of the same engine … likely shared core, different
input adapter").

**Name the seam correctly — this is devtools, not a runtime registry.** The upgrader runs at
author/migration time (a CLI/devtools invocation), never inside anyone's running app. So its analyzer seam is
**not** the same kind of thing as the runtime standard registries it currently claims kinship with —
`CustomRenderStrategyRegistry` (#052) and `CustomCompilerRegistry` (#081) are *runtime/app* seams the project
injects a provider into for the *running* standard to consult, and they are lock-minimization points at the
standard's surface. The analyzer is consulted once, by a tool. The provider-injection *need* is real and
devtools-appropriate (swap a deterministic reference analyzer for a BYO-key model analyzer), but the
*concept* is a **devtools provider seam**, not a runtime-registry standard — it must not drift into being
presented as a protocol or a standard registry. The engine's own doc comment
([upgraderEngine.ts:13-16](../blocks/renderers/upgrader/upgraderEngine.ts#L13)) markets it as "the SAME
inject-a-provider shape as `CustomCompilerRegistry` / `CustomRenderStrategyRegistry`" — that kinship framing
is the thing to correct. Separately, the global mutable singleton (`analyzerRegistry`, :93) is a
runtime-registry habit a devtools doesn't need — a tool more naturally takes its providers as an explicit
input (the engine already accepts `opts.registry`); demoting it to explicit injection is an **implementation
cleanup to spin out as its own item at close-out** — not a fork blocker, and orthogonal to how Fork 1
resolves (the analyzer-seam framing is wrong either way).

- **(A — recommended) A mode + input-adapter of `upgraderEngine`.** Add a version-migration input adapter
  (consumes source + changelog-manifest delta) behind the existing provider seam, reuse the
  `analyze → transform → verifyUpgrade` arc, and add a version-gated *planner* (select migrations in
  `>installed, <=target`, ordered, intermediate-spanning — the `ng update` loop) on top. No second engine,
  no drift, the verify gate is inherited. The seam it joins is the devtools provider seam above — the
  version-migration adapter is simply a second provider into the one tool. Cost: the planner + a transform
  step that mutates existing source (vs #094 generating fresh) are new surface on the engine.
- **(B) A distinct version-migration tool.** A standalone codemod runner separate from the legacy→standard
  upgrader. *Rejected* — duplicates the engine, the provider seam, and the verify gate; risks the two
  upgraders drifting; contradicts #094's shared-core follow-on and the #081 anti-drift discipline. The two
  kinds are *input adapters of one engine*, not two products.

## Fork 2 — transform authoring: declarative descriptor or imperative codemod?

**Crux.** A migration entry must say *how* to rewrite a call site. OpenRewrite's ruling principle — "if it
can be declarative, make it declarative; use imperative only when necessary" — applies directly, and the
`changelog-manifest`'s migration-script reference being **optional** is what makes the split expressible
without changing the protocol.

- **(A — recommended) Declarative-first, imperative escape hatch.** The common mechanical changes — renamed
  attribute, moved intent dimension, retired provider id — are described **declaratively** in the
  changelog-manifest entry, and the engine interprets them (no codemod module to write or trust). The entry
  **references an imperative codemod** (jscodeshift/ts-morph-style) only when the transform is too complex to
  declare. Most-permissive default: the reference is optional, declarative is the floor. Reuses the trust
  metadata (#102) for the imperative case. Cost: must define the declarative transform vocabulary (which
  mechanical change-kinds the engine interprets natively) — a sub-decision for build slice (b).
- **(B) Imperative-only (a codemod module per change).** Every migration ships a transform function (the
  Angular-schematics / jscodeshift model). *Rejected as the default* — forces a code module + trust review
  for trivial renames, and most breaking changes in this vocabulary are mechanical. Imperative stays
  available as the escape hatch, not the baseline.
- *Rejected:* declarative-only (can't express genuinely complex transforms — the escape hatch is load-bearing).
- **Sub-decision (hold open):** the exact declarative change-kind vocabulary the engine interprets natively
  (rename-attr / move-dimension / retire-provider / re-namespace …) — enumerated at build slice (b) against
  the real breaking-change history.

---

## Ruling (ratified 2026-06-13)

Both forks ratified as their bold defaults; both ratifies confirmed.

- **Fork 1 = 1A** — the version-migration upgrader is a **mode + input-adapter of #094's one
  `upgraderEngine`**, not a distinct tool (anti-drift: one engine, one verify gate, two input adapters).
  The analyzer/input seam is named correctly as a **devtools provider seam** (consulted once by a tool at
  author/migration time), **not** a runtime-registry standard like #052/#081 — and must not drift into a
  protocol/standard registry.
- **Fork 2 = 2A** — **declarative-first transform authoring with an imperative codemod escape hatch**
  (OpenRewrite's principle; most-permissive default). The declarative change-kind **vocabulary stays a held-open
  sub-decision for build slice (b)**, enumerated against the real breaking-change history — *not* re-decided here.
- **Ratifies** — descriptor = the `changelog-manifest` protocol (#102); verify gate = #094's `verifyUpgrade`.

**Spawned builds (the `blockedBy` chain):**
- [#491](/backlog/491-upgrader-version-migration-planner-changelog-manifest-consum/) — slice (a): changelog-manifest consumption + version-gated migration planner (Tier-A, ready).
- [#492](/backlog/492-upgrader-declarative-transform-interpreter-imperative-codemo/) — slice (b): declarative transform interpreter + imperative escape hatch (carries the vocabulary sub-decision; Tier-A, ready).
- [#493](/backlog/493-upgrader-version-migration-input-adapter-second-provider-on-/) — slice (c): version-migration input adapter/mode on `upgraderEngine` + `verifyUpgrade` wiring (`blockedBy [491, 492]`).
- [#494](/backlog/494-upgrader-analyzer-is-a-devtools-provider-seam-demote-the-glo/) — cleanup (task): demote the analyzer global singleton to explicit injection + fix the misleading #052/#081 kinship doc comment (orthogonal — do anytime).

---

## Context

**Why this is a decision, not yet a build:** it carries two genuine design forks (placement, transform
authoring) above volume. Once ratified it splits — per the survey — into three agent-ready builds via a
`blockedBy` chain: **(a)** changelog-manifest consumption + version-gated migration planner (range + order);
**(b)** the declarative transform interpreter + imperative escape hatch; **(c)** the version-migration input
adapter/mode on `upgraderEngine` with `verifyUpgrade` wiring.

**Blocker note:** `blockedBy: [266, 094, 102]` are **all resolved** — this item is unblocked. The edges are
kept as lineage (each produced an artifact this consumes: #102 the descriptor, #094 the engine/gate, #266 the
semver axis); they leave the item Tier-A once the forks are ratified.

**Relationship to neighbours:**
- [#094](/backlog/094-ai-upgrader-tools/) — the engine + verify gate + provider registry this extends (the first upgrade kind).
- [#102](/backlog/102-changelog-manifest-standard/) — the `changelog-manifest` protocol this consumes as the migration descriptor.
- [#266](/backlog/266-validation-capability-manifest-schema-semver-scheme-ratify-o/) — the capability-manifest + semver scheme (`compareSpecVersions`) the version-gating uses.
- [#190](/backlog/190-upgrader-additional-input-adapters/) — sibling input-adapter breadth (widens *what* is lifted in; this moves conformant code *forward*).
- [#005](/backlog/005-validation-spec-versioning-adherence-tooling/) — the spec-versioning epic this rolls under.
