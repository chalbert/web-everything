/**
 * @file http-adapter.test.mjs — the HTTP caller, derived from a declaration (#3036).
 *
 * THE THREE PROPERTIES THIS FILE EXISTS FOR:
 *
 *   1. **THE ROUTE TABLE IS DERIVED FROM STEP KINDS.** A `compute`-only declaration gets a route table with no
 *      non-GET route in it, because {@link ../http-adapter.mjs}'s `planRoutes` derives the table from step
 *      kinds. Proven twice over: the plan is asserted, and then a whole `suggest-next` request is served
 *      through a store whose every method THROWS — which passes only because the read-only path has no store
 *      in scope to call. **The limit of that is asserted too, in `the limits of "read-only"` below: a
 *      `compute`-only declaration whose fn closes over a writer is served on `GET` and writes. Do not read
 *      property 1 as a security guarantee; the guarantee is `#3036 read-only is a property of the DECLARING
 *      MODULE` further down, and it is narrower.**
 *   2. **GENERICITY.** The same adapter, with no `review-pr` knowledge anywhere in it, drives `review-pr`
 *      through start → judge → reduce → its `confirm` suspend, and resumes it — executing nothing. A run
 *      crosses surfaces in BOTH directions: started on the command line and finished over HTTP, and started
 *      over HTTP and finished on the command line, both against the same store.
 *   3. **THE ERRORS ARE THE COMMAND LINE'S.** The enum, missing-field and unknown-field refusals are asserted
 *      BYTE-IDENTICAL against `parseOperationArgv`/`validateInput`, not against a copied string.
 *
 * NOTHING HERE SPAWNS A PROCESS, TOUCHES `gh`, OR LEAVES A SERVER RUNNING. The one real `node:http` server is
 * created, bound to port 0, requested against, and closed inside a single test. The exploit test writes one
 * file into `node:os`'s tmpdir and removes it in the same test.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { get as httpGet, request as httpRequest } from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { importGraph } from './import-graph.mjs';
import { createRegistry, isReadOnlyOperation, op } from '../registry.mjs';
import { compute, effect } from '../step-kinds.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { inFlight } from '../effect-executor.mjs';
import { validateInput } from '../registry.mjs';
import { buildCliSpec, judgeOutcome, parseOperationArgv, runOperationCli } from '../cli-adapter.mjs';
import { OPERATIONS, resolveOperation } from '../run.mjs';
import { reviewPrOperation, REVIEW_PR_OP } from '../review-pr.mjs';
import { suggestNextOperation, SUGGEST_NEXT_OP } from '../suggest-next.mjs';
import { GATE_HEALTH_OP } from '../gate-health.mjs';
import {
  DEFAULT_BASE_PATH,
  assertReadOnlyDeclaration,
  createNodeRequestListener,
  describeOperation,
  handleOperationRequest,
  isReadOnlyDeclaration,
  parseQueryInput,
  planRoutes,
  runReadOnly,
  segmentsUnder,
} from '../http-adapter.mjs';

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────

/** A loader-shaped board item. */
function item(num, over = {}) {
  return {
    num: String(num).padStart(3, '0'), id: `${String(num).padStart(3, '0')}-x`, title: `item ${num}`,
    kind: 'story', size: 3, status: 'open', tier: 'A', batchable: true, batchCost: 3,
    locus: 'webeverything', leverageScore: 0, directUnblocks: 0, transitiveUnblocks: 0, unblocksToReady: 0,
    ...over,
  };
}
const BOARD = [item(101, { leverageScore: 5, unblocksToReady: 2 }), item(102), item(103, { kind: 'task', size: undefined })];

/** A stub `readPr` — the same shape `review-pr.test.mjs` uses, trimmed to what a suspend needs. */
function stubReader({ labels = ['review:pending'] } = {}) {
  return ({ pr, repo }) => ({
    detail: {
      pr, repo, title: 'a parked PR', url: `https://example.invalid/${pr}`, labels,
      humanRequired: labels.includes('review:human'),
      reviewClass: labels.includes('review:human') ? 'human' : 'pending',
      disposition: { mode: 'converge', autoLand: false }, escalationReason: ['gate-self'],
      advisoryComment: null, humanComment: null,
      diffStat: [{ path: 'scripts/x.mjs', additions: 1, deletions: 0 }],
    },
    headRefName: 'lane/thing',
    body: 'the PR description',
    net: { paths: ['scripts/x.mjs'], base: 'a'.repeat(40), revSha: 'b'.repeat(40), rev: 'origin/lane/thing', scored: true },
    diff: { text: '--- a/x\n+++ b/x\n+one\n', scored: true },
  });
}

/** A store whose every method throws. Passing it into a read-only request is the structural assertion. */
function refusingStore(why = 'the read-only path must never touch a run store') {
  const boom = () => { throw new Error(why); };
  return { read: boom, write: boom, delete: boom, list: boom };
}

/** A deterministic run-id minter. */
function idMinter() {
  let n = 0;
  return (name) => `${name}-${String(++n).padStart(3, '0')}`;
}

/** Build the two declarations and a `resolve`/`names` pair over them — the adapter's whole per-repo wiring. */
function wiring({ readerOptions, sinks = {}, board = BOARD } = {}) {
  const table = {
    [REVIEW_PR_OP]: () => ({ declaration: reviewPrOperation({ readPr: stubReader(readerOptions) }), sinks }),
    [SUGGEST_NEXT_OP]: () => ({
      declaration: suggestNextOperation({
        loadBoard: () => ({ items: board }),
        loadExclusions: () => ({ nums: [], sources: [{ id: 'prepare-hold', nums: [] }] }),
      }),
      sinks: {},
    }),
  };
  const resolve = (name) => {
    if (!Object.hasOwn(table, name)) {
      throw new Error(`operations: no operation named ${JSON.stringify(name)} (known: ${Object.keys(table).sort().join(', ')})`);
    }
    const { declaration, sinks: s } = table[name]();
    const registry = createRegistry();
    registry.register(declaration);
    return { declaration, registry, sinks: s };
  };
  return { resolve, names: () => Object.keys(table).sort() };
}

/** A canned juror, so `awaiting-judge` resolves without a spawn. */
const stubJudge = async () => judgeOutcome({ summary: 'nothing blocking', findings: [] }, { costUsd: 0.01, wallMs: 10 });

const REVIEW_PR_DECL = () => reviewPrOperation({ readPr: stubReader() });
const SUGGEST_DECL = () => suggestNextOperation({ loadBoard: () => ({ items: BOARD }) });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS_DIR = resolvePath(HERE, '..');

// ── 1. the route table is derived from step kinds — and what that is worth ──────────────────────────────────

describe('the route table is a function of the step kinds', () => {
  it('a compute-only declaration plans GET routes and NOTHING else', () => {
    const routes = planRoutes(SUGGEST_DECL());
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /operations/suggest-next',
      'GET /operations/suggest-next/run',
    ]);
    expect(routes.every((r) => r.method === 'GET' && r.safe === true)).toBe(true);
    // No run-record route at all: a run that cannot suspend has nothing to store.
    expect(routes.some((r) => r.path.includes('/runs'))).toBe(false);
  });

  it('a declaration that can suspend or write is NEVER reachable by a safe method', () => {
    const routes = planRoutes(REVIEW_PR_DECL());
    const executing = routes.filter((r) => r.kind === 'start' || r.kind === 'advance');
    expect(executing.map((r) => r.method)).toEqual(['POST', 'POST']);
    expect(executing.every((r) => r.safe === false)).toBe(true);
    // The only GETs are reads — the describe route and the run record.
    expect(routes.filter((r) => r.method === 'GET').map((r) => r.kind)).toEqual(['describe', 'read-run']);
    // …so no crawler, prefetch or <img src> can start one.
    expect(routes.some((r) => r.method === 'GET' && r.safe === false)).toBe(false);
  });

  it('the read-only branch is derived, not declared — one non-compute step flips the whole table', () => {
    expect(isReadOnlyDeclaration(SUGGEST_DECL())).toBe(true);
    expect(isReadOnlyDeclaration(REVIEW_PR_DECL())).toBe(false);
  });
});

describe('the read-only path is given nothing to write WITH', () => {
  it('serves a whole suggest-next request through a store whose every method throws', async () => {
    const res = await handleOperationRequest(
      { method: 'GET', url: '/operations/suggest-next/run?limit=2' },
      { ...wiring(), store: refusingStore(), judge: () => { throw new Error('no juror on a read-only path'); }, newRunId: idMinter() },
    );
    expect(res.status).toBe(200);
    expect(res.body.stopped).toBe('complete');
    expect(res.body.verdict.suggested).toHaveLength(2);
    expect(res.body.persisted).toBe(false);
  });

  it('`runReadOnly` takes no store, no sinks and no judge — and refuses a declaration that can suspend', () => {
    expect(() => runReadOnly(REVIEW_PR_DECL(), { input: { pr: 1, repo: 'a/b' }, id: 'r-1', registry: createRegistry() }))
      .toThrow(/is not `compute`-only — judge\(judge\), confirm\(confirm\), record\(effect\)/);
    expect(() => assertReadOnlyDeclaration(REVIEW_PR_DECL())).toThrow(/is not `compute`-only/);
    expect(assertReadOnlyDeclaration(SUGGEST_DECL()).name).toBe(SUGGEST_NEXT_OP);
  });

  it('refuses a write METHOD on the read route with a truthful Allow', async () => {
    const res = await handleOperationRequest(
      { method: 'POST', url: '/operations/suggest-next/run', body: {} },
      { ...wiring(), newRunId: idMinter() },
    );
    expect(res.status).toBe(405);
    expect(res.body.allow).toEqual(['GET']);
  });

  it('has no run-record route to reach at all, and says why', async () => {
    for (const [method, url] of [['POST', '/operations/suggest-next/runs'], ['GET', '/operations/suggest-next/runs/abc']]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await handleOperationRequest({ method, url, body: {} }, { ...wiring(), newRunId: idMinter() });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('is READ-ONLY');
      expect(res.body.error).toContain('every declared step is `compute`');
    }
  });
});

describe('the limits of "read-only" — asserted, so the claim above cannot grow back', () => {
  /**
   * THE EXPLOIT, AS A TEST. A `compute`-only declaration whose step fn closes over `writeFileSync` passes
   * `isReadOnlyOperation`, passes `assertReadOnlyDeclaration`, is planned a `GET …/run` route, and returns
   * `200` with the file on disk. Nothing in `op()` or in either predicate inspects a step fn's closure — they
   * read the declared KIND. This test exists so that any future header claiming a `compute` step "cannot reach
   * the world" is contradicted by a green test sitting next to it.
   */
  it('a compute-only declaration whose fn closes over a writer IS served on GET, and writes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-op-readonly-'));
    const victim = join(dir, 'written-by-a-compute-step.txt');
    try {
      const declaration = op('closure-writer', {
        input: { who: { type: 'string', required: false, default: 'world' } },
        verdictFrom: 'lookup',
        lookup: compute({
          reads: ['input.who'],
          fn: (view) => { writeFileSync(victim, `${view.input.who}\n`); return { greeting: view.input.who }; },
        }),
      });

      // Every declaration-level check says "read-only".
      expect(isReadOnlyOperation(declaration)).toBe(true);
      expect(() => assertReadOnlyDeclaration(declaration)).not.toThrow();
      expect(planRoutes(declaration).map((r) => `${r.method} ${r.path}`))
        .toEqual(['GET /operations/closure-writer', 'GET /operations/closure-writer/run']);

      const registry = createRegistry();
      registry.register(declaration);
      const res = await handleOperationRequest(
        { method: 'GET', url: '/operations/closure-writer/run?who=reviewer' },
        {
          resolve: () => ({ declaration, registry, sinks: {} }),
          names: () => [declaration.name],
          store: refusingStore(),
          newRunId: idMinter(),
        },
      );

      // …and the "write-free" GET wrote a file.
      expect(res.status).toBe(200);
      expect(res.body.persisted).toBe(false); // no RUN RECORD — which is all `persisted` ever meant
      expect(existsSync(victim)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the describe route ships the caveat, so a consumer is not told `readOnly` means "writes nothing"', () => {
    const described = describeOperation(SUGGEST_DECL());
    expect(described.readOnly).toBe(true);
    expect(described.readOnlyCaveat).toContain('declared step KINDS');
    expect(described.readOnlyCaveat).toContain('not a guarantee');
    // …and an operation that is not read-only carries neither field's prose.
    expect(describeOperation(REVIEW_PR_DECL()).readOnlyCaveat).toBeNull();
  });
});

describe('#3036 read-only is a property of the DECLARING MODULE — the part that IS checkable', () => {
  /**
   * THE PROPERTY, STATED EXACTLY: for every operation this repo registers as read-only, the module that
   * DECLARES it reaches nothing that can act — its whole static import graph has zero non-relative
   * specifiers, so no `node:` builtin and no package. Its `compute` fns therefore hold no writer in lexical
   * scope, and the only way one can arrive is through the `deps` its builder is handed at the single call
   * site in `../run.mjs`.
   *
   * THE HOLE, EQUALLY EXACTLY: `deps` is not covered, and for the one read-only operation that ships it is
   * where all the io lives — the test below asserts that too, rather than leaving it implied. This is the
   * same technique #3032's engine test uses (`engine.test.mjs`, "the engine's import graph reaches nothing
   * that can act"); it is applied here to a strictly narrower claim.
   */
  const DECLARING_MODULE = Object.freeze({
    [REVIEW_PR_OP]: 'review-pr.mjs',
    [SUGGEST_NEXT_OP]: 'suggest-next.mjs',
    [GATE_HEALTH_OP]: 'gate-health.mjs',
  });

  it('the module map covers every operation the repo declares — a new one cannot slip past this file', () => {
    expect(Object.keys(DECLARING_MODULE).sort()).toEqual(Object.keys(OPERATIONS).sort());
  });

  it('every operation registered as read-only declares in a module that reaches nothing that can act', () => {
    const readOnly = Object.keys(OPERATIONS).filter((name) => isReadOnlyOperation(resolveOperation(name).declaration));
    // Pinned, not derived: adding a read-only operation must be a deliberate edit here.
    expect(readOnly.sort()).toEqual([GATE_HEALTH_OP, SUGGEST_NEXT_OP].sort());
    for (const name of readOnly) {
      const { external } = importGraph(resolvePath(OPS_DIR, DECLARING_MODULE[name]));
      expect(external, `\`${name}\` declares in ${DECLARING_MODULE[name]}, which must import nothing that can act`)
        .toEqual([]);
    }
  });

  it('and the check stops at the injected deps — suggest-next\'s own readers DO reach fs and child_process', () => {
    // Not a defect being tolerated quietly: this is the boundary of the guarantee, written down as an
    // assertion so the header's "that narrows the surface; it does not close it" cannot rot into a stronger
    // claim. Both readers only read; that is a promise this repo keeps, not a property anything verifies.
    const { external } = importGraph(resolvePath(OPS_DIR, 'suggest-next-io.mjs'));
    expect(external).toContain('node:fs');
    expect(external).toContain('node:child_process');
  });

  it('a declaration module that imports a writer FAILS the check — the scanner is not vacuous', () => {
    // `review-pr` is the negative control: it is not read-only, and its module graph is full of writers. If
    // the scanner ever returned `[]` for everything, this would fail and the assertion above would be empty.
    const { external } = importGraph(resolvePath(OPS_DIR, 'review-pr.mjs'));
    expect(external).toContain('node:fs');
    expect(external).toContain('node:child_process');
  });
});

// ── 2. the describe route IS the --help ─────────────────────────────────────────────────────────────────────

describe('describe — one declaration, one description', () => {
  it('carries the command line\'s usage text verbatim', async () => {
    const res = await handleOperationRequest({ method: 'GET', url: '/operations/suggest-next' }, { ...wiring(), newRunId: idMinter() });
    expect(res.status).toBe(200);
    expect(res.body.usage).toBe(buildCliSpec(SUGGEST_DECL()).usage);
  });

  it('lists the declared value set, the defaults and the step kinds', () => {
    const described = describeOperation(SUGGEST_DECL());
    expect(described.input.tier).toEqual({ type: 'string', required: false, default: 'A', enum: ['A', 'B'] });
    expect(described.steps).toEqual([
      { name: 'board', kind: 'compute', reads: ['input.scanOpenPrs'] },
      { name: 'shortlist', kind: 'compute', reads: ['input.tier', 'input.limit', 'input.batchableOnly', 'findings.board'] },
    ]);
    expect(described.readOnly).toBe(true);
    expect(described.readOnlyBecause).toContain('every declared step is `compute`');
  });

  it('the index lists every declared operation and whether it can write', async () => {
    const res = await handleOperationRequest({ method: 'GET', url: '/operations' }, { ...wiring(), newRunId: idMinter() });
    expect(res.body.operations).toEqual([
      { op: REVIEW_PR_OP, readOnly: false, describe: '/operations/review-pr', steps: ['read(compute)', 'judge(judge)', 'reduce(compute)', 'confirm(confirm)', 'record(effect)'] },
      { op: SUGGEST_NEXT_OP, readOnly: true, describe: '/operations/suggest-next', steps: ['board(compute)', 'shortlist(compute)'] },
    ]);
  });
});

// ── 3. the errors are the command line's ────────────────────────────────────────────────────────────────────

describe('errors come from the generated validation', () => {
  it('an enum refusal is BYTE-IDENTICAL to the command line\'s', async () => {
    const fromCli = parseOperationArgv(SUGGEST_DECL(), ['--tier=C']).errors;
    const res = await handleOperationRequest(
      { method: 'GET', url: '/operations/suggest-next/run?tier=C' },
      { ...wiring(), newRunId: idMinter() },
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(fromCli);
  });

  it('a missing required field and an unknown field are BYTE-IDENTICAL to `validateInput`', async () => {
    const decl = REVIEW_PR_DECL();
    const expected = validateInput(decl.input, { nope: 1 }).errors;
    expect(expected.length).toBe(3); // missing pr, missing repo, unknown nope — asserted so a silent shrink fails.
    const res = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs', body: { nope: 1 } },
      { ...wiring(), store: createMemoryRunStore(), judge: stubJudge, newRunId: idMinter() },
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expected);
  });

  it('a wrong type in a query parameter is refused before a run exists', async () => {
    const res = await handleOperationRequest(
      { method: 'GET', url: '/operations/suggest-next/run?limit=banana' },
      { ...wiring(), store: refusingStore(), newRunId: idMinter() },
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['query parameter `limit` must be a number, got "banana"']);
  });

  it('an unknown operation fails with the resolver\'s own words', async () => {
    const res = await handleOperationRequest({ method: 'GET', url: '/operations/nope' }, { ...wiring(), newRunId: idMinter() });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('operations: no operation named "nope" (known: review-pr, suggest-next)');
  });

  it('a repeated query parameter is refused rather than silently last-wins', () => {
    const parsed = parseQueryInput(SUGGEST_DECL(), new URLSearchParams('limit=1&limit=2'));
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain('appears more than once');
  });

  it('is not mounted outside its base path', async () => {
    const res = await handleOperationRequest({ method: 'GET', url: '/elsewhere' }, { ...wiring(), newRunId: idMinter() });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain(`it is mounted at ${DEFAULT_BASE_PATH}`);
    expect(segmentsUnder('/operations', '/elsewhere')).toBeNull();
    expect(segmentsUnder('/operations', '/operations/a/b')).toEqual(['a', 'b']);
  });
});

// ── 4. genericity: the same adapter drives review-pr, executing nothing ─────────────────────────────────────

describe('genericity — the adapter knows nothing about either operation', () => {
  it('drives review-pr to its `confirm` suspend over HTTP and applies no effect', async () => {
    const store = createMemoryRunStore();
    const applied = [];
    const sinks = new Proxy({}, { get: (_t, type) => (payload) => { applied.push({ type, payload }); } });
    const deps = { ...wiring({ sinks }), store, judge: stubJudge, newRunId: idMinter() };

    const started = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs', body: { pr: 1146, repo: 'chalbert/web-everything' } },
      deps,
    );
    expect(started.status).toBe(201);
    expect(started.headers.location).toBe(`/operations/review-pr/runs/${started.body.runId}`);
    expect(started.body.stopped).toBe('confirm');
    expect(started.body.pending.kind).toBe('confirm');
    expect(started.body.pending.of).toBe('agent');
    expect(started.body.pending.options).toEqual(['accept', 'changes', 'abstain']);
    // NOTHING RAN. The juror was a stub and no sink was ever reached.
    expect(applied).toEqual([]);
    expect(store.read(started.body.runId).effects).toEqual([]);
    // The declared judge step DID suspend and its cost rode back on the resume — the generic loop, unchanged.
    expect(started.body.spend.jurors).toBe(1);

    // The record is readable through the derived GET route.
    const read = await handleOperationRequest({ method: 'GET', url: `/operations/review-pr/runs/${started.body.runId}` }, deps);
    expect(read.status).toBe(200);
    // A read is a snapshot, not a drive: `status` says what the run waits on, `stopped` is null because
    // nothing was driven. The start response above carries both, with `stopped: 'confirm'`.
    expect(read.body.status).toBe('awaiting-confirm');
    expect(read.body.stopped).toBeNull();
    expect(started.body.status).toBe('awaiting-confirm');
    expect(read.body.persisted).toBe(true);

    // …and the resume route answers it. `abstain` declares zero effects, so the run completes writing nothing.
    const done = await handleOperationRequest(
      { method: 'POST', url: `/operations/review-pr/runs/${started.body.runId}/advance`, body: { value: 'abstain' } },
      deps,
    );
    expect(done.status).toBe(200);
    expect(done.body.stopped).toBe('complete');
    expect(applied).toEqual([]);
  });

  it('refuses an answer to a question that has not been asked — the CLI stop point, over HTTP', async () => {
    const store = createMemoryRunStore();
    const deps = { ...wiring(), store, judge: stubJudge, newRunId: idMinter() };
    const started = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs', body: { pr: 7, repo: 'a/b' } }, deps,
    );
    const done = await handleOperationRequest(
      { method: 'POST', url: `/operations/review-pr/runs/${started.body.runId}/advance`, body: { value: 'abstain' } }, deps,
    );
    expect(done.body.stopped).toBe('complete');
    // The run is finished; a second answer has nothing to answer.
    const again = await handleOperationRequest(
      { method: 'POST', url: `/operations/review-pr/runs/${started.body.runId}/advance`, body: { value: 'accept' } }, deps,
    );
    expect(again.status).toBe(409);
    expect(again.body.error).toContain('a question that has not been asked');
  });

  it('a run STARTED on the command line is finished over HTTP, against the same record', async () => {
    const store = createMemoryRunStore();
    const { resolve, names } = wiring();
    const { declaration, registry, sinks } = resolve(REVIEW_PR_OP);

    const cli = await runOperationCli({
      declaration, argv: ['--pr=1146', '--repo=chalbert/web-everything', '--json'],
      registry, store, sinks, judge: stubJudge, newRunId: () => 'review-pr-crossing',
    });
    expect(cli.stopped).toBe('confirm');

    // …and the browser picks it up. Same store, same record, no second implementation of anything.
    const deps = { resolve, names, store, judge: stubJudge, newRunId: idMinter() };
    const seen = await handleOperationRequest({ method: 'GET', url: '/operations/review-pr/runs/review-pr-crossing' }, deps);
    expect(seen.body.pending.asks).toBe(cli.run.pending.asks);
    const done = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs/review-pr-crossing/advance', body: { value: 'abstain' } }, deps,
    );
    expect(done.body.stopped).toBe('complete');
    expect(store.read('review-pr-crossing').findings.confirm).toBe('abstain');
  });

  it('and the OTHER direction: a run STARTED over HTTP is finished on the command line', async () => {
    // The card claims the crossing works "in the terminal … and the reverse". Only one direction was pinned;
    // this is the reverse, and it is a separate risk — the HTTP start writes the record and the CLI's
    // `--resume` has to find, validate and advance a record it did not create.
    const store = createMemoryRunStore();
    const { resolve, names } = wiring();
    const deps = { resolve, names, store, judge: stubJudge, newRunId: () => 'review-pr-reverse' };

    const started = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs', body: { pr: 1146, repo: 'chalbert/web-everything' } },
      deps,
    );
    expect(started.status).toBe(201);
    expect(started.body.stopped).toBe('confirm');
    expect(store.read('review-pr-reverse').pending.kind).toBe('confirm');

    // …and the terminal finishes it, against the record the browser wrote. No second implementation.
    const { declaration, registry, sinks } = resolve(REVIEW_PR_OP);
    const cli = await runOperationCli({
      declaration, argv: ['--resume=review-pr-reverse', '--answer=abstain', '--json'],
      registry, store, sinks, judge: stubJudge, newRunId: () => 'unused',
    });
    expect(cli.stopped).toBe('complete');
    expect(cli.code).toBe(0);
    expect(cli.run.id).toBe('review-pr-reverse');
    expect(store.read('review-pr-reverse').findings.confirm).toBe('abstain');
    // `abstain` declares no effects, so nothing was applied on either surface.
    expect(store.read('review-pr-reverse').effects).toEqual([]);
  });

  it('keeps the repo sanitisation — in the operation\'s io shell, not in the generic adapter', async () => {
    // The card asks that the console's hand-written repo guard "moves into the generator rather than being
    // dropped". It moved into the IO SHELL instead, which is the correct home: a repo-format rule is
    // `review-pr`'s knowledge and the adapter is generic over every declaration. The regex here is
    // byte-identical to `daemonReviewDetailJson`'s in `plateau:tools/dev-panel/vite-plugin.ts`.
    const { readPr } = await import('../review-pr-io.mjs');
    expect(() => readPr({ pr: 1, repo: 'chalbert/web-everything; rm -rf /' }))
      .toThrow(/`repo` must be <owner\/name>/);
    // …and the adapter itself adds no repo knowledge: a hostile value is a well-typed `string` to it, so it
    // passes the declaration's validation and is stopped one layer down, where the rule lives.
    const decl = REVIEW_PR_DECL();
    expect(validateInput(decl.input, { pr: 1, repo: 'a b; rm -rf /' }).ok).toBe(true);
  });

  it('a run id belonging to another operation is not served under this one', async () => {
    const store = createMemoryRunStore();
    const deps = { ...wiring(), store, judge: stubJudge, newRunId: idMinter() };
    const started = await handleOperationRequest(
      { method: 'POST', url: '/operations/review-pr/runs', body: { pr: 7, repo: 'a/b' } }, deps,
    );
    const res = await handleOperationRequest({ method: 'GET', url: `/operations/suggest-next/runs/${started.body.runId}` }, deps);
    expect(res.status).toBe(404);
  });
});

// ── 5. over a real socket, started and stopped in one test ──────────────────────────────────────────────────

describe('the node:http shim', () => {
  /** @type {import('node:http').Server|null} */
  let server = null;
  afterEach(async () => {
    if (server) await new Promise((done) => server.close(done));
    server = null;
  });

  /** One request/response over the loopback, as text. */
  function fetchText(port, path, { method = 'GET', body } = {}) {
    return new Promise((done, fail) => {
      const req = (method === 'GET' ? httpGet : httpRequest)(
        { host: '127.0.0.1', port, path, method },
        (res) => {
          let text = '';
          res.on('data', (c) => { text += c; });
          res.on('end', () => done({ status: res.statusCode, headers: res.headers, text }));
        },
      );
      req.on('error', fail);
      if (body !== undefined) req.write(JSON.stringify(body));
      if (method !== 'GET') req.end();
    });
  }

  it('serves the derived route over a real socket, and refuses a write method with Allow', async () => {
    const listener = createNodeRequestListener({ ...wiring(), store: refusingStore(), newRunId: idMinter() });
    server = createServer(listener);
    const port = await new Promise((done) => server.listen(0, '127.0.0.1', () => done(server.address().port)));

    const ok = await fetchText(port, '/operations/suggest-next/run?limit=1');
    expect(ok.status).toBe(200);
    const payload = JSON.parse(ok.text);
    expect(payload.op).toBe(SUGGEST_NEXT_OP);
    expect(payload.persisted).toBe(false);
    expect(payload.verdict.next.num).toBe('101');

    const refused = await fetchText(port, '/operations/suggest-next/run', { method: 'POST', body: {} });
    expect(refused.status).toBe(405);
    expect(refused.headers.allow).toBe('GET');
  });
});

/**
 * A DISPATCH IS NOT A SERVER FAULT (#3073; PR #1180 review, blocking 1). `driveAndRespond` mapped anything
 * other than `complete`/`confirm` to 500, so a run that parked on deliberately-started long work — the one
 * operation the operations epic exists to reach — came back as a server error. The CLI had the same defect
 * one layer down (it exited 1 after spinning to the turn cap).
 */
describe('an in-flight dispatch is a successful park over HTTP, not a 500', () => {
  const DISPATCH_OP = 'http-dispatch-fx';

  /** The adapter's whole per-repo wiring, over one dispatching declaration. */
  function dispatchWiring() {
    const build = () => ({
      declaration: op(DISPATCH_OP, {
        input: { pr: { type: 'number', required: true } },
        go: effect({
          reads: ['input.pr'],
          effects: (view) => [{ type: 'start.build', payload: { pr: view.input.pr }, dispatch: true }],
        }),
      }),
      sinks: { 'start.build': async () => inFlight({ handle: 'sess-http', expectedBy: '2099-01-01T00:00:00.000Z' }) },
    });
    return {
      resolve: (name) => {
        if (name !== DISPATCH_OP) throw new Error(`operations: no operation named ${JSON.stringify(name)}`);
        const { declaration, sinks } = build();
        const registry = createRegistry();
        registry.register(declaration);
        return { declaration, registry, sinks };
      },
      names: () => [DISPATCH_OP],
    };
  }

  it('answers 201 with the park recorded, not 500', async () => {
    const res = await handleOperationRequest(
      { method: 'POST', url: `${DEFAULT_BASE_PATH}/${DISPATCH_OP}/runs`, body: { pr: 7 } },
      { ...dispatchWiring(), newRunId: idMinter(), store: createMemoryRunStore(), judge: async () => { throw new Error('no juror'); } },
    );
    expect(res.status).toBe(201);
    expect(res.body.stopped).toBe('effect-in-flight');
    expect(res.body.inFlight).toHaveLength(1);
    expect(res.body.error).toBeUndefined();
  });
});
