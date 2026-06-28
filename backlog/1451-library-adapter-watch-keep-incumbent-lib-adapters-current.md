---
kind: epic
ongoing: true
status: open
dateOpened: "2026-06-21"
tags: []
---

# Library-adapter watch

A front-B currency program (with a front-A conformance arm) that keeps Web Everything's **Library Adapters** — the impl layer that bridges third-party ecosystem libraries (TanStack, Floating UI, Mousetrap, Zod, …) to WE protocols — both *built out* and *current*. The standing goal: where a best-in-class incumbent lib exists for a protocol domain, a Library Adapter lets a WE protocol delegate to that lib's impl behind the contract (zero lock-in, native-first floor, lightest-resolver-wins), and those adapters don't silently rot as the libs ship major releases. The third currency sibling alongside the platform-standards watch (native) and framework-churn watch (vendor frameworks): this one watches **libraries**, not the platform and not frameworks. L0 / candidate — filed to record the watch; build the discovery mechanism after the platform-standards keystone proves the pattern.

## Why this is a distinct program (not covered by the existing watches)

The currency portfolio already guards two axes; libraries are the missing third:

- [#1257 platform-standards watch](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/) — the **native platform** (TC39/WHATWG/W3C). When the platform ships a capability, WE defers to it. This *shrinks* WE's surface.
- [#1258 framework-churn watch](/backlog/1258-framework-churn-watch-keep-we-s-forward-adapters-current-as-/) — **vendor frameworks** (React/Vue/Svelte/Solid), guarding the *forward / generation* adapters ([forward-generation-adapters](docs/agent/platform-decisions.md#forward-generation-adapters), #463) that project WE → framework.
- **This (#1451)** — **incumbent libraries**, guarding the *Library Adapters* (`we:src/_data/adapters.json#lib`) that bridge a lib → a WE protocol so WE can *consume* the lib's impl. The inverse direction of #1258: ingest/delegate, not project.

Distinct conformance target (a library adapter's generated/delegated output vs the lib's current API), distinct discovery signal (a lib's major release / a new dominant lib per domain), distinct ownership seam (below).

## The four-part Program Test (#1249)

1. **Standing goal, no DoD** — new libs ship and existing libs cut major versions forever; "every adapter green today" is a pass-through watch state, never the terminus.
2. **Conformance front (internal)** — every registered Library Adapter still (a) passes its target protocol's conformance vectors and (b) generates/delegates correctly against its pinned lib's *current* major. Metric (to build): count of registered library-adapters whose pinned lib version is behind current OR failing conformance.
3. **Currency front (external)** — a tracked lib ships a major/breaking release, OR a new lib becomes the dominant impl for a protocol domain → file an adapter-maintenance or new-adapter item. Discovery (to build): a by-hand sweep over the tracked-lib set (TanStack family, Floating UI, Mousetrap, Zod, …) for major releases + emerging incumbents per protocol domain.
4. **Cadence** — drift (conformance red) · external (major release / new entrant) · schedule (L2, later).

## Ownership / locus

A Library Adapter is **implementation, not a standard** ([Impl Is Not A Standard]; the adapter bridges a lib to a protocol — it does not define one). So:

- **WE owns** the *protocol contract* the adapter targets, the *conformance vectors* it must pass, and the `we:src/_data/adapters.json#lib` *discovery catalog*.
- **FUI owns** the *adapter impls themselves* (`locus: frontierui`), pinned to specific lib versions.

This mirrors #1258: the watch is WE-coordinated; the adapter children carry a FUI locus.

## Hard dependency — adapters need a ratified protocol first

A Library Adapter can only be built once its **target protocol exists / is ratified**. Several obvious TanStack-shaped adapters are therefore *blocked on open decisions*, not buildable: TanStack Query ⟂ [#1419 server-state query cache](/backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen/) (unresolved), TanStack Table ⟂ [#1411 treegrid / data-grid](/backlog/1411-treegrid-hierarchical-interactive-data-grid-standard-placeme/) (unresolved). The watch tracks these as *pending* — it files the adapter slice when the protocol ratifies. Only adapters whose protocol is already ratified are buildable today (see the first review-log run).

## Maturity & status — currently L0 / candidate

Per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/) this is a genuine two-front program at L0: the goal + discovery story exist; the metric, sweep, and cadence are not built. L0→L1 carve: (1) define the front-A metric (adapter-conformance ledger) and wire it into the gate; (2) build the front-B sweep (tracked-lib major-release scan) runnable by hand; (3) wire cadence; graduate to L2 (scheduled) only after a manual track record (the #315→#367 pattern). Build after the [platform-standards keystone](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/) proves the pattern.

## Review log

- **2026-06-21 — first run (L0).** Swept candidate library adapters against their target WE contracts to separate *buildable-today* (target protocol/intent/block codified) from *blocked* (target is an open decision). **Buildable today**, ranked: (1) **floating-ui-adapter** → Anchor intent + native anchor positioning ratified [#1262](/backlog/1262-anchor-positioning-native-baseline/) — Floating UI becomes the *fallback/polyfill* impl under native-first (already a `concept` in `we:src/_data/adapters.json#lib`); (2) **mousetrap-adapter** → Keyboard-Shortcuts module `active` (`we:src/_data/blocks/keyboard-shortcuts.json`, already a `concept`); (3) **focus-trap adapter** → Focus-Containment intent (`we:src/_data/intents/focus-containment.json`); (4) **TanStack-Query-persistence adapter** → `CustomStorageStrategy` from [#011](/backlog/011-gap-4-webpersistence-project/) (resolved) — but `we:src/_data/protocols/storage.json` is still `concept`, so confirm the registry is real before building; (5) **TanStack-Virtual adapter** → Windowed-Collection intent (`we:src/_data/intents/windowed-collection.json`); (6) **validation adapter (Zod / TanStack-Form)** → Validation intent (`we:src/_data/intents/validation.json`). **Blocked on an open decision** (file the adapter slice when the protocol ratifies): TanStack-Query server-state cache ⟂ [#1419](/backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen/); TanStack-Table ⟂ [#1411](/backlog/1411-treegrid-hierarchical-interactive-data-grid-standard-placeme/). **Next run:** re-sweep tracked-lib major releases; promote the floating-ui + mousetrap concepts to filed FUI-locus build slices first (lowest risk, already catalogued).

## Front-A surface — the multi-impl compatibility table

The conformance front needs a public face: a **capability × impl compatibility table** — one row per WE protocol/intent, one **column per impl** (native · FUI · Floating UI · Mousetrap · TanStack · focus-trap · …), each cell stating the support tier. This is the existing `we:src/_data/capabilityMatrix.json` resolver matrix *broadened from substrate impls to incumbent libs* and surfaced publicly. Its strategic point: it shows **WE is a standard for the web in general, not a front-end for one library** — every lib is just a column — while letting **FUI stand as a listed impl whose strength is breadth of coverage** (the column that's green across the most rows). Tracked as the front-A metric of this program (the count of red/missing cells). Public-surface placement + whether FUI is a first-class column is carved as a sibling decision.
