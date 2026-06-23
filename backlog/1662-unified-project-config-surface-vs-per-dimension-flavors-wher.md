---
kind: decision
parent: "099"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-project-config-materialization-shape.md
relatedTo: ["798", "227", "080"]
crossRef: { url: /backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/, label: "config-extends-platform-default statute (#911)" }
tags: [config, platform-default, flavors, project-config, separation, decision]
---

# Unified project-config surface vs per-dimension flavors — where config-extends-platform-default values live

## Digest

Spun out of [#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/) to settle the one end the
[config-extends-platform-default](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)
statute left open: dimension values (SoT-mode, auto-define, render-strategy, theme…) live in *"a project config
that extends a platform-default flavor"* — but **where do they physically materialize?** The card framed it as
a fork: **(a)** one unified rc-like project-config surface all dimensions inherit from vs **(b)** per-dimension
flavor configs that compose. **Prep reframes it: that a/b is a false fork — it conflates *storage* with
*discovery*.** Storage (a dimension's value + its `extends` chain) is the irreducible kernel and must be
**per-dimension and decoupled** (separation bias, the `CustomRegistry.extends` precedent, the flat-config
trend); discovery (the whole resolved config at one point) is a **derived view**, free either way and never a
second source of truth. **Recommended ruling: forced invariant — per-dimension flavor configs are the SoT; a
unified surface is supported only as a non-authoritative discovery view. Confidence: Med-High.** Grounded in
the [project-config materialization](/research/project-config-materialization-shape/) research topic.

## Axis-framing

The real axis is **storage vs discovery**, and the statute already leans the storage answer. The statute
(we:docs/agent/platform-decisions.md#config-extends-platform-default, ~L806–814) names the precedent as
*"core `CustomRegistry` `extends`; the JSX render-strategy axis"* — i.e. **per-concern** registries each with
their own `extends`, not one god-registry with sections. The existing dimensions are already separate concerns:
auto-define ([#227](/backlog/227-auto-define-strategy-axis/)), render-strategy
([#080](/backlog/080-render-strategy-contract-decisions/)), SoT-mode
([#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/)), theme. WE's
`bias-toward-separation` puts the burden of proof on *combining* them into one artifact, and
`minimize-lock-in` refuses a project-facing format as a source of truth. Prior art seals it: the ecosystem has
migrated **away** from monolithic per-section rc files toward composable flat/array config (ESLint flat config,
Vite/Rollup plugin arrays, separate EditorConfig/Browserslist/Prettier) precisely because section-merging
coupled unrelated concerns. So "storage" resolves to per-dimension; the only thing a unified surface legitimately
buys — *discovery / project identity* — is a derived view a resolver produces by reading the per-dimension
configs.

### Recommended path at a glance

| Fork | Recommended ruling | Broken / excluded branch | Confidence |
|---|---|---|---|
| **1 · materialization** | **Forced invariant: per-dimension flavor configs are the SoT** (each its own `extends`-to-flavor chain — the `CustomRegistry.extends` shape generalized); a unified project-config surface is **supported by default** only as a *derived, non-authoritative discovery view* | A unified project-config **file as authoritative SoT** — couples schema/ownership/release of unrelated dimensions into a god-artifact; project-facing-format lock-in; contradicts the per-concern precedent + the flat-config trend | **Med-High** |

## Fork 1 — where config-extends-platform-default values materialize

**Fork-existence justification:** the card's (a)-vs-(b) is **not a genuine either/or** — it conflates two
separable axes (storage vs discovery). Run straight, the **composability probe** shows the kernel is the
per-dimension config + its independent `extends`; option (a) merely adds a wrapper file and (b) a
manifest/resolver, so neither subsumes the other at the kernel — they are *not* mutually exclusive. What **is**
a real decision is the **forced invariant** hiding inside (a): the *strong* reading of (a) — a unified file as
the **authoritative storage source of truth** — is the **broken branch** (it re-couples the schema evolution,
ownership, and release cadence of semantically unrelated dimensions into one god-artifact, and makes a
project-facing file the SoT, the lock-in WE refuses). So this resolves to a ratify (storage = per-dimension)
plus a support-both (the unified *view*), not a weigh between (a) and (b).

**Crux:** the statute says values live in *"a project config that extends a platform-default flavor"* — the
singular "a project config" reads like (a), but the cited precedent (`CustomRegistry.extends`, render-strategy
axis) is **per-concern**. The crux is whether "a project config" means one *storage artifact* (broken — god
file) or one *resolved view* over per-dimension storage (correct). Prep rules the latter.

**Options:**

- **Storage — per-dimension flavor configs *(ratified invariant)*.** Each dimension stores its value and its
  own `extends`-to-platform-default chain independently, generalizing the `CustomRegistry.extends` precedent.
  **Merit:** honours `bias-toward-separation` (a new dimension slots in without touching another's schema or
  owner); no project-facing-format lock-in; matches the per-concern precedent and the live flat-config/plugin-
  array trend; decouples release cadence (theme vs codegen-SoT evolve independently).
- **Unified project-config surface — *supported by default, as a derived view only*.** A single point that
  shows the project's whole resolved config (an aggregator/resolver that *reads* the per-dimension configs).
  Fine to ship for ergonomics/discovery; **must never be a second source of truth.** Whether and when WE ships
  such a view, and at what granularity, is ordinary **build prioritization**, not a design fork.
- *Excluded:* **a unified config *file as the authoritative SoT*** — *Rejected.* Couples unrelated dimensions
  into one schema/ownership/git-object (merge-conflict + breaking-schema blast radius), and freezes a
  project-facing format as the SoT (lock-in). It also contradicts the statute's own cited per-concern precedent
  and the ecosystem's migration away from monolithic rc files.

**Ruling: per-dimension flavor configs are the source of truth (forced invariant); a unified project-config
surface is supported only as a derived, non-authoritative discovery view.** This is most-permissive +
separation-biased: storage stays decoupled and lock-in-free, while the convenience of one-glance discovery is
still available as a view a project (or tooling) opts into.

*Rejected:* a unified file as authoritative SoT (couples unrelated dimensions; lock-in; against precedent + trend).

**Skeptic:** REFUTED → **default flipped.** The card (and this prep's first-pass default) leaned toward (a) "a
single unified surface." A prep skeptic sub-agent refuted it on merit: (R1) "sections" is a fig leaf that
re-couples schema/ownership/evolution — the very thing separation protects — and contradicts the cited
*per-concern* `CustomRegistry.extends` precedent; (R2) the composability probe, run straight, shows the kernel
is per-dimension, so (a) does **not** subsume (b); (R3) the prior-art trend is *away* from monolithic rc files
(ESLint flat config, Vite plugin arrays); (R4) one surface manufactures a god-file / cadence-coupling hazard;
(R5) it's not a fork at all — storage must be per-dimension, discovery is a derived view. **Folded in:** the
default is now per-dimension storage (forced invariant) + unified-surface-as-view (support-both); the broken
branch is explicitly "unified file as authoritative SoT." Without this reframe, the as-written "(a) unified
surface" default is refuted.

## Context

- **Lineage:** residual of [#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/)'s
  ratification (the statute's open materialization end); sibling dimensions are #227 / #080 / #798 / theme.
  Governed by the [config-extends-platform-default](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)
  statute ([#911](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)).
- **Constellation:** `locus: plateau-app` for any materialized **view/aggregator** surface (a Technical
  Configurator-adjacent discovery tool); the per-dimension **storage** schemas ride each dimension's own build.
  No WE standard entity is minted — the config is project-facing data, not a protocol.
- **At ratification:** record the ruling; `codifiedIn` the statute (extend the
  config-extends-platform-default section with the storage-vs-view materialization end). The unified-view
  *build* is separately prioritized, not triggered by this decision.
