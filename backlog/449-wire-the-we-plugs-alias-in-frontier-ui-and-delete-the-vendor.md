---
type: issue
workItem: story
size: 8
parent: "170"
status: open
locus: frontierui
blockedBy: ["725"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
tags: [plugs, dedup, migration, frontierui, plateau-app]
---

# Package `frontierui/plugs` as `@frontierui/plugs`, delete `webeverything/plugs`, repoint WE + plateau-app

Terminal dedup of [#170](/backlog/170-plugs-duplicated-across-webeverything-frontierui/). The **relocation** in the
direction [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) ratified (2026-06-14):
plugs is **implementation**, owned by **Frontier UI**. Make `frontierui/plugs` the canonical `@frontierui/plugs`
(add `we:package.json` with dual exports — `.` = unplugged/non-invasive library, `/bootstrap` = plugged POC), delete
`webeverything/plugs`, and repoint WE + plateau-app to consume it as a no-leakage client (the
[#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) WE→FUI seam).

> **⚠ Blocked by [#725](/backlog/725-port-we-only-plug-domains-webguards-webvalidation-their-subs/) (updated 2026-06-15).**
> The earlier "reconcile is done, this is ready" framing is a **false premise** corrected by the
> [#635 plugs-runtime audit](/reports/2026-06-14-plugs-runtime-audit.md) (resolved 2026-06-14). **#649 (resolved
> 2026-06-15) did the runtime half** of the reconciliation: it ported WE's canonical runtime fixes into FUI
> (`cloneHandlers` #454, `Injector` #400 consumption-edge graph + `declarativeInjector`, `ensureNativelyConstructible`,
> the `viewportPresence` refactor) so the shared-runtime trees are now content-equal (verified: FUI typecheck + 1675
> unit tests green). **What remains before this delete is safe is #725**: the two **WE-only domains** (`webguards`,
> `webvalidation`) and their `guard/`/`validity-merge/`/`validator-resolution/` subsystems still have no FUI home —
> deleting `webeverything/plugs` before #725 lands would regress that behavior. After #725, work this whole via `/next 449`.

## Scope

1. **Make `frontierui/plugs` canonical `@frontierui/plugs`.** Add `we:frontierui/plugs/package.json` with dual exports:
   - `.` → the **unplugged**, non-invasive library entry (plugs as opt-in primitives — native-first).
   - `/bootstrap` → the **plugged** POC entry (the invasive runtime that patches Node/registries).
   - Keep FU-only files local and out of the public surface as appropriate: `fui:globals.d.ts`,
     `we:virtual-trait-manifest.d.ts`, `we:webbehaviors/traitManifest.ts`.
2. **Delete `webeverything/plugs/`.** Its content is the reconciled superset (#580) — it now lives in FU.
3. **Repoint WE → `@frontierui/plugs`.** Rewrite WE's demo/runtime imports of the local `plugs/` to the package.
   Confirm `@webeverything` never imports impl as a hard dep (npm scope mirrors layer) — this is a
   demo/client consumption seam, not a standard-artifact import.
4. **Repoint plateau-app.** plateau-app composes the runtime via `@we/plugs/*` today (path alias at
   `we:tsconfig.json:16` + `vite.config.mts:119`) — repoint that alias to `@frontierui/plugs`.
5. **Test relocation sub-decision (carried, now resolved as):** the 7 FU-only plug tests
   (`CustomAttributeRegistry.defineLazy/inert/visibility` units + 4 e2e specs) already live **inside
   `frontierui/plugs/`** — under the canonical-home inversion they simply **stay there**, no migration needed.
   Coverage is not dropped; verify they still run against the packaged entry.

## Acceptance

- `we:frontierui/plugs/package.json` exposes `.` (unplugged) + `/bootstrap` (plugged); FU build + vitest + e2e green.
- `webeverything/plugs/` is gone; WE demos render against `@frontierui/plugs`; WE build + check:standards green.
- plateau-app composes via `@frontierui/plugs`; plateau-app build green.
- No `../plugs/` or `@we/plugs/*` references survive in any of the three repos.

---

### Historical record (pre-#606, inverted direction — context only)

The notes below describe the **old, now-dead** direction (FU aliases `@we/plugs`, WE canonical) and the path that
got us here. Retained for trace; the scope above supersedes all of it.

- **Original scope (2026-06-12):** "point FU at `@we/plugs/*` via path alias and delete `frontierui/plugs/`." Sized
  task→story-5 in a batch pre-flight: FU had 75 relative `../plugs/` imports across 52 files + 8 per-package aliases
  in 3 config files, plus a test-relocation sub-decision.
- **Outgrew + blocked (2026-06-14 batch):** the "WE is the superset" premise was found false on-disk (16 common files
  diverged, FU ahead in several, e.g. `we:webcontexts/CustomContext.ts`). Gated on a reconciliation precursor #580.
- **Resolved by #580**, then **#606 inverted the canonical home** to Frontier UI — collapsing both the alias-wiring
  and the copy-down into the single relocation now scoped above. The 75 FU import rewrites the old plan required
  largely **vanish** under the inversion (FU keeps its own tree as the package source); the rewrite burden shifts to
  WE + plateau-app consumers instead.
