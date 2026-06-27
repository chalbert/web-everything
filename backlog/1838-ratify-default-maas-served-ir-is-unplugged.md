---
kind: decision
parent: "1836"
status: open
relatedProject: webplugs
relatedReport: reports/2026-06-27-unplugged-plug-parity.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
tags: [plugs, unplugged, maas, served-form-invariant]
---

# Ratify: default MaaS-served IR is unplugged

Workstream W5 of [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) frames this as "the MaaS-served IR is unplugged, plugged is opt-in." A survey of the **live** origin re-grounds it: the MaaS `form`/`variant` catalog is **orthogonal** to plug-mode (it selects framework shape + render-vs-live-mount), and **every served form is already a self-contained module that never patches the importer's globals**. So the recommended ruling is **codify the serve-path invariant — MaaS serves only self-contained modules; the global-patching plugged `bootstrap` is a consumer-side entry, never a served form**. "Default unplugged" is true by construction; the call is to lock it. Grounded in `/research/unplugged-plug-parity/` (report `we:reports/2026-06-27-unplugged-plug-parity.md`).

## Digest

The original framing — a `?form=plugged` opt-in over an unplugged default — does **not** match the live origin, and prep surfaced that before the decision turn (the #1437 lesson). The MaaS serve catalog is about *delivery shape*, not plug-mode:

- The wrapper route `/_maas/` serves `?form=react-wrapper`/`vue-wrapper` (source-display) and `?form=react-live`/`vue-live` (#1518 self-contained mount modules) — `fui:tools/maas/vite-plugin.mjs`. None is "plugged"/"unplugged".
- The functional form is a **separate route** `/_maas/fn/` keyed by `?variant=functional|live`, **not** a `?form=` member — `fui:tools/maas/functionalServeHandler.mjs:7-11` (the wrapper catalog "dropped its lone `functional` alias in #1681"). Its producer is "render-only `functional` default, self-contained `live` variant" (`fui:tools/maas/functionalServeHandler.mjs:9-10`).

So "default `form` = unplugged" was a category error: `unplugged` is not a member of either catalog, and `?form=plugged` would `400` on the real origin. The decision that *is* live, and aligns with the epic's intent, is the **served-form invariant**: what the MaaS origin serves is always a module the host imports without its `window`/prototypes being patched.

The axis, re-pinned to the verified tree:

- **Served modules are self-contained and self-register on import.** The workbench consumes a served block by cross-origin `import(servedUrl)` then `document.createElement(tag)` (`fui:workbench/loader.ts:63-67`) — the served bytes register their own element as an import side effect; the host calls no `register`/`attach`. This is the *scoped, non-global* registration the unplugged doctrine wants, and it is what every served form already does.
- **The plugged form is structurally unservable.** `fui:plugs/bootstrap.ts:70-109` patches the **importer's** `window` (`window.attributes`, `window.stores`, …). Across a cross-origin `import()` a served module cannot safely patch the *host's* globals (it would patch its own origin's), and the host consumes via `createElement`, not via the patched globals — so a "served plugged form" is incoherent, which is exactly why neither catalog offers one. Plugged stays a **consumer-side** dev entry (plateau-app imports `@frontierui/plugs/bootstrap` itself).
- **The neutral IR already keeps the form value-set open.** `we:blocks/renderers/module-service/servePathIR.ts:138-145` names `form` as catalog-gated with an injected value set the contract deliberately doesn't fix (`we:blocks/renderers/module-service/servePathIR.ts:91-94`). The invariant this decision codifies is a *constraint on what any such catalog entry may be* — a self-contained module — not a new default value.

## Recommended path at a glance

| Fork | The call | Recommended default | Main alternative (excluded) |
| --- | --- | --- | --- |
| **1 — served-form invariant** | What the MaaS origin is permitted to serve | **Self-contained modules only** (every `form`/`variant` is unplugged-doctrine: imported without patching host globals; self-registers scoped) — codified as a serve-path invariant | A served plugged / global-patching form — *Rejected*: incoherent across cross-origin `import()` (patches the wrong realm's globals) and unconsumed by the `createElement` host path |

## Fork 1 — the served-form invariant (plug-mode is not the form axis)

**Fork-existence justification (forced invariant):** the excluded branch — *the MaaS origin exposes a plugged, global-patching served form* — is **broken**, not merely dispreferred. A module fetched by cross-origin `import()` runs in its own realm; patching `window`/prototypes there does not reach the host (`fui:workbench/loader.ts:63-67` shows the host imports then `createElement`s, never reading patched globals), so a served plugged form cannot deliver the plugged contract at all. One branch is coherent; the other is impossible by the delivery model → ratify the invariant.

**Crux** (`fui:tools/maas/vite-plugin.mjs`, `fui:tools/maas/functionalServeHandler.mjs:7-11`, `fui:plugs/bootstrap.ts:70-109`): plug-mode (global-patching vs functional) is a **consumer-side** axis; the MaaS catalog is a **delivery-shape** axis (framework + render/live). They are orthogonal, and the served side only ever inhabits the self-contained end — so "default unplugged" is a property to *lock*, not a value to *pick*.

- **(a) Codify "served = self-contained modules only" as a serve-path invariant** *(recommended)* — state on the serve-path contract that every `form`/`variant` the origin serves must be a module the host imports without host-global patching (self-registering scoped). Today's catalog already satisfies it (react/vue wrapper + live, functional/live); the invariant just forecloses a future global-patching form. Tradeoff: it constrains catalog growth — correct, because a global-patching served form is the incoherent branch above.
- **(b) Add a `?form=plugged` / `?mode=plugged` served form** — *Rejected.* The original card's shape. Incoherent across `import()` (wrong realm), unconsumed by the `createElement` host path, and conflates the consumer-side plug-mode axis with the delivery-shape catalog. Plugged belongs to the consumer's own `@frontierui/plugs/bootstrap` import, not the wire.
- **(c) Leave it implicit (no invariant)** — *Rejected.* "Unplugged by construction" is true today only by accident of which forms exist; #1836 wants it *guaranteed*. Without a codified invariant a later framework adapter could ship a host-patching form and silently break the safe-now product surface. The whole point of W5 is to make the default a rule, not an accident.

**Sub-fork — the plugged-only residue.** A capability that is genuinely *plugged-only* (impossible without patching a global the plug doesn't own — the bar is [#1839](/backlog/1839-decide-the-plugged-only-residue-bar-and-how-the-parity-table/)) cannot be delivered by a self-contained served module at all. It is **not** served as a "plugged form" (still incoherent); it is simply **absent from the served surface and marked** — the served module sets `X-MaaS-Lossy` (`we:blocks/renderers/module-service/servePathIR.ts:57`) and the parity table (#1839) records it `plugged-only`. So the invariant holds with no exception: the origin never serves a global-patching module; residue is marked-and-omitted, not served plugged.

Code shape — the invariant as a guard the serve path (or its catalog validator) enforces, keyed to the real catalogs:

```ts
// Serve-path invariant (Fork 1a): every served form is a self-contained module.
// `form` ∈ {react-wrapper, vue-wrapper, react-live, vue-live}  (fui maas wrapper catalog)
// `variant` ∈ {functional, live} on /_maas/fn/                  (fui maas functional route, #1681)
// All four + both variants self-register on import and patch NO host global.
function assertServableForm(entry) {
  if (entry.patchesHostGlobals) {
    // a plugged/bootstrap-style module — never servable (wrong realm across import())
    throw new Error(`MaaS may not serve a host-global-patching form: ${entry.name}`);
  }
}
// import(servedUrl) then document.createElement(tag) — fui:workbench/loader.ts:63-67.
// Plugged stays consumer-side: the app imports '@frontierui/plugs/bootstrap' itself, never over the wire.
```

**Skeptic: REFUTED-AND-REGROUNDED → SURVIVES.** The prep skeptic (verified against `fui:tools/maas/vite-plugin.mjs`, `fui:tools/maas/functionalServeHandler.mjs:7-11`, `fui:workbench/loader.ts:63-67`) **refuted the original framing**: `unplugged`/`plugged` are not members of the served `form` catalog (it is `react/vue/*-live`), the functional axis is `?variant` on the `/_maas/fn/` route (#1681), and a served module self-registers on import (so "serve the side-effect-free unplugged API" is uncallable across the serve boundary). The fix was not to weaken a default but to **re-ground the decision onto the real seam**: the live, defensible call is the served-form invariant above, which preserves the epic's "default delivery is unplugged" intent while matching how the origin actually works. The re-grounded invariant then survives its own attack — a served plugged form is impossible across `import()`, so the excluded branch is genuinely broken. (Stale reference-handler citations from the first draft were dropped — no such file exists under the `we:blocks/renderers/module-service/` path.)

## Dependencies & lineage

- **Parent:** [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) (epic, W5). Codifies onto the serve-path contract (`we:blocks/renderers/module-service/servePathIR.ts`) + the FUI serve handlers; build slice [#1843](/backlog/1843-make-the-default-maas-served-ir-unplugged/).
- **Orthogonal to (not gated by):** [#1841](/backlog/1841-maas-mode-adapter-serve-a-component-plugged-or-unplugged/) (W4) — note its title says "serve plugged or unplugged"; this decision finds that axis isn't servable, so #1841 should be reframed to the *delivery-shape* adapter (framework/live), or its "plugged" arm dropped. Recorded here so the decision turn reconciles the two.
- **Sub-fork delegated to:** [#1839](/backlog/1839-decide-the-plugged-only-residue-bar-and-how-the-parity-table/) — the plugged-only residue bar (residue is marked-and-omitted, never served).
- **Grounds:** #606 (plugs FUI-owned; unplugged = product surface), #1826/#1807 (plug doctrine), #463/#505/#1619 (serve-path IR + functional route id-space), #1518/#1681 (live-mount forms + functional-as-own-route).
