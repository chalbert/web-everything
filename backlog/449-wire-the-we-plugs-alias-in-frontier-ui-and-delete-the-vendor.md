---
type: issue
workItem: story
size: 13
parent: "170"
status: open
locus: frontierui
blockedBy: ["725", "950"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-19"
tags: [plugs, dedup, migration, frontierui, plateau-app]
---

> **blockedBy `950` added 2026-06-18 (batch pre-flight).** This terminal dedup packages the FUI plugs
> tree as `@frontierui/plugs` and deletes WE's `plugs/` — but active **#950** is mid-porting
> `webguards` *into* that same FUI tree. Packaging/deleting it now is a direct two-session collision.
> Unblocks when #950 resolves (also coordinate with #726's test backfill before the WE-side delete).

# Package `frontierui/plugs` as `@frontierui/plugs`, delete `webeverything/plugs`, repoint WE + plateau-app

## Re-confirmed outgrew + re-sized 8 → 13 (batch-2026-06-18)

Re-claimed in the same batch; the scoping below still holds and is now reflected in the size. Two hard
reasons it is not a batch item: (1) **outgrew** — 61 WE runtime consumers + 152 files to delete +
plateau-app (3rd repo) + the #726 test relocation is 13+, not 8; (2) **forbidden mid-batch toolchain
restart** — wiring the `@frontierui/plugs` alias into WE's `we:tsconfig.json` + `we:vite.config.mts`
forces a Vite dev-server restart, which a batch must never do to the user's running server. Released for a
dedicated `/next 449` session. No design fork (settled by #606); purely execution-size + restart.

## Claimed + released — outgrew a batch slice (batch-2026-06-18)

Blockers verified resolved (#725, #950 both `resolved`), so the item is genuinely **unblocked** — the
collision warnings above are stale. Released anyway: scoping the actual work at claim shows it exceeds a
batch slice and wants a dedicated session (`/next 449`), where the dev server can be restarted. Concrete
scope measured on-disk:

- **WE has 61 runtime consumers of `../plugs/`** (excl. demos/tests; +tests +demos on top) — every one
  must repoint to the package. WE's `blocks/*` reference runtime (parsers, stores, behaviors,
  registries) consumes plugs directly; this is the bulk.
- **`frontierui/plugs` has no `fui:plugs/package.json` yet** — Scope §1 (dual `.`/`/bootstrap` exports) is greenfield.
- **152 files** to delete under `webeverything/plugs/`, plus the plateau-app alias repoint (3rd repo) and
  the #726 test relocation (`webguards`/`webvalidation` unplugged tests → FUI canonical home).
- **Dev-server-restart blocker (same as #960):** the 61 imports resolve only once `@frontierui/plugs` is
  added as a path alias in WE's `we:tsconfig.json` + `we:vite.config.mts` — a vite-config change forces a dev
  server restart, which the batch must not do to the user's running server.

Direction is settled (#606: plugs is FUI's; WE consumes it as a no-leakage client — WE is unpublished
`web-everything`, so the runtime import is a client seam, not a `@webeverything` standard-artifact dep).
No new fork — purely an execution-size + toolchain-restart deferral. **Resume via `/next 449`** in a
focused session; land the FUI `fui:plugs/package.json` first, then the alias (accepting the restart), then the
import sweep + delete + plateau-app repoint + #726 test move.


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

> **Carry-forward from #726 (batch-2026-06-18).** #726 added unplugged-mode tests at
> `we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` and
> `we:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts` and flipped
> `PLUG_UNPLUGGED_TEST_ENFORCED` to true (the WE gate now *errors* on a missing unplugged test). When this
> item deletes `we:plugs/`, **relocate both tests to the FUI canonical home** (`fui:plugs/webguards/` +
> `fui:plugs/webvalidation/`, adjusting the `guard/`→`blocks/guard/` and
> `validity-merge/`/`validator-resolution/` import paths per the FUI tree) so coverage is not dropped —
> folds into Scope §5's test-relocation point.

## Scope

1. **Make `frontierui/plugs` canonical `@frontierui/plugs`.** Add `fui:frontierui/plugs/package.json` with dual exports:
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

- `fui:frontierui/plugs/package.json` exposes `.` (unplugged) + `/bootstrap` (plugged); FU build + vitest + e2e green.
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
