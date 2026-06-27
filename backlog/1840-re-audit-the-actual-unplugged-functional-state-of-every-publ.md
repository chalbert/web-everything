---
kind: story
size: 2
parent: "1836"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: reports/2026-06-27-unplugged-functional-re-audit.md
relatedReport: reports/2026-06-27-unplugged-functional-re-audit.md
tags: []
---

# Re-audit the actual unplugged functional state of every public plug API

The premise of #1836 is that unplugged mode is largely non-functional, yet #726 is resolved as having backfilled unplugged tests and flipped PLUG_UNPLUGGED_TEST_ENFORCED to error. Resolved is not proof: re-audit each public plug API against the running runtime (fui:plugs/unplugged.ts versus fui:plugs/bootstrap.ts) and record, per capability, whether the full surface actually works unplugged. Refresh the #635 matrix with today's reality and scaffold a fix card for every real gap found. Discovery only — the per-plug fixes are separate slices this spawns.

## Verdict (re-audit complete 2026-06-27)

Full per-capability re-audit: [we:reports/2026-06-27-unplugged-functional-re-audit.md](/reports/2026-06-27-unplugged-functional-re-audit.md). The epic's "largely non-functional" premise is **half-right**:

- **#635 is obsolete.** The #726 backfill landed a `*.unplugged.test.ts` for every domain (webbehaviors via the shared integration test); the file-presence gate is green and correctly `error`.
- **#726's resolution is real but narrow.** It proved *registry mechanics* (define / resolve / plain-library / scoped-independence) for every domain — but NOT the full public surface. Capabilities that depend on bootstrap-only injector wiring or prototype patches are unproven, and the injector-dependent ones are **structurally absent** unplugged (`fui:plugs/unplugged.ts` builds no InjectorRoot and defines no form-associated controls).
- **Two structural gate gaps:** (A) the WE-side dual-mode rule walks `ROOT/plugs`, which doesn't exist in WE post-#449, so it is skipped silently — zero enforcement here, only in FUI; (B) the detection only checks for a test *file mentioning unplugged*, not surface coverage.

### Real gaps → spawned fix cards

- [#1856](/backlog/1856-webexpressions-unplugged-interpolation-path-wire-customexpre/) — webexpressions `{{ }}`/`[[ ]]` interpolation (the headline gap; needs an unplugged injector seam).
- [#1857](/backlog/1857-webvalidation-unplugged-form-fields-register-validity-merge-/) — webvalidation `<validity-merge-field>`/`<async-validator-field>` form-association (blockedBy #1856).
- [#1858](/backlog/1858-webcontexts-webinjectors-unplugged-ergonomics-out-of-band-we/) — webcontexts/webinjectors prototype-walk ergonomics, WeakMap equivalent or plugged-only (blockedBy #1842).
- [#1859](/backlog/1859-webguards-unplugged-delegation-prove-exit-guard-273-access-c/) — webguards exit-guard/access-control per-scope delegation (blockedBy #1856).
- [#1860](/backlog/1860-webbehaviors-webregistries-unplugged-members-drive-definelaz/) — webbehaviors defineLazy/trait + webregistries root-swap, prove or mark plugged-only.

Genuinely-plugged-only residue candidates (webcomponents `Element.insertion`/cloneHandlers prototype patches) feed the #1839 residue-bar decision, not a fix card.
