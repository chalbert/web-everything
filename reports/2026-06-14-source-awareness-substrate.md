# Source-Awareness Substrate & IDE Bridge — prior-art survey for #562

**Date**: 2026-06-14
**Point**: The dev-browser fix-loop's "map a deployed DOM node back to source, then act on the repo" capability is two orthogonal provider chains (resolver + bridge), and exactly one resolver family — a build-emitted string-literal source anchor — survives a stripped production build, making it the keystone of the design.
**Plan file**: (none — decision-prep for backlog #562)
**Research page**: `/research/source-awareness-substrate/`

---

## Question

The #141 fix-loop and #410's deployed live-patch both assume the dev browser can map a rendered DOM node — on a *deployed*, possibly minified, source-maps-stripped URL — back to the source construct that produced it, then act on the repo (jump to `file:line`, open a PR, drive the IDE). No item captured this implied dependency. #562 picks the mapping mechanism and whether live IDE interaction is in scope. What mechanisms exist, which survive a deployed build, and how do they compose into a degrading provider set?

## Recommendation

Model the substrate as **two independent provider chains**, each a registry with a precedence order and a degradation rule (support-all-coherent, not winner-pick):

- **Resolver chain** (node → `file:line`): build-emitted source anchor → framework debug metadata → source maps.
- **IDE-bridge chain** (act on repo): VS Code extension → File System Access API → `vscode://file` deep link → dev-server `launch-editor`.

The two genuine forks left for ratification:

1. **Cold-deployed anchor representation** — opaque-id + sidecar manifest (recommended, least-leaky) vs. raw `data-source-file`/`data-source-line` (Sentry-annotate style, simple but leaks paths) vs. authorized source-map sidecar only. A disclosure tradeoff, so the most-permissive default *inverts* toward least-leaky.
2. **IDE-interaction depth** — passive jump + FS-Access write is the must-have substrate; the rich two-way VS Code extension ("emits active projects and coordinates work") carves to its own child story (separation bias).

## Key Findings

- **Two chains, not one mechanism.** Any resolver composes with any bridge — they are separable axes; #562 should not "pick one."
- **The cold-deployed cliff.** Nearly all convenient dev tooling (React `__source`, LocatorJS, click-to-react-component, dev-server `launch-editor`, Chrome Automatic Workspace Folders) is dev-build-injected and stripped in prod. **React 19 removed `_debugSource`** (PR #28265) — don't build on framework internals.
- **The only prod-surviving resolver** is a build-emitted string-literal `data-*` attribute (minifiers rename JS identifiers, not markup strings). `@sentry/babel-plugin-component-annotate` (`data-sentry-component`, `data-sentry-source-file`) is the live precedent, intended to ship in prod. The least-leaky variant — an **opaque id + sidecar manifest** (id → `file:line` shipped separately) — is a design sweet spot no shipped product currently occupies.
- **File System Access API** is the only zero-install, zero-server way for a *deployed* tab to write a patch — but **Chromium-only** (Firefox declined; Safari ships only sandboxed OPFS), so it needs a fallback.
- **A VS Code extension** is the only true two-way bridge (apply `WorkspaceEdit` patches + enumerate active projects + push editor→browser), at the cost of a user install.
- **WE reframe:** WE apps are already introspectable, so the node→source anchor is a natural extension of the app's self-description — a no-leakage contract the app emits and the dev-browser consumes. The *anchor contract* is the WE standard; the *resolver + bridge* live in the Plateau dev-browser product (mirrors #475/#091).

## Files Created/Modified

| File | Action |
|---|---|
| `src/_data/researchTopics.json` | Added `source-awareness-substrate` registry entry |
| `src/_includes/research-descriptions/source-awareness-substrate.njk` | New research write-up |
| `backlog/562-…md` | Rewritten to prepared-fork shape; `preparedDate` set |
| `reports/2026-06-14-source-awareness-substrate.md` | This report |
