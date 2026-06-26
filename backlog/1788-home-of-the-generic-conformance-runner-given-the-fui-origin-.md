---
kind: decision
status: resolved
relatedProject: webvalidation
blocks: ["1790"]
relatedReport: reports/2026-06-26-split-analysis-1783.md
dateOpened: "2026-06-26"
preparedDate: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
codifiedIn: one-off
tags: [conformance, constellation-placement, runner-home, plateau, frontierui]
---

# Home of the generic conformance runner given the FUI-origin mode-C-bundle requirement (#899 backends→FUI vs #1597 runner→plateau)

#1784 needs the WE docs site to mode-C-load a FUI-origin conformance-runner bundle, but the generic runner (zero plateau-specific deps) is homed in plateau (#1597 'neutral runner'). FUI cannot import plateau (backward edge), and a plateau-origin bundle fails mode-C's #765 trust gate — so the runner's home must be resolved: re-home plateau to FUI as a reference-impl-tier engine (per #899 'backends to FUI'), widen the #765 trust allowlist, or a controlled thin-FUI-runner variant. Gates #1783 Slice B.

## Decision (ratified 2026-06-26)

**(b) — the runner engine stays in plateau.** Deciding rule (ratified): **code reusable against all implementers → plateau (the shared, neutral home); impl-specific code → its implementer.** The conformance runner is a multi-surface plateau tool — run via `npx` inside the implementation under test, from the dev web browser, from the hosted SaaS exerciser, and as the docs demo — so it is shared infrastructure and does not move into one implementer's repo. Only the **binding** (`dispatch`/`observe` adapter) is per-implementer. The WE docs page reaches the plateau runner via a **plateau-origin** surface — widen mode-C's #765 trust to admit the plateau origin, or embed a plateau-hosted conformance iframe (#1790 picks). **Amends #1784:** its "FUI-origin bundle / don't-widen-#765" surface note is **superseded** (the surface is plateau-origin); the rest of #1784 (the #899 declarative-vector KIT model) stands. This reverses the prepared default (a) — re-homing shared infra into one implementer to serve one consuming surface was the wrong cut.

## The reframe (grounding)

#1597 moved the executable runner **engine** (`plateau:src/conformance-engine/conformanceVectors.ts` — `runConformanceVector` + `judgeConformanceTrace` + `ConformanceVectorOracle` + `plateau:src/conformance-engine/virtualClock.ts`) from FUI → plateau on two grounds (`we:backlog/1576-…md:27-31`): (1) it is **executable**, and WE holds zero executable (#1282); (2) **neutrality** — "FUI is one *target*", so a neutral runner shouldn't live in an implementer's repo; plateau (a non-implementer) satisfies neutrality. The engine is **generic** — it imports only the WE-owned `@webeverything/conformance-vectors/{schema,binding}` contracts + a 4-field `Finding` type; **zero** plateau-specific code (verified, #1783 split investigation).

The apparent force #1784 introduces: it framed the WE docs site as needing to **mode-C-load** the runner as a **FUI-origin** bundle. FUI cannot import plateau (backward edge; WE→FUI→plateau, #1595), and a plateau-origin bundle is refused by mode-C's #765 trust gate (`fui:embed/in-document.ts:44-45` — `trustedOrigins ?? [location.origin]`). #1784's prep read that as pressure to move the engine to FUI — but that inverts the placement rule (below): it would relocate shared infrastructure for one consuming surface. The right move is to fix the *surface*, not the *home*.

## Fork 1 — home of the generic conformance-runner engine

*Fork-existence:* a genuine either/or — the engine is one artifact with one home, and the FUI-origin-bundle requirement cannot coexist with #1597's plateau home (FUI↛plateau import + #765 refuses a plateau origin). The three branches are mutually exclusive resolutions; none is free.

| Option | Mechanism | Main tradeoff |
|---|---|---|
| **(a)** Re-home the engine → FUI as reference-impl-tier | The generic `runConformanceVector`/`judgeConformanceTrace`/`VirtualClock` move plateau → FUI (a reference-impl open module consuming only WE contracts); plateau's **hosted exerciser** keeps its neutral-product role and consumes the FUI engine over the forward edge (plateau→FUI, allowed). FUI publishes the mode-C runner bundle directly. | Makes the docs bundle FUI-origin — but **mislocates a multi-surface shared tool in one implementer's repo**, reverses #1597's "engine→plateau", and re-homes the `Finding` type. Rejected by the reusable→plateau rule. |
| **(b)** Keep engine in plateau; surface the docs demo via a plateau-origin mechanism *(default)* | The runner stays the shared plateau tool (npx-in-impl / dev-browser / SaaS / docs). For the docs page: widen mode-C's #765 trust to admit the plateau origin, **or** embed a plateau-hosted conformance iframe. No code moves. | Honors #1597 + the reusable→plateau rule; no re-home, no `Finding` move. Cost: a bounded *first-party* #765 trust addition (the iframe option avoids even that). |
| **(c)** FUI ships its own thin runner; plateau keeps the neutral one | Two engines: a FUI reference runner (self-dogfood) + plateau's neutral exerciser runner. | No edge break, no rule reversal — but **duplicates a ~255-LOC generic engine** across repos (drift risk, the #1245 failure mode this whole effort exists to end). |

**Deciding rule (ratified principle):** **code reusable against *all* implementers → plateau (the shared, neutral home); code specific to one implementer → that implementer (FUI for FUI's own).** The generic runner is reusable against every implementer (zero impl-specific deps), so it belongs in **plateau** — exactly where #1597 put it. #899's "backends→FUI" refers to the **impl-specific backend (the binding)**, not the generic runner.

**The runner is a multi-surface plateau tool (the framing that settles it).** Conformance is not run only on the WE docs page — the same plateau runner is invoked across many surfaces: as an **`npx` script distributed from plateau, executed *inside the implementation under test*** (a 3rd-party's CI / local run), from the **dev web browser**, from the **hosted SaaS exerciser**, and as the docs-site demo. A tool consumed by all of those is shared infrastructure by construction; you do **not** re-home it into one implementer's repo (FUI) to serve one of its surfaces. This is the decisive case against (a).

**Default: (b) — keep the runner engine in plateau; surface the docs demo via a plateau-origin mechanism.** The engine stays put (it's the shared, multi-surface tool above); the only thing to solve is how the WE docs *page* reaches it — one surface among many. Two clean mechanisms (choice delegated to #1790):
- **Widen mode-C's #765 trust allowlist to admit the plateau origin** — a bounded, *first-party-to-first-party* trust addition (plateau is the neutral conformance host), not an untrusted 3rd party; or
- **a plateau-hosted conformance iframe / the `npx`-style runner output rendered** — a cross-origin runtime boundary, no #765 trust-gate issue, no FUI↛plateau edge.

The impl-specific **binding** stays with each implementer (FUI ships FUI's); only that is per-implementer.

**Consequence — amends #1784.** #1784 required a *FUI-origin* mode-C bundle and explicitly declined to widen #765, because its prep assumed the runner would be FUI-homed. This rule overturns that assumption: the runner is plateau-homed and multi-surface, so the docs surface is **plateau-origin**, and #1784's "FUI-origin only / don't-widen-#765" surface note is **superseded** (the rest of #1784 — the #899 declarative-vector KIT model — stands). #1790 carries the amendment.

**Why (a) is rejected (the prepared default, flipped on review).** (a) re-homed the shared runner into FUI and defended it with "neutrality is about *who-hosts*, not *where-source-lives*." The reusable→plateau rule + the multi-surface framing expose that as a rationalization: a runner invoked from npx-in-the-impl / dev-browser / SaaS / docs is shared infra, and shared infra does not live in one implementer's repo. (a) also paid a ratified-placement reversal (#1597) + a `Finding`-type re-home for a result (b) reaches without either.

**Skeptic / red-team (flip clears the same merit gate).** (b) keeps shared infra in the neutral home and costs only a bounded first-party #765 trust addition (or an iframe that avoids even that); (a) mislocated shared code *and* reversed a ratified placement. The pass-4 skeptic that attacked (a) forced a "neutrality defense" the cleaner placement rule makes unnecessary. (b) is the lower-cost, principle-conformant branch.

## Supported by default

- **plateau owns both the runner engine *and* the hosted exerciser** (#427/#1577) — they stay together as the shared, multi-surface conformance tool (npx-in-impl / dev-browser / SaaS / docs). Nothing re-homes.
- **The binding is the only per-implementer piece** — each implementer ships its own `dispatch`/`observe` adapter (FUI's `fui:blocks/deck/deckConformance.ts`, the #1789 synchronous variant for facts→verdict); the runner consumes it via injection. That is the impl-specific code that lives with its implementer.

## Lineage

Surfaced slicing #1783 (`we:reports/2026-06-26-split-analysis-1783.md`); gates #1790 (Slice B). Grounds: #1784 (FUI-origin mode-C bundle), #899 (backends→FUI / exerciser→plateau decomposition), #1576-(2)/#1597 (runner→plateau, neutral), #765 (mode-C WE↔FUI trust gate, `fui:embed/in-document.ts:44-45`), #1595 (clock injected — no backward edge), #1282 (WE zero-executable).
