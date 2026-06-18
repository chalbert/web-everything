---
type: decision
workItem: story
size: 3
status: open
locus: frontierui
relatedProject: webdocs
parent: "746"
dateOpened: "2026-06-18"
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Decide how the FUI polyglot panel consumes WE-side artifacts (author-mode serve() source + conformance runner/verdict)

Surfaced claiming **#818** (author-mode emit) **and #913** (per-target conformance badges) in
batch-2026-06-18 — both are FUI polyglot-panel slices that consume **WE-side** artifacts the FUI workbench
has no import path to (no `webeverything` alias in FUI tsconfig/vite; the #700 cross-repo-impl boundary):

- **#818** renders idiomatic source via the transform core `serve(definition,{form})`
  (`we:blocks/renderers/module-service/moduleService.ts`).
- **#913** renders a pass/fail badge per target consuming the #891 behavioral wrapper-conformance **runner**
  (`we:wrapper-conformance/runner.ts` — its real home; the body's `fui:wrapper-conformance/runner.ts` is
  wrong) and the #506 cross-language gate **verdict** (`we:blocks/renderers/module-service/conformance`).

The polyglot panel is **FUI-owned** (`fui:workbench/mount.ts`, #753) and its consume-mode uses FUI's *own*
`genWrapper` (`fui:tools/gen-wrapper/genWrapper.ts`) — it imports no WE impl. So neither "render via
serve()" nor "badge from the runner/verdict" can be wired as the bodies assume. One placement mechanism
likely answers both: how does a FUI workbench surface reach WE-side transform/conformance output?

## The fork (one mechanism for both artifact types — source forms and conformance verdicts)

- **A — Data-emit channel (bold default).** WE emits its polyglot output as **committed data** the FUI
  workbench reads: `serve()` renders the source forms to a JSON/text artifact, and the #506/#891 gate
  emits a verdict JSON per block/target. The FUI panel consumes those data files — no cross-repo *code*
  import, honoring #700 (only data crosses the seam, never impl). Author-mode source can ALSO surface as a
  WE-side docs source-toggle (demo-workflow §4) that the panel mirrors. Likely the lightest path that fits
  "rides what already ships."
- **B — FUI ports the equivalents** (`serve()` forms + a conformance reader) into the workbench, as it did
  `genWrapper` for consume-mode. Self-contained but duplicates the WE transform/conformance logic in FUI —
  lock-in risk + divergence from WE's `ServeForm` set and golden vectors.
- **C — WE publishes consumables** (the #872 `@webeverything/contracts`-style package, or a published
  runner) the FUI workbench imports. Cleanest long-term but gated on the publish pipeline; heavier than
  the slices' "rides what already ships" framing.

Also re-confirm the **demand-gate** (#818's bold "build only after appetite for idiomatic source is shown")
at decision time — #818 is the slice whose appetite was never demonstrated.

**Blocks #818 and #913** (both `blockedBy: 954`). Sibling of #753/#912/#913 under #746.

---

## Proposed ruling — PENDING RATIFICATION (`/next 954`, 2026-06-18)

**Grounding (traced to the tree, not inherited):**

- `serve(definition,{form})` ([we:moduleService.ts:142](../blocks/renderers/module-service/moduleService.ts#L142))
  returns a **pure-data** `ServeResult{form,code,language,lossy,diagnostics}` ([:60](../blocks/renderers/module-service/moduleService.ts#L60))
  over the `FORMS` catalog — the same catalog comment says it already "drives the demo toggle." So source
  forms are deterministic WE-side outputs already serialized for display.
- The #506 cross-language gate (`we:blocks/renderers/module-service/conformance/`) already commits verdict data
  (`we:blocks/renderers/module-service/conformance/golden.json`) — a WE-computable, committable artifact.
- **But** `we:wrapper-conformance/runner.ts` `runVectors(subject, vectors)` requires a live `WrapperSubject`
  (a *mounted* wrapper instance). #891's runner is **generator-agnostic by design** ("FUI implements one
  subject per framework … FUI's generated React/Vue wrappers run as `WrapperSubject`s"). The behavioral
  verdict is therefore a function of **FUI's own `genWrapper` output**, which WE never sees — there is **no
  WE-side verdict to emit** for this one.

**The fork is two natures, not one mechanism.** Reject "one channel for both":

### Ruling 1 — deterministic, WE-computable outputs → **A (data-emit)**. Confidence ~85%.

- **#818 author-mode source forms:** WE emits a committed artifact per block × form
  (`{code, language, lossy, diagnostics}`) by running `serve()` over each block's `<component>` definition at
  build time — an extension of the toggle the `FORMS` catalog already drives. The FUI panel reads the JSON
  and renders author-mode tabs. Only rendered text + diagnostics cross; the `<component>` definitions and the
  transform code stay WE-side. Pure #700-honoring data-emit, "rides what already ships."
- **#913 part 1 (#506 cross-language verdict):** emit a per-block/target verdict JSON alongside `we:blocks/renderers/module-service/conformance/golden.json`;
  the panel reads it → badge.

*Residual:* the emit-artifact format/build-step is a small new seam (where it's written, how the FUI vite
build picks it up) — an impl detail, not a fork.

### Ruling 2 — #891 behavioral conformance badge → **vectors cross as data, runner executes FUI-side**. Confidence ~75%.

Pure A is **impossible** here (corrects #913's note): WE can't emit a verdict for a wrapper it never sees.
Instead, mirroring #891's own design intent:

- The **vectors** (`we:wrapper-conformance/vectors.ts`) cross as data (consistent with A).
- The **runner** executes **FUI-side** against FUI's live subject. The runner is a WE-owned **standard
  artifact** (#855 B2), ~165 lines of pure DOM logic — so its end-state home is a WE-**published consumable**
  (option **C**: a legitimately `@webeverything`-scoped conformance package, since it's a standard artifact
  that imports no FUI), with **byte-replication the documented interim** (the #694/#170 precedent, governed by
  the #872 distribution pipeline). This is **not** a new distribution decision — it rides #872; this item only
  fixes *that the runner runs FUI-side*, not how it's packaged.
- This badge needs a **mounted** subject to assert against → it is correctly **downstream of #912** (the
  live-test sandbox), not just #753. Recommend adding `blockedBy: 912` to the #891-behavioral half of #913.

*Residual:* whether #913 should split — the cheap #506-verdict badge (Ruling 1) vs the #912-gated behavioral
badge (Ruling 2). Likely yes (bias-toward-separation), but that's a slice call, not part of this ruling.

### Demand-gate re-confirm (#818). Confidence ~70%.

Keep #818 demand-gated. #753 shipped consume-mode source tabs; whether *idiomatic-source* appetite is now
demonstrated is a user call. The Ruling-1 data-emit foundation is cheap enough to ride the existing emit
channel **when** appetite shows — do not build ahead of it.

### On resolve (when ratified)

- `codifiedIn`: the data-emit-vs-FUI-execute split is a reusable boundary rule (deterministic WE outputs →
  data-emit; verdicts that depend on FUI's live output → vectors-as-data + runner-runs-FUI-side).
- Unblock #818 (Ruling 1) and #913 (split per above); set `graduatedTo`.

**PENDING RATIFICATION — item stays `open`, no commit/spawn until explicit "ratify/go."**
