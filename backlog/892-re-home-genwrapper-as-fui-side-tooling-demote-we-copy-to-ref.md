---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["855"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/tools/gen-wrapper/genWrapper.mjs
tags: []
---

# Re-home genWrapper as FUI-side tooling + demote WE copy to reference fixture; correct #821/#753 framing

Ratified by #855 (B2): the generator is impl/tooling, not a @webeverything standard. genWrapper lives in webeverything/scripts/gen-wrapper (#821). Re-home generation ownership to FUI, which runs a generator over WE's published CEM. Demote the WE-side copy to a reference generator / conformance fixture subordinate to the CEM (the #461 fetchHandler 'reference impl, not the definition' pattern), or move it out of @webeverything per #507. Correct the #821/#753 framing. Boundary invariant: only the CEM contract crosses WE→FUI; codegen never ships as a WE standard.

## Progress (resolved 2026-06-18)

Applied the **demote-to-reference-fixture** branch (the #461 precedent the item cites), since #891 already
gives WE the generator-agnostic behavioral conformance — so a WE reference generator is a CEM-subordinate
demonstration, not a redundant second standard. (~75% confidence; residual = pure move-out per #507, which
stays available and reversible.)

- **Re-homed (canonical → FUI):** copied the pure generator `genWrapper.mjs` + its self-contained test into
  `frontierui/tools/gen-wrapper/` (beside the trait-enforcer — FUI's `tools/` is its build-tooling home), with
  a CANONICAL-HOME header. Wired FUI's `vitest.config.ts` to run `tools/**/__tests__/**/*.test.mjs`. **FUI: 17
  gen-wrapper tests green, `check:standards` green.** The `cli.mjs` materializer stayed WE-side (it reads WE's
  own `custom-elements.json`; the FUI panel #753 imports `generateWrapper` directly, not the CLI).
- **Demoted (WE copy):** `scripts/gen-wrapper/genWrapper.mjs` + `cli.mjs` carry a prominent ⚠ REFERENCE-FIXTURE
  header — the canonical generator is FUI's; this WE copy is a CEM-subordinate reference that materializes +
  diffs sample wrappers, NOT a shipped `@webeverything` standard. WE's owned conformance is `wrapper-conformance/`
  (#891).
- **Framing corrected:** appended a #892 note to **#821** (its `graduatedTo` WE artifact is now the demoted
  reference); **#753** already carries the #892 edge.

Boundary held: only the CEM contract crosses WE→FUI; the generator code now lives in FUI. WE: 503 tests +
`check:standards` green; FUI: gate green.
