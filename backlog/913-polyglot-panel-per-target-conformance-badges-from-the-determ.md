---
type: idea
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
