---
kind: epic
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753", "xwj9o7m"]
childlessReason: blocked
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — conformance-gated feature lighting (capability-manifest gate)

Read the per-feature capability manifest from the loaded app and light up each existing plateau:packages/dev-browser/src/* capability module (capture, ide-bridge, fault-injector, intent-inspector, variant-simulator, …) against the capability it needs — partial conformance first-class (#141 Fork 1A, ratified per-feature degrade). Home plateau:packages/dev-browser/src/shell/. Demoable: a thinly-conformant app lights exactly its supported slice.

## NOT build-ready — two real blockers, verified against the tree (2026-08-15)

Attempted full preparation per `we:agent-memory-src/story-preparation-checklist.md`. Item 5 of that
checklist ("interfaces at every seam, real signatures... never invent an interface you have not read")
cannot be honestly satisfied today, on **both** sides of this card's one integration seam:

1. **The consuming side doesn't exist.** `blockedBy: "1753"` is not a formality — verified live: there is
   no `plateau:packages/dev-browser/src/shell/` directory in the tree at all (`find packages/dev-browser
   -iname "*shell*"` returns nothing), and `plateau:packages/dev-browser/package.json`'s own header
   comment calls it "the future Electron shell (#1753)". #1753 was itself only just re-prepared
   (2026-08-15) and is not yet built — its planned `plateau:packages/dev-browser/src/shell/main.ts` /
   `plateau:packages/dev-browser/src/shell/chrome/chrome.ts` / IPC contract are a detailed, reviewed
   *plan*, not code on disk. Writing this card's wiring against that plan would be citing an interface
   from another unbuilt card, not one "actually opened" — exactly the grounding rule's warning, doubled.
2. **The data source doesn't exist either**, independent of #1753 landing — filed as
   [#xwj9o7m](/backlog/xwj9o7m-dev-browser-shell-has-no-runtime-readable-capabilitymanifest/) (new,
   2026-08-15). This card's own premise ("read the per-feature capability manifest from the loaded app")
   has nothing to read: zero implementations anywhere in the constellation export a `CapabilityManifest`
   (`we:capability-manifest/check.ts`'s `IMPLEMENTATION_MANIFESTS` is still empty), and even if one did,
   there is no channel that carries it across the loaded-page boundary to an external observer like this
   shell — the manifest is a build-time static export (#266 OP-19), and the one runtime channel that does
   cross that boundary (`window.__WE_DEVTOOLS_GLOBAL_HOOK__`) only carries generic activation-surface
   strings, not the manifest shape. #1673 (ratified) found this same gap for the extension case and
   deliberately left DECLARED as a future, undesigned "opt-in upgrade tier" — that future is now.

Do not start a build against this card until both clear. Re-preparing after they do is cheap: the
scope/interfaces below are otherwise settled (see "What IS settled").

## What IS settled (does not need re-deciding later)

- **The pure gate is already built and fully tested** — [#2212](/backlog/2212-conformance-gated-feature-lighting-pure-manifest-unlocked-fe/)
  (resolved 2026-07-03) shipped `lightFeatures(manifest) -> DevBrowserModuleId[]` and
  `isModuleUnlocked(manifest, moduleId) -> boolean` at
  `plateau:packages/dev-browser/src/feature-lighting/{light,types,index}.ts`, with the full
  `MODULE_REQUIREMENTS` table (all 13 module ids, L0/L1 tiers, `ValidationFeatureId` prerequisites) and a
  144-line test suite proving partial conformance ("a thinly-conformant app lights exactly its supported
  slice") for every tier combination. #2212's own header says explicitly: "The shell (#1755) consumes
  this." **This card's remaining scope is wiring only — no new gating logic.** (This is also why `size`
  was dropped and `kind` changed `story` → `epic`: this card already sized `5` while #2212 was still an
  unopened child, and once a sized item has a resolved child the burndown double-counts — the same
  correction #1753 already made for the identical reason with its own child #2211. The remaining wiring
  scope, once both blockers below clear, is comparable in footprint to #2212 itself minus the
  logic/test-table authorship it already did, plus a small amount of shell glue.)
- **The module-id vocabulary is final** — the 13 `DevBrowserModuleId`s (one per existing
  `packages/dev-browser/src/*` capability directory) are enumerated and locked in
  `plateau:packages/dev-browser/src/feature-lighting/types.ts`; nothing here needs re-litigating.
- **Path corrections carried into this card**: the original text said `plateau:src/dev-browser/*` and
  homed the shell at `plateau:src/dev-browser/shell/`. Both are stale — the real location (per #2342,
  resolved 2026-07-09, and confirmed live) is `plateau:packages/dev-browser/src/*`, and #1753's own
  decided design homes the shell at `plateau:packages/dev-browser/src/shell/`. Corrected above.

## What remains undecided (deferred, not silently picked)

Once both blockers clear, a real open question still needs an answer before a builder starts: **how does
a lit/dark module state actually present in the shell chrome?** #1753's own design only builds a
single-line text status pane (`plateau:packages/dev-browser/src/shell/chrome/chrome.ts`'s
`applyStatus(el, result)`) — it has no notion of a module list or per-module toggle UI, and no other card
decides one. #1753's card flags that "S3 ... need[s] a chrome surface to render into" but does not design
that surface. This is this card's own job to decide once #1753's real chrome files exist to extend
(likely: extend the status pane's rendered markup with a module list, reusing the same
IPC-forwarded-result pattern #1753 already wires for the probe) — not a reason to block further, just not
answerable with real signatures today.
