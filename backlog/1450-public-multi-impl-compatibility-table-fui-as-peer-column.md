---
kind: decision
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-21"
parent: 1451
relatedReport: reports/2026-06-21-multi-impl-compatibility-table.md
relatedProject: webadapters
tags: [capabilityMatrix, compatibility-table, impl-neutrality, library-adapters, native-first, minimize-lock-in, public-catalog, positioning, decision-prep]
---

# Public multi-impl compatibility table — how FUI appears

The general-strategy decision surfaced under the [library-adapter watch (#1451)](/backlog/1451-library-adapter-watch-keep-incumbent-lib-adapters-current/): WE surfaces a **public capability × impl compatibility table** — one row per WE protocol/intent, one column per impl (native · FUI · Floating UI · Mousetrap · TanStack · focus-trap · …), each cell a support tier. This is `we:src/_data/capabilityMatrix.json` *broadened from native substrates to incumbent libraries* and rendered as a public catalog (mirroring `/protocols/` and `/intents/`). Its strategic purpose: make it self-evident that **WE is a standard for the web in general, not a front-end for one library** — every lib, including FUI, is just a column. The decision exists because the *positioning* is not yet ratified and there is one genuine fork below; the impl-neutrality *principle* is already statute (`we:docs/agent/platform-decisions.md:274` "FUI is one conforming implementation"; `we:docs/agent/platform-decisions.md:104` capabilityMatrix resolver-impl rule). The forks below are grounded in a prior-art survey published as the `/research/multi-impl-compatibility-table/` topic (session report `we:reports/2026-06-21-multi-impl-compatibility-table.md`); the recommended default is in **bold**.

## Ruling — RATIFIED 2026-06-21 (Fork 1 → A)

**FUI appears in the public compat table as a peer column** — listed exactly like every other impl; its strength is *earned and visible* (the column green across the most rows), never status-declared. Branch B (a privileged "reference / recommended impl" column) is **rejected as an anti-pattern**: it reintroduces the single-lib perception the table exists to dispel and conflicts with minimize-lock-in (protocol is the only lock; no impl is blessed) — the lone outlier across BCD / caniuse / wpt.fyi / OpenFeature. The ~20% residual (a curated pointer lowers adoption friction) is satisfied **outside** the grid: an adoption pointer, if wanted, lives in clearly-editorial getting-started prose (per OpenFeature, which keeps its matrix neutral despite having a reference impl), keeping the neutrality artifact neutral. Codified as a cite-able addendum to the impl-neutrality rule at `we:docs/agent/platform-decisions.md`. ~80% confidence.

**Build-time note for the successor (not part of this positioning call):** the existing matrix's 3 tiers (`native-ok` / `polyfill-ok` / `capability-hard`) are native-first/platform-relative semantics; a JS library (e.g. Floating UI) does not sit on that axis. Broadening rows to incumbent libs likely needs a second tier vocabulary (supported / partial / unsupported) alongside the substrate tiers — a schema detail for the build item, flagged here so it isn't lost.

## Recommended path at a glance

| # | Decision | Recommended default | Main alternative | Confidence |
|---|----------|---------------------|------------------|------------|
| 1 | How does FUI appear in the public compat table? | **A — a peer column** (strength earned/visible as the greenest column, never status-declared) | B — a privileged "reference / recommended impl" column | ~80% |

**Settled without a fork** (see *Supported by default* + *Context*): public placement as a `/compat/`-style catalog auto-rendered from `we:src/_data/capabilityMatrix.json`; broadening the matrix from native substrates to incumbent libs (adding an impl stays one row, #206); the red/missing-cell count as #1451's front-A metric; WE owns the table/contracts/vectors while impl columns reference impl-owned adapters.

## Axis-framing

The concern is the **public positioning** of one impl's column in a neutrality artifact — *not* the impl-neutrality principle, which is already statute. Pinned to the real tree and the convergent prior art:

- **The mechanism already exists.** `we:src/_data/capabilityMatrix.json:8-66` is the registered capability-adapter table (one row per impl, capability-id → 3-state tier map, `we:src/_data/capabilityMatrix.json:3-7`), today holding native substrates only — `face` (`:9-36`) and `base-select` (`:37-65`). `we:src/capabilities.njk:21-39` **already renders it as a column-per-impl grid.** So #1450 broadens the *rows* (substrate → incumbent lib) and decides the *positioning*, not the rendering.
- **The principle is statute, not in play.** `we:docs/agent/platform-decisions.md:274` (FUI is one conforming implementation) and `:104` (capabilityMatrix resolver-impl rule) already settle that FUI is one impl among many. The only open question is how FUI's column is *labelled* in the public table.
- **Every neutral compat artifact lists impls as peers.** MDN BCD, caniuse, wpt.fyi, the ECMAScript/Kangax tables, and OpenFeature's provider table all use a feature-row × impl-column grid with per-cell support tiers and **no column flagged official**. wpt.fyi shows strength as pass-rate (earned, not declared); even OpenFeature — which *has* a reference impl (flagd) — keeps the matrix neutral and names the reference impl only in editorial docs. W3C/WHATWG require "≥2 independent conforming implementations" — independence is structural; no impl is "official."

The structural point: a "recommended impl" column **re-introduces the single-lib perception the table exists to dispel** and conflicts with minimize-lock-in. A neutral grid is the convergent, lock-in-minimizing end-state; an adoption pointer, if wanted, lives in clearly-editorial getting-started prose, not the grid.

## Fork 1 — How does FUI appear in the table?

**Why it's a fork:** the branches genuinely cannot coexist — FUI's column is either flat-peer or privileged-reference — and the excluded branch (a privileged column) is *flawed*: it reintroduces the exact single-vendor perception the table is built to dispel, and conflicts with WE's minimize-lock-in stance (protocol is the only lock; no impl is blessed). It is also the lone anti-pattern across every neutral compat artifact surveyed.

- **A — FUI is a peer column** *(recommended)*. FUI is listed exactly like every other impl; its strength is *earned and visible* as the column green across the most rows, never declared by status. Aligns native-first + minimize-lock-in / protocol-is-the-only-lock, and matches BCD / caniuse / wpt.fyi / OpenFeature (every neutral compat artifact lists impls as peers).
- **B — FUI is a privileged "reference / recommended impl" column** *(Rejected — anti-pattern)*. FUI flagged as the canonical impl WE points adopters to. Re-introduces the single-lib perception the table exists to dispel; the lone outlier across the survey.

**Recommended: A.** *(~80%. Residual (the ~20%): a curated "recommended impl" can lower adoption friction — but, per OpenFeature, that's better served by a separate, clearly-editorial "getting started" pointer than by privileging a column in a neutrality artifact. Ratify A and treat the editorial pointer as the friction-reliever, keeping the grid neutral.)*

---

## Supported by default (not decisions — settle as written unless contested)

- **Public placement:** a `/compat/` (or `/impls/`) catalog auto-rendered from `we:src/_data/capabilityMatrix.json`, per [Catalogs Auto-Render From JSON] — new surface needs page + nav + authoring note + validator. (The column-per-impl render already exists at `we:src/capabilities.njk:21-39`.)
- **Broaden capabilityMatrix from substrates → incumbent libs:** today `impls[]` holds native substrates (`base-select`, `face`); this admits library impls (Floating UI, Mousetrap, TanStack, FUI) as rows. Adding an impl stays "one row" ([#206](/backlog/206-capability-adapter-registration-table/)).
- **The red/missing-cell count is this program's front-A metric** (#1451).
- **Ownership:** the table + contracts + vectors are WE; the impl columns reference FUI- and third-party-owned adapter impls (locus stays with the impl).

## Context

**Classification (per-fork pass, recorded).** The table is **not a protocol or an intent** — it is a **public catalog surface** over `we:src/_data/capabilityMatrix.json` (a rendering / positioning decision), mirroring `/protocols/` and `/intents/` (auto-render from JSON). The impl-neutrality **principle** is already statute (`we:docs/agent/platform-decisions.md:104` and `:274`), so the only open question is the **positioning of the column**, not the principle. Ownership: table/contracts/vectors are WE, impl columns reference impl-owned adapters (locus stays with the impl, mirroring #1451's WE-coordinates / FUI-locus split).

**Lineage.** Surfaced 2026-06-21 while reviewing how WE compares to libs like TanStack: the insight that listing FUI *among* all supported libs (with a compat table) sharpens WE's web-general positioning while letting FUI's coverage breadth show. Carved as a sibling decision of the library-adapter watch #1451 rather than ratified inline (Wait-For-Ratification). **RATIFIED 2026-06-21 → A (peer column).**
