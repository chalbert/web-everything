---
type: decision
workItem: story
size: 5
status: open
blockedBy: ["141"]
dateOpened: "2026-06-14"
tags: [dev-browser, fix-loop, source-awareness, source-map, ide, deployed-app, foundational]
---

# Dev-browser source-awareness & IDE bridge — map deployed DOM back to source for the #141 fix-loop

The #141 fix-loop and #410's deployed live-patch both assume the dev browser can map a rendered DOM node — on a *deployed* URL, not just localhost — back to the source that produced it, then act on the repo (open a PR, drive the IDE). That is more than static analysis of a site at a URL: it needs a source-awareness substrate, materially harder for a deployed, minified app where source maps may be stripped. No item captured this implied dependency. This decision picks the mapping mechanism and whether live IDE interaction is in scope. Foundational to the fix-loop.

## Why this is captured here

It surfaced while ratifying #410 as an *implicit* premise of the whole #141 fix-loop: "propose a fix →
verify it → **open a PR against the source repo**" only works if the browser knows *which source produced
the rendered thing it is patching*. #141 names the introspectable self-description (registries, intents,
contexts, traces) but never the **DOM-node → source-construct** link or any IDE interaction. It's a shared
foundation — even v1's local-session patch→PR needs it — so it lives under #141, not as a fork of #410.
The hard, distinguishing case is exactly #410's: a *deployed* surface, where the easy local-dev assumptions
(dev server, unstripped source maps, a checked-out workspace) may all be absent.

## Open axes (to prepare, not yet ratified)

1. **Source-awareness is a *provider set*, not a single mechanism.** Several strategies coexist — the
   browser uses whichever is present and degrades when none is, so this is a **registry of source-awareness
   providers** (same provider-set shape the standard favours), not one winner. Candidate providers:
   - **Browser loads the workspace dir directly** (File System Access API / native dir picker) — the browser
     holds the source tree itself, so it can resolve a node to a file and write the patch back locally. Best
     when the developer's own checkout is on the same machine.
   - **VS Code extension bridge** — an extension **emits which projects are currently open/being developed**
     and coordinates work two-way: the IDE tells the browser what's active and where its source lives, and
     the browser hands patches (or `file:line` jumps) back for the IDE to apply. Richest when the dev is in
     their editor; also the natural home for "active project" awareness.
   - **Source maps** from the served bundle — zero setup, but absent/stripped on many deployed builds.
   - **Build-emitted node→source manifest** — extend the app's self-description with stable source anchors;
     native-first and survives minification (works where source maps don't).
   - **Dev-server live bridge** — a localhost-only channel; doesn't help the deployed case.

   The decision is the **provider set + precedence + degradation rule**, not picking one. (Several may be
   active at once — e.g. dir-load *and* the VS Code bridge — or none, on a cold deployed URL.)
2. **Deployed-case degradation — what holds when there's no workspace and maps are stripped?** e.g. the
   self-description carries stable source anchors independent of the bundle, or a source-map sidecar is
   served only to an authorized session. This is the axis #410 forces, and where the local-only providers
   (dir-load, dev-server, VS Code bridge) drop out.
3. **IDE-interaction depth (separable — bias toward separation).** *Passive*: open `file:line` in the
   user's editor. *Active*: the VS Code extension applies the patch into the live workspace and coordinates
   work (which project is active, conflict with unsaved edits, two-way sync). Source-awareness is the
   must-have substrate; deep live IDE coordination is a richer optional layer that **may split into its own
   item** (the extension that "emits active projects and coordinates work" is plausibly its own story).

## Relationships

- **Foundational to** the #141 fix-loop's PR step and to #410's build follow-through (and thus #555/#557).
- **Not a blocker of #410's *decision*** — #410's four forks (isolation/auth/lifetime/audit) are orthogonal
  to *how* source is located; this gates the *build*, not the ratification.
- Needs a `/prepare` pass (survey source-map/IDE-bridge prior art, materialize a research topic, state each
  axis's options + default) before it's ratify-ready.
