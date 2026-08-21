/**
 * @file resolve.test.mjs — the `resolve` declaration (#xrrpfo7), `claim`'s sibling at the close of the
 * lifecycle.
 *
 * THE PROPERTY UNDER TEST is that no path writes a CONTRADICTION. PR #1503's round-1 finding was a decision
 * card whose body said RATIFIED while `status` stayed `open`, leaving four siblings blocked — the close-out
 * failing quietly, with the human-readable half and the machine-readable half disagreeing. Each refusal below
 * is a different way of writing that same kind of state to disk, so each is asserted to REFUSE and to refuse
 * for a NAMED reason a caller can branch on.
 *
 * The `force` cases matter as much as the refusals: a guard that can be stepped over silently is a guard that
 * was not really there. The CLI prints `--force` warnings to stderr, which no caller can act on; these assert
 * the verdict RECORDS what was stepped over.
 *
 * Nothing here touches `fs` or `git` — the reader is a plain function returning a fixture.
 */
import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import {
  planResolve, shapeResolveRead, resolveOperation, RESOLVE_OP, RESOLVE_EFFECT, RESOLVE_REFUSALS,
} from '../resolve.mjs';
import { createResolveReader } from '../resolve-io.mjs';

/** A minimal card body the real `applyTransition` will splice. */
const card = ({ kind = 'story', status = 'active', extra = '' } = {}) =>
  `---\nkind: ${kind}\nstatus: ${status}\ndateOpened: "2026-08-01"\n${extra}---\n\n# A card\n\nBody.\n`;

const read = (over = {}) => shapeResolveRead({
  found: true,
  abs: '/repo/backlog/100-a.md',
  rel: 'backlog/100-a.md',
  id: '100',
  kind: 'story',
  status: 'active',
  content: card(),
  openChildren: [],
  scopeDeclared: true,
  offending: [],
  today: '2026-08-21',
  ...over,
});

const reasonOf = (fn) => { try { fn(); return null; } catch (e) { return e.reason ?? 'threw-without-reason'; } };

describe('the happy path', () => {
  it('splices status + dateResolved and carries graduatedTo through', () => {
    const v = planResolve(read(), { graduatedTo: 'some-entity' });
    expect(v.status).toBe('resolved');
    expect(v.content).toMatch(/status: resolved/);
    expect(v.content).toMatch(/dateResolved: "2026-08-21"/);
    // UNQUOTED — `quoteScalar` only quotes when the value needs it. Asserted as the home actually behaves,
    // checked against `applyTransition` directly rather than assumed from the quoted `dateResolved` above.
    expect(v.content).toMatch(/graduatedTo: some-entity/);
    expect(v.forced).toBe(false);
    expect(v.steppedOver).toEqual([]);
  });
});

describe('no path writes a contradiction', () => {
  it('#658 — an epic with open children REFUSES, and names them', () => {
    const r = read({ kind: 'epic', openChildren: [{ num: '201', status: 'open' }, { num: '202', status: 'active' }] });
    expect(() => planResolve(r)).toThrow(/2 open child slice/);
    expect(() => planResolve(r)).toThrow(/#201/);
    expect(reasonOf(() => planResolve(r))).toBe('open-children');
  });

  it('#658 — an epic whose children are all closed resolves normally', () => {
    // The other half of the guard. Without this, "always refuse for an epic" would pass the test above.
    expect(planResolve(read({ kind: 'epic', openChildren: [] })).status).toBe('resolved');
  });

  it('a wrong status REFUSES — only an in-flight item resolves', () => {
    expect(reasonOf(() => planResolve(read({ status: 'resolved', content: card({ status: 'resolved' }) }))))
      .toBe('not-in-flight');
  });

  it('#911 — a decision with no codifiedIn REFUSES', () => {
    // The ruling would exist only in a card nobody reads. `validateCodifiedIn` decides; this asserts the
    // refusal is mapped onto its own reason rather than the catch-all.
    const r = read({ kind: 'decision', content: card({ kind: 'decision' }) });
    expect(reasonOf(() => planResolve(r))).toBe('uncodified-decision');
  });

  it('#911 — the same decision resolves once codifiedTo is supplied', () => {
    const r = read({ kind: 'decision', content: card({ kind: 'decision' }) });
    const v = planResolve(r, { codifiedTo: 'docs/agent/platform-decisions.md#some-anchor' });
    expect(v.status).toBe('resolved');
    expect(v.content).toMatch(/codifiedIn:/);
  });

  it('#2803 — undeclared presentation drift REFUSES, and names the surfaces', () => {
    const r = read({ scopeDeclared: true, offending: ['src/pages/x.njk', 'src/assets/js/y.js'] });
    expect(() => planResolve(r)).toThrow(/src\/pages\/x\.njk/);
    expect(reasonOf(() => planResolve(r))).toBe('scope-drift');
  });

  it('every refusal reason is in the declared set', () => {
    const cases = [
      read({ kind: 'epic', openChildren: [{ num: '9', status: 'open' }] }),
      read({ status: 'resolved', content: card({ status: 'resolved' }) }),
      read({ kind: 'decision', content: card({ kind: 'decision' }) }),
      read({ offending: ['a.njk'] }),
    ];
    for (const r of cases) expect(RESOLVE_REFUSALS).toContain(reasonOf(() => planResolve(r)));
  });
});

describe('`force` steps over a guard — and the verdict SAYS SO', () => {
  it('records which guard was stepped over, not merely that force was passed', () => {
    // The CLI prints this to stderr today, where no caller can gate on it. A batch close-out that must refuse
    // to proceed over a forced resolve needs it as data.
    const v = planResolve(read({ kind: 'epic', openChildren: [{ num: '201', status: 'open' }] }), { force: true });
    expect(v.status).toBe('resolved');
    expect(v.forced).toBe(true);
    expect(v.steppedOver).toEqual([{ guard: 'open-children', detail: ['#201'] }]);
  });

  it('records BOTH when force steps over two guards at once', () => {
    const v = planResolve(
      read({ kind: 'epic', openChildren: [{ num: '7', status: 'open' }], offending: ['a.njk'] }),
      { force: true },
    );
    expect(v.steppedOver.map((s) => s.guard).sort()).toEqual(['open-children', 'scope-drift']);
  });

  it('force does NOT override the splice-level refusals', () => {
    // #911's codification gate and the status check live inside `applyTransition`, and `--force` never
    // reached them in the CLI either. Asserted so a later "make force consistent" change is a visible break.
    expect(reasonOf(() => planResolve(read({ kind: 'decision', content: card({ kind: 'decision' }) }), { force: true })))
      .toBe('uncodified-decision');
    expect(reasonOf(() => planResolve(read({ status: 'resolved', content: card({ status: 'resolved' }) }), { force: true })))
      .toBe('not-in-flight');
  });
});

describe('"could not check" is not "checked and clean"', () => {
  it('an item with no declared scope passes, and the verdict says the check did not run', () => {
    // #2613 legacy item. Collapsing `scopeDeclared: false` into an empty `offending` would let an unrunnable
    // check read as a clean one — the same line `verify` draws between `unrun` and `pass`.
    const v = planResolve(read({ scopeDeclared: false, offending: [] }));
    expect(v.status).toBe('resolved');
    expect(v.scopeUnchecked).toBe(true);
    expect(v.forced).toBe(false); // it was not stepped over — it never ran
  });

  it('a scope that RAN clean is distinguishable from one that never ran', () => {
    expect(planResolve(read({ scopeDeclared: true, offending: [] })).scopeUnchecked).toBe(false);
  });
});

describe('the read refuses rather than proceeding on nothing', () => {
  it('a ref that resolves to no item throws, naming the ref', () => {
    // Proceeding would reach a plan that reports "nothing to do", which reads as success.
    expect(() => shapeResolveRead({ found: false }, { ref: '999' })).toThrow(/no backlog item resolves for "999"/);
  });

  it('a non-object reader result throws', () => {
    for (const bad of [null, undefined, 'x', 7]) expect(() => shapeResolveRead(bad, { ref: '1' })).toThrow(/not a resolve context/);
  });
});

describe('the declaration end to end', () => {
  it('drives read → plan → write and applies exactly one effect', async () => {
    const registry = createRegistry();
    registry.register(resolveOperation({
      readResolveContext: () => ({
        found: true, abs: '/repo/backlog/100-a.md', rel: 'backlog/100-a.md', id: '100',
        kind: 'story', status: 'active', content: card(), openChildren: [],
        scopeDeclared: true, offending: [], today: '2026-08-21',
      }),
    }));
    const written = [];
    const sinks = { [RESOLVE_EFFECT]: async (p) => { written.push(p); return { rel: p.rel, written: true }; } };

    let run = advanceWhileRunning(startRun({ op: RESOLVE_OP, id: 'run-rs', input: { ref: '100' }, registry }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));

    expect(written).toHaveLength(1);
    expect(written[0].rel).toBe('backlog/100-a.md');
    expect(written[0].content).toMatch(/status: resolved/);
    // The bytes handed to the sink are the ones `plan` computed — the sink decides nothing.
    expect(written[0].content).toBe(run.verdict.content);
  });

  it('refuses to build without an injected reader', () => {
    expect(() => resolveOperation({})).toThrow(/needs a `readResolveContext/);
  });
});

/**
 * THE WIRING, NOT JUST THE DECLARATION — the blocker PR #1510's juror found.
 *
 * Every test above drives `planResolve` with a hand-built `read` fixture, so all of them passed while the
 * REAL reader shipped with `reconcile`/`observedFiles` defaulting to `null` and `run.mjs` calling it with no
 * arguments. The #2803 guard never reconciled anything in the wired operation.
 *
 * The second half was worse than the first: with `reconcile` null the reader still reported
 * `scopeDeclared: true` and an empty `offending`, which `planResolve` reads as "ran and found nothing". The
 * declaration's three states exist precisely to keep "could not check" apart from "checked clean", and the
 * WIRING collapsed them anyway. A fixture-only suite cannot see that, by construction.
 */
describe('the wired reader actually reconciles (#2803)', () => {
  const CARD = '---\nkind: story\nstatus: active\nscope: ["we:src/"]\ndateOpened: "2026-08-01"\n---\n\n# c\n\nb.\n';
  const io = (over = {}) => ({
    root: '/repo',
    listFiles: () => ['100-a.md'],
    readText: () => CARD,
    exec: () => '',
    today: () => '2026-08-21',
    ...over,
  });

  it('with NO overrides at all, a broken tree reports UNCHECKED — not clean', () => {
    // The regression this pins, stated as BEHAVIOUR rather than as a grep for `= null`. `run.mjs` calls
    // `createResolveReader()` with no arguments, so the defaults ARE the production path. If they were null
    // again, the old code set `scopeDeclared: true` off the frontmatter alone and the declaration read that
    // as CHECKED AND CLEAN. Here `exec` returns nothing, so the real observed-files read throws, and the
    // only acceptable answer is "could not check".
    const read = createResolveReader(io())({ ref: '100' });
    expect(read.scopeDeclared).toBe(false);
    expect(read.offending).toEqual([]);
    expect(planResolve(shapeResolveRead(read)).scopeUnchecked).toBe(true);
  });

  it('actually CALLS the reconciliation — the call path is live, not just present', () => {
    let called = 0;
    const read = createResolveReader(io({
      reconcile: (args) => { called += 1; expect(args.declared).toContain('we:src/'); return { offending: [] }; },
      observedFiles: () => ['src/x.js'],
    }))({ ref: '100' });
    expect(called).toBe(1);
    expect(read.scopeDeclared).toBe(true);
  });

  it('reports scopeUnchecked when the reconciliation CANNOT run — never a clean run', () => {
    // `observedFiles` throwing is the realistic shape (no git, no origin, detached tree). The old wiring
    // returned `scopeDeclared: true, offending: []` here, which the declaration read as CHECKED AND CLEAN.
    const read = createResolveReader(io({
      reconcile: () => ({ offending: [] }),
      observedFiles: () => { throw new Error('no git here'); },
    }))({ ref: '100' });
    expect(read.scopeDeclared).toBe(false);
    expect(planResolve(shapeResolveRead(read)).scopeUnchecked).toBe(true);
  });

  it('reports a REAL clean run as checked, distinguishably', () => {
    const read = createResolveReader(io({
      reconcile: () => ({ offending: [] }),
      observedFiles: () => ['src/x.js'],
    }))({ ref: '100' });
    expect(read.scopeDeclared).toBe(true);
    expect(planResolve(shapeResolveRead(read)).scopeUnchecked).toBe(false);
  });

  it('surfaces drift the reconciliation found, so the guard can actually refuse', () => {
    const read = createResolveReader(io({
      reconcile: () => ({ offending: ['src/pages/x.njk'] }),
      observedFiles: () => ['src/pages/x.njk'],
    }))({ ref: '100' });
    expect(read.offending).toEqual(['src/pages/x.njk']);
    expect(() => planResolve(shapeResolveRead(read))).toThrow(/scope: never declared/);
  });
});

/**
 * THE GUARD MUST GIVE THE RIGHT ANSWER, not merely run — PR #1510's round-2 blocker.
 *
 * Round 1's fix proved the reconciliation was WIRED. Nothing proved it was wired with the right SHAPE, and it
 * was not: `declared` went in as the raw frontmatter string where `reconcileScope` takes a parsed `string[]`,
 * so `normScope` read every declared scope as empty and the guard flagged files the item's scope covered
 * perfectly. "It never fires" became "it always fires", which is the worse of the two — a guard that cries
 * wolf gets `--force`d past on reflex.
 *
 * So these drive the REAL `reconcileScope`, not a stub. A stub would have agreed with either shape.
 */
describe('the #2803 guard answers correctly, against the real reconciliation', () => {
  const card = (scope) => `---\nkind: story\nstatus: active\nscope: ${scope}\ndateOpened: "2026-08-01"\n---\n\n# c\n\nb.\n`;
  const readerFor = (scopeYaml, observed) => createResolveReader({
    root: '/repo',
    listFiles: () => ['100-a.md'],
    readText: () => card(scopeYaml),
    exec: () => '',
    today: () => '2026-08-21',
    observedFiles: () => observed,
    // reconcile left at its DEFAULT — the real `reconcileScope`. A stub here would prove nothing about shape.
  })({ ref: '100' });

  it('parses `scope:` into an ARRAY — a raw string reads as no scope at all', () => {
    // The bug in one assertion. `readScopeList` returns the parsed list; `readField` would return the string.
    const read = readerFor('["we:src/pages/"]', ['we:src/pages/x.njk']);
    expect(read.scopeDeclared).toBe(true);
  });

  it('does NOT flag a presentation file the declared scope COVERS', () => {
    // The false positive the wrong shape produced: every declared scope read as empty, so every touched
    // presentation file was drift.
    const read = readerFor('["we:src/pages/"]', ['we:src/pages/x.njk']);
    expect(read.offending).toEqual([]);
    expect(planResolve(shapeResolveRead(read)).status).toBe('resolved');
  });

  it('still DOES flag a presentation file outside the declared scope', () => {
    // The other half — without this, "never flag anything" would pass the test above.
    const read = readerFor('["we:scripts/"]', ['we:src/pages/x.njk']);
    expect(read.offending.length).toBeGreaterThan(0);
    expect(() => planResolve(shapeResolveRead(read))).toThrow(/scope: never declared/);
  });

  it('treats an absent `scope:` as unchecked, not as an empty declared list', () => {
    const read = createResolveReader({
      root: '/repo', listFiles: () => ['100-a.md'],
      readText: () => '---\nkind: story\nstatus: active\ndateOpened: "2026-08-01"\n---\n\n# c\n\nb.\n',
      exec: () => '', today: () => '2026-08-21', observedFiles: () => ['we:src/pages/x.njk'],
    })({ ref: '100' });
    expect(read.scopeDeclared).toBe(false);
    expect(planResolve(shapeResolveRead(read)).scopeUnchecked).toBe(true);
  });
});
