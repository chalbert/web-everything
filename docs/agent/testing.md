# Testing — Three-Tier Strategy

> Tier-1 reference. Read when writing or changing tests.

## Proof-based verification — observe before you claim

The first rule of verifying anything here is **observe the real running system; don't reason about
what it probably does.** A diagnosis is a *finding* backed by output, not a plausible hunch. This
applies to every "does it work / why is it broken" moment, not just to written test files.

**The discipline:**
- **Reproduce against the live system first.** Probe what the user actually sees: `curl` the served
  HTML, drive a real browser (Playwright — see the recipe below), run the gate, `grep` the real
  output. Let the result name the cause.
  - **Ad-hoc Playwright recipe.** Node ESM resolves `import { chromium } from 'playwright'` relative
    to the *script file's* directory, **not** the cwd — so a script in `/tmp` fails even when you
    launch it from the repo root. Write the throwaway script **inside the repo tree** (e.g. a
    git-ignored `./.probe.mjs`), `node ./.probe.mjs`, then delete it. The first port is whatever the
    user named; otherwise probe 3000/8080 (WE) and 6000/6080 (FUI). Always capture `page.on('console')`
    + `page.on('pageerror')` so silent client-side failures surface. For "is the current page marked?"
    questions, dump each nav link's `aria-current` and class — don't eyeball the screenshot.
- **The render layer is not the server output.** A page can be in the DOM yet invisible because of
  client-side JS (a filter adding `is-filtered-out`, `display:none`) or persisted `localStorage`
  state. `curl` proves what the server *sent*; only a real browser proves what the user *sees*. If
  the claim is about visibility/interaction, the browser is the only valid probe.
- **"Cache / stale tab / hard-reload / it's just uncommitted" are hypotheses, never diagnoses.**
  They are the convenient explanations that *feel* right without a test. Rule each in or out by
  observation before you offer it. (Eleventy renders from disk regardless of git state — uncommitted
  is almost never why something is "missing"; the real cause is usually a render/wiring bug. The
  `/backlog/` type-filter once hid every `type: review` item this exact way — a one-`curl` find that
  three untested guesses missed.)
- **A probe can lie too.** If you guessed a selector, storage key, port, or fixture, the run may be
  inconclusive (it tested the wrong thing and "passed"). Say so — an inconclusive run is not proof,
  and presenting it as one repeats the original sin one level down.
- **When you fix a class of bug, add a gate guard and prove the guard fires** — reintroduce the bug,
  watch it error, restore. An untested guard is itself an untested claim. (Worked example: the
  type-filter-coverage guard in `scripts/check-standards.mjs` §10.) Note `check:standards` does **not**
  run the 11ty build, so render-layer bugs stay green-invisible — smoke template changes with a real
  build/probe too.

### Hard rule — every verification must be agent-runnable; if it needs a real runtime, the harness is a dependency

A verification item is only *real* if an agent can **reproduce its proof mechanically** — run a
command, observe the result. "Verify end-to-end in a real browser / a real extension host / a real
device" is **not** a finished verification when no harness exists to drive that runtime headlessly;
it's a claim waiting on a human, and "I eyeballed it / I reasoned it works" is exactly the untested
guess the discipline above forbids.

So, as a **hard rule**:

- **If a verification's proof needs a runtime the standard tiers can't reach** — a real service worker
  / Background Fetch / push (happy-dom has none), a real VS Code Extension Development Host (Vitest
  never loads one), a real device sensor, a GPU, a secure-context-only API — then **the test harness
  that makes that runtime agent-runnable is its own backlog item, and the verification item carries a
  `blockedBy` edge to it.** Build the harness first; verify against it second.
- **Never claim a real-runtime verification you did not mechanically observe.** If part of a claim
  genuinely cannot be driven even with the harness (e.g. a network transfer that only survives in a
  flagged real profile), say so explicitly and file that residual — an inconclusive run is not proof
  (see "A probe can lie too").
- **The harness card's own DoD is a green sample** in that runtime (a trivial spec going green via the
  lane's command), so the harness itself is proven before anything depends on it.

This is why a card whose only remaining step is "verify in a real X" is **not agent-ready** until its
harness exists: at batch/selection pre-flight it reads as `blocked-in-fact` (a needed gate verified
absent) and the remediation is to scaffold the harness card and add the `blockedBy` edge — not to skip
the item, and never to mark it done off an un-run claim. Worked example: #675 (real SW + Background
Fetch) `blockedBy` #684 (the real-Chromium SW E2E lane); #676 (real extension host) `blockedBy` #685
(the `@vscode/test-electron` host harness).

## Pyramid

| Tier | Pattern | Runner | Env | Purpose |
|------|---------|--------|-----|---------|
| Unit | `*.test.ts` | Vitest | happy-dom | Single class/function, mocked deps |
| Integration | `*.test.ts` | Vitest | happy-dom | Multiple components together |
| E2E | `*.spec.ts` | Playwright (`chromium`) | real browser | User flows on the live demo |
| SW / durable-tier | `*.sw.spec.ts` | Playwright (`chromium-sw`) | real browser, **SW allowed** | Service-worker + Background-Fetch reload-survival |

> **Real-browser service-worker lane (#684).** Vitest runs under happy-dom — **no service
> worker, no Background Fetch** — and the default `chromium` E2E project neither allows SW
> registration nor serves a SW origin. A verification whose proof needs a real runtime (e.g.
> #675's durable-tier reload-survival) must depend on a harness that provides it. The
> `chromium-sw` Playwright project is that harness: it runs `*.sw.spec.ts` in a context with
> `serviceWorkers: 'allow'`, served by the zero-dependency static fixture server at
> `plugs/__tests__/e2e/sw-fixtures/serve.mjs` (http://localhost:3210 — a SW-capable origin
> sending `Service-Worker-Allowed: /`). Drive reload-survival via the reusable
> `sw-fixtures/rehydrate-helper.ts` (`assertSurvivesHardReload(page, task)`): register → arm →
> hard-reload → assert the worker re-hydrated. The fixture's Background-Fetch feature-detect
> honours `window.__forceNoBgFetch`, so the degraded (navigation-guard re-arm) branch is
> exercised deterministically. **Residual manual step:** a true Background-Fetch *network*
> transfer surviving reload may need a flagged/real Chromium profile — drive what headless can,
> document the rest as the one manual check.

### Locations
```
plugs/{module}/__tests__/unit/*.test.ts
plugs/{module}/__tests__/integration/*.test.ts
blocks/__tests__/unit/{group}/*.test.ts
blocks/__tests__/integration/*.test.ts
plugs/__tests__/e2e/*.spec.ts
plugs/__tests__/e2e/*.sw.spec.ts          # real-browser SW lane (chromium-sw project)
plugs/__tests__/e2e/sw-fixtures/          # static fixture server + SW/page + rehydrate-helper
```

## What to test where

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| New class/function | Yes | Maybe | No |
| Bug fix | Yes (reproduce) | If cross-component | If user-visible |
| New public method | Yes | If uses injectors | No |
| Parser | Yes | Yes (with registry) | No |
| Attribute | Yes | Yes (with DOM) | Yes (user flow) |
| Store | Yes | Maybe | If in demo |
| Demo feature | No | No | Yes |

## Quality guidelines
1. Test behavior, not implementation.
2. One concept per test; descriptive names (`should notify listeners on setItem`).
3. Arrange-Act-Assert. Reset state in `beforeEach`/`afterEach`.
4. Mock external deps with `vi.fn()` / spies.

## Coverage
Enforced in `vitest.config.ts` — **80% minimum** for lines, functions, branches, statements over `plugs/**/*.ts` and `blocks/**/*.ts`. Excluded: `**/index.ts`, `**/__tests__/**`, `*.test.ts`, `*.spec.ts`, config files.

## Commands
```bash
npm test                            # all unit + integration
npx vitest run blocks/              # a directory
npx vitest run path/to/file.test.ts # one file
npx vitest watch                    # watch mode
npm start                           # dev server (needed for E2E)
npm run test:integration            # E2E (Playwright)
npx vitest run --coverage           # coverage report
```

## Developing & manually testing in a lane

Every edit — including an ad-hoc "just fix this one thing" — happens in an **isolated lane clone**, never the main checkout (#2123; the writer model in [platform-decisions.md#pr-flow-rollout-mechanism](platform-decisions.md#pr-flow-rollout-mechanism)). The lane trigger is *making an edit*, not *running a command*. The main checkout stays the human's — its dev server on `:3000`/`:8080` is theirs; don't build or serve into it.

**1 — Pick or provision a lane** (persistent clone pool under `~/workspace/.lanes/<repo>/lane-N`, git objects shared via `--reference`, own HEAD):
```bash
node scripts/lane-pool.mjs status --json     # per-lane path / head / clean / deps
node scripts/lane-pool.mjs provision --count=N   # create/refresh N lanes
```
Use a `clean` lane. `git -C <lane> reset --hard <sha>` to check out any local commit (shared objects — no fetch needed, works for un-pushed HEADs).

**2 — Boot the lane's OWN dev pair.** The `.env.local` port pair is **not auto-loaded** — export it first, or the servers fall back to the main band (`:3000`/`:8080`) and collide:
```bash
cd ~/workspace/.lanes/web-everything/lane-N
set -a; source .env.local; set +a        # sets WE_VITE_PORT / WE_ELEVENTY_PORT
npm run dev
```
Verify Playwright/curl against **that** lane's `WE_ELEVENTY_PORT` (the 11ty docs site) — not `:8080`.

**3 — The constellation render-siblings (#2166 → #2282 → #2349).** Every WE grid page SSRs through the pinned FUI build-artifact, resolved as a `frontierui` checkout *sibling* of the WE repo root — which a lane clone (`<pool>/lane-N`) has no sibling for, so `build:docs` and the 11ty dev-serve would hard-fail with *"pinned FUI artifact missing at …/.lanes/web-everything/frontierui/dist/tools/component-render/cli.mjs"*. `lane-pool.mjs provision`/`refresh` now provisions **real, pushable git clones** at the pool root (`~/workspace/.lanes/web-everything/frontierui`, `~/workspace/.lanes/web-everything/plateau-app`) — one clone per sibling repo, serving every lane at the same `../<name>` path. Each clone is fetched/reset to `origin/main` and rebuilt via its own `npm run build:tools` (where it has one — FUI does, ~1.2s; plateau-app doesn't, a plain clone is enough). You only need each sibling's PRIMARY checkout to exist locally (it's the source the pool-root clone's `origin` URL is derived from):
```bash
cd ~/workspace/frontierui && npm run build:tools   # optional — the pool-root clone builds its own dist/ on provision/refresh
```
If a sibling's primary checkout is missing entirely, provision warns and skips that sibling (the pool is still usable for non-render work). A pool-root sibling that is DIRTY or AHEAD of its own `origin/main` (real local state, now that it's a pushable clone) is left untouched on refresh, same as a lane (`--force` overrides).

**4 — Known lane limitations.**
- For rendering/screenshots, a **static build is most reliable**: `npx @11ty/eleventy --output=/tmp/site-X --quiet`, then `python3 -m http.server` in that dir. (This is how you diff two commits: build each into its own dir, serve on two ports, screenshot.)
- **Visual baselines**: `tests/visual/rendered-site-visual.spec.ts` (the snapshot-baseline spec, #2236) targets its OWN dedicated, Playwright-booted Eleventy server (`WE_VISUAL_FIXTURE_PORT`, default `:8099`) rendered from the checked-in frozen fixture set (`tests/visual/fixtures/backlog/*.md`, via `WE_VISUAL_FIXTURES=1`) — it needs no `:8080` at all, so it regenerates cleanly from ANY lane with no coordination or collision risk with the main checkout. The sibling `tests/visual/fui-card-cross-origin-render.spec.ts` is a live token-render check (not a snapshot baseline) and still reads `WE_ELEVENTY_PORT` (default `:8080`), so regenerate/run *that* one from a checkout that owns `:8080` (or the lane's own bound port, per step 2 above). To add a new frozen-fixture visual target, see the header comment in `tests/visual/pages.json`.

> **Visual-regression substrate is self-hosted Playwright, in-repo committed `-linux` PNG baselines — no hosted SaaS** (decision #2233, ratified 2026-07-09). The governing rule + rationale + evidence-gated escape hatches (Argos-as-review-UI-only #2233 fork 2; graduate-baselines-off-PNG #1967) live in [platform-decisions.md#visual-regression-substrate](./platform-decisions.md#visual-regression-substrate).

## Web Cases — protocol conformance fixtures
"Web Cases" are the source of truth for protocol conformity: live documentation examples **and** input fixtures for E2E conformance testing.
- **Directory**: `src/cases/<protocol-id>/`
- **Naming**: ordered — `01-registry-standard.html`, `02-edge-case.html`.
- **Format**: raw HTML fragments. ❌ No `<html>`/`<body>`/`div.wrapper`. ✅ Only the directive/component and its direct children.

**Mandatory coverage per protocol:**
1. **Registry Standard** — happy path using valid registry defaults.
2. **Visual Overrides** — inline slot/template customization.
3. **Parameterization** — passing args via attributes (`args-*`).
4. **Reliability** — error handling, timeouts, forgivable failures.
5. **Deferred/Lazy** — interaction with the loading/visibility Intent.
