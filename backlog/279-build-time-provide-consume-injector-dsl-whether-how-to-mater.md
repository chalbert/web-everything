---
type: decision
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
tags: []
---

# Build-time provide/consume injector DSL — whether/how to materialize the deferred surface

Deferred sibling of #002 (ruling: @domain = Protocol). The build-time injector DSL — provide/consume with three prepositions (`as` = replace registry, `in` = extend/merge, `to` = target a @domain/Protocol), `consume … of` for domains vs `from` for registries, and `import.injector` comma source-lists for priority/fallback — needs build tooling WE lacks, and #271 ruled resolution is native-implied (a generator hint, not a resolver). Open decision: whether to build it at all, on which build-tooling foundation, and how to keep it a thin generator over native importmap/alias. Surface is documented-as-intended in #002's gap analysis (we:reports/2026-02-24-injector-syntax-spec.md); this item decides build, not concept.

## Decision (2026-06-10) — don't build now; cap the ceiling at Tier 1/2 + the declarative form

**Ruling: WE does NOT build the build-time keyword DSL now.** With #002 (`@domain` = Protocol) and
#271 (resolution = native-implied generator hint, no runtime resolver) already pulling the runtime
substance out, what remains in #279 is purely **Tier-3 sugar** that desugars to the Tier-1 runtime API
+ native importmap entries. The shipped conformance ceiling is:

- **Tier 1** — runtime `provide()`/`consume()` API (partially implemented).
- **Tier 2** — TypeScript types over Tier 1.
- **Tier 1.5** — the no-build `<script type="injector">` declarative form (pulled forward as #278).

The `provide/consume … to/of/as/in` keyword forms and the `import.injector` comma source-lists stay
**Tier-3 documented-as-intended** (in `we:reports/2026-02-24-injector-syntax-spec.md` and #002's gap
analysis) — not built.

**Reasoning (settled in discussion):**

- **A custom-keyword DSL is the single biggest lock-in surface WE could ship** — a syntax only WE
  understands. Per the spec's tooling matrix, *no* tool parses custom keywords without a pre-transform
  WE writes and maintains. This directly contradicts "minimize lock-in; protocol is the only lock".
- **No current consumer demands the sugar.** #278 already covers the no-build declarative case;
  everything else has a working (if more verbose) Tier-1 form. Building a parser before a consumer asks
  violates native-first + POC-mode pragmatism.
- **The only lock stays the `@domain` Protocol identity**, consistent with #002/#271.

**Triggered follow-on (B, deferred — not an open item, no falsely-ready Tier-A):** *if/when* a real
consumer (plateau-app or frontierui hitting verbose multi-provider priority/fallback, the one surface —
`import.injector` source-lists — with no clean Tier-1 ergonomic equivalent) needs the sugar, build it
**then** as a thin **Vite + esbuild onLoad pre-transform generator** that emits Tier-1 API calls +
native importmap entries — a *generator hint* per #271, **never** a runtime resolver and **never** a new
project-facing manifest — asserted by the same `@frontierui/*` → `exports` lint #271 defined. When that
trigger fires, open a fresh item then; until it does, this decision is closed.

**Rejected:**
- *Build now (B early)* — stands up + maintains a custom parser against zero demand in a POC-stage repo.
- *Re-defer with no trigger (C)* — leaves the decision in the limbo this mode exists to end.

graduatedTo: **none** (a deferral ruling — the deferred surface stays documented-as-intended; no entity).

## Progress

- **Status:** resolved — ruling recorded; no code (decision item).
- **Done:** decided build=no-for-now; ceiling = Tier 1/2 + `<script type="injector">` (#278); keyword DSL
  + `import.injector` stay Tier-3 documented-as-intended; B scoped as a consumer-triggered follow-on over
  Vite+esbuild pre-transform, no runtime resolver.
- **Next:** none — closed. B re-opens as a new item only when a real consumer needs the sugar.
- **Notes:** see Decision section; consistent with #002 (`@domain`=Protocol) and #271 (native-implied resolution).
