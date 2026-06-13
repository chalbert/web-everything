---
type: issue
workItem: epic
status: open
dateOpened: "2026-06-07"
tags: [plugs, duplication, drift, single-source, frontierui, maintenance, runtime]
relatedProject: webplugs
---

# The plugs runtime is duplicated (and drifting) between Web Everything and Frontier UI

> **Sliced into a storied epic (2026-06-12).** Strategy fork is resolved (alias — see *Resolution of the
> strategy fork* below); a fresh on-disk re-measure showed the reconcile is a **bidirectional core-runtime
> merge** (15 drifted, 9 WE-only, 3 FU-only — directionality in
> `reports/2026-06-12-backlog-split-analysis.md`), too large and load-bearing for one item. Umbrella for
> the consolidation; sliced into **#A merge FU's attribute-lifecycle up into WE · #B trait-manifest into
> WE bootstrap · #C wire the `@we/plugs/*` alias + delete FU's vendored tree** (A ∥ B → C). The body below
> is the spec; the per-slice scope lives in the children.
>
> _Prior 2026-06-11 note (superseded): reclassified `decision` → `issue`, kept `story · size 5` — the
> 06-12 re-measure found bidirectional drift and re-scoped to this epic._

`frontierui/plugs/` is a **vendored copy** of `webeverything/plugs/`, not an import — and the two
copies have already **drifted**. Measured 2026-06-07: of the 53 plug source files in
`webeverything/plugs/` (excluding tests), **all 53 have a counterpart** in `frontierui/plugs/`,
**40 are byte-identical**, and **13 have diverged**. Frontier UI carries 3 extra files on top.
Frontier UI does **not** import `@we/plugs/*` (the way plateau-app composes the runtime via path
alias) — it ships its own tree, so every plug fix has to be applied twice by hand, and the 13
already-diverged files prove that doesn't reliably happen.

This is a live maintenance hazard, not a hypothetical: a fix landed in one repo silently rots the
other. It directly threatens any `plugs/` work — e.g. the autonomous-element lifecycle items
([#165](/backlog/165-playwright-evaluate-object-serialization-patched-pages/),
[#167](/backlog/167-autonomous-element-lifecycle-completeness/)) patch
`plugs/` in Web Everything; without consolidation those fixes won't reach Frontier UI's copy.

## The 13 drifted files (as of 2026-06-07)

```
bootstrap.ts
core/CustomRegistry.ts
webbehaviors/CustomAttributeRegistry.ts
webbehaviors/index.ts
webinjectors/HTMLInjector.ts
webinjectors/Node.injectors.patch.ts
webregistries/CustomElementRegistry.ts
webexpressions/UndeterminedTextNode.ts
webexpressions/CustomTextNodeParser.ts
webexpressions/CustomTextNodeRegistry.ts
webexpressions/index.ts
webcontexts/Node.contexts.patch.ts
webcontexts/CustomContext.ts
```

(Note: the related but **narrower** Spec-Explorer dev-panel Vite plugin is also copy-pasted across
the two repos — a separate, smaller instance of the same copy-paste pattern.)

## Consolidation strategy (resolved 2026-06-11 — see *Resolution of the strategy fork* below)

The strategy fork is **settled**: Frontier UI imports `@we/plugs/*` via path alias (resolution at the
foot of this item). The options below are retained as the design record that led to that call:

- **Recommendation: Frontier UI imports `@we/plugs/*` via path alias**, the same way plateau-app
  already composes the runtime (`@we/plugs/*`, `@we/blocks/*` per the constellation). Web Everything
  becomes the single source of the plugs runtime; Frontier UI stops vendoring its own. This matches
  the documented mental model (AGENTS.md: plugs are the platform primitives, owned here) and the
  existing plateau-app precedent. The cost is reconciling the 13 drifted files first (decide which
  side is canonical per file) and confirming the 3 frontierui-only files are genuinely
  Frontier-UI-specific (then they stay local) vs. plugs that belong upstream.
- *Alternative held open: a build-time sync/check.* A script that copies `webeverything/plugs/` →
  `frontierui/plugs/` (or a `check:standards`-style guard that **fails CI on any drift**) keeps the
  copy but removes the silent-rot risk. Lighter to stand up, but it preserves two trees and the
  alias import is strictly cleaner if the toolchains allow it.

Whichever path, the reconciliation of the 13 drifted files is shared work and the concrete first
step. Settle the strategy, then it splits into a reconcile task + a wiring task.

## Re-measured 2026-06-12 — the reconcile is a BIDIRECTIONAL merge, not a stale-copy pick (size 5 → 8)

Picked up in a batch as a "mechanical reconcile"; the current on-disk diff shows it is not. **14 files now drifted** (`webinjectors/index.ts` joined the 13), and the drift is **bidirectional** — each repo is canonical for different features, so "pick the canonical side per file" undersold it: several files need a *merge*, and the alias-wiring would delete FU work that isn't upstream yet.

- **WE ahead (must flow → FU):** `bootstrap.ts` (webvalidation/webguards/blocks registration), `webinjectors/index.ts` (#278 declarative-injector exports). Plus **9 WE-only files** FU lacks entirely: `webvalidation/*` (6), `webguards/*` (2), `webinjectors/declarativeInjector.ts`.
- **FU ahead (must flow → WE *before* any alias-wiring, or it's lost):** `webbehaviors/CustomAttributeRegistry.ts` is **892 vs 362 lines** — ~530 extra lines of visibility-gating + lazy fetch-on-view (`-active`/`-when`, #221/#280/#222/#226); `bootstrap.ts` trait-manifest wiring (`virtual:trait-manifest`, #116); `core/CustomRegistry.ts` `GetterValue` type; `webexpressions/index.ts` cloneHandlers.
- **3 genuinely FU-only files** (stay local, as predicted): `globals.d.ts`, `virtual-trait-manifest.d.ts`, `webbehaviors/traitManifest.ts`.

**Why it can't be batched as-is:** these are *core runtime* files (registries, bootstrap, the attribute lifecycle); a wrong merge silently breaks one repo's runtime, and FU's build can't be verified from this repo. **Re-scope before next pickup** — split into: (a) upstream FU's attribute-lifecycle + trait-manifest advances into WE (the load-bearing merge), (b) flow WE's validation/guards/injector files down, (c) wire the `@we/plugs/*` alias + delete FU's vendored tree *last*, once (a)+(b) make the trees content-equal. Each is its own item; (a) is the real work and is itself ≥ size 5.

## Resolution of the strategy fork (2026-06-11)
**Frontier UI imports `@we/plugs/*` via path alias** — settled by native-first / impl-is-not-a-standard: plugs are platform primitives owned in Web Everything, not a format to vendor; the documented mental model and the plateau-app precedent both point one way. The build-time-sync alternative is dropped. **This item stays open** because the decision spawns real execution: (1) reconcile the 13 drifted files (pick the canonical side per file), (2) confirm the 3 Frontier-UI-only files are genuinely local, (3) wire the alias. The fork is closed; what remains is that build.
