---
bornAs: x2a76pj
kind: story
size: 2
parent: "2612"
status: open
dateOpened: "2026-08-02"
dateStarted: "2026-08-15"
tags: [drain, conveyor, gate, cross-repo, argv, tech-debt]
scope:
  - we:scripts/lib/reconcile-predicate.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/__tests__/reconcile-predicate.test.mjs
  - plateau-app:tools/drain-daemon/lib.mjs
  - plateau-app:tools/drain-daemon/lib.test.mjs
  - plateau-app:vitest.config.ts
---

# A cross-repo argv guard must parse flags the way the receiving CLI parses them

A guard that inspects an argv it is about to hand to another repo's CLI must decide using that CLI's own flag semantics, not a hand-written string match. Today `childPassEnforcesHoldInvariant` in `plateau-app:tools/drain-daemon/lib.mjs` (#2832) tests `args.includes('--no-reconcile-labels')` and `x.startsWith('--label=')`, while `we:scripts/merge-ai-prs.mjs` parses `--name=value` into a flags object and tests truthiness. The two disagree on exactly the inputs the guard exists to reject, so the guard can pass an argv whose reconcile never runs.

## Where this came from

Filed out of the human review of **plateau-app PR #136** (the plateau-app half of #2832). The PR was accepted —
the diff changes no live behaviour — but the review found the new guard is weaker than the invariant it advertises.

## Verification against the live tree (2026-08-15, re-grounded — the card's own file:line refs had drifted)

`we:scripts/merge-ai-prs.mjs` has moved since this card was filed (dateOpened 2026-08-02): the module-scope argv
reduction is now `we:scripts/merge-ai-prs.mjs:137-138` (not `:133`) and `RECONCILE` is computed at
`we:scripts/merge-ai-prs.mjs:2465` (not `:1334`) — the regex and the predicate are byte-identical to what the
card quotes, only the line numbers shifted:

```js
// we:scripts/merge-ai-prs.mjs:137-138 (module scope)
const flags = {};
for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }
// we:scripts/merge-ai-prs.mjs:2408
const label = typeof flags.label === 'string' ? flags.label : null;
// we:scripts/merge-ai-prs.mjs:2465
const RECONCILE = label && !flags['no-reconcile-labels'];
```

`plateau-app:tools/drain-daemon/lib.mjs` (confirmed at `plateau-app:` `main` 2e668700, unmoved by the 2 commits
`main` picked up between fetch and lane-adopt — neither touches `plateau-app:tools/drain-daemon/` or
`plateau-app:vitest.config.ts`) still has exactly the two-boolean string match the card names:

```js
// plateau-app:tools/drain-daemon/lib.mjs:86-91
export function childPassEnforcesHoldInvariant(args) {
  const a = Array.isArray(args) ? args : [];
  const labelScoped = a.some((x) => typeof x === 'string' && x.startsWith('--label='));
  const reconcileDisabled = a.includes('--no-reconcile-labels');
  return labelScoped && !reconcileDisabled;
}
```

**Both named divergences are confirmed live** by direct inspection (no mutation needed — the code is read
directly, not inferred): `--no-reconcile-labels=1` fails `a.includes('--no-reconcile-labels')` (exact-string
match, no `=value` form) while it sets `flags['no-reconcile-labels']` to the truthy string `'1'` on the WE side
— divergence 1 is live. `buildPassArgs({ owner, label: '' })` would emit `--label=`, which passes
`x.startsWith('--label=')` while `flags.label === ''` is falsy on the WE side (`RECONCILE` false) — divergence 2
is confirmed **latent, not live**: `plateau-app:tools/drain-daemon/cli.mjs:251,294` and
`plateau-app:tools/drain-daemon/daemon.mjs:228` are the only call sites of `buildPassArgs`, and none passes
`label` (grepped `buildPassArgs(` across the whole `plateau-app` tree — 4 real call sites, the rest are the test
file), so today's argv always carries the default `--label=ready-to-merge` and never an empty label.

**The "assert is unreachable" claim is also independently re-verified**: `buildPassArgs` builds `argv` two lines
above its own `childPassEnforcesHoldInvariant(argv)` call, always with a `--label=<value>` token (default or
caller-supplied) and never `--no-reconcile-labels`, so the throw branch has zero live input that reaches it. The
existing test at `plateau-app:tools/drain-daemon/lib.test.mjs:78-79` proves this by construction — it appends
`'--no-reconcile-labels'` to `buildPassArgs(...)`'s *output* rather than calling `buildPassArgs` with an input
that would produce it, exactly the pattern #2860 was filed to catch gate-wide.

## A load-bearing probe this prep ran that changes the design: a naive cross-repo import breaks CI

The obvious reading of "give the daemon the child's parse" is: have `plateau-app` import a WE-exported
parse/predicate function directly, either at runtime or in the contract test. **Probed, and it does not work
for the direct route:**

- `plateau-app`'s CI (`plateau-app:.github/workflows/ci.yml:50-72`) checks out `chalbert/web-everything` as a
  build-time **sibling directory** (`$GITHUB_WORKSPACE/webeverything`, no `npm ci` run inside it) — the same
  layout `plateau-app:vitest.config.ts:10` already uses for `weRoot = resolve(__dirname, '../webeverything')`
  and several existing `@webeverything/*` aliases (e.g. `plateau-app:vitest.config.ts:46-83`). So a **sibling
  import for a test is an established, working pattern** — verified by the existing aliased contract tests
  (e.g. `plateau-app:src/project-config-discovery/discovery.test.ts:8`, `import { extendsFlavor, ... } from
  '@webeverything/config'`).
- **But `we:scripts/merge-ai-prs.mjs` itself is not safe to import that way.** Traced its full transitive
  import graph (23 files, all relative/`node:` specifiers except one): `we:scripts/lib/review-escalation.mjs:17`
  does `import MarkdownIt from 'markdown-it';` — a real npm package. `webeverything/node_modules` is never
  installed in `plateau-app`'s CI job (only `plateau-app` and `frontierui` get `npm ci`), and Node's ESM bare-
  specifier resolution climbs the *file's own* ancestor directories (`webeverything/scripts/lib/` →
  `webeverything/scripts/` → `webeverything/` → `$GITHUB_WORKSPACE/`), never sideways into
  `plateau-app/node_modules` — confirmed empirically: `webeverything/node_modules/markdown-it` exists locally,
  `plateau-app/node_modules/markdown-it` also happens to exist locally (an unrelated `plateau-app` dependency),
  which would make a naive direct import of `we:scripts/merge-ai-prs.mjs` **pass locally by coincidence and
  fail in CI** the moment `ERR_MODULE_NOT_FOUND` fires against the never-installed WE sibling `node_modules`.
  Importing `we:scripts/merge-ai-prs.mjs` wholesale from a `plateau-app` test is not viable.
- Symmetrically, a WE-side contract test cannot import `plateau-app`'s `buildPassArgs` either:
  `we:.github/workflows/ci.yml` checks out `frontierui` as a sibling (`we:.github/workflows/ci.yml:87-93`) but
  **never `plateau-app`** — and WE depending on a product repo would also invert the constellation's own
  layering (WE is the standard layer; `plateau-app` is the product layer that depends on WE, never the reverse
  — memory rule #96).

**Decided design, consequently:** extract the parse+predicate into a new, dependency-free leaf module in WE
(zero imports of its own) that is safe to import cross-repo, and keep the daemon's production predicate as a
**local, structurally-identical mirror** (not a live cross-repo import at runtime — the daemon's own header
comment, `plateau-app:tools/drain-daemon/lib.mjs:7-11`, states this module is deliberately dependency-free and
pure; a runtime import of a hardcoded `../../../webeverything` sibling path would also be wrong operationally,
since the daemon's real WE dependency is the configurable `cfg.weClone`/`cfg.wePrimary`, not a fixed sibling —
`plateau-app:tools/drain-daemon/lib.mjs:36-50`). The mirror is pinned to the source by a **cross-repo contract
test** that imports the real WE leaf module via the sibling alias and asserts the two predicates agree on real
`buildPassArgs(...)` output — this is what makes "one expression of the semantics" true in practice: one
canonical implementation (WE) plus one verified-equivalent mirror (plateau-app), continuously checked, instead
of two independently-evolving strings.

## Decided design

**WE side — one new leaf module, `we:scripts/lib/reconcile-predicate.mjs`, zero imports:**

```js
/**
 * @file scripts/lib/reconcile-predicate.mjs
 * @description #2859 — the ONE canonical argv→flags reduction and reconcile predicate `merge-ai-prs.mjs` uses,
 *   pulled out to a dependency-free leaf (no imports of its own — not even node: builtins) so it is SAFE for
 *   `plateau-app:tools/drain-daemon/lib.test.mjs` to import cross-repo off the sibling WE checkout that repo's
 *   CI already provides (`plateau-app:vitest.config.ts`'s `weRoot`/`@webeverything/*` aliases) without pulling
 *   in `merge-ai-prs.mjs`'s full graph, which transitively imports the `markdown-it` npm package via
 *   `scripts/lib/review-escalation.mjs` — a dependency `plateau-app`'s CI does not install for the WE sibling
 *   checkout (verified during #2859 prep: `ERR_MODULE_NOT_FOUND` in CI, though it happens to resolve locally
 *   by an unrelated coincidental `plateau-app` devDependency).
 */

/**
 * Parse a raw argv into a flags object, exactly as `merge-ai-prs.mjs` does at its module scope. A bare
 * `--name` records `true`; a valued `--name=value` records the raw string `value`. Non-matching tokens
 * (a script path, a positional) are silently skipped. Pure.
 * @param {string[]} argv
 * @returns {Record<string, true|string>}
 */
export function parseArgvFlags(argv) {
  const flags = {};
  for (const a of Array.isArray(argv) ? argv : []) {
    const m = typeof a === 'string' && a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

/**
 * Would a `merge-ai-prs.mjs` pass built from this argv run the label/hold reconcile? Mirrors
 * `runCli`'s own `RECONCILE = label && !flags['no-reconcile-labels']` (`merge-ai-prs.mjs:2465`), except this
 * is a pure function of an arbitrary argv (not `process.argv`) so it is directly callable by a test or a
 * cross-repo caller. A present-but-EMPTY `--label=` is treated as "no label" (`Boolean(label)`, not `label`),
 * closing the #2859 divergence where a token being present and its value being meaningful were conflated.
 * @param {string[]} argv
 * @returns {boolean}
 */
export function reconcileWouldRunFor(argv) {
  const flags = parseArgvFlags(argv);
  const label = typeof flags.label === 'string' ? flags.label : null;
  return Boolean(label) && !flags['no-reconcile-labels'];
}
```

`we:scripts/merge-ai-prs.mjs` wires to it — TWO edits, both replacing an inline reduction with a call to the
now-single source, no behaviour change to anything except `RECONCILE`'s type (was possibly a non-empty string
via `label && ...`, now a strict boolean — confirmed safe: every one of `RECONCILE`'s 4 usage sites,
`we:scripts/merge-ai-prs.mjs:2725,2818,2922,3486`, uses it only in `if (!RECONCILE)` / `RECONCILE ? … : …`
boolean positions):

```js
// we:scripts/merge-ai-prs.mjs — add to the existing named-import line from './lib/...' (or its own import line)
import { parseArgvFlags, reconcileWouldRunFor } from './lib/reconcile-predicate.mjs';

// we:scripts/merge-ai-prs.mjs:137-138 — replace the inline loop
const flags = parseArgvFlags(argv); // #2859 — single source: scripts/lib/reconcile-predicate.mjs

// we:scripts/merge-ai-prs.mjs:2465 — replace the inline predicate
const RECONCILE = reconcileWouldRunFor(argv);
```

**plateau-app side — three edits to `plateau-app:tools/drain-daemon/lib.mjs`:**

1. Validate `label` in `buildPassArgs` (closes divergence 2 at the source, makes the fail-closed assert
   reachable — the #2860 precondition):

```js
export function buildPassArgs({ owner = null, primary = null, dryRun = false, label = DEFAULTS.label } = {}) {
  if (!owner && !dryRun) throw new Error('buildPassArgs: owner is required (the daemon lease owner id)');
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error(`buildPassArgs: label must be a non-empty string (got ${JSON.stringify(label)})`);
  }
  const argv = [ /* unchanged */ ];
  …
}
```

2. Rewrite `childPassEnforcesHoldInvariant` to the SAME reduction + predicate as
   `we:scripts/lib/reconcile-predicate.mjs`, byte-structurally, instead of the two-boolean string match:

```js
/**
 * WE #2832/#2859 — mirrors `we:scripts/lib/reconcile-predicate.mjs`'s `reconcileWouldRunFor` EXACTLY (same
 * `/^--([^=]+)(?:=(.*))?$/` reduction, same `Boolean(label) && !flags['no-reconcile-labels']` predicate) —
 * NOT the child CLI's argv restated as a weaker string match (the #2859 defect this closes: a valued
 * negation like `--no-reconcile-labels=1`/`=false`, or an empty `--label=`, used to slip past
 * `.includes`/`.startsWith`). Kept as a LOCAL, dependency-free mirror rather than a live cross-repo import
 * (this module is deliberately pure/no-imports, and the daemon's real WE dependency is the configurable
 * `cfg.weClone`, not a fixed sibling path) — pinned to the source by the cross-repo contract test below.
 * @param {string[]} args - the child-pass argv (after `node`)
 * @returns {boolean} true iff the pass will run the ready-to-merge/hold reconcile
 */
export function childPassEnforcesHoldInvariant(args) {
  const flags = {};
  for (const a of Array.isArray(args) ? args : []) {
    const m = typeof a === 'string' && a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  const label = typeof flags.label === 'string' ? flags.label : null;
  return Boolean(label) && !flags['no-reconcile-labels'];
}
```

   (Verified against every existing assertion in `plateau-app:tools/drain-daemon/lib.test.mjs:38-80` by hand —
   all 8 pass unchanged under the new body: label-scoped+no-negation → true; `--no-reconcile-labels` bare →
   false; no `--label=` → false; `null`/`undefined` → false, no throw. It additionally now returns `false` for
   `--no-reconcile-labels=1`/`=true`/`=false` and for `--label=`, which it wrongly returned `true` for before.)

3. Add the WE sibling alias, `plateau-app:vitest.config.ts` (inside the existing `resolve.alias` block, beside
   the other `@webeverything/*` entries, using the already-defined `weRoot`):

```ts
'@webeverything/reconcile-predicate': join(weRoot, 'scripts/lib/reconcile-predicate.mjs'),
```

**Cross-repo contract test — `plateau-app:tools/drain-daemon/lib.test.mjs`** (satisfies the card's acceptance
literally: real `buildPassArgs` output through the real WE parser, not a restated shape):

```js
import { reconcileWouldRunFor } from '@webeverything/reconcile-predicate';
// … existing imports unchanged …

describe('drain-daemon — #2859 cross-repo reconcile-predicate contract', () => {
  it('buildPassArgs output enforces the reconcile under the REAL WE sweep parser', () => {
    expect(reconcileWouldRunFor(buildPassArgs({ owner: 'o', primary: '/we' }))).toBe(true);
    expect(reconcileWouldRunFor(buildPassArgs({ owner: 'o' }))).toBe(true);
    expect(reconcileWouldRunFor(buildPassArgs({ dryRun: true }))).toBe(true);
  });
  it('childPassEnforcesHoldInvariant agrees with the REAL WE predicate on buildPassArgs output — the pin', () => {
    for (const args of [buildPassArgs({ owner: 'o', primary: '/we' }), buildPassArgs({ owner: 'o' }), buildPassArgs({ dryRun: true })]) {
      expect(childPassEnforcesHoldInvariant(args)).toBe(reconcileWouldRunFor(args));
    }
  });
  it('the two named divergences: a valued negation and an empty label are both closed under the real parser', () => {
    const withValuedNegation = [...buildPassArgs({ owner: 'o' }), '--no-reconcile-labels=1'];
    expect(reconcileWouldRunFor(withValuedNegation)).toBe(false);
    expect(childPassEnforcesHoldInvariant(withValuedNegation)).toBe(false);
    expect(reconcileWouldRunFor(['scripts/merge-ai-prs.mjs', '--label='])).toBe(false);
  });
});
```

This is a REAL pin, not an illusion of one: if `we:scripts/lib/reconcile-predicate.mjs`'s semantics drift, this
test's first `it()` reddens because it calls the real function, not a copy. If `childPassEnforcesHoldInvariant`'s
local mirror drifts from it, the second `it()` reddens because it compares the two live.

## Task 4 from the original card — decided: do not build the deterministic gate here

The card's "consider a `check:standards` rule flagging ad-hoc child-CLI flag inspection" is explicitly
conditional: "worth it only if a sweep finds more than this one site." Ran that sweep during prep —
`plateau-app:tools/drain-daemon/lib.mjs`'s two other argv-building exports, `buildReviewDetailArgs`
(`plateau-app:tools/drain-daemon/lib.mjs:98-101`) and `buildSetLabelArgs`
(`plateau-app:tools/drain-daemon/lib.mjs:108-119`), validate their OWN inputs (`pr`, `repo`, `to` — positive
integer, `owner/name` shape, allow-listed verdict) and throw on bad input; neither inspects an argv it received
*back* against another CLI's truthy/falsy flag semantics the way `childPassEnforcesHoldInvariant` does.
`plateau-app:tools/drain-daemon/cli.mjs`'s own `.startsWith('--')` uses
(`plateau-app:tools/drain-daemon/cli.mjs:78,382-513`) are that file parsing **its own** dispatch args, a
same-repo, self-consistent concern, not the cross-repo-semantics-divergence class this card is about. **One
site found, not more than one** — so per the card's own condition, this item does not add the gate. Not a
buried fork: stating it here so a future sweep that finds a second site has the reasoning to build on rather
than re-deriving it.

## Interfaces and protocol

- `parseArgvFlags(argv: string[]): Record<string, true|string>` — new, WE, pure, zero imports.
- `reconcileWouldRunFor(argv: string[]): boolean` — new, WE, pure, zero imports. Called with a raw argv
  (`process.argv.slice(2)` shape, OR `buildPassArgs()`'s return value which additionally carries the leading
  script-path token — safe either way, since the regex never matches a non-`--`-prefixed token).
- `buildPassArgs({ owner, primary, dryRun, label }): string[]` — existing plateau-app export, behaviour change:
  now throws `buildPassArgs: label must be a non-empty string (got ...)` for a non-string or blank/whitespace-only
  `label` (previously accepted `''` silently). No caller passes `label` today (checked:
  `plateau-app:tools/drain-daemon/cli.mjs:251,294`, `plateau-app:tools/drain-daemon/daemon.mjs:228`, the 4 real
  call sites), so this is a pure narrowing with zero behaviour change for every live caller.
- `childPassEnforcesHoldInvariant(args: string[]): boolean` — existing plateau-app export, behaviour change:
  now returns `false` (previously `true`, the bug) for `--no-reconcile-labels=<anything>` and for a present-but-
  empty `--label=`. Every existing test assertion (`plateau-app:tools/drain-daemon/lib.test.mjs:38-80`) is
  unchanged under the new body (hand-verified above).
- New vitest alias `@webeverything/reconcile-predicate` → `we:scripts/lib/reconcile-predicate.mjs` (resolved via
  the existing `weRoot`) added to `plateau-app:vitest.config.ts`'s `resolve.alias`, resolved only at test time
  (no production/runtime path touches it).

## Tasks

1. Create `we:scripts/lib/reconcile-predicate.mjs` (`parseArgvFlags`, `reconcileWouldRunFor`, zero imports).
2. Add `we:scripts/lib/__tests__/reconcile-predicate.test.mjs` — unit-test both exports directly: bare vs.
   valued vs. non-flag-token parsing; `reconcileWouldRunFor` true/false matrix covering label present/absent/
   empty crossed with no-negation/bare-negation/valued-negation (`=1`, `=true`, `=false`).
3. Wire `we:scripts/merge-ai-prs.mjs`: import the two functions; replace the module-scope inline reduction
   (`we:scripts/merge-ai-prs.mjs:137-138`) with `parseArgvFlags(argv)`; replace the `RECONCILE` line
   (`we:scripts/merge-ai-prs.mjs:2465`) with `reconcileWouldRunFor(argv)`. Run the existing
   `we:scripts/__tests__/merge-ai-prs.test.mjs` suite — no behaviour change expected (RECONCILE's 4 usage sites
   are all boolean-position).
4. Land the WE half first (see Delivery shape) — it is fully self-contained and does not reference plateau-app.
5. `plateau-app:` add the `label` validation to `buildPassArgs`.
6. `plateau-app:` rewrite `childPassEnforcesHoldInvariant` to the mirrored reduction+predicate.
7. Add the `@webeverything/reconcile-predicate` alias to `plateau-app:vitest.config.ts`.
8. Add the cross-repo contract tests to `plateau-app:tools/drain-daemon/lib.test.mjs` (three new `it()`s
   under a new `describe('drain-daemon — #2859 cross-repo reconcile-predicate contract', ...)`), plus two new
   `buildPassArgs` cases: `{ owner: 'o', label: '' }` throws, `{ owner: 'o', label: '   ' }` throws.
9. Run `plateau-app`'s `npm run test` (vitest) locally against the just-merged WE `main` to confirm the sibling
   import resolves before opening the plateau-app PR.

## Delivery shape

**Two PRs, sequenced WE-first — not incremental within a repo, but a deliberate two-step landing across repos.**
This is the OPPOSITE of this constellation's usual "impl-first/WE-last" couple convention
(`we:scripts/merge-ai-prs.mjs:5-6`), and that reversal is load-bearing, not a style choice: `plateau-app`'s CI
checks out WE at its **default branch** (`plateau-app:.github/workflows/ci.yml:56-60`, no `ref:` override, no
matching-branch fallback), so `plateau-app`'s new `@webeverything/reconcile-predicate` alias cannot resolve
`we:scripts/lib/reconcile-predicate.mjs` in CI until that file exists on WE `main`. Sequence:

1. Land the WE PR (tasks 1-3) — self-contained, touches no plateau-app file, passes `check:standards` +
   `npm run test:unit` standalone, no cross-repo dependency in either direction.
2. Once merged to WE `main`, open the plateau-app PR (tasks 5-8) — its CI now resolves the new sibling file.

Within each repo the change is one piece (small, mechanically dependent edits across 2-3 files); it is the
cross-repo ORDER, not either repo's internal diff, that must not be collapsed.

## Done when

- `buildPassArgs({ owner: 'o', label: '' })` throws `/label/`; `buildPassArgs({ owner: 'o', label: '   ' })`
  throws `/label/`; `buildPassArgs({ owner: 'o' })` still builds (unchanged default).
- `childPassEnforcesHoldInvariant` returns `false` for a label-scoped argv carrying `--no-reconcile-labels=1`,
  and likewise for the `=true`/`=false` spellings — reddening if the predicate reverts to
  `.includes('--no-reconcile-labels')` (exact-string match).
- `childPassEnforcesHoldInvariant` returns `false` for an argv of
  ```js
  ['scripts/merge-ai-prs.mjs', '--label=']
  ```
  (present-but-empty label) — reddening if the predicate reverts to `.startsWith('--label=')` (presence-only
  match).
- The cross-repo contract test (`plateau-app:tools/drain-daemon/lib.test.mjs`, `describe('... #2859 ...')`)
  imports the REAL `we:scripts/lib/reconcile-predicate.mjs` off the sibling checkout and asserts
  `reconcileWouldRunFor(buildPassArgs(...))` is `true` for every real call shape, and that
  `childPassEnforcesHoldInvariant` agrees with it — reddening if either repo's predicate drifts from the other,
  not just if either breaks in isolation.
- `we:scripts/lib/reconcile-predicate.mjs`'s own unit tests redden if the regex, the empty-label handling
  (`Boolean(label)` vs `label`), or the negation check is mutated.
- `npm run check:standards` is 0 errors in `we:` on the live repo with the wiring in place.
- `plateau-app`'s `npm run test` (vitest) is green with the new alias, the rewritten guard, and the new
  cross-repo describe block.

## Progress

- **Status:** active — WE half (tasks 1-3 of the card's Delivery shape) built and landing; plateau-app half
  (tasks 5-8) NOT started — out of scope for a `we:`-only lane.
- **Branch:** `lane/build-2859` (web-everything), landed via `we:scripts/pr-land.mjs --no-wait`.
- **Done:**
  - `we:scripts/lib/reconcile-predicate.mjs` created — `parseArgvFlags`, `reconcileWouldRunFor`, zero imports,
    byte-identical to the card's decided design.
  - `we:scripts/lib/__tests__/reconcile-predicate.test.mjs` created — parse (bare/valued/empty/non-flag/repeat)
    + `reconcileWouldRunFor` true/false matrix (absent/empty label × no-negation/bare/`=1`/`=true`/`=false`).
  - `we:scripts/merge-ai-prs.mjs` wired: import added; the module-scope inline reduction (was line 137-138)
    now calls `parseArgvFlags(argv)`; the `RECONCILE` line (was line 2465, now 2468 after the import lines)
    now calls `reconcileWouldRunFor(argv)`. No behaviour change confirmed — all 4 `RECONCILE` usage sites are
    boolean positions.
  - Gate green: `npm run check:standards` 0 errors (unchanged warning set, none touching the new file);
    `npx vitest run we:scripts/lib/__tests__/reconcile-predicate.test.mjs we:scripts/__tests__/merge-ai-prs.test.mjs`
    — 401 passed (14 new + 387 existing, all unchanged).
- **Next:** open a `plateau-app` lane and do tasks 5-8 — `buildPassArgs` label validation,
  `childPassEnforcesHoldInvariant` rewrite to the mirrored reduction+predicate, the
  `@webeverything/reconcile-predicate` vitest alias, and the cross-repo contract `describe()` block in
  `plateau-app:tools/drain-daemon/lib.test.mjs` — only startable once this WE PR is merged to `main` (the
  card's own sequencing: `plateau-app` CI resolves the WE sibling at its default branch, no `ref:` override).
- **Notes:** this item's own "Verification against the live tree" section already re-confirmed both line
  refs and the two named divergences live as of 2026-08-15 — no re-grounding needed before resuming.
