---
kind: story
size: 3
parent: "1836"
status: resolved
blockedBy: ["1856"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/validationUnplugged.ts
tags: []
---

# webvalidation unplugged form-fields — register validity-merge-field/async-validator-field + prove form-associated merge/async resolution unplugged

Re-audit #1840: <validity-merge-field> and <async-validator-field> are customElements.define'd ONLY in fui:plugs/bootstrap.ts:230-243; the form-association capability has no unplugged registration path or test (the unplugged test only resolves default strategies by key). Provide an unplugged registration path and an end-to-end form-associated validity-merge + async-resolution test. Blocked by #1856 (needs the unplugged per-scope injector seam). Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

## Shipped (batch-2026-06-27-1842-1720)

Cascade off #1856's unplugged-injector pattern. **Seam:** `fui:plugs/validationUnplugged.ts` —
`setupValidationUnplugged(root)` attaches an `InjectorRoot`, `.set()`s `customValidityMerge` (#215) +
`customValidatorResolution` (#224) on the injector (+ `window`), and idempotently registers
`<validity-merge-field>` + `<async-validator-field>` — the unplugged equivalent of `fui:plugs/bootstrap.ts:230-243`,
no prototype patches. **Test:** `fui:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.e2e.test.ts` —
**12 tests**: element registration, validity-merge end-to-end (`setValidity` driven by the unplugged registry),
async-validator-field end-to-end (versioning drops a stale generation), per-scope injector-chain resolution,
and two wiring guards that **fail without** the setup call. 12/12 pass; tsc-clean. Sonnet-delegated; gate
re-run + assertions reviewed on the main loop.
