---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-16"
tags: []
---

# How WE apps + straddle demos consume the 9 moved block-impl families post-deletion

The #791 rule settled block-impl DEMOS (subject=block → iframe) but not WE artifacts that COMPOSE a moved family as a building block: the loan-origination + auto-insurance exercise apps and the loader-background-handoff / durable-tier-verification straddle demos. They can't iframe a whole app and can't import @frontierui/blocks (#707 boundary; no frontierui vite alias). #765 in-document mount is runtime-SDK-only (mount a rendered thing), which gives an app no block CLASSES to compose with. So there is no sanctioned consumption path today. Options: (a) move the apps to FUI (dissolves their WE conformance-forcing-function role); (b) re-classify the consumed families as reference-runtime that stays in WE (contradicts #791 9-move + reopens #641); (c) extend #765 federation from mount-a-demo to compose-blocks (principled, unproven for apps); (d) decouple the apps to use only retained reference-runtime families. Load-bearing fork that gates the #697 cutover.

## The fork

**Crux:** once #697 deletes WE's 9 vendored block-impl families, what runtime do the WE artifacts that
**compose** those families as building blocks consume? Affected (per
[the #697 split analysis](../reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md)):

- `demos/loan-origination/` — imports `blocks/{audit,lifecycle,master-detail,stepper}` + renderers
- `demos/auto-insurance/` — adds `blocks/tree-select`
- `demos/loader-background-handoff-demo.*` — `blocks/background-task-surface` + `resource-loader` (stays)
- `demos/durable-tier-verification/*` — `blocks/background-task-surface`

Each can't iframe (a full app / standard-runtime demo isn't one embeddable block) and can't
`import '@frontierui/blocks'` ([#707](/backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-/)
boundary — no `frontierui` vite alias, by design). [#765](/backlog/765-in-document-shadow-dom-di-mount-relax-the-docs-rendering-bou/)'s
in-document mount is "runtime SDK only — mount a rendered FUI thing," giving an app no block **classes**.

| Option | Stance | Tension |
|---|---|---|
| **(a)** Move the exercise apps to FUI | — | Dissolves their WE conformance-forcing-function role (apps are WE's deliverable that proves the standard) |
| **(b)** Re-classify the consumed families as reference-runtime that **stays** in WE | — | Contradicts #791's "9 move"; re-opens #641's blocks=application-impl classification |
| **(c)** Extend #765 federation from mount-a-demo → **compose FUI blocks at runtime** | candidate | Principled (one runtime-federation seam), but unproven for app-level composition; needs an SDK that exposes block factories, not just rendered mounts |
| **(d)** Decouple the apps — rebuild on WE's **retained reference-runtime** families only | candidate | Apps stop exercising the moved impls directly; may lose conformance coverage of those families |

**Not yet prepared** — needs the fork-readiness pass (cite the real app import sites at `file:line`,
survey whether #765's SDK could expose factories) before ratification. Resolving it turns #697 agent-ready.

## Decision done when

- [ ] Consumption path for moved-impl-composing WE artifacts ratified (a/b/c/d), grounded in the real tree.
- [ ] #697 `blockedBy` updated to drop this once resolved; the affected demos/apps get their per-artifact
      disposition recorded.
