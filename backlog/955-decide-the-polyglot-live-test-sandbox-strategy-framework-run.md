---
type: decision
workItem: story
size: 3
status: resolved
locus: frontierui
relatedProject: webdocs
parent: "746"
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-polyglot-live-test-sandbox.md
researchTopic: polyglot-live-test-sandbox
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Decide the polyglot live-test sandbox strategy (framework-runtime loading + element isolation)

Surfaced claiming **#912** (live-test sandbox) in batch-2026-06-18. #912 transpiles + **executes** the
consume-mode wrapper `generateWrapper(cem, target)` produces, rendering it live with runtime-error
surfacing — a much bigger build than the `story·5` estimate, carrying a genuine strategy fork.

## Ruling — ratified 2026-06-18 (reverses both prepared ✶ defaults after the skeptic pass)

A skeptic pass (prompted only to refute, grounded in the real FUI tree) landed on **both** prepared
defaults; the ruling below **supersedes the ✶ markers in the table and forks further down** — those are
kept as the audit trail of the prepared shape and why it flipped.

- **Fork A → A2 (same-document mount), not A1 (iframe).** The A1 default rode the
  [Lit-Playground](https://github.com/google/playground-elements) precedent, which is **dis-analogous**:
  Lit Playground is a multi-file *code editor* that re-resolves arbitrary projects per preview, so it
  needs a fresh per-preview frame + import-map. #912's input is a **deterministic transform of a *known*
  component's CEM** rendered against an **already-registered** element (`fui:workbench/registry.ts:149`) —
  no per-preview re-resolution, no re-`define`. A1 would (1) need a stable per-block module URL the
  registry doesn't expose, and (2) re-introduce a `postMessage` console/error bridge — the exact channel
  ratified **#809/#815** forbids (`fui:workbench/mount.ts:9` *"NO postMessage … NO WE↔FUI channel"*) — and
  fragment the existing inspector/event/anatomy panels (which read the live instance host-side) away from
  the element. A1's one real win (error containment) is mitigable with a React error boundary +
  `window.onerror` — which **is** the runtime-error surfacing #912 asks for. ~70%; residual = a framework
  *init* crash (not a render throw) can't be fully boundaried → "isolate only a block that demonstrably
  corrupts the shell" stays the documented fallback.
- **Fork B → framework runtime resolved by the bundler (devDependency), not CDN and not vendor-route.**
  Once A is same-document, the runtime-source fork **largely dissolves**: the sandbox uses the workbench's
  existing bundler resolution (Vite → `node_modules`), which is offline in dev *and* e2e, keeps the shipped
  `@frontierui` bundle framework-free (react/vue are devDeps), and mirrors the dominant npm+bundler
  consumer better than esm.sh import-maps. CDN excluded (the "two-paths" cost the skeptic showed was a
  false dilemma is moot under A2); bundle-into-FUI stays excluded. ~75%.
- **Transpiler → server-side transpile via a dev-server endpoint, NOT in-browser esbuild-wasm.**
  `fui:tools/gen-wrapper/genWrapper.mjs` is already Node and Node already has esbuild, so a dev-server endpoint runs
  `genWrapper(cem, target)` + transpile and serves a ready ESM module the sandbox consumes with a plain
  `await import('/api/wrapper/<block>/<target>')` (see *Code sketch*). No `esbuild-wasm`/Worker/wasm-init in
  the client; deterministic + cacheable (CEM hash → wrapper). esbuild-wasm demoted to a fallback only if a
  pure-client (no-dev-server) form is ever needed. ~75%.
- **Constellation placement:** the endpoint is the **local form of a MaaS** — WE owns the CEM contract,
  FUI owns the generator (`genWrapper` is FUI tooling, #855), the *hosted* serve is plateau-app (#091/#398).
  #955's locus is `frontierui`, so it ratifies the **FUI dev-server endpoint** only.

**Dependency (raised at ratification):** the endpoint's request/response shape **is** a MaaS
wrapper-serve protocol, and that protocol is **not yet defined** — the resolved #081 cluster (#461/#505/
#463) defined the polyglot *server-impl* generation/distribution origin, not the **CEM→framework-wrapper
ESM serve contract** a browser sandbox consumes. So #912's build is gated on a new protocol-definition
item (scaffolded as the blocker below) — the local endpoint must conform to that contract, not be
throwaway. CI/offline: the local endpoint keeps e2e deterministic; a hosted MaaS in CI would breach
"no uncontrolled external network," so CI always uses the local endpoint.

## Grounding digest

- The generated React wrapper is literally **TS+JSX that `import`s `react`** and renders the **real
  custom element**: `fui:tools/gen-wrapper/genWrapper.mjs:119` emits `import React, { useEffect, useRef }
  from 'react'; … return React.createElement('<fui-tag>', { ref, …attrs }, children)`. So a live preview
  needs three things absent from the workbench today: (1) in-browser TS+JSX transpile, (2) a React/Vue
  **runtime** reachable from the preview, (3) the **real element defined where the wrapper runs**.
- The workbench registers blocks via **bundler-resolved dynamic imports** — `fui:workbench/registry.ts:149`
  `import('../blocks/droplist/AutoComplete').then(({ registerAutoComplete }) => …)` — which expose **no
  stable per-block module URL** to re-import into an isolated frame. No in-browser transpile/sandbox infra
  exists in FUI today (no `esbuild-wasm`/`@babel/standalone` dep).
- **Prior art (full survey: [research topic](/research/#polyglot-live-test-sandbox) ·
  `we:reports/2026-06-18-polyglot-live-test-sandbox.md`).** [Lit
  Playground](https://github.com/google/playground-elements) is the closest analog — also
  web-components-first, also live-executing — and chose **iframe `srcdoc` isolation** (own execution
  context; console captured by monkey-patching `console.*` + `postMessage` to the parent) + **rewriting
  bare imports to CDN URLs**. [esbuild-wasm](https://esbuild.github.io/api/) (`transform()` in a Web
  Worker, also does module resolution) beats [@babel/standalone](https://babeljs.io/docs/babel-standalone/)
  (no module resolution) for our `import`-ing wrapper. [esm.sh](https://esm.sh/) + import maps is the
  no-build runtime-source mechanism Lit-style tools point at.

## Axis framing

The transpiler (esbuild-wasm vs Babel-standalone) **is** a mere impl detail — supported by default
(esbuild-wasm recommended). The two real axes are **element isolation** and **framework-runtime source**,
and they are **coupled**: B's framework-free isolation is cleanest when the runtime loads *inside* an
iframe (A1), not the workbench document (A2). Three platform facts ground the defaults: import maps are
document-scoped and resolve-once (a fresh `<iframe srcdoc>` gets a fresh map per preview; same-doc can't
re-resolve); `customElements.define` throws on re-definition (same-doc can only reuse the parent's
registration); and executed wrapper code is framework code, not host DOM (a same-doc throw can break the
workbench shell, an iframe contains it).

> **Research flipped both interim defaults.** Surfacing authored A2 (same-doc) and B1 (CDN) as the POC
> defaults; the prior-art survey moves the best-end-state defaults to **A1 (iframe)** and **local-vendored
> runtime** — see each fork. Both are **high-leverage, flag for the deciding agent's skeptic pass.**

### Recommended path at a glance

| Fork | Options (✶ = recommended default) | Main alternative & why excluded/weaker | Confidence |
|---|---|---|---|
| **A — element isolation** | ✶ **A1 iframe `srcdoc` + own import-map** · A2 same-document mount | A2 is a *coherent* alternative (simpler, no module-URL resolution), so it's a real either/or — not excluded; A1 wins on error containment + framework isolation + the Lit-Playground precedent | ~70% |
| **B — framework-runtime source** | ✶ **Local-vendored devDependency served into the sandbox iframe** · CDN import-map (esm.sh) · ~~bundle into FUI~~ | Bundling into FUI is the **flawed/excluded** branch (ships framework runtimes in a web-components lib); CDN is coherent but forces two paths (CDN dev + vendored CI) | ~75% |

## Fork A — element isolation

*Fork-existence: iframe-`srcdoc` and same-document mount genuinely **cannot coexist** for one preview
surface — a preview mounts to exactly one target. Both branches are coherent end-states, so this is a real
either/or (not a forced invariant).*

- **A1 — Isolated `<iframe srcdoc>` with its own import-map (✶ recommended default, ~70%).** Re-import the
  element module + framework into the frame. Clean error/runtime containment, a fresh import-map per
  preview, and the framework runtime stays out of the workbench document. This is the
  [Lit-Playground](https://github.com/google/playground-elements) path for the same problem
  (web-components live execution; full survey in `we:reports/2026-06-18-polyglot-live-test-sandbox.md`), and it pairs naturally with Fork B's vendored runtime (loaded *inside*
  the frame). **Cost (build, not merit):** must resolve the element's dev-served module URL — the registry
  exposes none today (`fui:workbench/registry.ts:149`) — so #912 needs a stable per-block module URL. Per
  *fork-is-not-a-prioritization-tool* that build effort is filed to #912, not a reason to pick the weaker
  end-state.
- **A2 — Same-document mount** reusing the already-registered parent element. Simplest path to a first live
  render (no module-URL resolution — the element is already defined), and architecturally consistent with
  the existing #815 "one document, no channel" workbench. But the framework runtime then loads in the
  workbench page and a thrown error in the executed wrapper isn't contained. **Residual / red-team
  hook:** if #912 finds the per-block module URL intractable, A2 is the documented interim, and the #815
  no-channel philosophy is the principled argument a decider could use to make A2 the durable choice.

## Fork B — framework-runtime source

*Fork-existence: the **flawed/excluded** branch is bundling React/Vue into `@frontierui` — a
web-components library shipping framework runtimes violates FUI's framework-free principle and bloats the
published bundle. The remaining options (CDN vs local-vendored) are coherent framework-free choices that
genuinely cannot both be the single runtime source.*

- **Local-vendored devDependency served into the sandbox iframe (✶ recommended default, ~75%).** A
  React/Vue copy held as a workbench **devDependency** (never the shipped `@frontierui` bundle, so
  framework-free is preserved) and served by the dev server into the sandbox iframe via a local
  import-map. Offline + **deterministic CI**, and — paired with the already-local esbuild-wasm — the whole
  sandbox needs no external network. Resolves the e2e ask below with one path. Cost: slightly more
  dev-server wiring than pointing at a CDN.
- **CDN import-map (esm.sh) in the sandbox.** Zero wiring, and what Lit Playground ships. But the item
  already requires an e2e plan with **no uncontrolled external network** (next paragraph) — which forces a
  vendored copy to exist for CI anyway, so CDN means maintaining **two paths** (CDN dev + vendored CI).
  **Residual / red-team hook:** a decider optimizing purely for POC wiring-speed could reasonably take CDN
  and accept the two-path cost.
- **~~Bundle React/ReactDOM/Vue into FUI~~ — flawed/excluded.** No network dependency, but **conflicts
  with FUI's framework-free principle** (a web-components lib shipping framework runtimes) and bloats the
  published bundle — the branch the fork-existence test rules out.

## Supported by default (not forks)

- **Transpiler = server-side via a dev-server endpoint** (`fui:tools/gen-wrapper/genWrapper.mjs` + Node esbuild; the sandbox
  `import()`s the served ESM module). *(Ruling above supersedes the originally-authored "esbuild-wasm in a
  Web Worker" — that is now the fallback for a pure-client form only.)*
- **Console / runtime-error surfacing** via a React error boundary + `window.onerror` /
  `unhandledrejection`, **same-document** (no `postMessage` bridge — A2 ruling). *(Supersedes the
  originally-authored Lit-Playground `postMessage` monkey-patch, which assumed the A1 iframe.)*
- **E2e verification plan.** Live-mount can't be unit-tested in jsdom; the e2e plan reuses the **same
  local-vendored runtime** (Fork B default) so it never depends on uncontrolled external network — the
  two-decisions-become-one consolidation the e2e ask was pointing at.

## Code sketch — recommended path (A2 same-document + bundler-resolved runtime)

*Illustrative, grounded in the real tree; for the deciding agent. The wrapper input is what
`fui:tools/gen-wrapper/genWrapper.mjs:119` already emits — TS+JSX that `import React from 'react'` and
ends in `React.createElement('<tag>', { ref, …attrs }, children)`.*

**1 — Transpile the generated wrapper in-browser (esbuild-wasm in a Worker; the one swappable impl,
not a fork).** The wrapper source is produced at *runtime* from the CEM, so it can't be a build-time
file — it needs an in-browser transpile:

```ts
// workbench/live-test/transpile.ts
import * as esbuild from 'esbuild-wasm';
let ready: Promise<void> | undefined;
export async function transpileWrapper(tsx: string): Promise<string> {
  ready ??= esbuild.initialize({ wasmURL: esbuildWasmUrl /* local devDependency asset */ });
  await ready;
  const { code } = await esbuild.transform(tsx, { loader: 'tsx', format: 'esm', target: 'es2022' });
  return code; // ESM with bare `import … from 'react'` left intact for the bundler to resolve
}
```

**2 — Same-document mount, runtime resolved by the existing bundler (Fork A → A2, Fork B → devDep).**
The element is *already registered* by the block's `load()` (`fui:workbench/registry.ts:149` →
`registerAutoComplete('auto-complete')`), so the executed wrapper's `createElement('auto-complete', …)`
upgrades against that existing definition — **no per-block module URL, no fresh import-map, no iframe**.
`react` is a workbench **devDependency** Vite resolves from `node_modules` (offline in dev *and* e2e;
never in the shipped `@frontierui` bundle, so framework-free is preserved):

```ts
// workbench/live-test/mount-react.ts
const js = await transpileWrapper(wrapperTsx);
const blobUrl = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
const { AutoComplete } = await import(/* @vite-ignore */ blobUrl); // bare `react` import → node_modules
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const root = createRoot(stageNode); // stageNode lives in the workbench document — #815 "one document"
root.render(React.createElement(LiveErrorBoundary, null, React.createElement(AutoComplete, props)));
```

**3 — Surface runtime errors without a postMessage channel** (A1's bridge is exactly what #815's
`fui:workbench/mount.ts:9` forbids — *"NO postMessage manipulation protocol and NO WE↔FUI channel"*).
Same-document uses a React error boundary for render throws + `window.onerror` for the async tail —
which **is** the "runtime-error surfacing" #912 asks for, displayed in a workbench panel:

```ts
class LiveErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() { return this.state.err ? renderErrorCard(this.state.err) : this.props.children; }
}
window.addEventListener('error', (e) => showRuntimeError(e.error));        // uncaught tail
window.addEventListener('unhandledrejection', (e) => showRuntimeError(e.reason));
// existing inspector/event/anatomy panels keep reading the live instance host-side:
//   getComputedStyle(stageNode.querySelector('auto-complete'))  — works ONLY because it's same-document
```

*If A1 (iframe) were chosen instead, step 2 would need a stable dev-served module URL the registry does
not expose, its own per-preview import-map, and a `postMessage` `console.*`/`onerror` proxy in step 3 —
and the inspector/event/anatomy panels could no longer reach the live element. That cost delta is the
core of Fork A.*

---

Note the related ruling on **#954** already places the #891-behavioral conformance badge (#913 part 2)
**downstream of #912** — so this sandbox is on the critical path for behavioral conformance too.

**Blocks #912** (`blockedBy: 955`; #912 re-sized 5 → 8). Sibling of #753/#818/#913 under #746.
