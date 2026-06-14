---
type: idea
workItem: story
size: 5
locus: webeverything
status: resolved
dateOpened: "2026-06-14"
blockedBy: ["582"]
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "none (convergence build — webeverything/plugs now superset of frontierui/plugs per #582 A/A; unblocks #449)"
tags: [plugs, frontier-ui, webeverything, superset, reconciliation, refactor]
crossRef: { url: /backlog/449-wire-the-we-plugs-alias-in-frontier-ui-and-delete-the-vendor/, label: "Blocks #449 (alias + delete vendored plugs)" }
---

# Reconcile the 16 divergent FU↔WE plugs files so WE is a true runtime superset (precursor to #449)

Surfaced 2026-06-14 (batch claim on #449). #449's premise — "after #447 + #448 WE is the runtime superset;
files reach FU via the alias, no copy-down" — is **false**. A diff of `frontierui/plugs/` vs
`webeverything/plugs/` finds, beyond 8 expected FU-only files, **16 common files that diverge**, with **FU
ahead in some** (`webcontexts/CustomContext.ts`: 24 FU-only lines). Aliasing+deleting would **lose FU runtime
code**. This converges the trees so WE is a true superset (porting FU-ahead files up first); it gates #449.

## The 16 divergent common files

Expected WE-ahead (per #449's own list — adopt WE): `webinjectors/Injector.ts`, `webinjectors/index.ts`,
`webregistries/CustomElementRegistry.ts`.

**Unexpected divergences — direction must be verified per file before any deletion** (FU may be canonical):
`bootstrap.ts`, `core/cloneUtils.ts`, `webbehaviors/CustomAttributeRegistry.ts`, `webcomponents/cloneHandlers.ts`,
`webcontexts/CustomContext.ts` (FU ahead, proven), `webcontexts/Node.contexts.patch.ts`,
`webexpressions/CustomTextNodeParser.ts`, `webexpressions/CustomTextNodeRegistry.ts`,
`webexpressions/UndeterminedTextNode.ts`, plus 4 divergent test files
(`__tests__/e2e/webcomponents.spec.ts`, `core/__tests__/pathInsertionMethods.extended.test.ts`,
`webcomponents/__tests__/unit/Element.insertion.patch.test.ts`, `webinjectors/__tests__/unit/Injector.test.ts`).

## What this item does

Per divergent file, determine the canonical version and converge the two trees so `webeverything/plugs/`
is a **true superset** of `frontierui/plugs/`: where WE is genuinely ahead, confirm FU loses nothing by
adopting it; where **FU is ahead** (e.g. `CustomContext.ts`), port FU's additions up into WE first (WE is
the upstream per the constellation: WE standard layer → FUI impl). No FU runtime behaviour may be lost.
This re-opens the assumption #447/#448 were meant to establish — either they were incomplete or FU diverged
after them; the close-out must state which.

## Why a precursor, not part of #449

#449 is the destructive step (delete `frontierui/plugs/`, repoint 8 aliases). It is only safe once WE is a
proven superset — otherwise the delete is lossy. So this reconciliation is the gate: resolve it, then #449
becomes the mechanical alias + delete it was always meant to be.

## Gate

`npm run check:standards` in `../frontierui`; a per-file diff of the two trees shows WE ⊇ FU (no FU-only
runtime lines remain) before #449 is unblocked.

## Reconciliation findings (2026-06-14 batch claim) — answers "incomplete vs diverged"

A per-file `diff webeverything/plugs/<f> frontierui/plugs/<f>` over all 16. **The verdict: #447/#448 were
mostly *complete* — WE is genuinely ahead in 11 of 16 — but FU *diverged* on the type architecture of three
core registries, and that divergence is a real decision, not a one-directional port.** So this item is
**not** purely mechanical; it is blocked on a type-architecture call ([#582](582-customcontext-and-customtextnode-customelement-registry-type.md)).

**WE already ⊇ FU — these *prove* the superset, no action (adopt WE; FU loses nothing under #449):**
- `webinjectors/Injector.ts`, `webinjectors/index.ts`, `webinjectors/__tests__/unit/Injector.test.ts` — WE-only lines, FU+0.
- `bootstrap.ts` — WE carries webvalidation (#215/#224), webguards (#289), data-grid, type-ahead registrations FU entirely lacks; FU's "+14" is only older comment wording + import order.
- `core/cloneUtils.ts`, `webcomponents/cloneHandlers.ts` — WE has the #454 `hasOwnProperty('options')` fix (native `<select>`/`<datalist>` clone); FU has the old `'options' in node`.
- `webbehaviors/CustomAttributeRegistry.ts` — WE has the #320/#321 `createViewportPresenceObserver` refactor; FU has the older inline `new IntersectionObserver`.

**Style/representation divergence — pick WE, no runtime loss:**
- `webexpressions/CustomTextNodeParser.ts` + `UndeterminedTextNode.ts` — `parserName: string | null` (WE) vs `parserName?: string` (FU). Equivalent; keep WE for consistency.

**FU-ahead / mutually-incompatible — the blocking decision ([#582](582-customcontext-and-customtextnode-customelement-registry-type.md)):**
- `webcontexts/CustomContext.ts` — **the crux.** WE: `Key`-parameterized `Registry<ContextValue, keyof ContextValue>`. FU: `string`-keyed `Registry` with method-level `get<Key>`, **plus genuinely FU-ahead runtime** WE lacks — `values()`, `entries()`, and a `delete(_key): boolean` signature (WE has `delete(): void`). Not a superset either direction; the converged tree must choose ONE public form.
- `webexpressions/CustomTextNodeRegistry.ts` — FU made `ImplementedTextNode` generic (`<any>`) + imports `RootNode`. Same "which generic form" question.
- `webregistries/CustomElementRegistry.ts` — both have `upgrade()`; FU types it with a concrete signature + an `ImplementedElement` type, WE uses `Parameters<typeof …upgrade>`. Same type-form family.
- `webcontexts/Node.contexts.patch.ts` — FU-ahead robustness (a null-check throwing on an unregistered context + `HTMLInjectorTarget` casts). One-directional-portable, but entangled with CustomContext's resolution.

**Test files (FU-ahead lines, reconcile after the code lands):** `__tests__/e2e/webcomponents.spec.ts` (FU+148/WE+162 — both moved substantially), `core/__tests__/pathInsertionMethods.extended.test.ts`, `webcomponents/__tests__/unit/Element.insertion.patch.test.ts`.

**Next:** ratify [#582](582-customcontext-and-customtextnode-customelement-registry-type.md) (the canonical registry generic form), then this item becomes one-directional: port FU's iteration methods + the Node.contexts.patch robustness up into WE under the chosen form, reconcile the 3 test files, and confirm `WE ⊇ FU`. Released to `open` (blocked on #582) — the mechanical 11/16 are settled above.

## Progress

- **Resolved 2026-06-14.** Converged `webeverything/plugs/` one-directionally onto the #582 A/A ruling so
  it is a **true superset** of `frontierui/plugs/` — verified by a per-file diff of all 16.
  - **Incomplete vs diverged → DIVERGED.** #447/#448 were complete (WE genuinely ahead in 11/16); FU had
    *diverged* on the type architecture of three core registries — that was the one real decision (#582),
    now ratified A/A and applied here.
  - **Converged (adopt FU typings, keep WE runtime):** `CustomContext.ts` + `Node.contexts.patch.ts` +
    `CustomTextNodeRegistry.ts` now byte-identical to FU (method-level `get<Key>`, string-keyed Map-shaped
    context with `values()`/`entries()`/`delete(): boolean`; FU's `ImplementedTextNode<any>` + the
    previously-**unimported** `RootNode` type — porting FU's import also *fixed* a latent WE error;
    `Node.contexts` null-check + `HTMLInjectorTarget` casts). `CustomElementRegistry.ts` took FU's typings
    (`options?` optional, concrete `upgrade(root: Node)`) **while keeping WE's `ensureNativelyConstructible`
    runtime** (#582 Axis 3, unconditional — without it `new RealClass()` throws "Illegal constructor").
  - **Kept WE (already ⊇ FU):** the 11 mechanical files — every remaining FU-only line is older code WE has
    superseded (#454 `hasOwnProperty('options')` clone fix, #320/#321 `createViewportPresenceObserver`
    refactor, bootstrap comment/import-order, and the e2e spec where **WE's assertions are strictly
    stronger** than FU's coarser ones), the #582-ruled `parserName` null/undefined equivalence, or
    whitespace. **No FU runtime behaviour and no FU test coverage is lost.**
  - **Verified:** 216 affected WE plug tests pass (webcontexts/webexpressions/webregistries/webcomponents);
    WE `check:standards` green; FU `check:standards` green (FU untouched). **Unblocks #449** (the
    alias + delete is now a safe, mechanical step).
  - **Note:** `locus` corrected `frontierui → webeverything` — the build edits land in `webeverything/plugs`
    (WE is upstream per the constellation), so the gate + commit are WE; FU was only verified, not modified.
