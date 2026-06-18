---
type: decision
workItem: story
size: 3
parent: "746"
status: open
blockedBy: []
dateOpened: "2026-06-18"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — per-target conformance badge from the deterministic #506 gate verdict

Block Explorer polyglot-panel slice (c), sibling of #753. Add a pass/fail conformance badge to each
target tab from the **#506 cross-language gate verdict** — a deterministic, WE-computable verdict
already committed at `we:blocks/renderers/module-service/conformance/golden.json`. Per **#954 Fork 1 = A
(data-emit)**: WE commits a per-block/target verdict JSON alongside the #506 golden; the panel reads it
and renders the badge (only verdict data crosses the seam, honoring #700). Home fui:workbench/.
locus:frontierui.

> **#954 ratified 2026-06-18 — split + unblocked.** This slice was originally the *combined* badge
> (deterministic #506 verdict **+** #891 behavioral runner). Per #954 the two have different natures and
> are split (bias-toward-separation):
> - **This item (#913)** keeps the **deterministic #506-verdict badge** — Fork 1 = A data-emit. The
>   verdict is WE-computable and committed; WE emits it as JSON the panel reads. `blockedBy: 954` cleared
>   on ratify (data-emit is the foundation).
> - **The behavioral badge** (the #891 runner executing FUI-side over a live `WrapperSubject`) moved to
>   **[#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/)** — #954 Fork 2,
>   `blockedBy: [912, 954]` (needs the #912 live-test sandbox for a mounted subject).

---

## ⚠ Re-typed `idea` → `decision` 2026-06-18 (batch-2026-06-18-965-913 pre-flight, claimed then released NOT built) — the premise is false

Tracing the build to the real tree before wiring it (per the grounding-claims discipline) shows the
data this badge reads **does not exist for this panel's targets** — an axis mismatch, not a missing file:

- **The panel's target tabs are `react` / `vue`** — the consume-mode genWrapper targets
  (`fui:workbench/mount.ts:648` `TARGET_LABELS = { react, vue }`, `TARGETS` from
  `fui:tools/gen-wrapper/genWrapper.mjs:26`). The slice-(a) comment there literally reserves this work:
  *"no conformance badge (#913)"* (`fui:workbench/mount.ts:635`).
- **The committed #506 golden is a different generator/axis.** `we:blocks/renderers/module-service/conformance/golden.json`
  is the **MaaS serve-origin** gate (#505/#549) — its 14 vectors are all `_maas` / `X-MaaS` HTTP
  responses for `reference` (JS) vs generated `.NET` origins (`we:blocks/renderers/module-service/conformance/runner.ts`,
  `we:blocks/renderers/module-service/conformance/dotnetTarget.ts`). It contains **zero** react/vue content. It is not a per-target verdict for the
  genWrapper wrappers the panel shows.
- **No deterministic react/vue wrapper verdict is committed anywhere.** A tree-wide search finds no
  golden/verdict/snapshot for genWrapper output. The *only* react/vue conformance artifact is
  `we:wrapper-conformance/runner.ts` + `we:wrapper-conformance/vectors.ts` — the **#891 BEHAVIORAL** runner (executes over a live
  subject), which is exactly **#967's** scope. So #954 Fork 2 handed #967 the real (behavioral)
  artifact and left #913 pointing at a "deterministic verdict" that doesn't exist for its targets.

So #913 cannot be built as written. **The decision: what deterministic verdict, if any, backs the
react/vue polyglot badge?**

- **A — Build a deterministic wrapper-source golden.** Freeze genWrapper output per target as a
  committed golden-source snapshot; badge = "emitted source matches golden." Faithful to a *deterministic*
  badge and independent of the #912 live sandbox — but it's **new WE artifact + emit work**, not the
  "already committed" verdict the card assumed, and it's a second conformance axis for wrappers (source
  vs behavioral).
- **B — Collapse #913 into #967 (lean, ~60%).** The only genuine wrapper conformance is behavioral; the
  deterministic/behavioral split (#954 Fork 2) was predicated on a deterministic verdict that doesn't
  exist, so the badge should just be the behavioral one (#967) and #913 is redundant. Cleanest unless we
  specifically want a sandbox-independent deterministic tier.
- **C — Repoint to a cheap genWrapper *health* signal.** Badge = emit-success / no-lossy / no-diagnostics
  per target, computable from genWrapper output alone (deterministic). Weakest: it's a "generated cleanly"
  badge, not "conformant" — risks implying a conformance guarantee it doesn't verify.

Confidence ~60% on **B**; residual is whether a sandbox-independent deterministic tier (A) is worth a
second axis. Not pre-settled — needs a ratification turn. `dateStarted` cleared (no build happened).
