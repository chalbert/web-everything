---
kind: story
size: 8  # basis below ("Size basis") — 8 real files across 2 package-config edits (each multi-field),
         # 1 new CI workflow, 1 new generator script, 2 new committed wrapper files, 2 READMEs; one linear
         # arc behind one humanGate, not >8 so not a slice instruction (see "Why not split" below)
status: open
blockedBy: ["907"]
humanGate: { kind: setup, short: "Add NPM_TOKEN to the frontierui repo, then run the first npm publish of @frontierui/blocks and @frontierui/plugs.", what: "A human adds an `NPM_TOKEN` secret to the frontierui GitHub repo — verified ABSENT 2026-08-15 via `gh secret list --repo chalbert/frontierui` (only CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN/FUI_READ_TOKEN exist there; webeverything already has NPM_TOKEN for #907) — then runs the first-ever publish of `@frontierui/blocks` and `@frontierui/plugs` via the new `fui:.github/workflows/publish-fui-packages.yml` (`workflow_dispatch` with `dry-run:false`, or a hand-pushed tag once one is wired). Not agent-executable — `npm whoami` → E401 in this environment, the same residual #907 documents for `@webeverything`; `@frontierui` needs its own npm-org access on the same account (see #2155's 'human-action contingency')." }
dateOpened: "2026-07-02"
tags: [external-validation, pilot-adopter, npm-publish, gen-wrapper, consumption-channel]
locus: frontierui
scope:
  - fui:blocks/package.json
  - fui:plugs/package.json
  - fui:.github/workflows/publish-fui-packages.yml
  - fui:scripts/gen-pilot-wrappers.mjs
  - fui:blocks/background-task-surface/wrappers/react.tsx
  - fui:blocks/background-task-surface/wrappers/vue.ts
  - fui:blocks/README.md
  - fui:plugs/README.md
---

# Pilot consumption channel: publish the pilot-scoped artifact set (FUI blocks/plugs + a react/vue generated wrapper)

Ratified #2089 Gate A prerequisite: the pilot (#2129) needs published, externally-installable FUI blocks/plugs
plus a generated framework wrapper, and today none of that exists — `@frontierui/blocks` is `private:true`,
`@frontierui/plugs` has no publish guard at all, and gen-wrapper output only ever serves from the localhost
workbench. Publish `@frontierui/blocks` and `@frontierui/plugs` to npm (public + provenance — this pilot IS the
restricted-until-go "go" event, [we:docs/agent/platform-decisions.md#npm-scope-audience-layer](../docs/agent/platform-decisions.md#npm-scope-audience-layer)),
narrowed to their externally-resolvable subpaths, plus one committed generated wrapper
(`background-task-surface`, react + vue) reusing the block's already-proven live-workbench CEM. `blockedBy`
#907 (needs the pinned `@webeverything/contracts` dependency to actually exist on the registry first).

## What's true on disk (verified 2026-08-15)

- **`@webeverything/contracts` is not actually published yet.** `npm view @webeverything/contracts version` →
  `E404`, even though `we:contracts/package.json` already reads `0.1.0` in-tree. #907 is a real, live blocker,
  not a formality.
- **`fui:blocks/package.json:6`** has `"private": true`, no `files` allowlist, no `dependencies`, no
  `publishConfig`, no `repository`. A live `npm pack --dry-run` in `fui:blocks/` (run this session) packs
  **491 files / 2.8 MB**, including `__tests__/*.test.ts` — everything under `blocks/`, unfiltered, since there
  is no `files` field to narrow it.
- **`fui:plugs/package.json`** has no `private` field at all (publish-eligible by npm's default **today**,
  unprotected), version `0.0.0`, and a `files` allowlist that is stale against its own `exports` map: `exports`
  declares 22 subpaths, `files` only lists 8 (`core`, `webregistries`, `webinjectors`, `webcomponents`,
  `webcontexts`, `webbehaviors`, `webstates`, `webexpressions`). A live `npm pack --dry-run` in `fui:plugs/`
  (run this session) confirms it empirically: **76 files**, and `webanalytics`, `webdirectives`, `webguards`,
  `webidentity`, `webnodes`, `webnotifications`, `webportals`, `webrealtime`, `webresources`, `webtheme`,
  `webtraces`, `webvalidation` are **absent** from the packed tarball despite being exported — every one of
  those subpaths 404s for a real npm consumer today. `fui:plugs/package.json`'s `repository.url` also names
  `https://github.com/frontierui/frontierui.git`; `git remote -v` in that repo shows the real remote is
  `git@github.com:chalbert/frontierui.git`.
- **`@frontierui/blocks` has real, undeclared cross-package runtime deps.** Non-test imports of
  `@webeverything/contracts/*` exist in `fui:blocks/audit/AuditProvider.ts`,
  `fui:blocks/lifecycle/LifecycleProvider.ts`, `fui:blocks/selection/SelectionBehavior.ts`, etc.; imports of
  `@frontierui/jsx-runtime` and `@frontierui/component-compiler` exist in
  `fui:blocks/renderers/component/jsxSource.ts` and `fui:blocks/renderers/functional/functionalComponent.ts`.
  None of these are declared as `dependencies` in `fui:blocks/package.json` today — resolution currently works
  only because everything is one npm workspace.
- **`@frontierui/plugs`'s `webvalidation` subpath has real (non-type) runtime deps on THREE separate,
  never-published WE modules**: `@webeverything/error-summary` (real class `ErrorSummaryModel`, not a type —
  `fui:plugs/webvalidation/ValidationErrorSummary.ts:18`), `@webeverything/commitment-policy`
  (`fui:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts:25`,
  `fui:plugs/webvalidation/ValidityMergeField.ts:29`), `@webeverything/interaction-state`
  (`fui:plugs/webvalidation/ValidityMergeField.ts:31`). None of `we:error-summary/`, `we:commitment-policy/`,
  `we:interaction-state/`, `we:capability-manifest/`, `we:validation-generation/` (WE repo root dirs) are
  subpaths of `@webeverything/contracts`'s published `exports` map (checked `we:contracts/package.json` — 34
  subpaths, none named `error-summary`/`commitment-policy`/`interaction-state`) and none has its own publish
  plan. `webanalytics` (`fui:plugs/webanalytics/analyticsConformance.ts:17-18`) imports
  `@webeverything/conformance-vectors/*` too, `import type` only (erased at runtime, but still an unresolvable
  type for a consumer typechecking against the published `.d.ts`).
- **FUI has no committed, generated CEM for its own blocks.** `fui:package.json:134`'s `"customElements"` field
  points at the OS temp directory `/tmp/cem-probe/` (a gitignored CEM manifest, not a repo path). Per
  `fui:workbench/__tests__/e2e/live-test-panel.spec.ts:22-26`'s own comment: *"Nothing in the repo generates
  this file (it was a hand-run `custom-elements-manifest` output left over from earlier dev sessions)."* WE's
  own committed `we:custom-elements.json` covers only WE's 7 reference demo elements (`we-*` tags), not FUI's
  real production blocks.
- **One FUI block already has a real, hand-authored CEM declaration and a proven live gen-wrapper path**: the
  `<background-tasks>` custom element (`background-task-surface` block), declared inline at
  `fui:workbench/registry.ts:328-354` and already rendered live through a genWrapper-produced React wrapper via
  the localhost `/_maas/` route (`fui:tools/maas/produceWrapperBytes.mjs`,
  `fui:tools/maas/wrapperServeHandler.mjs`, mounted only by `fui:tools/maas/vite-plugin.mjs`'s
  `configureServer` — dev-only, confirming the card's "workbench-localhost-only" claim). Its source
  (`fui:blocks/background-task-surface/*.ts`) has **zero** `@frontierui/*` / `@webeverything/*` imports —
  self-contained, lowest-risk candidate for the required generated-artifact leg.
- **No FUI CI publishes anything.** `fui:.github/workflows/ci.yml` runs only the `test` job (unit suite +
  `check:standards`); there is no analog of `we:.github/workflows/publish-contracts.yml`.

## Decided design

1. **Access posture: publish `@frontierui/blocks` and `@frontierui/plugs` straight to public + provenance,
   skipping a restricted interim.** This pilot is exactly the "first external consumer who cannot reasonably
   hold a read token" go-event the ratified rule names
   ([we:docs/agent/platform-decisions.md#npm-scope-audience-layer](../docs/agent/platform-decisions.md#npm-scope-audience-layer), decided
   2026-07-03, Fork 3): *"the first external consumer who cannot reasonably hold a read token flips that set
   public (#2128's pilot channel is exactly such an event...)."* Both packages are unpublished today (no
   restricted history to protect), so there's no provenance-gap cost either.
2. **CI: a manual-fallback workflow mirroring `we:.github/workflows/publish-contracts.yml`, not release-please
   automation.** New `fui:.github/workflows/publish-fui-packages.yml`: `workflow_dispatch` (default
   `dry-run:true`) or a `blocks-v*`/`plugs-v*` tag push, `npm ci` → `check:standards` → `npm publish
   --provenance --access public` per package with `NODE_AUTH_TOKEN: secrets.NPM_TOKEN`. Full release-please
   automation (contracts' `#2156`) is a **later**, separate hardening step for FUI, same as it was for
   contracts — out of scope here.
3. **Named fork — trim `@frontierui/blocks`'s published surface to skip a 3-package publish cascade, via the
   repo's OWN existing optional-peer idiom.** Rather than also publishing `@frontierui/jsx-runtime` +
   `@frontierui/component-compiler` (which itself needs `@frontierui/compiler`, per
   `fui:compiler/package.json` importing `@frontierui/jsx-runtime` with **no** `dependencies` entry either — a
   3-deep cascade), declare them as **optional peer dependencies** in `fui:blocks/package.json`
   (`peerDependencies` + `peerDependenciesMeta: { optional: true }`), reusing the exact pattern already live at
   `fui:package.json` for `lexical`/`prosemirror-*`/`quill`/`xstate`. **Rejected alternative — publish all
   three now:** none of the pilot's realistic ≥3-block picks (button, type-ahead, data-grid, navigation,
   app-shell, background-task-surface — all self-contained or contracts-only) touch the `./renderers/*` or
   `./deck` subpaths that need them, so publishing three more packages buys nothing for THIS pilot and is
   deferred to whenever a consumer actually needs those subpaths.
4. **Named fork — narrow `@frontierui/plugs`'s published `exports`/`files` to drop `./webvalidation` and
   `./webanalytics`.** `./webvalidation` has verified real runtime dependencies on three unpublished WE
   modules (above) with no publish plan; `./webanalytics` depends on unpublished `@webeverything/conformance-vectors`
   types. Both stay reachable via the existing dev-time sibling-alias path for plateau-app/insider consumption
   — nothing insider-facing breaks. **Rejected alternative — publish those WE modules too:** that's a
   materially bigger, separately-scoped effort (giving `error-summary`/`commitment-policy`/`interaction-state`/
   `capability-manifest`/`validation-generation` their own publish story, WE-side) that nothing currently
   requires; flagged as a follow-up, not filed as a blocker since nothing needs it yet.
5. **Dependency pin timing.** `fui:blocks/package.json` and `fui:plugs/package.json` gain a real, pinned
   `dependencies["@webeverything/contracts"]` entry **only once #907 lands a real registry version** — pinning
   before the version exists would break `npm install` for everyone, exactly the reasoning #907's own body
   gives for its FUI-migration half. This is the literal mechanism of the `blockedBy: ["907"]` edge, not
   decoration.
6. **Named fork — ship the generated-wrapper leg as pre-generated, committed static source, not a served
   route or a CLI.** Add `fui:scripts/gen-pilot-wrappers.mjs`, a small reusable script that calls the
   *existing* `fui:tools/gen-wrapper/genWrapper.mjs` against the *existing* hand-authored
   `background-tasks` CEM declaration (`fui:workbench/registry.ts:328-354`) and writes
   `fui:blocks/background-task-surface/wrappers/react.tsx` + `fui:blocks/background-task-surface/wrappers/vue.ts`,
   exported as new `fui:blocks/package.json` subpaths. **Rejected alternative — publish `tools/gen-wrapper` as
   a runnable CLI so the pilot generates its own wrappers on demand:** requires ALSO publishing a durable,
   externally-reachable CEM source, and none exists (FUI's only CEM output is the ephemeral OS temp file under
   `/tmp/cem-probe/`, confirmed gitignored and generator-less above) — strictly more
   infrastructure than the card's "at least one" bar requires, and it cuts against the repo's own codified bias
   toward static data over a served route
   ([we:docs/agent/platform-decisions.md#workbench-inert-data-static-slot](../docs/agent/platform-decisions.md#workbench-inert-data-static-slot):
   *"static display text never routes through [`/_maas/`] as its baseline transport"*). MaaS live-serve stays
   parked (#1625), untouched. `fui:scripts/gen-pilot-wrappers.mjs` is written to be **re-run for whatever
   additional blocks #2129's pilot ultimately adopts** — it isn't a disposable one-off.
7. **Fix the two latent packaging defects found while here (same files, zero extra risk):** give
   `fui:blocks/package.json` a `files` allowlist excluding `__tests__`/`*.test.ts` (mirroring `fui:plugs`'s own
   pattern); reconcile `fui:plugs/package.json`'s `files` against its (narrowed, per #4) `exports` map so every
   published subpath is actually packed; fix `fui:plugs/package.json`'s `repository.url` to
   `https://github.com/chalbert/frontierui.git`.

### Why not split

Every piece above shares one `humanGate` and has no independent value on its own (a published `blocks` with no
wrapper doesn't satisfy Gate A's generated-artifact leg; a wrapper with nothing published to attach it to is
inert) — one linear arc, single locus, no parallelizable branches. Size 8 is the top of the un-split range, not
past it.

## Interfaces / protocol

**`fui:blocks/package.json` (diff shape):**
```json
{
  "private": false,
  "files": ["**/*.ts", "**/*.tsx", "!**/__tests__", "!**/*.test.ts"],
  "publishConfig": { "access": "public", "provenance": true },
  "repository": { "type": "git", "url": "https://github.com/chalbert/frontierui.git", "directory": "blocks" },
  "dependencies": { "@webeverything/contracts": "<version #907 actually publishes>" },
  "peerDependencies": {
    "@frontierui/jsx-runtime": "^0.1.0",
    "@frontierui/component-compiler": "^0.1.0"
  },
  "peerDependenciesMeta": {
    "@frontierui/jsx-runtime": { "optional": true },
    "@frontierui/component-compiler": { "optional": true }
  },
  "exports": {
    "./background-task-surface/react": "./background-task-surface/wrappers/react.tsx",
    "./background-task-surface/vue": "./background-task-surface/wrappers/vue.ts"
  }
}
```
(the `exports` block above is the two NEW entries only; every existing entry stays as-is.)

**`fui:plugs/package.json` (diff shape):** add the same `publishConfig` + `dependencies["@webeverything/contracts"]`
(post-#907) + corrected `repository.url`; **remove** `"./webvalidation"` and `"./webanalytics"` (and their
directories) from `exports`, confirmed above they were never in `files` either; reconcile `files` to include
every *remaining* exported directory (`webdirectives`, `webguards`, `webidentity`, `webnodes`,
`webnotifications`, `webportals`, `webrealtime`, `webresources`, `webtheme`, `webtraces`, plus the 8 already
listed).

**`fui:scripts/gen-pilot-wrappers.mjs` (shape, no args):**
```js
import { generateWrapper } from '../tools/gen-wrapper/genWrapper.mjs';
// PILOT_DECLARATIONS: one entry per block getting a committed wrapper — starts with exactly the
// backgroundTasksLive.cem literal at workbench/registry.ts:328-354 (kept byte-identical; do not
// hand-diverge the two copies).
for (const { blockDir, declaration } of PILOT_DECLARATIONS) {
  for (const target of ['react', 'vue']) {
    writeFileSync(
      `blocks/${blockDir}/wrappers/${target}.${target === 'vue' ? 'ts' : 'tsx'}`,
      generateWrapper(declaration, target),
    );
  }
}
```
Output is derived/deterministic (mirrors `we:scripts/gen-cem.mjs`'s own "no timestamp, re-run is a no-op diff"
convention) — a re-run must produce byte-identical files; that identity check is the Done-when test for this
script, agent-runnable with no publish/credentials required.

**`fui:.github/workflows/publish-fui-packages.yml` (shape):** `on: workflow_dispatch (input dry-run, default
true) | push tags 'blocks-v*' | push tags 'plugs-v*'`; steps `checkout → setup-node (registry-url set) → npm ci
→ check:standards → npm publish --provenance --access public [--dry-run] -w blocks -w plugs` with
`NODE_AUTH_TOKEN: secrets.NPM_TOKEN`, `permissions: { contents: read, id-token: write }` — copy
`we:.github/workflows/publish-contracts.yml`'s exact shape, retargeted at two workspaces.

## Tasks (ordered)

1. Confirm #907 has landed a real registry version (`npm view @webeverything/contracts version` no longer
   404s); read off the exact version to pin.
2. Edit `fui:blocks/package.json` and `fui:plugs/package.json` per the Interfaces section above (private flag,
   `files`, `publishConfig`, `repository`, `dependencies`, peer deps, narrowed `exports`).
3. Re-run `npm pack --dry-run` in both `fui:blocks/` and `fui:plugs/` and diff the file list against the
   (narrowed) `exports` map — every remaining subpath's backing file must appear; nothing under
   `__tests__`/`*.test.ts` may appear. This is the same probe already run during prep — re-running it against
   the edited config is the correctness check, not a new invention.
4. Add `fui:scripts/gen-pilot-wrappers.mjs`; run it once to generate
   `fui:blocks/background-task-surface/wrappers/react.tsx` and `fui:blocks/background-task-surface/wrappers/vue.ts`;
   wire the two new `exports` subpaths into `fui:blocks/package.json`.
5. Add `fui:blocks/README.md` (new) and update `fui:plugs/README.md`'s install section — both must show
   `npm install @frontierui/blocks @frontierui/plugs @webeverything/contracts` (no sibling checkout, no
   workspace alias) plus one worked import of `@frontierui/blocks/background-task-surface` and its
   `.../react` / `.../vue` wrapper subpaths.
6. Add `fui:.github/workflows/publish-fui-packages.yml` per the Interfaces shape.
7. `npm run check:standards` in the FUI repo (locus gate) — 0 errors.
8. Re-run the same `grep -rlE "from ['\"]@webeverything/" plugs --include="*.ts" | grep -v __tests__` sweep
   this prep used, against whatever the tree looks like at build time, to confirm no OTHER `fui:plugs` subpath
   picked up a new unpublished-module dependency since this prep — the only re-verification this card asks the
   builder to redo, because prep and build may be separated in time.
9. Land the above as one PR (nothing here is destructive — see Delivery shape).
10. **Human-only, after landing:** add `NPM_TOKEN` to the frontierui repo secrets; run the workflow with
    `dry-run:false` (or push the version tag) to actually publish both packages. Clears the `humanGate`.
11. **Human-or-agent, after #10:** from a clean scratch directory (no sibling repo checkout), run
    `npm install @frontierui/blocks @frontierui/plugs @webeverything/contracts` and import
    `@frontierui/blocks/background-task-surface` plus its two wrapper subpaths — the literal "no
    constellation-insider support" acceptance test #2089 names. Record the result; if it fails, the `humanGate`
    is not actually clear yet regardless of what got published.

## Done when

- `fui:blocks/package.json` and `fui:plugs/package.json` carry the config in Interfaces (verifiable by reading
  the files — no publish required).
- `npm pack --dry-run` in both `fui:blocks/` and `fui:plugs/` packs exactly the files their (narrowed)
  `exports` maps reference, and nothing under `__tests__`/`*.test.ts` (agent-runnable now, no credentials
  needed).
- `fui:blocks/background-task-surface/wrappers/react.tsx` and `fui:blocks/background-task-surface/wrappers/vue.ts`
  exist, are exported, and re-running
  `fui:scripts/gen-pilot-wrappers.mjs` reproduces them byte-for-byte (no drift).
- `fui:blocks/README.md` and `fui:plugs/README.md` document the npm-install path and one working wrapper
  import.
- `fui:.github/workflows/publish-fui-packages.yml` exists and its shape matches
  `we:.github/workflows/publish-contracts.yml`'s proven pattern (steps present; `workflow_dispatch` dry-run
  does not require a live `NPM_TOKEN` to be well-formed, though it will fail on the actual `npm publish
  --dry-run` auth call until the secret exists).
- `npm run check:standards` is green in the frontierui repo.
- **Gated on the human step:** `npm view @frontierui/blocks version` and `npm view @frontierui/plugs version`
  resolve (not `E404`); the clean-scratch-directory install + import test in Task 11 passes.

## Delivery shape

Lands **incrementally**, as one normal PR to FUI `main` — nothing in tasks 1–9 is destructive or publishes
anything (`private:true` → removed doesn't itself publish; the workflow only fires on an explicit human
dispatch or tag push). No feature branch or big-bang landing is needed. The one genuinely non-reversible,
non-incremental step is the human `npm publish` act (task 10) — that is the `humanGate` residual by design,
identical in shape to #907, not a delivery-shape concern for the PR itself.
