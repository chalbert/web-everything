# Framework-churn watch (#1258) — review run 2026-06-20 (first run, L0→L1)

Second program watch run of the session, via `/review-program`. L0→L1 graduation for the
framework-churn watch.

## Orient

- **Program:** #1258 — keep WE's framework adapters/wrappers current as vendor framework APIs move.
- **WE surface:** custom elements (FUI) consumed via framework wrappers (#977 React/Vue, resolved)
  and per-framework emitters (#810, resolved). The #463/#505–507 polyglot path is *server*-side
  (.NET/Java), out of scope for this watch.
- **Prior state:** childless program, first run, no metric (L0).

## Front-B delta — frameworks are moving *toward* native custom-element consumption

| Movement | Status | Meaning for WE |
|---|---|---|
| React 19 custom-elements support | Passes Custom Elements Everywhere (property/attribute heuristic, custom events) | The React wrapper (#977) may be largely unnecessary |
| Form-Associated Custom Elements (`ElementInternals`) | Broadly available (Chromium/FF/Safari 16.4+, early 2026) | WE form blocks participate in forms natively — drop polyfill/wrapper form hacks |
| Reactivity convergence (Angular signals, Vue Vapor, Svelte 5 runes, React Compiler) | Shipping 2025–26 | Reinforces the TC39 Signals watch (#1269) — not re-filed |

The headline: "frameworks need a wrapper to use our components" is becoming **false**. The adapter
burden is shrinking — the watch caught a favorable shift, not just a risk.

## Items filed (3) — under #1258

#1271 React-wrapper re-eval (vs React 19 native CE parity) · #1272 adopt `ElementInternals` for
form-participating blocks · #1273 refresh the framework-adapter conformance matrix (React 19 / Vue
3.5+Vapor / Angular 20 zoneless / Svelte 5).

**Not filed (deduped):** reactivity convergence → reinforces existing #1269 (Signals). #977/#810 are
resolved; #1271/#1273 are currency-triggered follow-ups that cross-ref them.

## Front-A read

Not quantifiable yet (shared metric is #1267). Qualitatively the adapter burden is *decreasing* as
React 19 + FACE land — #1273 (matrix refresh) is the recurring front-A check that will quantify it
once #1267 exists.

## Coverage / caveats

- Swept the four major vendor frameworks + CE interop (Custom Elements Everywhere). Did not deep-dive
  niche/emerging frameworks (Qwik, Solid 2.0) — note, not a silent drop; revisit next run.
- Version/status figures are point-in-time (mid-2026); worked items must re-verify at implementation.

## Sources

- [JS framework trends 2026 — nucamp](https://www.nucamp.co/blog/javascript-framework-trends-in-2026-what-s-new-in-react-next.js-vue-angular-and-svelte)
- [React 19 supports custom elements](https://aleks-elkin.github.io/posts/2024-12-06-react-19/) · [Custom Elements Everywhere](https://custom-elements-everywhere.com/)
- [Form-Associated Custom Elements in practice — Frontend Masters](https://frontendmasters.com/blog/form-associated-custom-elements-in-practice/)
- [Reactivity models compared — OpenReplay](https://blog.openreplay.com/reactivity-react-vue-angular-svelte/)

---

## Run 2 — 2026-07-01 (front-A goal-completeness pass)

Focus: the **front-A goal-completeness** pass (the new /review-program step). Run 1 scoped front-A to
*wrapper/adapter conformance* only; this run asks the feature-level completeness question the watch never
had: **does every framework feature #1258 tracks have a WE-standard equivalent** (an intent/block/plug/
protocol), or a deliberate dismissal?

### Front A — goal-set coverage (completeness pass)

**Finding: the feature goal-set was never enumerated** in the item or Run 1 (both scoped to the wrapper
front). Reconstructed the reactivity/rendering feature axes the tracked frameworks (React/Vue/Svelte/
Solid/Angular/Qwik) expose and diffed each against `we:src/_data/intents/` + `we:src/_data/blocks/` +
`we:src/_data/plugs/` (subagent, 2026-07-01). The 13-feature matrix is now recorded in the #1258 body.

**Coverage: 13/13 features covered.** Every tracked feature maps to a named WE standard or a filed
decision — signals→`reaction`, resource-loading→`loader`/`resource-loader`, actions→`action`, suspense→
`resource-loader`+#1976, error-boundary→`reliability`/`error-recovery`, control-flow→`view`/`for-each`,
context→`customcontext`/`injectorroot`, view-transitions→render-strategy protocol, islands/resumability→
loader-timing+#1977, transitions→`motion`, SSR/streaming→`transient-component`, routing→`router`/
`navigation`, wrapper-conformance→#1271–#1273. The open directive proposals (#1976/#1977/#1978) are
*declarative-shape* refinements of already-covered concerns, not missing equivalents.

### Front B — currency

Not re-run this round (Run 1 swept it 2026-06-20). No new vendor delta pulled.

### Outcome

- **0 standard-equivalent residuals** — the feature-parity front is complete; honest-0 completeness case.
- **1 inline record:** folded the 13-feature coverage matrix into the #1258 body so front-A stays
  auditable (the only genuine gap was that the goal-set was undocumented). No cards filed.

**Next run:** re-run the front-B vendor sweep (esp. the deferred Qwik/Solid-2.0 deep-dive from Run 1) and
re-diff any newly-shipped framework feature against the recorded 13-feature matrix.

