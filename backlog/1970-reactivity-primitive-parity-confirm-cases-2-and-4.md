---
kind: story
size: 3
parent: "1963"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
graduatedTo: none
tags: []
---

# Reactivity-primitive parity confirm (cases 2 and 4)

Cases 2 (grouped or reactive control) and 4 (view directives) assume a framework-grade reactivity primitive (signals or observed properties) for ergonomic parity. Confirm WE and FUI reactivity glue is framework-grade, or file the build. The DOM and form pieces are already native; only the reactivity glue is the open confirm. Ratified under #1963.

## Confirm — framework-grade, no build to file

The reactivity glue cases 2/4 lean on is **already ratified and built (FUI half) at framework parity** — this
is a positive confirm, not a gap. WE holds the contracts (zero impl, rule #6); FUI holds the runtime. Four
existing primitives cover the ergonomic-parity assumption end to end:

1. **DC-4 `observe=` binding layer (#792, ratified; codified `we:docs/agent/platform-decisions.md#component-dc`,
   graduated → #825).** Observed-attribute → template reflection lowered to generated imperative code at
   `<component>` build time — the **Svelte/Solid compile-time model** (zero platform bet, zero runtime
   diff-cost). This is the "observed properties" leg of the parity assumption: one-way reactive bindings
   with framework-grade ergonomics, buildable today.

2. **The reactive `consume()` handle (#1798 ruled → #1829 built; codified
   `we:docs/agent/platform-decisions.md#reactive-handle-not-thenable`).** A **non-thenable** handle: live
   synchronous `.value` (matches TC39 Signals `.get()` / RxJS `BehaviorSubject.value`), explicit
   `await handle.next()` for wait-for-next, and `for await…of` streaming via `Symbol.asyncIterator`. The
   `await consumable`-hangs footgun is impossible by construction. WE ships the typed contract at
   [`we:webinjectors/contract.ts`](../webinjectors/contract.ts); FUI ships the live value source at
   `fui:plugs/webinjectors/Injector.ts` + `fui:plugs/webcontexts/CustomContext.ts` (both present in-tree).
   This is the **signals-grade reactive read** leg.

3. **`webexpressions` `{{ }}` / `[[ ]]` binding+reactivity layer** — the runtime binding grammar cases 2/4
   reuse (per the #854 sub-ruling, `<component>` scoped registration binds through it rather than a new
   runtime). Exists and shipped (poc).

4. **`CustomStore` reactive container** (block-standard `Store` type, `extendsClass: CustomStore`) — the
   observable state container blocks bind to for grouped/reactive control (case 2).

**Native-substrate watch is live, not missing:** TC39 Signals is tracked (#1269, resolved) as the future
native substrate for the webexpressions reactivity model, with a concrete trigger recorded at the consumer
(`we:src/_data/projects/webexpressions.json`): if Signals reaches Stage 4 / ships, file an item to defer
webexpressions reactivity to native Signals per native-first. So the glue is framework-grade **today** and on
a credible path to native **later** — exactly the parity-now / deprecate-to-native-later shape #1963's bar
rule 4 requires.

**Case 4 (view directives)** is already graded ✅ *at parity today* in #1963 (comment-anchor directives
#1130 + the view directive family #1217, FUI `webexpressions`/view glue) — zero-node, HTML + JSX. **Case 2
(grouped/reactive)** was graded ◐ *parity pending this confirm*; the ratified group-CE + form-associated-
children split (#1456) plus the four reactivity primitives above **clear the pending confirm**.

**Verdict: confirmed framework-grade — no build filed.** The reactivity glue assumed by cases 2 and 4 is
ratified contract + shipped FUI impl, not an open invention. Case 2's ◐ → ✅; case 4 already ✅. No new
WE entity/protocol/intent; no new child item (the only future work — defer-to-Signals — is already filed as
the #1269 trigger, not opened prematurely).
