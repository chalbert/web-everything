# Surfacing FUI headless-logic conformance on the WE docs site (#1784)

**Date:** 2026-06-26
**For:** decision #1784 (prep), downstream of #1294 un-park gate (b).
**Question:** how does the WE eleventy docs site exercise FUI *headless logic* (webpolicy is a DMN engine — facts→verdict, no DOM) as an executable conformance proof, with no build-time `@frontierui` import?

## Finding 1 — the original "mode-C vs #899-runner" framing was a false fork; they are orthogonal layers

| Layer | Mechanism | Evidence |
|---|---|---|
| **Transport** (how a FUI bundle reaches the page) | **mode-C** — runtime `import(url)` of a published FUI bundle that self-mounts via `mountInDocument`; eleventy never imports FUI source | `fui:embed/in-document.ts:84`, `fui:embed/contract.ts:66-82`, `we:.eleventy.js:112-121` (`data-embed-src=<URL>`, the #700 source-direction rule) |
| **Harness** (what conformance runs) | **#899 KIT** — WE owns the `ConformanceBinding`/`ConformanceClock` interfaces + vector schema; FUI ships a binding impl per standard; plateau owns the runner | `we:conformance-vectors/binding.ts:40-64`, `fui:blocks/deck/deckConformance.ts`, `plateau:src/conformance-engine/conformanceVectors.ts` (#1597) |

You mode-C-*load* a runner; they compose, they don't compete. So #1294's gate-(b) "mode-C bundle path **or** the #899 runner" is not the real decision.

## Finding 2 — the real fork: conformance **model** for the relocated facts→verdict runtimes

- **(a)** bespoke self-checking FUI bundle (engine + its own asserts travel into FUI; WE displays pass/fail). The current `we:demos/webpolicy-conformance-demo.ts:34,106` is exactly this shape.
- **(b)** #899 declarative-vector KIT (facts→golden verdict; WE corpus + synchronous binding interface; FUI binding impl; FUI-origin runner bundle). **Recommended default.**

## Finding 3 — skeptic pass (run in prep) corrected three things

A refute-only sub-agent returned **SURVIVES-WITH-AMENDMENT**:

1. **Transport claim was false.** Mode-C's #765 trust gate defaults to `[location.origin]` (`fui:embed/in-document.ts:44-45`); a **plateau-origin** runner bundle is refused. The mode-C artifact must be **FUI-origin** — the plateau runner logic (#1597) is re-exported as a FUI-published bundle. Widening the allowlist would reopen #765 (not done).
2. **The #1467 demerit on (a) was rhetorical.** A self-checking bundle proving one FUI engine against its own asserts is a reference-impl-proving-itself (wpt/test262 pattern), not a neutral verifier — and plateau is not in the docs render path (`we:.eleventy.js:112-121`). (a)'s real flaw is **format proliferation**, not verifier placement.
3. **Amortization was overclaimed + the binding split undersold.** The #1078 list is heterogeneous (webpolicy=DMN, `intl`=formatting, `webtheme`=tokens, `webexpressions`=interpreter) — not 10 facts→verdict engines. So (b) is scoped to the **facts→verdict subset** (webpolicy first), and #1783 must deliver a **clock-optional synchronous** binding *sibling* (the temporal `neverObserved`/clock machinery is dead for synchronous logic), not a free extension.

## Outcome

#1784 prepared with default **(b)**, scoped to facts→verdict runtimes, corrections folded in. Prior external survey (WPT / JSON Schema Test Suite) lives in #899's research; not re-surveyed. Residual build delegated to #1783 (blocked on this call).
