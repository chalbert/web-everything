---
kind: story
size: 5
parent: "232"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a real heavy-SWC/Next/Turbopack <component> consumer"
dateOpened: "2026-06-23"
tags: [component, adapters, compiler, build-tooling, strategy-axis, toolchain-depth, swc, maturity-gated]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Per-bundler-native `<component>` integration (Rust/WASM SWC plugin for Next/Turbopack)

A deferred opt-in on the **toolchain-depth axis** established by #231 (the
[component-dc](docs/agent/platform-decisions.md#component-dc) rule). Adds a richer per-toolchain plugin —
notably a Rust/WASM **SWC** plugin for Next/Turbopack — beyond the universal pre-transform baseline #231
ships.

Held at `priority: low`: native-depth integration is only *worth its weight* under heavy-SWC adoption, but
we build the full feature surface **ahead of** that consumer rather than gating on it — so this stays a
valid, pickable item, just low-value-now. Picked up when there's slack or a heavy-SWC project to validate
the native depth against.

- Additive: joins the toolchain-depth axis, no breakage to the #231 universal pre-transform baseline.
- Sibling deferred opt-ins under #232: #1628 (`.component` file surface), #1630 (`tsc`-only transformer).

## Re-classified `priority: low → maturityGated` (batch-2026-06-26-1806-1825)

Claimed in this batch, then **not built** — grounding showed it is mis-flagged. The deliverable is a **Rust/WASM
SWC plugin**: an SWC WASM plugin runs inside SWC's Rust pipeline on the SWC AST, so it must **re-implement the
lowering in Rust** (it cannot call the shared JS `compile()` core the #231/#234 baseline guarantees). Building
that **now**, with no heavy-SWC/Next/Turbopack `<component>` consumer to validate the native depth against
(the body's own "only worth its weight under heavy-SWC adoption / picked up … to validate the native depth
against" a consumer), yields a **worse artifact** — tuned blind against no real integration, with the
byte-identical-output contract un-provable. That is exactly the `maturityGated` test (build-now-yields-worse),
**not** a `priority: low` (which is for fully-specifiable-now-but-low-value work, e.g. #1592/#1626).

Mirrors the **ratified sibling #1659** (the trait Enforcer's Rust/WASM SWC plugin, parent #718), which is
`maturityGated` for the identical reason; the #718 epic explicitly pairs them. The universal pre-transform
baseline (#231) already gives SWC pipelines lowered output via the Vite/webpack wrappers — nothing is owed
today. Un-gate trigger: a real heavy-SWC/Next/Turbopack `<component>` consumer. Reversible (cite this note).
