---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [lane, pr-flow, merge-queue, integrator, session-tooling]
relatedTo: ["2138"]
---

# Durable lane manifest (#2138 Fork 2): per-item cross-repo shape, couple-order, cross-item blockedBy in the WE lane commit; drain deletes it at landing

Implements #2138 **Fork 2 (ruled: option a)** — the durable source of truth the deferred drain needs for each queued item. Today the cross-repo shape (which repos' `lane/*` refs form the item, the impl-first/WE-last order, and `blockedBy` edges **between queued items**) lives **only in the orchestrator's in-run memory** (`crossRepoRefs`) and evaporates when the session ends. Fix: write a standalone **`we:.lane-manifest.json`** as a **new file in the WE lane commit** — a one-sided add that preserves the #1869 conflict-free WE-lane merge and doesn't pollute the resolve diff. It is a **superset** of the run-scoped array (also carries cross-item/cross-session `blockedBy` the in-run array never held). Shape per the decision's schema (`item`, `repos[]` with order + `carriesResolve`, `blockedBy`, `mergeRiskFiles`). **The drain deletes it at landing** (co-located with `lane/*` ref deletion) so `main` carries no post-drain cruft. Buildable now, independent of #2153; **consumed by** the drain command (#2162).

## Progress

**Resolved 2026-07-02.** Shipped the primitive + reader:

- **`we:scripts/readiness/lane-manifest.mjs`** — a PURE module: `MANIFEST_FILENAME` (`we:.lane-manifest.json`), `INTEGRATION_ORDER` (`['frontierui','plateau-app','we']`, impl-first/WE-last, mirrors the orchestrator), `buildManifest` (normalizes to merge order, defaults `carriesResolve` onto WE), `validateManifest` (returns `{ok, errors}` — item is numeric, ≥1 repo each with a ref, WE present, **exactly one** resolve-carrier and it is WE), `orderedRepos`, `parseManifest`/`serializeManifest` (tolerant, `_doc` header). The manifest is the durable **superset** of the in-run `pushedRefs` array (adds cross-item `blockedBy` + `mergeRiskFiles`).
- **Tests:** `we:scripts/readiness/__tests__/lane-manifest.test.mjs` (6, green — order/defaults, cross-repo + WE-only validation, rejects missing-WE / missing-ref / non-WE-carrier, serialize↔parse round-trip, garbage→null). Readiness suite 138/138, `check:standards` green.

**Boundary with #2162:** ships the primitive + validator/reader. The **write** (author the manifest into the WE lane commit at push) and **delete** (at landing, co-located with `lane/*` ref deletion) call-sites are wired by the drain/monitor command (#2162), which owns the relocated push+land flow — it consumes `buildManifest`/`orderedRepos`/`parseManifest`. Pairs with the ready-to-merge token (#2161): the token says WHICH items are queued, the manifest says HOW to land each.
