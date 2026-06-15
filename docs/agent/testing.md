# Testing — Three-Tier Strategy

> Tier-1 reference. Read when writing or changing tests.

## Proof-based verification — observe before you claim

The first rule of verifying anything here is **observe the real running system; don't reason about
what it probably does.** A diagnosis is a *finding* backed by output, not a plausible hunch. This
applies to every "does it work / why is it broken" moment, not just to written test files.

**The discipline:**
- **Reproduce against the live system first.** Probe what the user actually sees: `curl` the served
  HTML, drive a real browser (Playwright — `node` a throwaway script *from the repo root* so
  `playwright` resolves), run the gate, `grep` the real output. Let the result name the cause.
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
| E2E | `*.spec.ts` | Playwright | real browser | User flows on the live demo |

### Locations
```
plugs/{module}/__tests__/unit/*.test.ts
plugs/{module}/__tests__/integration/*.test.ts
blocks/__tests__/unit/{group}/*.test.ts
blocks/__tests__/integration/*.test.ts
plugs/__tests__/e2e/*.spec.ts
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
