---
kind: story
size: 3
status: resolved
blockedBy: ["328"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/technical-configurator/configurator.ts
tags: [technical-configurator, natural-language, panel, plateau, ai-agnostic]
---

# Panel NL input wiring (populate Requirements state + degrade into the manual panel)

Wire a natural-language input box into the existing Technical Configurator panel in plateau-app: it calls the NL provider seam, populates the configurator's Requirements state from the returned (partial) map, and degrades gracefully into the panel's manual fine-tune mode for any axes the model left unset. Ratified in #096 (Forks 1 & 4): the panel-first surface reuses the most existing machinery (ranking, verdict badges, decision-record emitter) and is the cheapest demonstrable concept; partial-fill-then-complete is the honest default whose failure mode *is* the configurator's manual mode. Blocked on the NL provider seam (#328).

## Progress — resolved 2026-06-13

Built in **plateau-app** `src/technical-configurator/` (locus plateau-app):

- **Registered the no-key keyword NL provider** (`keywordNLProvider`) as the default seam fallback at
  module load, so the NL box is exercisable with zero configuration (a BYO-AI-key provider supersedes it
  via `{ active: true }`). `hasNLProvider()` now returns true.
- **`renderNLBox()`** in `plateau:configurator.ts` — a plain-language input + "Interpret" button inserted at the
  top of the Requirements card, gated on `hasNLProvider()` (shows a manual-only note otherwise). Submit
  (click or Enter) calls **`applyNLDescription()`**, which runs `describeRequirements(nl, currentDomain())`
  through the seam, sets `state.requirements` to the returned **partial** map, marks the config Custom, and
  re-renders — leaving every unmentioned axis un-required so it **degrades into the manual fine-tune below**
  (the #096 partial-fill-then-complete default). A transient hint reports "set N of M axes — complete the
  rest below", or the degrade-to-manual message when nothing mapped / a provider errors. The seam's
  closed-vocabulary normalization keeps a description from ever widening the decision space.
- `nlHint` is module-scoped (survives re-render, not persisted); cleared on preset apply + domain switch.
- **`plateau:configurator.css`** — styles for the NL box.

**Verification:** plateau-app's `npm test` gate (`vitest run`) is not runnable here — vitest is not
installed (pre-existing repo state, same as #502). Verified instead by **`tsc --noEmit`** (new code
type-clean) and an **esbuild-bundled integration run**: registering the keyword provider →
`describeRequirements` partial-fills the matched axis, and an off-vocabulary description normalizes to `{}`
(the manual-mode degrade). The seam itself is covered by the existing `plateau:nl-provider.test.ts`.

**Graduated to** `plateau:plateau-app/src/technical-configurator/configurator.ts` — NL box — keyword no-key provider + renderNLBox/applyNLDescription wired to describeRequirements seam; partial-fill populates Requirements state; unset axes degrade to manual fine-tune (#096).
