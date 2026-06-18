# Portable Cross-Field Rule Expression — CEL vs Shape-Only for Mode-1 Validation

**Date**: 2026-06-13
**Point**: Prep survey for decision #465 — keep the validation adapter contract shape-only, leave cross-field to Mode-2 by default, and make a portable Mode-1 cross-field layer a deferred opt-in that adopts CEL (never a minted WE format) if/when built.
**Research page**: `/research/portable-cross-field-rule-language/`

---

## Question

The #085 validation-generation epic shipped a v1 **shape-only** intent set (`we:validation-generation/provider.ts:39-58`) statically emittable to every Mode-1 target (HTML, Zod, Pydantic, JSON Schema). Cross-field / conditional logic (`endDate after startDate`, `require X when Y=z`) was deferred. Decision #465: **define a portable rule-expression language (CEL-like) so cross-field emits to all Mode-1 targets, OR stay shape-only and treat cross-field as Mode-2-only** — which decides whether `CustomValidationAdapter` must carry an expression compiler.

## Recommendation

The binary dissolves into a scope decision + a representation decision, because **Mode-2 already gives cross-field a settled home** (RFC 9457 `problem+json` + precognition, fixed in the 2026-06-06 report). So cross-field works regardless. Recommended:

1. **Shape-only-required v1 contract** — don't force every adapter to carry an expression compiler. Cross-field is an **opt-in adapter capability**, not a baseline (most-flexible default; the per-adapter degradation seam already exists at `we:capability-manifest/provider.ts:48-50`).
2. **Mode-2 is the default authoritative home for cross-field now.**
3. **Portable Mode-1 cross-field is a deferred opt-in — and IF/when built, adopts CEL**, not a minted WE format (minimize-lock-in: reuse the proven external interop language, the `Intl.Collator`/`aria-sort` borrowing discipline), not JSONLogic (weaker), not JSON-Schema-conditionals-only (can't express value-comparison cross-field).
4. **Transpile-vs-embed-runtime is an adapter implementation detail**, representation-neutral in the contract — not a standards fork.

## Key Findings

- **CEL is the reference design.** Non-Turing-complete, linear-time, cross-field via `&&`; official Go/C++/Java/Python runtimes (`cel-expr-python` open-sourced Mar 2026) + community JS/TS (`cel-js`, `@marcbachmann/cel-js` zero-dep, tree-shakeable). protovalidate runs it across 5 languages at v1.0 with **no codegen**.
- **JSON-Schema conditionals are a trap for the headline case** — `if/then/else` + `dependentRequired` survive shape-schema codegen but only express *presence* dependencies; they cannot do value-comparison cross-field (`endDate > startDate`). They cover the easy third.
- **JSONLogic** — portable JSON-AST, many languages, but weaker typing/ecosystem and verbose. Fallback, not a standard.
- **The architecture already has the degradation seam.** `cross-field`/`conditional` are *optional* capability features (`we:capability-manifest/provider.ts:48-50`, "absence is reportable, never a silent no-op"), so portable cross-field can be a per-adapter capability, flag-lossy when absent → falls back to Mode-2. The only predicate escape hatch today is the non-portable `custom` intent (`we:provider.ts:57`).

## Classification (per-fork pass)

- **Layer**: cross-field is an Intent dimension; its *representation* is a format/Protocol question — but the proven external Protocol (CEL) already exists, so WE adopts rather than mints. Generation machinery stays a dependency-free code model (the `CustomValidationAdapter` contract), not an `we:intents.json` entry.
- **Protocol or just dimension?** Minting a WE rule language = lock-in for no interop gain (a protocol is the single escapable lock, never reached casually). Adopt CEL instead.
- **Fixed mechanic or dimension?** Cross-field support is a per-adapter *capability dimension* (manifest-declared), both end-states legitimate (shape-only adapter vs cross-field-capable). Forced invariant: never silently drop → flag-lossy.
- **Most-permissive default?** The standard does **not** require an expression compiler; cross-field is the author/adapter opt-in.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | Added `portable-cross-field-rule-language` topic entry |
| `we:src/_includes/research-descriptions/portable-cross-field-rule-language.njk` | New research write-up |
| `we:backlog/465-portable-cross-field-rule-expression-language-or-stay-shape-.md` | Rewritten to prepared-fork shape; `preparedDate` set |
| `we:reports/2026-06-13-portable-cross-field-rule-language.md` | This report |

## Sources

- [protovalidate (Buf)](https://github.com/bufbuild/protovalidate) · [How Protovalidate uses CEL](https://protovalidate.com/cel/how-cel-works/) · [Logic and conditions](https://protovalidate.com/cel/logic-and-conditions/)
- [CEL](https://cel.dev/) · [google/cel-go](https://github.com/google/cel-go) · [cel-expr-python (Google Open Source, Mar 2026)](https://opensource.googleblog.com/2026/03/announcing-cel-expr-python-the-common-expression-language-in-python-now-open-source.html) · [cel-js (npm)](https://www.npmjs.com/package/cel-js) · [@marcbachmann/cel-js](https://www.npmjs.com/package/@marcbachmann/cel-js)
- [JSONLogic — portable rules (Marcus Obst)](https://marcus-obst.de/blog/portable-rules-and-formulas-with-json-logic)
- [JSON Schema — conditional validation](https://json-schema.org/understanding-json-schema/reference/conditionals) · [dependentRequired](https://tour.json-schema.org/content/05-Conditional-Validation/01-Ensuring-Conditional-Property-Presence)
- Companion: `we:reports/2026-06-06-validation-generation-protocol-adapters.md`
