# Public multi-impl compatibility table — how FUI appears (decision prep)

**Date:** 2026-06-21
**Decision item:** [#1450](/backlog/1450-public-multi-impl-compatibility-table-fui-as-peer-column/) (carved under the library-adapter watch [#1451](/backlog/1451-library-adapter-watch-keep-incumbent-lib-adapters-current/))
**Status:** grounding artifact for an open decision — no ruling made here.

## The question

The library-adapter watch (#1451) surfaced a public-positioning decision: WE should
publish a **capability × impl compatibility table** — one row per WE protocol/intent,
one column per implementation (native · FUI · Floating UI · Mousetrap · TanStack ·
focus-trap · …), each cell a support tier. This is the existing native-substrate matrix
(`we:src/_data/capabilityMatrix.json`) *broadened from native substrates to incumbent
libraries* and surfaced as a public catalog (mirroring `/protocols/` and `/intents/`).

Its strategic purpose: make it self-evident that **WE is a standard for the web in
general, not a front-end for one library** — every lib, FUI included, is just a column.

The one genuine fork: **how does FUI appear in that table** — (a) a peer column
[recommended default], or (b) a privileged "reference / recommended impl" column? The
impl-neutrality *principle* is already statute, so only the column *positioning* is open.

## What already exists (don't rebuild)

- `we:src/_data/capabilityMatrix.json` — the registered capability-adapter table. Its
  `impls[]` array (`we:src/_data/capabilityMatrix.json:8-66`) is one row per impl, each
  declaring a capability-id → 3-state tier map (`native-ok` / `polyfill-ok` /
  `capability-hard`, `we:src/_data/capabilityMatrix.json:3-7`). Today it holds **native
  substrates only** — `face` (`:9-36`) and `base-select` (`:37-65`, `native:true`). The
  resolver-impl rule: "adding a new impl is a single-row registration" (#206).
- `we:src/capabilities.njk` already **renders this matrix as a grid with one column per
  impl** (`we:src/capabilities.njk:21-39`), reading `capabilityMatrix.description` and
  iterating the tiers. So the *rendering mechanism* for a column-per-impl compat grid is
  built; #1450 broadens the *rows* (substrate → incumbent lib) and decides the *public
  positioning* of FUI's column.
- The impl-neutrality principle is statute:
  `we:docs/agent/platform-decisions.md:264` — "FUI is one conforming implementation (not
  WE mirroring FUI's `customElements.define`)"; `we:docs/agent/platform-decisions.md:104`
  — capability work registers as "a `capabilityMatrix` resolver impl, not a new protocol."
- #1451's front-A metric is the **count of red/missing cells** in this table
  (`we:backlog/1451-...md:51-53`).
- #206 (resolved → `we:src/_data/capabilityMatrix.json`) established "adding an impl stays
  one row."

## Prior-art survey — how neutral standards present a compat matrix

Surveyed the canonical multi-implementation compat artifacts. Treating standards bodies as
**upstream collaborators, not competitors** (align, don't compete), the convergent shape is
unmistakable: **a feature-row × impl-column grid with per-cell support tiers, and no column
flagged "official."**

| Artifact | Rows | Columns | Per-cell tier | A privileged column? |
|----------|------|---------|---------------|----------------------|
| MDN Browser Compat Data (BCD) | ~15,000 web features | browsers / JS runtimes | yes / no / partial / version | **No** — every engine is a peer |
| caniuse.com | per-feature | per-engine | supported / partial / unsupported / prefixed | **No** |
| wpt.fyi (Web Platform Tests) | per-test | per-engine | pass-rate % | **No** |
| ECMAScript / Kangax compat tables | per-feature | per-engine/runtime | pass / fail | **No** |
| OpenFeature providers | per-technology (SDK/lang) | per-provider | coverage %, official/community | **No** (see below) |
| W3C/WHATWG process | per-feature (at-risk annotation) | "N independent implementations" | implemented / not | **No** — "N independent" by design |

Key extractions:

1. **BCD + caniuse** (the web's reference compat surface) list browser engines as flat
   peer columns. caniuse merged MDN's BCD, expanding from ~500 to ~10,500 tables — the
   web's most-consulted compat artifact, and *no* engine column is ever marked
   "recommended." Support is shown, not editorialized.
2. **wpt.fyi** shows per-engine pass-rates side by side. A green engine is green because it
   *passes the tests*, not because the dashboard endorses it — strength is **earned and
   visible**, never declared. This is exactly default (a)'s "FUI's strength shows as the
   greenest column."
3. **OpenFeature is the instructive near-counter-example.** It *does* have a reference
   implementation (`flagd`), yet its provider table still lists every provider with a
   coverage % (DevCycle 76%, flagd 53%, ConfigCat 47% — peer rows). The reference impl is
   named in *docs/concepts*, not by privileging its row in the support matrix. So even a
   standard that blesses a reference impl keeps the **compat matrix itself neutral** — the
   "recommended" pointer lives in editorial getting-started prose, not the grid. This is
   precisely #1450's recommended split (residual ~20%).
4. **W3C/WHATWG "N independent implementations."** The maturity bar is structurally
   impl-neutral: a feature is normative only with ≥2 *independent* conforming
   implementations; the process sources status from caniuse / wpt.fyi annotations and marks
   single-impl features "at risk." The standard never names one impl as the official one —
   independence is the whole point.

**Convergent pattern:** a neutral compat matrix is a feature-row × impl-column grid of
per-cell support tiers with **no column flagged official**. A "recommended impl" column is
the anti-pattern — it reintroduces the single-vendor perception the matrix exists to
dispel, and conflicts with WE's minimize-lock-in stance. Where a reference impl exists
(OpenFeature/flagd), it is named in editorial prose, not by privileging a matrix column.

This grounds default (a). FUI's coverage breadth is best shown the wpt.fyi way: the column
that's green across the most rows, *earned and visible*, not status-declared.

## Classification (per-fork pass)

- **Layer / shape** — the table is **not a protocol or an intent.** It is a **public
  catalog surface** over `we:src/_data/capabilityMatrix.json` — a rendering / positioning
  decision, mirroring `/protocols/` and `/intents/` (auto-render from JSON). New surface =
  page + nav + authoring note + validator (Catalogs Auto-Render From JSON).
- **The principle is already settled; only the positioning is open.** Impl-neutrality (FUI
  is one conforming implementation; the capabilityMatrix resolver-impl rule) is statute at
  `we:docs/agent/platform-decisions.md:104` and `:264`. So #1450 does **not** re-open the
  principle — the single open question is the *positioning of FUI's column* in the public
  table (peer vs privileged).
- **Ownership** — the table, contracts, and conformance vectors are **WE**; the impl
  columns reference FUI-owned and third-party-owned adapter impls (locus stays with the
  impl, mirroring #1451's WE-coordinates / FUI-locus split).

## The fork + recommendation

**Fork — how does FUI appear in the public compat table?**

- **A — FUI is a peer column** *(recommended, ~80%).* FUI is listed exactly like every
  other impl; its strength is *earned and visible* as the column green across the most
  rows, never declared by status. Matches every neutral compat artifact surveyed (BCD,
  caniuse, wpt.fyi, OpenFeature) and aligns native-first + minimize-lock-in.
- **B — FUI is a privileged "reference / recommended impl" column** *(rejected).* Re-
  introduces the exact single-lib perception the table exists to dispel; the lone
  anti-pattern across the survey.

**Recommended: A.** *Residual (~20%):* a curated "recommended impl" pointer can lower
adoption friction — but, per OpenFeature, that belongs in a clearly-editorial "getting
started" pointer, **not** in a neutrality artifact's columns. The reference-impl idea is
not wrong; it is mis-placed if it privileges a matrix column.

## Residual for the deciding agent's skeptic pass

- The ~20% adoption-friction residual is real: a brand-new adopter facing N peer columns
  with no pointer may stall. Confirm the editorial getting-started pointer (separate from
  the grid) adequately covers it before ratifying A — i.e. ratify A *and* note the
  editorial pointer as the friction-reliever, so the neutrality artifact stays clean.
- Naming of the public surface (`/compat/` vs `/impls/`) is a "supported by default" item,
  not a fork; flag only if the deciding agent disagrees it's settle-as-written.

## Cross-references

- [#1451](/backlog/1451-library-adapter-watch-keep-incumbent-lib-adapters-current/) — parent watch; this table is its front-A surface.
- [#206](/backlog/206-capability-adapter-registration-table/) — "adding an impl stays one row" (resolved → `we:src/_data/capabilityMatrix.json`).
- `we:docs/agent/platform-decisions.md` — impl-neutrality statute (`:104`, `:264`).
- `/research/multi-impl-compatibility-table/` — the published prep topic.
