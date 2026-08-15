---
bornAs: xwj9o7m
kind: decision
parent: "1391"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
crossRef: { url: /backlog/1755-dev-browser-shell-conformance-gated-feature-lighting-capabil/, label: "Blocks #1755 (dev-browser conformance-gated feature lighting)" }
relatedTo: ["1673", "266", "268", "1722", "2212"]
tags: [dev-browser, capability-manifest, conformance, decision]
---

# Dev-browser shell has no runtime-readable CapabilityManifest to gate feature-lighting on (blocks #1755)

Found while preparing #1755 to build-ready (2026-08-15) — not a re-litigation of #1673, a fresh gap #1673 didn't have to close (it only needed the extension's *passive light-up* gate, and ruled probe for that; it explicitly left DECLARED as a future opt-in tier without designing that tier's mechanics).

#1755's whole premise is reading a loaded app's declared CapabilityManifest (we:capability-manifest/provider.ts) to gate which dev-browser capability modules light up. Verified against the tree (2026-08-15): that data source does not exist yet, on either side. (1) Zero implementations ship one — we:capability-manifest/check.ts's IMPLEMENTATION_MANIFESTS is still empty, its own comment says so, and a repo-wide grep for 'export const manifest' (the #266 OP-19 static-export convention) finds nothing in plateau-app or frontierui. (2) Even if one existed, there is no channel to read it across the loaded-page boundary: the CapabilityManifest is a build-time static export (OP-19), not runtime-queryable, and the one runtime channel that does cross that boundary — window.__WE_DEVTOOLS_GLOBAL_HOOK__ (frontierui:plugs/webregistries/declarativeRegistry.ts) — only carries a generic activation-surface features:ReadonlySet<string> (e.g. 'declarative-registry', 'plugged-mode'), not the structured {specVersion, conformanceLevel, features: ValidationFeatureId[], concerns} shape. #268's guardCapability(manifest, feature) is intra-process only (called by validation-runtime code that already holds the manifest in scope) — no cross-boundary read exists there either. #1673 (ratified 2026-06-23) already found this for the extension case and deliberately demoted DECLARED to an 'opt-in upgrade tier' for exactly this reason; that finding still holds today and applies identically to the standalone shell.

## What this needs to resolve

1. **A decided channel design** — how does a CapabilityManifest cross the loaded-page boundary to an external observer (the dev-browser shell's content-pane preload, same restriction the #2211 probe operates under)? Candidate shapes worth weighing: extend `window.__WE_DEVTOOLS_GLOBAL_HOOK__` with a `capabilityManifest` field (mirrors how #1722 solved this for probe presence — same hook, same MAIN-world-shared-DOM boundary #1753's decided design already leans on); vs. a new dedicated query surface; vs. something else. Not pre-decided here — this card exists to hold the fork open, not to pick for it.
2. **At least one real implementation shipping a manifest** — `IMPLEMENTATION_MANIFESTS` (we:capability-manifest/check.ts) is empty; #1755 cannot demo "a thinly-conformant app lights exactly its supported slice" against zero real manifests. The natural first candidate is frontierui's webvalidation plug (already imports the vocabulary at frontierui:plugs/webvalidation/index.ts, but does not itself export `manifest`).

Until both exist, #1755 has nothing to read — its own "a thinly-conformant app lights exactly its supported slice" demoable clause is unmeetable, not just unbuilt.
