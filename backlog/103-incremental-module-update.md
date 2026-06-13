---
type: idea
workItem: story
size: 5
parent: "099"
status: resolved
blockedBy: ["087"]
dateOpened: "2026-06-06"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [module-as-a-service, incremental-update, delta, patch, service-worker, cache-api, distribution, evergreen, performance]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Incremental / delta module updates — service-worker patching so a shared MaaS bundle updates without full re-download

When common code is shared across many apps as Module-as-a-Service (#081/#087), an active platform may update it **multiple times a day** — which destroys the caching benefit if each change forces a full re-download. This item adds **incremental updates**: the service computes a **delta from the previous version** and the client applies it via a service worker + the Cache API, instead of refetching the whole module. From the essay's *Incremental update* section.

## Two delivery shapes (from the essay)

| Shape | How | When |
|---|---|---|
| **Patch** | the previous module is kept; a patch is applied on top | small, frequent changes — minimal bytes over the wire |
| **Full module update** | the new module fully replaces the cached one | larger changes where a patch isn't worth it |

The previous-version artifact lives in the **Cache API** (service worker); async storage is fine and the size limits shouldn't be an issue. The choice of patch vs. full is per-update, ideally driven by the **changelog manifest (#102)** which already knows exactly which modules changed.

## Relationship to MaaS distribution (#087)

#087 makes served artifacts **cache-friendly and immutable** (content-addressed, `Cache-Control: immutable`). This item is the *complementary* lever: immutability makes a URL cacheable forever, but a frequently-changing shared bundle still produces a *new* immutable URL each change — incremental update is how the client avoids re-downloading the unchanged 95% when it moves to that new version. The delta is computed between two content-addressed versions (#088).

## Design notes (recommended)

- Delta format / algorithm — lean on an existing binary-diff approach rather than inventing one (native-first / don't-reinvent-the-wheel).
- Where the patch is computed: at the MaaS origin (eager, per version pair) vs. on demand. Recommendation: on demand, cached, keyed on `(fromHash → toHash)`.
- Integrity: a patched result must still match the target content hash + SRI (#088) — verify after applying, fall back to full download on mismatch.
- Sequenced **after** #087/#088 (needs immutable content-addressed versions to diff between).

## Progress (2026-06-13) — resolved

#087/#088 are resolved, so this built on them. New [blocks/renderers/module-service/incrementalUpdate.ts](../blocks/renderers/module-service/incrementalUpdate.ts) — the pure, framework-free delta-update orchestration core (the reference; WE is the standard, production binary-diff + service-worker/Cache-API wiring are app/FU-owned, **injected**). Each recommended default from the design notes is taken:

- **Don't reinvent binary diff** — `applyPatch` is an injected `(previous, patch) => bytes` seam; WE ships no diff algorithm, only verifies the result.
- **On-demand patch, keyed on `(fromHash → toHash)`** — `resolvePatch(fromHash, toHash) => bytes | null`; `null` (origin hasn't computed the pair) falls back to full.
- **Integrity-then-fallback (the safety invariant)** — `applyIncrementalUpdate` verifies the patched bytes against `toHash` (the #088 content-address = SRI, via a default `sha256-<base64>` hasher matching the fetch origin) and on *any* mismatch discards the patch and full-downloads; the full path is verified too and throws `IntegrityError` if even it is corrupt. A bad patch can never install.
- **Two delivery shapes** — `chooseDeliveryShape({fullSize, patchSize, threshold=0.5})` returns `patch` only when the patch saves enough bytes (drive `threshold` from the changelog manifest #102), else `full`; unknown full size never patches blind.

10 unit tests (decision thresholds; patch success; patch-integrity-mismatch → verified full fallback; no-previous; no-patch-available; corrupt full → `IntegrityError`); gate green; type-clean (the lone tsc note is the pre-existing `tsconfig.plugs` rootDir artifact that flags every `blocks/` module-service file). The service-worker/Cache-API host that calls this — supplying the previous bytes, the patch/full transports, and the diff codec — is the app/FU integration, not a WE standard artifact.
