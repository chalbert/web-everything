---
type: issue
workItem: story
size: 5
status: active
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
---

# Land the WE to @frontierui/plugs repoint for real (the #449 repoint is incomplete — WE still imports local plugs)

Finish the WE→`@frontierui/plugs` repoint so #1047 can delete `we:plugs/`. **Grounding (2026-06-20)
revised the premise:** #449's block-runtime repoint DID land (45 `we:blocks`/`we:src` files already
import `@frontierui/plugs`, zero `../plugs/` left); the residual local-plugs consumers are only demos,
test-pages, the bootstrap `src`, and vestigial config aliases. The real blocker is bigger — **`fui:plugs/`
has drifted *behind* `we:plugs/`** across ~11 of 14 domains (+2 WE-only: webportals, webtraces), so
repointing onto FUI is lossy (proven: regresses the #1014 + #1117 demos). Prerequisite: re-reconcile
FUI up to WE's plugs. Trial repoint made and fully reverted; see grounding below.

## Grounding (2026-06-20) — the original premise is stale, and the real blocker is FUI drift

Measured the live tree at claim. The framing above is **mostly wrong**, and the genuine prerequisite
is much bigger than a repoint:

**What #449 actually did land (verified):** the `@frontierui/plugs` sibling-alias IS wired in
`we:vite.config.mts`, `we:vitest.config.ts`, `we:tsconfig.json`, `we:tsconfig.plugs.json`; the sibling
`fui:plugs/` exists with a `fui:plugs/package.json` (#1045); and the block runtime already imports
`@frontierui/plugs/*` — **45** files in `we:blocks/`+`we:src/`, with **zero** relative `../plugs/`
imports remaining there. "200+ files still import local plugs" is false for the block runtime.

**Real residual WE consumers of local `we:plugs/`** (the only things that still pin the dir): ~10
`we:demos/*` + 5 `we:test-pages/*.html` (JS imports of `/plugs/…`), the bootstrap
script tag for `we:plugs/bootstrap.ts` (injected as a `<script type=module src>` by the
`webEverythingPatches` Vite plugin + hard-coded in ~12 demos — a `src` URL an alias can't reach), and the vestigial
`@core`/`@webX`/`virtual:trait-manifest` config aliases (0 runtime consumers).

**The blocker that stops this item cold — `fui:plugs/` has drifted *behind* `we:plugs/`.** The #606
"FUI is the canonical superset" premise has decayed: WE's local plugs kept evolving after the #580/#649
reconciliation and FUI was not kept in step. A non-test `*.ts` diff WE-local vs FUI shows drift in
**~11 of 14 shared domains plus 2 WE-only domains**:

| domain | differ | WE-only files | notes |
|---|---|---|---|
| core, webcomponents | 0 | 0 | clean (identical) |
| webanalytics | 1 | 1 | FUI missing `UnknownTrackerError` (#1014) — demo regresses |
| webcontexts | 4 | 0 | FUI missing `resolveContext` strict/flexible (#1117) — demo regresses |
| webbehaviors | 3 | 0 | |
| webdirectives | 2 | 5 | |
| webexpressions | 4 | 1 | |
| webguards | 2 | 0 | |
| webinjectors | 2 | 0 | |
| webregistries | 2 | 2 | |
| webstates | 1 | 4 | |
| webvalidation | 3 | 2 | also now consumes `@webeverything/*` contracts (#700/#872) FUI's copy doesn't |
| **webportals** | — | all (10) | **no FUI home** (#1148/#1149/#1150 built into WE local) → #1235 |
| **webtraces** | — | all (3) | **no FUI home** (sessionReplayEnvelope) → #1236 |

Proven by browser probe on the running `:3000` after a trial repoint: repointing
`analytics-conformance-demo` → FUI fails (`UnknownTrackerError` not exported by FUI), and
`webcontexts-demo` → FUI fails (`child.resolveContext is not a function`). These are **real
regressions**, not config noise — FUI genuinely lacks the symbols.

**Two further sub-findings:** (a) FUI's `webvalidation` was refactored to import the published
`@webeverything/*` contract packages (the #872 end-state); serving FUI plugs through WE's dev server
therefore also requires a `@webeverything/* → this-repo` mirror-alias map (the reverse of FUI's own
`weRoot` map). (b) WE's own runtime never imports `@webeverything/*` today, so that map is purely a
consume-FUI-plugs prerequisite.

### Conclusion / re-scope
The repoint **cannot land** until FUI's plugs tree is re-reconciled up to WE's current local state
(port the drifted/WE-only files — incl. webportals + webtraces — into FUI), because today FUI is a
lossy subset. This is the un-done substance behind #449's on-paper close. A trial repoint + config
wiring was made and **fully reverted** (it regressed the analytics + webcontexts demos against stale
FUI); the working tree is unchanged. Pending the user's call on direction (re-reconcile FUI up vs
revisit the #606 canonical-home direction now that WE has remained the de-facto dev tree), the
mechanical follow-ups are: a FUI plugs re-reconciliation item, the #1235 webportals + #1236 webtraces
ports, all blocking #1047. **#1234 is blocked on that reconciliation** — flipped back to `open`.
