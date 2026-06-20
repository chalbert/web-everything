---
kind: decision
size: 2
parent: "125"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: "2026-06-06"
blockedBy: ["125"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [component, adapters, packaging, build-tooling, swc, typescript]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Decide how far the `<component>` compiler reaches across toolchains

The `<component>` → custom-element transform is a build-time plugin that re-wraps cleanly per bundler
(Vite/esbuild/Rollup/webpack/Babel), but three toolchain questions from report §7 don't have a single
mechanical answer — each is a fork to settle before the compiler's surface is finalized:

- **SWC / Next.js / Turbopack** — SWC plugins are Rust/WASM, so our JS compiler can't be a native SWC
  plugin. *Recommendation:* run the compiler as a **pre-transform** step (let SWC see plain output);
  revisit a Rust port only if Next/Turbopack adoption demands it.
- **`<component>` source surface** — a dedicated `.component` file type vs. inline `<component>` inside
  `.html`/template strings vs. inside `.tsx`. This choice sets every plugin's match rule, so it must be
  decided once. *Open — no recommendation yet.*
- **`tsc`-only consumers** — `tsc` does JSX/types but no custom transforms, so a `tsc`-only project gets
  types but no `<component>` lowering. *Recommendation:* document "a bundler is required" first; consider
  shipping a `tsc` custom-transformer (via `ts-patch`/`ttypescript`) only if demand appears.

Depends on the package extraction (#125). The source-surface question is the one genuinely open fork; the
SWC and `tsc` questions are ratify-the-recommendation calls.

## Resolution (2026-06-09)

The premise "this sets every plugin's match rule, so it must be decided once" was wrong. The compiler's
toolchain reach is **not one baked pipeline** — it's a small set of **configurable strategy axes**, each
with a native-first default that a project/team overrides where their stack differs. Different teams pick
different stacks; we meet them where they are. (Same shape as #227 — auto-define is "a strategy axis, not
one mechanism" — and an instance of #150's dev-authoring-preferences thesis. #126's "support both, document
one default" is the same pattern next door.)

**Ruling — prove the principle, ship the top 2 per axis, collect the rest for later:**

- **Source surface** (the dimension): ship **`.html` (default) + `.tsx`** — both legitimate end-states.
  `.component` (dedicated SFC-style file) is deferred, not rejected.
- **Toolchain depth**: ship the **pre-transform** baseline that works across Vite/esbuild/Rollup/webpack/Babel
  — that *is* the proof of the principle. A richer per-bundler-native integration (incl. a Rust SWC plugin)
  is a deferred opt-in only if a heavy-SWC/Turbopack team demands it.
- **`tsc`-only**: **bundler-required** is the default and documented stance; a `ts-patch`/`ttypescript`
  custom-transformer is a deferred opt-in for teams that refuse bundlers.
- **Where the choice lives**: **adapter/plugin options** (e.g. `{ surfaces: ['html','tsx'] }`), living where
  the build is already configured. A Technical Configurator domain that generates those options is **deferred
  to #150**, not built here — keeps this a ruling, not a config-surface project.

**Successors:**
- **#231** — agent-ready build: the `<component>` compiler as configurable strategy axes (top-2 surfaces +
  pre-transform baseline + plugin options). Proves the principle.
- **#232** — lower-priority collection of the deferred strategy opt-ins (`.component` surface, per-bundler-native
  integration, `ts-patch` transformer), held for later/on-demand.
