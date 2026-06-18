# Change Plan: Separate Intent (ambient preference) from Trait Selection (local construction)

**Date:** 2026-06-02
**Decision:** "Intent" was being used for two things — an ambient, design-owned *behavioral preference* propagated via DI, and a local, developer-owned *structural construction* of a component. Keep the name **intent** for the first; rename the second to **trait selection**. Structural dimensions never travel on the intent channel — so `customContexts:droplistIntent="single"` goes away.
**Worked example:** [`we:2026-06-02-droplist-trait-language.md`](./2026-06-02-droplist-trait-language.md).

---

## The rule this enforces

| Channel | Owner | Carries | Mechanism |
|---|---|---|---|
| **Intent** | Designer / product | *Behavioral* preference (focus strategy, collision, truncation) — ambient, partial, overridable | DI: `customContexts:*Intent` |
| **Trait selection** | Developer | *Structural* construction (`model`, `editable`, which traits compose) — local, total | Attributes / `with*` composition |

Resolution per dimension: `explicit ⊕ ambient intent (behavioral only) ⊕ default`.

---

## What changes

### A. Design doc — `we:2026-06-02-dropdown-trait-composition.md` (primary)

1. **Rename the `DropdownIntent` interface → `DroplistTraits`** (or `DroplistConfig`). Drop all "intent" framing for the per-instance bundle.
2. **Strip `customContexts:droplistIntent="…"` wrappers** from the Step 1 / Step 3 markup. Move structural values onto the behavior attributes directly (`selection="model=single"`, `selection="model=multiple"`).
3. **Narrow the "Where the intent profile comes from" section** to *behavioral* dims only (focus strategy, collision, truncate); relabel it "Ambient design preference (intent)". Show it can never set `model`/`editable`.
4. **Add a "Two channels, one config" subsection** with the resolution-merge rule (the table + `explicit ⊕ ambient ⊕ default`, structure stops at local).
5. **Update `selectTraits` / desugaring sketch** so behavioral options fall back to ambient intent while structural options are always explicit.
6. **Add the `composeDroplist([...with*])` TS form** as the canonical trait-language surface (was JS-call-then-HTML; now lead with explicit trait composition for structure).
7. **Terminology table:** add the Intent (ambient preference) vs Trait selection (local construction) distinction.

### B. Standard artifacts (flag now, apply when promoting)

8. **`we:src/_includes/block-descriptions/droplist.njk`** — note that variant differences are *trait selections*; only behavioral defaults come from an injected intent. (Also still carries the earlier "dropdown→droplist" wording fix.)
9. **Glossary** (`we:src/_data/semantics.json` or includes) — add **Trait selection / composition** and **Ambient intent**; cross-link.
10. **Intents catalog framing** (`we:src/_data/intents.json` design notes / `/intents/` intro) — state explicitly that an intent is an *ambient behavioral-preference vocabulary*, distinct from per-instance trait composition. No per-intent data shape change required.

### C. Code — Plateau (light; mostly already aligned)

11. **`fui:FocusDelegation.ts` / `fui:Selection.ts`** already take options *locally* — that is trait selection, so no API change. Add only: a documented fallback where *behavioral* options (e.g. `strategy`) resolve from an injected `droplistIntent` when not passed; structural options never do.
12. **Add `controller` to `FocusDelegation`** (already its own flagged prototype — the autocomplete focus-host case). Independent of this rename but lands in the same pass.
13. **(Future) `composeDroplist(host, traits[])` helper** + `withFilter` / `withClearable` / `withLiveStatus` / `withAnchoredSurface` factories — the TS trait surface shown in the worked example. Not built yet.

---

## What does NOT change

- The **intent vocabulary / `/intents/` catalog** stays as-is (it was always the dimension *schema*). This plan only fixes how *instances* of those dimensions are expressed.
- The **ambient intent (DI) mechanism** survives — narrowed to behavioral preference. `loaderIntent` is already a correct example of it.
- The **split behaviors** (`FocusDelegation`/`Selection`) and their green test are unaffected.

---

## Sequence

1. Land **A1–A7** in the design doc (text-only; no code risk). ← the substance of this decision.
2. Apply **B8–B10** when the droplist standard is next touched.
3. Do **C11–C12** with the `controller` prototype; **C13** only if/when a runnable component is built.

Smallest first step that proves the idea: **A2 + A6** — delete the `customContexts:droplistIntent="single"` wrappers and show the `composeDroplist([... withSelection({model:'single'}) ...])` form beside them. Everything else is consolidation around that move.
