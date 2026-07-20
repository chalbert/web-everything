---
bornAs: xt99aii
kind: story
size: 5
parent: "2505"
status: open
locus: plateau-app
dateOpened: "2026-07-20"
tags: [plateau-loop, console, console-board, taxonomy, visual-grammar, glyph, conformance]
---

# Port the visual-grammar manifest into the card-taxonomy webcases + conformance

The 2026-07-20 per-state visual-grammar ruling is **recorded** (in
`plateau-app:docs/backlog-console-design.md` §6e, via plateau-app PR #76) but is **not yet in the machine
spec**. Today each case's `assert:` line in `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`
carries only `actor · edge · primary · rendered · uc` — there is **no glyph / color / motion field**. This
story extends the spec's grammar triple to carry the ruled visual language for all 37 states, and hardens
the conformance test around it, so the board build ([#2555]) can cite a state's glyph/color/motion by UC-id.
Lives in **plateau-app** (the 37 states are plateau business logic; WE holds no taxonomy spec — see [#2553]).

## Scope (all in plateau-app)
- **Extend the assert schema** on all 37 cases in `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`
  with the three ruled fields — `glyph=<lucide>` · `motion=<spin|pulse|nudge|shake|breathe|draw|none>` · and
  the color/style fork values that apply per family (action-fill, amber-value, failure-edge). Source of
  truth: design-record §6e.
- **Pull real Lucide glyphs** at this port (per design-record §318 "pull real Lucide at port time instead
  of hand-maintaining"); the two custom glyphs (`halfdashed`, `brokencircle`) are authored locally.
- **Fold in [#2554] F7** (the six icon-differentiation fixes) as part of the same port pass — this is the
  "one port-time pass" that ruling deferred.
- **Extend the conformance test** (`plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts`): every case
  has a `glyph`; every `glyph` resolves to a known sprite; the intentional shared glyphs (xcircle×E1–E6,
  help×A9/A13, clock×A1/B1) are asserted as an explicit allow-list so they don't trip a uniqueness check;
  every you-act case still carries its amber edge + one primary verb (existing invariant).
- **Render** the glyph/motion column on the web-docs `/console-cases` surface so the grammar is reviewable
  as pixels (per "review the pixels, not the source").

## Manifest to port (from design-record §6e — do not re-litigate)
20 glyph changes from the mock defaults incl. `D1` loader→sync; color forks A=blue · B=lighten-light-only ·
C=drop-chip · D=undo/configurable · F=per-state · G=red-edge · P=ghost; 16 action-button glyphs; motion
overrides A5=pulse · A8=nudge · E2=shake · C3/A11=breathe (loop cadence, reduced-motion respected).

## Acceptance
The 37-case spec carries `glyph`+`motion`+color-fork fields sourced from design-record §6e; the conformance
test is green and guards the allow-listed shared glyphs; `/console-cases` renders the glyph+motion; a board
slice ([#2555]) can cite a state's full visual grammar by UC-id. The mock is not re-litigated.

## Not in scope
- **No new ruling.** Every value is already ruled (§6e); this is a mechanical port + test-harden. A weak or
  contested glyph is refined via the review surface, not decided here.
- **No WE spec.** The general interaction grammar stays app-local until a second board consumer proves it
  general and a reviewed decision mints it (per [#2553] boundary).
