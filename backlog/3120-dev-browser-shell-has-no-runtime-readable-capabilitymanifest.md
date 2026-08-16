---
bornAs: xwj9o7m
kind: decision
parent: "1391"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
crossRef: { url: /backlog/1755-dev-browser-shell-conformance-gated-feature-lighting-capabil/, label: "Blocks #1755 (dev-browser conformance-gated feature lighting)" }
relatedTo: ["1673", "266", "268", "1722", "2212", "1753"]
relatedReport: reports/2026-06-23-live-page-we-conformance-detection.md
tags: [dev-browser, capability-manifest, conformance, decision]
---

# Dev-browser shell has no runtime-readable CapabilityManifest to gate feature-lighting on (blocks #1755)

Found while preparing #1755 to build-ready (2026-08-15) — not a re-litigation of #1673, a fresh gap #1673 didn't have to close (it only needed the extension's *passive light-up* gate, and ruled probe for that; it explicitly left DECLARED as a future opt-in tier without designing that tier's mechanics).

#1755's whole premise is reading a loaded app's declared CapabilityManifest (we:capability-manifest/provider.ts) to gate which dev-browser capability modules light up. Verified against the tree (2026-08-15): that data source does not exist yet, on either side. (1) Zero implementations ship one — we:capability-manifest/check.ts:107's `IMPLEMENTATION_MANIFESTS` is still empty, its own comment says so, and a repo-wide grep for 'export const manifest' (the #266 OP-19 static-export convention) finds nothing in plateau-app or frontierui. (2) Even if one existed, there is no channel to read it across the loaded-page boundary: the CapabilityManifest is a build-time static export (OP-19), not runtime-queryable, and the one runtime channel that does cross that boundary — `window.__WE_DEVTOOLS_GLOBAL_HOOK__` (frontierui:plugs/webregistries/declarativeRegistry.ts:330) — only carries a generic activation-surface `features: ReadonlySet<string>` (e.g. `'declarative-registry'`, `'plugged-mode'`), not the structured `{specVersion, conformanceLevel, features: ValidationFeatureId[], concerns}` shape. #268's `guardCapability(manifest, feature)` (we:capability-manifest/guard.ts:51) is intra-process only (called by validation-runtime code that already holds the manifest in scope) — no cross-boundary read exists there either. #1673 (ratified 2026-06-23) already found this for the extension case and deliberately demoted DECLARED to an "opt-in upgrade tier" for exactly this reason; that finding still holds today and applies identically to the standalone shell.

## Prior art (reused, not re-surveyed)

This is a narrow *extension* of ground #1673 already surveyed, not a fresh greenfield question: the [live-page WE-conformance detection](/research/live-page-we-conformance-detection/) research topic (`relatedReport` above) already benchmarked how shipping framework devtools expose runtime state across a MAIN-world global hook (React's `__REACT_DEVTOOLS_GLOBAL_HOOK__` carries structured per-renderer data, not just a presence boolean — the precedent that a devtools hook can carry more than a flag). #1722 already built the WE-specific instance of that pattern (`window.__WE_DEVTOOLS_GLOBAL_HOOK__`) for probe-presence data. Fork 1 below is "does the same hook grow one more field," grounded directly in the live code (citations throughout), so no new `/research/` topic is warranted — the survey this would need already exists and is linked.

## Fork 1 — how does a CapabilityManifest cross the loaded-page boundary to an external observer?

*Fork-existence justification:* a forced invariant, not a genuine multi-way tradeoff — of the four candidate channels below, two ((c), (d)) are structurally disqualified from ever being cross-boundary-readable by an external observer (the dev-browser extension's `chrome.devtools.inspectedWindow.eval()` call, or the Electron shell's content-pane preload, plateau:packages/dev-browser/src/shell/probe-preload.ts per #1753's decided design), and the third (b) is disqualified on precedent-consistency/composability grounds (a real, permanent merit gap, not an effort one — see the Screen note below), leaving exactly one survivor. Naming the excluded branches:

- **(a) Extend `window.__WE_DEVTOOLS_GLOBAL_HOOK__` with a manifest getter — recommended default, the only surviving candidate.** The hook (frontierui:plugs/webregistries/declarativeRegistry.ts:340, `WebEverythingDevtoolsHook`) is already installed on `globalThis` at every WE runtime activation point (`markWebEverythingActive`, frontierui:plugs/webregistries/declarativeRegistry.ts:368) specifically to be cross-world-readable — the identical MAIN-world-shared-DOM boundary both consumers already cross today for the hook's *existing* fields: the extension's panel-detect script (plateau:packages/extensions/src/chrome-extension/panel-detect.js:24) reads `typeof __WE_DEVTOOLS_GLOBAL_HOOK__` via `inspectedWindow.eval()` (which runs *in* the page's own JS context, so any MAIN-world global — and, by the same reachability, any method on it — is callable), and `detect()` (plateau:packages/core/src/probe/detect.ts:50) reads `win[WE_DEVTOOLS_GLOBAL_HOOK]` directly for the Electron shell's preload (which per #1753's own decided design shares the real `document`/`window` with the loaded page — "isolated worlds share the DOM; they only get separate JS-builtin realms," per plateau:packages/dev-browser/src/shell/main.ts's design note). Extending the *same* hook is strictly additive (a probe that doesn't know the new field just ignores it; `version` stays `1`) and reuses the one cross-boundary channel WE already committed to, rather than teaching every consumer a second one.
- **(b) A dedicated new global/query surface** — *rejected*. Would duplicate the exact job `__WE_DEVTOOLS_GLOBAL_HOOK__` already does (a versioned, MAIN-world, read-only marker a probe gates on `version === 1` before trusting) for no new capability — every consumer that can read one global can read a second field on the one it already reads. React/Vue-style devtool hooks converge on a single hook per runtime for exactly this reason (one thing to install, one thing to probe); a second WE global is a footgun (a probe must now know to check two markers, and the two can drift out of version-lockstep).
- **(c) An `ElementInternals` property** — *rejected, structurally disqualified*. OP-19's own comment (we:capability-manifest/provider.ts:121-127) names this as an anticipated "richer exposure," but it requires the observer to already hold a reference to a *specific element* that carries the property — there is no natural page-root element an external observer (extension or shell preload) could reach for *before* knowing anything about the page's implementation. `ElementInternals` is designed for a custom element to expose semantics to the browser/AOM, not for a page to publish a document-level artifact to an unknown external observer.
- **(d) An injector provider via `InjectorRoot.getProviderOf`** — *rejected, structurally disqualified*. Also named in OP-19's comment. `InjectorRoot.getProviderOf(node, providerName)` (frontierui:plugs/webinjectors/InjectorRoot.ts:118) requires a live `Node` reference already inside the page's own injector chain (it walks `node.parentNode`) and is a static method on a class that lives in the page's own bundle — an external observer has no global handle to reach the class *or* a qualifying node from outside the page's JS realm. This is the exact class of disqualification #1673 already applied to #268's `guardCapability` (intra-process only, called by code that already holds the manifest in scope) — same failure, different call site.

### Shape of the default (concrete)

Add one method to the existing hook, mirroring how `getActiveRegistryResult()` (frontierui:plugs/webregistries/declarativeRegistry.ts:350) already exposes a live snapshot via a late-bound reader, and one new marking entry point mirroring `markWebEverythingActive` (frontierui:plugs/webregistries/declarativeRegistry.ts:368):

```ts
// frontierui:plugs/webregistries/declarativeRegistry.ts
export interface WebEverythingDevtoolsHook {
  readonly version: 1;
  readonly runtime: 'web-everything';
  readonly features: ReadonlySet<string>;
  readonly present: boolean;
  getActiveRegistryResult(): unknown;
  /** NEW — the most recently published CapabilityManifest (any implementation that has called
   *  markCapabilityManifest()), or `null` if none has published yet. */
  getCapabilityManifest(): unknown;
}

/** NEW — an implementation calls this once, at module load, alongside its OP-19 static `export const
 *  manifest`, to also publish it on the cross-world hook. Mirrors markWebEverythingActive's pattern:
 *  installs the hook idempotently, records the manifest in a module-private slot. */
export function markCapabilityManifest(manifest: unknown): void { /* … */ }
```

```ts
// frontierui:plugs/webvalidation/index.ts — the publishing side, next to the existing #266 re-exports
// and the file's existing "if (typeof window !== 'undefined') console.log(...)" module-load pattern
import { manifest } from './capabilityManifest'; // new: this plug's own OP-19 static export
import { markCapabilityManifest } from '../webregistries/declarativeRegistry';
if (typeof window !== 'undefined') markCapabilityManifest(manifest);
```

```ts
// plateau:packages/core/src/probe/detect.ts — the reading side, alongside the existing hook read
const hook = win[WE_DEVTOOLS_GLOBAL_HOOK];
const capabilityManifest = (hook as { getCapabilityManifest?: () => unknown } | undefined)
  ?.getCapabilityManifest?.() ?? null;
```

One slot, last-publisher-wins, exactly like `getActiveRegistryResult`'s single `reader` variable (frontierui:plugs/webregistries/declarativeRegistry.ts:378) — there is exactly one shipping manifest-typed vocabulary today (`ValidationFeatureId`/`ConformanceLevel`, we:capability-manifest/provider.ts:41/31), so a single unkeyed slot has zero design speculation baked in. `CapabilityManifest`'s own docstring already anticipates other WE standards reusing the `{specVersion, conformanceLevel, features, concerns}` shape (we:capability-manifest/provider.ts:20-23) — if and when a second standard actually ships one, the real shape of that second manifest should drive whether the hook keys by standard id or grows a second dedicated getter; guessing a keying scheme now, against zero real second manifests, risks shipping a wire-shape nobody's actual data fits. This isn't a rival fork (a keyed form is a strict, non-breaking superset addable later — the two can coexist by construction, so it fails the fork-existence test rather than surviving as Fork 2) — it's a build note for whoever picks this up.

*Skeptic (dedicated fresh sub-agent, four axes — classification / merit / statute-overlap / citation-scope, prompted only to refute):* **SURVIVES-WITH-AMENDMENT.** Classification: SURVIVES-WITH-AMENDMENT — the agent caught a real overclaim in the fork-existence line (it originally said all three rejected branches are "structurally disqualified," but (b) is only precedent/composability-rejected, not unreadable; **amendment folded in above** — the justification line now names (c)/(d) as hard-disqualified and (b) as merit-rejected separately). Merit: SURVIVES — independently re-read `frontierui:plugs/webinjectors/InjectorRoot.ts:118` (`getProviderOf` walks `node.parentNode`, confirming (d)'s in-realm-only reachability) and the hook/provider/detect/panel-detect files cited above, confirming all line-level citations; flagged that today's two cross-boundary consumers only read plain hook *fields* (`version`/`features`), never call a hook *method*, so "reuses the identical channel both consumers already cross" slightly overstated a proven-in-practice pattern as opposed to a structurally-identical one — **amendment folded in above** (now "structurally identical... any method on it is callable," not "already crosses today"). Statute-overlap: SURVIVES — independently confirmed `detection-claim-matches-evidence-tier` governs printed-claim strength, not channel design; no collision. Citation-scope: SURVIVES — independently confirmed OP-19's comment names (c)/(d) only descriptively and explicitly declines to pick a winner; the item never claims otherwise.

*Screen (separate fresh-context agent, no exposure to this session's authoring):* **clear.** (1) Standard-vs-implementation: "a real cross-boundary protocol question... the wire shape becomes a public contract plateau-app's probe code and FUI's publishing code both compile against... same footing as the existing `__WE_DEVTOOLS_GLOBAL_HOOK__` itself." (2) Merit-vs-prioritization: "the merit gap holds up... a structural reachability/correctness fact, unrelated to build effort... The one place cost-flavored language appears is explicitly *not* part of the four-way fork — it's flagged in the doc itself as a separate, deferred, non-forked question." `Screen: clear`.

## What ratifying this unlocks (not part of the ruling — execution scope, not a fork)

Two buildable follow-ups become startable once Fork 1 lands, both already scoped narrowly enough to be their own small stories rather than part of this decision:

1. **Wire the channel** — add `markCapabilityManifest` / `getCapabilityManifest` to frontierui:plugs/webregistries/declarativeRegistry.ts per the shape above, re-exported from webregistries' index alongside the existing hook exports; extend plateau:packages/core/src/probe/detect.ts's `ProbeResult` to carry the read manifest (or `null`) the same way it already carries `RuntimeSignals`.
2. **Ship the first real manifest** — frontierui:plugs/webvalidation/index.ts already imports the whole #266 vocabulary (`CapabilityManifest`, `CORE_FEATURES`, …) but does not itself `export const manifest` (OP-19). Authoring one is real work (walk the plug's actual code — `ValidityMergeField`/`AsyncValidatorField`/`ValidationErrorSummary`/`CustomCommitmentPolicyRegistry` — to honestly declare which `ValidationFeatureId`s and `concerns` strategies it truthfully supports; a wrong/optimistic manifest is worse than none per #266's whole premise) — not a decision fork, since there is no branch to choose between, only accuracy to get right. This is what unblocks `we:capability-manifest/check.ts:107`'s `IMPLEMENTATION_MANIFESTS` from being permanently empty and gives #1755 something real to demo against.

Neither is filed as a separate backlog item here — that is this decision's own resolve-time close-out (or a follow-up prep pass), once Fork 1 is ratified and the exact interfaces above are locked.
