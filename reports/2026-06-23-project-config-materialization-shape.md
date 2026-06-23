# Project-config materialization shape — where config-extends-platform-default values live

**Date:** 2026-06-23 · **Decision:** [#1662](/backlog/1662-unified-project-config-surface-vs-per-dimension-flavors-wher/) ·
**Parent:** [#099 evergreen app](/backlog/099-evergreen-app-vision/) ·
**Statute:** [config-extends-platform-default](/Users/nicolasgilbert/workspace/webeverything/docs/agent/platform-decisions.md#config-extends-platform-default)

## The question

The `config-extends-platform-default` statute (we:docs/agent/platform-decisions.md, ~L806–814) ruled that a
multi-strategy concern — auto-define (#227), JSX render-strategy (#080), code-from-requirement SoT-mode (#798),
theme — is a **configurable dimension**: the core tool/registry stays **default-less**, and the value lives in
a *"project config that **extends** a fully-defined platform default (flavors)"*, the precedent mechanism being
`CustomRegistry.extends`. It deliberately left one end open: **where do those values physically materialize?**
#1662 was spun out of #798 to settle it. The card framed an a/b fork:

- **(a)** one unified materialized project-config surface all dimensions inherit from (an rc-like file/namespace);
- **(b)** per-dimension flavor configs that compose.

## Prior art surveyed

| System | Materialization | Lesson |
|---|---|---|
| TypeScript / Python / legacy ESLint rc | One file, per-concern **sections**, one `extends` chain | Single discovery point — but a monolithic schema + one ownership/git object |
| **ESLint flat config** | An **array of composable independent blocks**; the ecosystem migrated here *away from* the rc file | The trend is *away* from monolithic merged-section rc files because section-merging made resolution opaque and coupled |
| **Vite / Rollup** | Plugin **arrays** — independent composable units | Composition of decoupled units, explicit resolution, no god-schema |
| EditorConfig · Browserslist · Prettier | Separate per-concern artifacts, each its own resolution | Decoupled storage; discovery is "whoever needs it reads its file" |

## Finding — the fork is false; it conflates *storage* with *discovery*

A skeptic pass (run in prep) refuted the card's leaning toward (a). The decisive reframe:

- **Storage** (where a dimension's value + its `extends` chain live) is the **irreducible kernel** and is
  identical work in both branches. WE's `bias-toward-separation` + `minimize-lock-in` rules, the cited
  `CustomRegistry.extends` *per-concern* precedent, and the live flat-config/plugin-array trend all push the
  same way: **storage must be per-dimension and decoupled.** A single physical file as the *authoritative
  source of truth* re-couples schema evolution, ownership, and release cadence of semantically unrelated
  dimensions (theme vs codegen-SoT vs auto-define) into one god-artifact — the merge-conflict / breaking-
  schema-blast-radius hazard, and exactly the project-facing-format lock-in WE refuses.
- **Discovery / "project config identity"** (seeing the whole project's resolved config at one point) is a
  **derived view** — a resolver or manifest that *reads* the per-dimension configs. It is free in either
  branch and must **never** be a second source of truth.

The composability probe, run straight, confirms it: the kernel is the per-dimension config + its independent
`extends`; (a) adds a wrapper file, (b) adds a manifest/resolver — neither is the kernel, so (a) does **not**
subsume (b). What is *broken* is only the strong reading of (a): **a unified file as the authoritative
storage SoT.**

## Recommendation (folded into the prepared card)

**Forced invariant:** per-dimension flavor configs are the **source of truth** — each dimension stores its
value and its own `extends`-to-platform-default chain independently (the `CustomRegistry.extends` shape,
generalized). **Broken branch:** a unified project-config *file as authoritative SoT* (couples unrelated
dimensions; lock-in; contradicts the per-concern precedent and the flat-config trend).

**Supported by default (not a rival fork):** a unified project-config surface as a **derived, non-
authoritative discovery view/aggregator** over the per-dimension configs — fine to ship for ergonomics, never
a second SoT. Whether/when WE ships such a view is ordinary build prioritization, not a design fork.

**Confidence: Med-High** — prior-art trend, the separation/lock-in statutes, and the cited precedent all
converge; the residual is only cosmetic (does WE ship the view artifact, and at what granularity).
