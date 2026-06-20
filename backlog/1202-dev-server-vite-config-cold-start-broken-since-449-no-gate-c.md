---
type: issue
workItem: story
status: resolved
locus: webeverything
dateOpened: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:tools/maas/vite-plugin.ts"
size: 5
tags: [dev-server, vite, tooling, regression, gate-gap, frontierui-plugs, 449]
---

## Resolved (2026-06-20) — option A (lazy-load) + cold-start gate

**Cure (A).** `we:tools/maas/vite-plugin.ts` no longer statically imports block runtime. Its
`blocks/*` value imports now load lazily at server-start via `server.ssrLoadModule(...)` inside
`configureServer` (Vite resolves the `@frontierui/plugs` alias there); only type-only imports
stay static (erased by esbuild, never reach Node). The esbuild-compiler registration + fixture
indexing that fired at module-eval now fire once in `buildHandler()` on the ssr-loaded instances
the middleware uses; the handler promise is warmed at server-start and awaited per request.
Audit confirmed maas was the **sole** Node-side offender in the config-eval graph (`devPanel`
imports only fs/path; the `scripts/*.mjs` gates consume JSON/markdown data, not block runtime).

**Guarantee (gate).** Added `we:scripts/dev/check-cold-start.mjs` (`npm run check:cold-start`):
loads `vite.config.mts` via Vite's `createServer` exactly as a fresh `vite` would and fails on
`ERR_MODULE_NOT_FOUND`. Wired into `verify` (the **build** gate) rather than `check:standards` —
the latter is a pure data/standards linter invoked by 9+ skills, so a ~1s Vite boot there would
slow every `/prepare`//`/resolve`//`/slice` and break layering (data linter must not import Vite).
Buildability belongs in the build gate. Positive + negative tested (reintroducing a static block
import flips it red with the exact #1202 diagnostic).

**Verified.** Fresh `vite` cold-starts clean; the plug `.ts` modules serve 200; the demo's
`upgrade()` runs. A *separate*, pre-existing eval bug remains — bindings render the expression
**path** not its value — tracked as **[#1207](/backlog/1207-interpolation-text-node-renders-expression-path-not-its-eval/)** (not in this item's scope).

# Dev-server Vite config cold-start is broken since #449 — and no gate catches it (block runtime in the config graph imports the Node-unresolvable `@frontierui/plugs`)

## Symptom (how it surfaced)

The `we:demos/text-interpolation-demo.html` demo renders only empty **RESULT**
placeholders instead of live `{{ }}` / `[[ ]]` bindings. A Playwright check on the
running `:3000` showed every plug `.ts` module returning **500**:

```
Failed to resolve import "@frontierui/plugs/webexpressions/CustomTextNodeParser"
from "we:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts". Does the file exist?
```

The modules never load → `customTextNodes.upgrade()` never runs → nothing is evaluated.
The demo is **designed to show live bindings**; it currently shows static placeholders
purely because of this failure.

## Root cause (two layers, one origin — #449/dd4ff79)

1. **Cold-start is broken.** Launching a fresh Vite (`vite` / `npm run build:demo`)
   dies at **config load**:

   ```
   failed to load config from we:vite.config.mts
   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@frontierui/plugs'
     imported from .../vite.config.mts.timestamp-*.mjs
   ```

   Chain: `we:vite.config.mts` → `we:tools/maas/vite-plugin.ts` (imported at config-eval)
   → `we:blocks/renderers/module-service/*` + `we:blocks/renderers/component/__fixtures__/component-cases.ts`
   → transitively `we:blocks/renderers/jsx/index.ts` (and siblings) → bare
   `@frontierui/plugs/*`. At config-eval time this is **plain Node ESM resolution** — the
   Vite app alias (`resolve.alias['@frontierui/plugs']` → `../frontierui/plugs`) does **not**
   apply, and `node_modules/@frontierui` is empty. So Node can't resolve it. Reproduced
   deterministically on a throwaway port.

   `@frontierui/plugs` is resolvable **only** by aliases that don't cover Node config-load:
   `we:vite.config.mts` `resolve.alias` (app serving), `we:vitest.config.ts` `alias`
   (tests), `we:tsconfig.json` `paths` (typecheck). Plain Node — which loads the Vite
   config and any `scripts/*.mjs` that import `blocks/` — has no resolver, and the sibling
   source is `.ts` (a `node_modules` symlink wouldn't help: Node can't import `.ts`).

2. **The running `:3000` is frozen on the pre-#449 config.** pid was started before
   dd4ff79 (#449) landed. When the config later changed to add the `@frontierui/plugs`
   app-alias, Vite tried to auto-restart, the **new config failed to load** (layer 1), so
   Vite kept serving with the **old in-memory config** — which lacks the app-alias →
   every `@frontierui/plugs` app import 500s. This is why "it should live-reload" didn't:
   the reload is silently failing on the broken config. **The dev server cannot be
   restarted until layer 1 is fixed** (cold start dies the same way).

## The gate gap (the real ask — "testing failing when building blocks")

No check caught that the dev server / demo build can no longer cold-start:

- `we:package.json` `verify` = `vitest run && eleventy build:check`. vitest has the
  `@frontierui/plugs` alias; eleventy `build:check` is the **docs** server (no Vite). So
  neither exercises **plain-Node Vite config load** or `vite build`.
- `npm run build:demo` (`vite build`) **does** hit config-load and is therefore broken
  today — but it's not in any gate.
- `check:fresh` (`we:scripts/dev/check-fresh.mjs`, #850) only probes the **Eleventy**
  `:8080` `we:build-id.json` for staleness — it knows nothing about Vite `:3000`
  cold-startability or config-loadability.

Net: a class of regression — *Node-side tooling (config, `scripts/*.mjs`) importing block
runtime that transitively pulls the alias-only `@frontierui/plugs` specifier* — is
**invisible to CI/gates**. It only showed up because a human noticed a demo rendering wrong.

## Fix direction (needs a considered choice, not a one-liner)

The maas plugin genuinely needs block runtime loaded in Node to serve `/_maas/`, so we
can't just drop the import. Options:

- **A — keep block runtime out of the config-eval graph.** Lazy-load the maas plugin's
  `blocks/` deps via Vite's own loader (`server.ssrLoadModule('/blocks/renderers/...')`
  inside `configureServer`), so they're resolved by Vite (alias applies), never by Node at
  config-eval. Cleanest; preserves the #449 dev-time-sibling-source design.
- **B — make `@frontierui/plugs` Node-resolvable.** A real installed/symlinked package
  with compiled `.js` (published-package shape, #877). Heavier; closer to release wiring
  but defeats the dev-time live sibling source.
- **C — register a Node TS loader** (tsx/esbuild-register + path mapping) for config load.
  Broadest blast radius.

Lean **A** (~70%); residual is whether other Node-side scripts (`we:scripts/*.mjs`) also
import `blocks/` and need the same treatment — audit before committing.

**Plus a gate** (the "improve"): add a cheap cold-start / config-load probe to the health
gate — e.g. a `check:cold-start` that runs `vite --config we:vite.config.mts` config
resolution (or a throwaway `vite build --mode probe`) and fails on `ERR_MODULE_NOT_FOUND`,
so a Node-unresolvable specifier entering the config/script graph is caught mechanically.

## Acceptance

- [x] `vite build` / a fresh `vite --port N` cold-starts cleanly off `we:vite.config.mts`.
- [x] `we:demos/text-interpolation-demo.html` plug modules load (no 500s) and `upgrade()` runs
      on a freshly-started server. *(Full live-value rendering is the separate #1207.)*
- [x] A gate fails when Node-side config/script code imports a specifier only resolvable by
      a Vite/vitest/tsc alias (`we:scripts/dev/check-cold-start.mjs`, in `verify`).
