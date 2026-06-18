# Where does the plugs runtime live — the spec / reference-implementation / polyfill ownership boundary

> **⚠ SUPERSEDED by the #606 ruling (2026-06-14).** This report recommended **A — WE owns the reference
> runtime**. The decision (`backlog/606-…md`) was ratified to **B — plugs is *implementation* →
> `@frontierui/plugs`** (FUI impl umbrella), after the classification was corrected: plugs is a polyfill /
> permanent library of a *theoretical* standard (not a reference impl of a ratified spec), the real surface
> is the *unplugged* non-invasive library (plugged = POC/demo), and FUI is a granular umbrella so there is
> no layer inversion. Read the analysis below as the prior-art survey it is, **not** the conclusion.

**Date**: 2026-06-14
**Point**: Decision #606 reduces to one archetype question — is `plugs/` a *polyfill* (lives outside the spec), a *reference implementation* (lives with the spec), or a *shared substrate package* (its own home below many impls)? The prior-art survey says WE's plugs are a **reference implementation** of the standard (CommonMark/cmark, dart-sass precedent), so they belong in WE — with a standalone `webplugs` package as the principled escape hatch the moment a *second* independent impl consumes them (the React-`scheduler` / `@lit/reactive-element` precedent).
**Plan file**: (none — focused `/prepare 606`)
**Research page**: `/research/spec-reference-runtime-boundary/`
---

## Question

`plugs/` is an executable runtime tree (registries + browser-API patches: `plugs/webregistries/`, `plugs/webinjectors/`, `we:plugs/bootstrap.ts`) that lives in **Web Everything**, the *standard* layer. That placement was inherited from epic #170's consolidation premise ("WE owns the plugs runtime; FU aliases via `@we/plugs`"), never ratified on its own merits. #606 settles whether the executable substrate belongs in the standard layer (WE), the impl layer (Frontier UI), or its own published package — against the one adjacent ruling, #239, which says "`@webeverything/*` is reserved for standard artifacts and never depends on Frontier UI."

## Recommendation

**A — WE owns the reference runtime**, on the corrected "reference-implementation, not polyfill" justification. **C — carve a standalone `webplugs` package — is the named escape hatch**, triggered by a concrete event (a *second* independent impl, beyond Frontier UI, consuming plugs). **B — FU owns the runtime — is rejected**: no archetype in the survey supports the implementation layer owning the *standard's own* reference runtime, and it inverts the demo model. Confidence: **med-high** — the archetype classification is clear; the only genuine judgment is whether a second impl consumer is near enough to pull C forward now.

## Key findings

The survey verified how real ecosystems split a standard from its runtime. Three archetypes emerged, and `plugs/` must be classified as exactly one:

1. **Polyfill** — *spec ≠ runtime; the runtime lives OUTSIDE the spec.* Web Components polyfills ship as `@webcomponents/webcomponentsjs` (a separate `webcomponents/polyfills` repo), not inside the WHATWG/W3C spec. core-js is a third-party ECMAScript polyfill TC39 does **not** publish — TC39 ships the spec plus the **test262** conformance suite (tests, not runtime). This archetype would push plugs *out* of WE (toward B or C).
2. **Reference implementation** — *a canonical executable embodiment kept WITH the spec, to make it demonstrable and testable.* CommonMark ships the spec **and** `cmark` (the C reference impl) under one org; dart-sass is the canonical/official Sass implementation; CPython is the reference impl PEPs are realized against. This archetype keeps the runtime *with the standard* (A).
3. **Shared substrate package** — *a platform primitive factored into its own package consumed by multiple higher layers.* React publishes `scheduler` and `react-reconciler` as packages shared by react-dom/react-native; Lit publishes `@lit/reactive-element` as the base `LitElement` extends. This archetype is C — but it is **earned by plurality**: the package exists because *many* consumers need it.

**The two patterns are not mutually exclusive** (TC39 ships tests-not-runtime; CommonMark ships both a spec and a reference impl) — so "specs ship no runtime" is a *tendency of mature multi-vendor standards*, not a law that binds a young standard whose reference runtime *is* its demonstration vehicle.

**WE's plugs are a reference implementation, not a polyfill.** They are the runtime that makes WE standards runnable in a real browser (`we:bootstrap.ts` patches `window` in plugged mode); WE demos exist to *exercise the standard itself*. That is precisely the CommonMark/dart-sass role — the executable embodiment of the spec, co-located with it. Frontier UI's `blocks/` are the *application* implementations built on top; those are the polyfill/impl analogue, correctly outside the standard.

**The #239 reading in the item was incomplete — and the correction strengthens A.** The item argued "#239 governs *published* packages; `@we/plugs` is an unpublished path alias, so #239's letter doesn't bind." But #239 re-scoped `jsx-runtime` to `@frontierui/*` **despite it having no `@frontierui` import** — purely because "it **is** implementation." So #239's load-bearing principle is **standard-artifact vs implementation**, *not* published-vs-unpublished. The unpublished-alias argument is a red herring. The real question #239 poses is the *classification* — and a reference implementation of the standard is a standard artifact (an artifact *of* the project), categorically unlike `jsx-runtime` (application glue). So plugs satisfies #239's letter (it imports nothing from FU — the only dependency #239 forbids) **and** its spirit (it is not application implementation masquerading as a standard artifact). #239 does not extend to plugs.

**C is real but not yet earned.** The separation bias ("a concept that recurs without its neighbour earns its own home; couple only when the split has a concrete named cost") is the rule for C. Today Frontier UI is the *only* implementation consuming plugs (plateau-app consumes the same alias, but as a *product*, not an independent impl). plugs does not yet "recur without its neighbour," so the split into a third versioned package is not yet earned — its named cost (a package/repo to version + maintain) is real and unoffset. The moment a *second* independent impl consumes plugs, the React-`scheduler` precedent applies and C becomes the honest home. That trigger — not effort — is the A↔C knob; *when* to build C is normal burndown ordering, not a design fork (the cost is prioritization, not a merit branch).

## Files Created/Modified

| File | Action |
|------|--------|
| `we:reports/2026-06-14-plugs-runtime-ownership-boundary.md` | Created (this report) |
| `we:src/_data/researchTopics.json` | Added `spec-reference-runtime-boundary` topic |
| `we:src/_includes/research-descriptions/spec-reference-runtime-boundary.njk` | Created write-up |
| `we:backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth.md` | Rewritten to prepared-fork shape; `preparedDate` stamped |
