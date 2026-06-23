# Live-page WE-conformance detection — prep for #1673

**Point:** How the dev-browser extension decides a running page is WE-conformant (and lights up): probe-first MVP, tiered to a declared opt-in upgrade and a verify-on-demand action — grounded in how every shipping framework devtool detects its framework.

---

## Question

`#1673` (the buried fork under the conformance-lit funnel MVP `#1656`): how does the dev-browser extension decide a running page is WE-conformant, so its tooling lights up? Three mutually-exclusive mechanisms — (a) DECLARED (read a `CapabilityManifest`), (b) PROBED (inspect the live runtime, no app cooperation), (c) VERIFIED (run conformance vectors against the page). Greenfield: no live-page probe exists today.

## Recommendation

**Probe-first, tiered.** PROBE is the default activation gate (zero cooperation, widest reach, non-mutating, the universal framework-devtool pattern, and the only branch that lights up on real pages today). DECLARED is the authoritative opt-in *upgrade* layered over the probe (precise `conformanceLevel`/features when an app ships a manifest). VERIFIED is an explicit on-demand inspector action, never the passive gate (it mutates the page).

## Key findings

1. **Every shipping framework devtool probes a runtime signal — none gates first-impression on a declared manifest, none runs a verification suite to merely light up.** React injects `__REACT_DEVTOOLS_GLOBAL_HOOK__` + tags DOM nodes (`__reactFiber$`); Vue exposes `__VUE__` / `el.__vue_app__`; Angular renders `ng-version` on the root (robust even under SSR — the probe/declared hybrid); Svelte compiles away and leaves no runtime global (the cautionary "compile-away is near-invisible" case). Wappalyzer/Lighthouse/BuiltWith generalize the probe to ~3000 signatures but are documented as unreliable.

2. **The recurring trade space is exactly #1673's three branches:** declared (opt-in/trustable/self-describing, but needs cooperation, can lie, goes stale) vs probe (zero-cooperation/widest-reach, but brittle to drift + false positives) vs verify (authoritative, but expensive/slow and *mutates* the page).

3. **In-tree facts decide two branches out of the default seat:**
   - A DECLARED-only gate lights up on **zero** pages today — `we:capability-manifest/check.ts:107` (`IMPLEMENTATION_MANIFESTS`) is empty; the manifest is a build-time `export const manifest` convention (`we:capability-manifest/provider.ts:129/139`), not runtime-queryable.
   - VERIFIED **mutates** the live page — `we:wrapper-conformance/runner.ts:62/64` creates DOM containers, renders, dispatches events — so it cannot be the always-on activation gate.
   - PROBE has real, non-mutating signals today — `we:plugs/webregistries/declarativeRegistry.ts:39` (`script[type="registry"]`), `:279` (`SCOPED_REGISTRY_KEY`), `:292` (`getActiveRegistryResult()`). The webexpressions binding (`we:plugs/webexpressions/index.ts:75`) is injector-internal with no public probe global — a known limit on probe richness.

4. **Precedent in-repo:** `#141` Fork 1 already ruled the rich vision "gate on a capability manifest, degrade gracefully" (per-feature lighting). `#1673` is the narrower *first-impression* detection for the MVP — and because no app ships a manifest yet, a declared-first MVP would be a funnel that never lights up. The probe-first ruling is the faithful MVP composition of the #141 end-state.

5. **The sub-fork ("probe-to-light + verify-on-demand tiering") is not a rival** — it is the recommended composition: probe = floor, declared = ceiling, verify = on-demand deep check.

## Files created/modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics/live-page-we-conformance-detection.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/live-page-we-conformance-detection.njk` | created (write-up) |
| `we:reports/2026-06-23-live-page-we-conformance-detection.md` | created (this report) |
| `we:backlog/1673-conformance-lit-mvp-how-does-the-extension-detect-we-conform.md` | prepared-fork body + `preparedDate` |
