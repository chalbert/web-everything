---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-07"
tags: [plugs, duplication, drift, single-source, frontierui, maintenance, runtime]
relatedProject: webplugs
---

# The plugs runtime is duplicated (and drifting) between Web Everything and Frontier UI

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

## Open question — how to make the runtime single-source (recommendations in bold)

This needs a design call before it's dev-ready — pick the consolidation strategy first:

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
