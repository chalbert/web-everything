/**
 * @file scripts/operations/http-adapter.mjs
 * @description THE HTTP ADAPTER, DERIVED FROM A DECLARATION (#3036, under epic #3029).
 *
 * THE SECOND DERIVED CALLER. Per the statute
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * clause 1 — *"a hand-written route or argv parser for an operation that could be declared is a defect, not a
 * style choice"* — this file knows nothing about reviewing a PR and nothing about suggesting a backlog item.
 * It knows about **declarations**. Exactly like {@link ./cli-adapter.mjs}, which derives flags, usage text and
 * validation from `declaration.input`, this derives the **route table**, the request validation and the
 * response envelope from the same frozen object. Declaring a third operation buys its HTTP surface for free.
 *
 * DERIVED AT RUN TIME, NOT GENERATED. No codegen, no build step, no checked-in route file. {@link planRoutes}
 * is a pure function of the declaration, so a route table cannot drift from the operation it serves — which is
 * strictly stronger than generated source.
 *
 * ── THE ROUTE TABLE IS A FUNCTION OF THE STEP KINDS ─────────────────────────────────────────────────────────
 *
 * The engine's vocabulary is closed at `compute | judge | confirm | effect` ({@link ./step-kinds.mjs}), and
 * the route table is derived from which kinds a declaration uses — never from a per-operation allowlist:
 *
 *   | declaration                       | routes planned                                                     |
 *   |-----------------------------------|--------------------------------------------------------------------|
 *   | every step `compute` (READ-ONLY)  | `GET /<base>/<op>` · `GET /<base>/<op>/run` — **and nothing else**  |
 *   | any `judge`/`confirm`/`effect`    | `GET /<base>/<op>` · `POST …/runs` · `GET …/runs/<id>` ·            |
 *   |                                   | `POST …/runs/<id>/advance`                                          |
 *
 * ── WHAT "READ-ONLY" HERE DOES AND DOES NOT GUARANTEE ───────────────────────────────────────────────────────
 *
 * READ THIS BEFORE QUOTING THE TABLE ABOVE AS A SECURITY PROPERTY. It is not one.
 *
 * **Guaranteed by the closed vocabulary, for any declaration whatever.** A `compute`-only declaration cannot
 * suspend (no `judge`/`confirm` means no stop point exists) and cannot produce an effect descriptor for
 * {@link ./effect-executor.mjs} to apply (no `effect` step). So it genuinely has no run-record route, no
 * resume route and no non-GET route, and {@link runReadOnly} genuinely receives no store, no sinks and no
 * judge — the read-only branch has none of those handles in scope, so the engine and this adapter write
 * nothing on that path. {@link assertReadOnlyDeclaration} re-checks at the door for a caller that bypassed the
 * router. The converse holds too: a declaration that CAN suspend is never reachable by a safe method, so no
 * crawler, prefetch or `<img src>` can start one.
 *
 * **NOT guaranteed: that the operation writes nothing.** Nothing in `op()`, {@link isReadOnlyDeclaration} or
 * {@link assertReadOnlyDeclaration} inspects what a `compute` fn's body or closure touches — they read the
 * declared KIND. A `compute` fn that closes over `writeFileSync` passes all three, and `GET …/<op>/run`
 * returns `200` with the file written. `compute` means "the engine gives this fn only its declared reads and
 * takes only a finding back"; it does not and cannot mean "this fn is pure". Purity of a step fn is a contract
 * the DECLARATION AUTHOR keeps, exactly like every other convention in this tree.
 *
 * **How far the repo narrows that gap for its OWN declarations.** `__tests__/http-adapter.test.mjs` asserts
 * statically, over the whole import graph, that the module DECLARING a read-only operation reaches nothing
 * that can act — no `node:fs`, no `node:child_process`, no package at all. So its step fns hold no writer in
 * lexical scope, and the only way one can arrive is through the `deps` its builder is handed. That narrows the
 * surface to one call site (`we:scripts/operations/run.mjs`'s `OPERATIONS` table); it does not close it. The
 * injected readers are NOT covered, and for the read-only operation that ships today they do reach `node:fs`
 * and `node:child_process` — they only read, which is a convention, not a structure. That test names it. The
 * check also covers only declarations in that table; an ad-hoc declaration built at a call site is served by
 * this adapter and never seen by it. (This file stays generic: which operation is which is not its business.)
 *
 * ── THE RUN RECORD, AND WHEN THERE ISN'T ONE ────────────────────────────────────────────────────────────────
 *
 * A read-only run **is never persisted**. A `compute`-only operation completes inside one `advance` sweep, so
 * there is nothing to cross surfaces with — and the run store is a session-local sidecar
 * (`we:.operations/runs/`, {@link ./run-store.mjs}) that nothing prunes, so a record per page-load is landfill.
 * Consistency is kept where it is worth something: the response body is {@link ./cli-adapter.mjs}'s
 * `outcomePayload` — the SAME envelope `--json` prints — plus `persisted: false` so a consumer is told, not
 * left to infer. And this is not a policy the handler observes: the read-only branch has no store in scope at
 * all, so "no run record was written" is structural. (It is a statement about the RUN STORE and about nothing
 * else — see the section above for what a step fn can still do on its own account.)
 *
 * A stateful run IS persisted, on the same store the command line writes, because that is the whole point of
 * the record: a review begun in the terminal can be finished in the browser and the reverse.
 *
 * ── ERRORS COME FROM THE GENERATED VALIDATION ───────────────────────────────────────────────────────────────
 *
 * A missing required field, a wrong type, an unknown field and a value outside a declared `enum` all fail
 * through {@link ../operations/registry.mjs}'s `validateInput` — the same call `parseOperationArgv` makes — so
 * the message is BYTE-IDENTICAL to the command line's. `__tests__/http-adapter.test.mjs` asserts that rather
 * than trusting it. The one honest divergence is TRANSPORT SPELLING: the command line reports a bad token as
 * `--pr must be a number, got "abc"` because argv tokens are flags, and this reports the same failure against
 * a query parameter. Both call {@link ./cli-adapter.mjs}'s exported `coerceInputValue`, so the coercion itself
 * is one implementation; only the label differs.
 *
 * ── TRANSPORT-NEUTRAL BY CONSTRUCTION ───────────────────────────────────────────────────────────────────────
 *
 * {@link handleOperationRequest} takes `{ method, url, body }` and returns `{ status, headers, body }`. It
 * imports nothing from `node:` and constructs no server — a test asserts on values instead of scraping a
 * socket, and a host (a Vite dev-server plugin, a Worker, a `node:http` server) adapts it in a few lines.
 * {@link createNodeRequestListener} is that adaptation for `node:http`, written against duck-typed
 * `req`/`res` so even it imports nothing.
 *
 * IMPURE only where the declaration is: the stateful path drives runs through `driveRun`, which spawns jurors
 * and applies effects through INJECTED handles.
 */

import { advanceWhileRunning, runStatus, startRun } from './engine.mjs';
import { isReadOnlyOperation, validateInput } from './registry.mjs';
import { coerceInputValue, driveRun, buildCliSpec, outcomePayload } from './cli-adapter.mjs';

/** Where the operation surface is mounted by default. A host may mount it anywhere via `basePath`. */
export const DEFAULT_BASE_PATH = '/operations';

/**
 * Only used to give the WHATWG `URL` parser an origin — request urls arrive origin-relative. Nothing is ever
 * fetched from it, and `.invalid` is reserved by RFC 2606 precisely so it can never resolve.
 */
const URL_BASE = 'http://operations.invalid';

/** The route kinds {@link planRoutes} can emit. Closed, like everything else in this engine. */
export const ROUTE_KINDS = Object.freeze(['index', 'describe', 'read-run-once', 'start', 'read-run', 'advance']);

/**
 * Is every step of this declaration a `compute`? That is exactly what it tests — see the header's
 * *"what read-only does and does not guarantee"*: it reads declared KINDS, never a step fn's body or closure.
 *
 * THE PREDICATE LIVES IN {@link ./registry.mjs}, beside `op()`, because BOTH adapters derive from it — the
 * command line drops its `--resume` line for an operation that can never suspend, and this derives an entire
 * route table. Re-exported here under the adapter's own name so a reader of the route table can see what it
 * is keyed on without following an import.
 *
 * @param {object} declaration - a frozen declaration from `op()`.
 * @returns {boolean}
 */
export const isReadOnlyDeclaration = isReadOnlyOperation;

/**
 * Refuse a declaration that has a step this path cannot drive. The door on {@link runReadOnly}, so a
 * declaration that can suspend or declare effects cannot reach the store-free, sink-free, judge-free path even
 * by a caller that bypassed the router entirely.
 *
 * IT CHECKS KINDS, NOT BEHAVIOUR. A `compute`-only declaration whose fn writes passes here. See the header.
 *
 * @param {object} declaration
 * @returns {object} the same declaration, for chaining.
 */
export function assertReadOnlyDeclaration(declaration) {
  if (!isReadOnlyDeclaration(declaration)) {
    const impure = declaration.steps.filter((s) => s.step.kind !== 'compute').map((s) => `${s.name}(${s.step.kind})`);
    throw new Error(
      `operations: \`${declaration.name}\` is not \`compute\`-only — ${impure.join(', ')} can suspend or declare effects. `
      + 'The read-only HTTP path takes no store, no sinks and no judge, so it has nothing to drive those with; '
      + 'refusing rather than half-running an operation that suspends.',
    );
  }
  return declaration;
}

/** Join a base path and segments into a route path, with exactly one slash between each. */
function joinPath(basePath, ...segments) {
  const base = String(basePath || '').replace(/\/+$/, '');
  return [base, ...segments].filter((s) => s !== '' && s !== undefined).join('/');
}

/**
 * DERIVE the route table from a declaration. PURE — no io, no registry, no request.
 *
 * The whole read-only property lives in the branch below: the shape of this array is decided by
 * {@link isReadOnlyDeclaration}, which reads only step kinds.
 *
 * @param {object} declaration
 * @param {{basePath?: string}} [options]
 * @returns {ReadonlyArray<{method: string, path: string, kind: string, safe: boolean, summary: string}>}
 */
export function planRoutes(declaration, { basePath = DEFAULT_BASE_PATH } = {}) {
  const name = declaration.name;
  const readOnly = isReadOnlyDeclaration(declaration);
  const routes = [
    {
      method: 'GET',
      path: joinPath(basePath, name),
      kind: 'describe',
      safe: true,
      summary: `The declaration's own \`--help\`: input fields with their types, defaults and declared value sets; the ordered steps and their kinds; this route table.`,
    },
  ];

  if (readOnly) {
    routes.push({
      method: 'GET',
      path: joinPath(basePath, name, 'run'),
      kind: 'read-run-once',
      safe: true,
      summary: `Run \`${name}\` and return its verdict. Every step is \`compute\`, so it cannot suspend: it completes in one sweep and leaves no run record. It is served on GET on the strength of its step fns being pure, which the engine does not enforce.`,
    });
    return Object.freeze(routes.map((r) => Object.freeze(r)));
  }

  routes.push(
    {
      method: 'POST',
      path: joinPath(basePath, name, 'runs'),
      kind: 'start',
      safe: false,
      summary: `Start a \`${name}\` run from a JSON body of its declared input, and drive it to its first suspend or to completion.`,
    },
    {
      method: 'GET',
      path: joinPath(basePath, name, 'runs', ':runId'),
      kind: 'read-run',
      safe: true,
      summary: 'Read one run record — the same record the command line writes, so a run started there is readable here.',
    },
    {
      method: 'POST',
      path: joinPath(basePath, name, 'runs', ':runId', 'advance'),
      kind: 'advance',
      safe: false,
      summary: 'Resume a suspended run with `{ "value": … }` — the HTTP spelling of `--resume=<id> --answer=<option>`.',
    },
  );
  return Object.freeze(routes.map((r) => Object.freeze(r)));
}

/**
 * THE `--help`, AS JSON. The same `buildCliSpec` usage text is carried verbatim under `usage`, so the two
 * derived callers cannot describe one declaration two ways. PURE.
 *
 * @param {object} declaration
 * @param {{basePath?: string}} [options]
 * @returns {object}
 */
export function describeOperation(declaration, { basePath = DEFAULT_BASE_PATH } = {}) {
  const readOnly = isReadOnlyDeclaration(declaration);
  return {
    op: declaration.name,
    readOnly,
    // Said out loud rather than left to be inferred from the absent routes: WHY the table has this shape.
    readOnlyBecause: readOnly
      ? 'every declared step is `compute`. No judge, no confirm, no effect — so this operation cannot suspend, '
        + 'declares no effects, and is given no run store, no sinks and no judge when it runs.'
      : null,
    // The limit of the flag above, in the payload rather than only in a comment, because a consumer deciding
    // whether a GET is safe must not read `readOnly: true` as "this cannot write".
    readOnlyCaveat: readOnly
      ? 'This is derived from declared step KINDS. Nothing inspects what a `compute` fn does, so `readOnly` is '
        + 'not a guarantee that running the operation writes nothing — that rests on its step fns being pure.'
      : null,
    input: Object.fromEntries(Object.entries(declaration.input).map(([field, spec]) => ([field, {
      type: spec.type,
      required: spec.required,
      default: spec.default === undefined ? null : spec.default,
      enum: spec.enum ? [...spec.enum] : null,
    }]))),
    verdictFrom: declaration.verdictFrom,
    // #3316 — the skill that owns the rest of a run. `null` here rather than omitted: this route DESCRIBES the
    // declaration, and a console rendering it needs "declares none" to be a readable answer rather than a
    // missing key. The RECORD is the opposite (absent when undeclared) because there the field's presence is
    // what changes shape for every other operation.
    ownedBy: declaration.ownedBy ?? null,
    steps: declaration.steps.map((s) => ({ name: s.name, kind: s.step.kind, reads: [...s.step.reads] })),
    // `kind` RIDES ALONG, and it is the field a programmatic consumer actually needs. `method`/`path`/`safe`/
    // `summary` describe a route to a READER; `kind` ({@link ROUTE_KINDS}) names it to a CALLER, which is what
    // lets a consumer look a route UP instead of retyping its path. Without it, a browser console mounting
    // this surface has to hand-write `…/runs`, `…/runs/:runId` and `…/runs/:runId/advance` — three
    // per-operation route shapes, in a caller whose whole point is that it has none, free to drift silently
    // into 404s the moment `planRoutes` changes a segment. `plateau:tools/dev-panel/drain-daemon.html` (#3036)
    // is the first such consumer and keys off exactly this.
    routes: planRoutes(declaration, { basePath }).map((r) => ({ method: r.method, path: r.path, kind: r.kind, safe: r.safe, summary: r.summary })),
    // Byte-for-byte the command line's own `--help`. One declaration, one description.
    usage: buildCliSpec(declaration).usage,
  };
}

/**
 * PARSE a query string against a declaration. PURE.
 *
 * Coercion is {@link ./cli-adapter.mjs}'s `coerceInputValue` — the same fn argv tokens go through — because a
 * query parameter and a `--flag=value` are the same problem: a string that has to become a declared type.
 * Unknown parameters are deliberately passed THROUGH to `validateInput` rather than rejected here, so the
 * refusal is the generated one (`unknown input field \`x\` — the declaration does not accept it`) and not a
 * second wording invented by this adapter.
 *
 * @param {object} declaration
 * @param {URLSearchParams|Iterable<[string, string]>} params
 * @returns {{ok: boolean, input: object, errors: string[]}}
 */
export function parseQueryInput(declaration, params) {
  const errors = [];
  const raw = {};
  const seen = new Set();
  for (const [key, value] of params) {
    if (seen.has(key)) {
      errors.push(`query parameter \`${key}\` appears more than once — the declaration accepts one value per field`);
      continue;
    }
    seen.add(key);
    const spec = Object.prototype.hasOwnProperty.call(declaration.input, key) ? declaration.input[key] : null;
    if (!spec) { raw[key] = value; continue; } // let `validateInput` produce the unknown-field refusal.
    const coerced = coerceInputValue(spec.type, value);
    if (coerced === undefined) {
      errors.push(`query parameter \`${key}\` must be a ${spec.type}, got ${JSON.stringify(value)}`);
      continue;
    }
    raw[key] = coerced;
  }
  const validated = validateInput(declaration.input, raw);
  errors.push(...validated.errors);
  return { ok: errors.length === 0, input: validated.value, errors };
}

/**
 * RUN A `compute`-ONLY OPERATION TO COMPLETION. **Takes no store, no sinks and no judge** — that absence is the
 * point, and it is why this function is the whole read-only execution path rather than a flag on the general
 * one. `startRun` and `advanceWhileRunning` are the engine's, which imports nothing from `node:`.
 *
 * THE ABSENCE IS ABOUT THIS FUNCTION'S SCOPE, NOT THE STEP FNS'. Nothing here can write; a `compute` fn the
 * declaration supplies still can, because it is called with whatever its own closure holds. See the header.
 *
 * @param {object} declaration
 * @param {object} o
 * @param {object} [o.input]
 * @param {string} o.id - a run id, for correlation only. Nothing persists it.
 * @param {object} o.registry
 * @returns {object} the completed run record.
 */
export function runReadOnly(declaration, { input = {}, id, registry } = {}) {
  assertReadOnlyDeclaration(declaration);
  const started = startRun({ op: declaration.name, id, input, registry });
  const settled = advanceWhileRunning(started, { registry });
  const status = runStatus(settled, { registry });
  if (status !== 'complete') {
    // Unreachable through `planRoutes` (a compute-only declaration cannot suspend), kept as a refusal so a
    // future kind that slipped past `assertReadOnlyDeclaration` cannot silently return a half-run.
    throw new Error(
      `operations: \`${declaration.name}\` is declared read-only but its run settled at \`${status}\` — refusing to `
      + 'return a partial result from a path that has nothing to resume it with.',
    );
  }
  return settled;
}

/** A JSON response, with the headers a JSON body needs. */
function json(status, body, headers = {}) {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers }, body };
}

/** The error envelope. One shape for every refusal, so a consumer parses one thing. */
function fail(status, message, extra = {}) {
  return json(status, { error: message, ...extra });
}

/** Split a request path into the segments below `basePath`, or `null` when it is not under it. */
export function segmentsUnder(basePath, pathname) {
  const base = String(basePath || '').replace(/\/+$/, '');
  const path = String(pathname || '');
  if (base && path !== base && !path.startsWith(`${base}/`)) return null;
  const rest = base ? path.slice(base.length) : path;
  return rest.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
}

/**
 * The methods this declaration's route table offers at a given path SHAPE (segments after the operation
 * name, with `:runId` standing in for any id). Used to answer `405` with a truthful `Allow`.
 */
function methodsForShape(declaration, shape, basePath) {
  const want = shape.join('/');
  return planRoutes(declaration, { basePath })
    .filter((r) => {
      const segs = segmentsUnder(basePath, r.path);
      return segs.slice(1).join('/') === want;
    })
    .map((r) => r.method);
}

/** Every path shape this declaration serves, for a legible 404. */
function shapesFor(declaration, basePath) {
  return planRoutes(declaration, { basePath }).map((r) => `${r.method} ${r.path}`);
}

/**
 * HANDLE ONE REQUEST. Transport-neutral: values in, values out.
 *
 * @param {object} request
 * @param {string} request.method
 * @param {string} request.url - origin-relative path plus query, e.g. `/operations/suggest-next/run?limit=3`.
 * @param {*} [request.body] - a parsed JSON value for `POST`; ignored for `GET`.
 * @param {object} deps
 * @param {(name: string) => {declaration: object, registry: object, sinks: object}} deps.resolve - throws on
 *   an unknown name. `we:scripts/operations/run.mjs#resolveOperation` is exactly this shape.
 * @param {() => string[]} deps.names - the declared operation names, for the index route.
 * @param {object} [deps.store] - the run store. **Only ever touched on a stateful route.**
 * @param {Function} [deps.judge] - the juror spawner. Only ever touched on a stateful route.
 * @param {(name: string) => string} deps.newRunId
 * @param {string} [deps.basePath]
 * @returns {Promise<{status: number, headers: object, body: *}>}
 */
export async function handleOperationRequest(
  { method = 'GET', url = '/', body = undefined } = {},
  { resolve, names, store, judge, newRunId, basePath = DEFAULT_BASE_PATH } = {},
) {
  if (typeof resolve !== 'function' || typeof names !== 'function' || typeof newRunId !== 'function') {
    throw new TypeError('operations: the HTTP adapter needs `resolve(name)`, `names()` and `newRunId(name)`');
  }
  const parsed = new URL(String(url), URL_BASE);
  const segments = segmentsUnder(basePath, parsed.pathname);
  const verb = String(method).toUpperCase();

  if (segments === null) {
    return fail(404, `no operation surface at ${JSON.stringify(parsed.pathname)} — it is mounted at ${basePath}`);
  }

  // ── /<base> — the index. The HTTP spelling of `run.mjs` with no operation named. ──────────────────────────
  if (segments.length === 0) {
    if (verb !== 'GET') return fail(405, `${verb} is not allowed on ${basePath}`, { allow: ['GET'] });
    return json(200, {
      basePath,
      operations: names().map((name) => {
        const { declaration } = resolve(name);
        return {
          op: name,
          readOnly: isReadOnlyDeclaration(declaration),
          describe: joinPath(basePath, name),
          steps: declaration.steps.map((s) => `${s.name}(${s.step.kind})`),
        };
      }),
    });
  }

  const [name, ...rest] = segments;
  let resolved;
  try {
    resolved = resolve(name);
  } catch (e) {
    // The SAME refusal the command line prints for an unknown operation — one message, one source.
    return fail(404, String(e?.message ?? e));
  }
  const { declaration, registry, sinks } = resolved;
  const readOnly = isReadOnlyDeclaration(declaration);

  /** 405 when the shape exists under another method; otherwise fall through to the 404 below. */
  const wrongMethod = (shape) => {
    const allow = methodsForShape(declaration, shape, basePath);
    return allow.length && !allow.includes(verb)
      ? fail(405, `${verb} is not allowed here — \`${declaration.name}\` serves ${allow.join(', ')} at this path`, { allow })
      : null;
  };

  // ── /<base>/<op> — describe ───────────────────────────────────────────────────────────────────────────────
  if (rest.length === 0) {
    const wrong = wrongMethod([]);
    if (wrong) return wrong;
    return json(200, describeOperation(declaration, { basePath }));
  }

  // ── /<base>/<op>/run — the READ-ONLY execution route. Planned only for a compute-only declaration. ────────
  if (rest.length === 1 && rest[0] === 'run') {
    if (!readOnly) {
      return fail(404, notPlanned(declaration, basePath, 'GET …/run', readOnly));
    }
    const wrong = wrongMethod(['run']);
    if (wrong) return wrong;
    const input = parseQueryInput(declaration, parsed.searchParams);
    if (!input.ok) return fail(400, `cannot start \`${declaration.name}\``, { errors: input.errors });
    let run;
    try {
      // NOTE THE ARGUMENTS: a declaration, an input, an id and a registry. No store. No sinks. No judge.
      run = runReadOnly(declaration, { input: input.input, id: newRunId(declaration.name), registry });
    } catch (e) {
      return fail(500, String(e?.message ?? e));
    }
    return json(200, {
      ...outcomePayload({ run, stopped: 'complete', error: null, applied: [] }),
      status: 'complete',
      // Told, not inferred. See the header: the read-only branch has no store in scope, so this is a
      // structural fact about the code path, not a policy it chose to follow.
      persisted: false,
      persistedWhy: 'every step is `compute`, so the run cannot suspend, completes in one request and never needs to cross a surface; the read-only path is given no run store at all. This says no RUN RECORD was written — not that the operation wrote nothing.',
    });
  }

  // ── the stateful routes. Planned only when the declaration has a step that can suspend or write. ──────────
  if (rest[0] === 'runs') {
    if (readOnly) {
      return fail(404, notPlanned(declaration, basePath, `${verb} …/runs`, readOnly));
    }
    if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
      throw new TypeError(`operations: serving \`${declaration.name}\` over HTTP needs a run \`store\` — it suspends, so its record must be durable between requests`);
    }

    // POST /<base>/<op>/runs — start
    if (rest.length === 1) {
      const wrong = wrongMethod(['runs']);
      if (wrong) return wrong;
      const given = body === undefined || body === null ? {} : body;
      const validated = validateInput(declaration.input, given);
      if (!validated.ok) return fail(400, `cannot start \`${declaration.name}\``, { errors: validated.errors });
      let run;
      try {
        run = startRun({ op: declaration.name, id: newRunId(declaration.name), input: validated.value, registry });
        store.write(run);
      } catch (e) {
        return fail(400, String(e?.message ?? e));
      }
      return driveAndRespond({ run, registry, store, sinks, judge, resume: null, basePath, status: 201 });
    }

    const runId = rest[1];

    // GET /<base>/<op>/runs/<id> — read the record
    if (rest.length === 2) {
      const wrong = wrongMethod(['runs', ':runId']);
      if (wrong) return wrong;
      const run = store.read(runId);
      if (!run) return fail(404, `no run record for ${JSON.stringify(runId)}`);
      if (run.op !== declaration.name) {
        return fail(404, `run ${run.id} is a \`${run.op}\` run, not \`${declaration.name}\``);
      }
      return json(200, {
        // TWO FIELDS, TWO QUESTIONS — and the reason they are both here is that this route answers only one
        // of them. `status` is the engine's derived `runStatus`: what the run is WAITING ON, true of the
        // record itself. `stopped` is where a DRIVE stopped, and no drive happened here, so it is `null`
        // rather than a `runStatus` value wearing the drive vocabulary's clothes — `awaiting-confirm` and
        // `confirm` are not the same word, and a consumer switching on one field should never get both.
        ...outcomePayload({ run, stopped: null, error: null, applied: [] }),
        status: runStatus(run, { registry }),
        persisted: true,
      });
    }

    // POST /<base>/<op>/runs/<id>/advance — resume
    if (rest.length === 3 && rest[2] === 'advance') {
      const wrong = wrongMethod(['runs', ':runId', 'advance']);
      if (wrong) return wrong;
      const run = store.read(runId);
      if (!run) return fail(404, `no run record for ${JSON.stringify(runId)}`);
      if (run.op !== declaration.name) {
        return fail(404, `run ${run.id} is a \`${run.op}\` run, not \`${declaration.name}\``);
      }
      let resume = null;
      if (body != null && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'value')) {
        const status = runStatus(run, { registry });
        if (status !== 'awaiting-confirm') {
          // THE STOP-POINT PROPERTY, verbatim from the command line: you cannot answer a question that has
          // not been asked. 409 rather than 400 — the body is well-formed, the RUN is in the wrong state.
          return fail(409, `run ${run.id} is \`${status}\`, not awaiting a decision — refusing an answer for a question that has not been asked. POST with no \`value\` to drive it to its next stop.`);
        }
        resume = { step: run.pending.step, value: body.value };
      }
      return driveAndRespond({ run, registry, store, sinks, judge, resume, basePath, status: 200 });
    }
  }

  return fail(404, notPlanned(declaration, basePath, `${verb} /${segments.join('/')}`, readOnly));
}

/** The 404 body for a path the declaration's own route table never planned. */
function notPlanned(declaration, basePath, attempted, readOnly) {
  const why = readOnly
    ? `\`${declaration.name}\` is READ-ONLY — every declared step is \`compute\`, so it cannot suspend and has no run records and no non-GET routes. Its route table is derived from those step kinds, not from a policy.`
    : `\`${declaration.name}\` suspends, so it is served through run records rather than a single call.`;
  return `${attempted} is not a route \`${declaration.name}\` declares. ${why} Routes: ${shapesFor(declaration, basePath).join(' · ')}`;
}

/**
 * Drive a stateful run and render it, sharing one response shape with the read routes.
 *
 * The status code follows the CLI's exit code exactly: `complete`, `confirm` and `effect-in-flight` are the
 * stops the command line exits 0 on (a suspend is a successful outcome — the run is parked, waiting for a
 * person, a juror, or work that outlives this process), and everything else is the `stopped` states it exits
 * 1 on.
 *
 * `effect-in-flight` (#3073) joined that list because a DISPATCH is the epic's target operation, and 500-ing
 * on it would report the one thing the machinery exists to do as a server fault.
 */
async function driveAndRespond({ run, registry, store, sinks, judge, resume, basePath, status }) {
  let outcome;
  try {
    // A NETWORK CLIENT, which this adapter cannot identify — it could be a person in a console or another
    // machine. `unknown` is excluded from both retry populations rather than padding either.
    outcome = await driveRun({ run, registry, store, sinks, judge, resume, attemptedBy: 'unknown' });
  } catch (e) {
    return fail(500, String(e?.message ?? e));
  }
  const settled = outcome.stopped === 'complete' || outcome.stopped === 'confirm' || outcome.stopped === 'effect-in-flight';
  return json(settled ? status : 500, {
    ...outcomePayload(outcome),
    status: runStatus(outcome.run, { registry }),
    persisted: true,
  }, {
    ...(settled && status === 201
      ? { location: joinPath(basePath, outcome.run.op, 'runs', outcome.run.id) }
      : {}),
  });
}

/**
 * ADAPT {@link handleOperationRequest} to a `node:http` request listener — and import nothing to do it. The
 * `req`/`res` pair is duck-typed, so the same shim serves a Vite dev-server middleware (which hands over the
 * identical objects) with no change.
 *
 * @param {object} deps - exactly {@link handleOperationRequest}'s deps.
 * @param {{maxBodyBytes?: number}} [options]
 * @returns {(req: object, res: object) => Promise<void>}
 */
export function createNodeRequestListener(deps, { maxBodyBytes = 1_000_000 } = {}) {
  return async function operationsRequestListener(req, res) {
    let response;
    try {
      const body = await readJsonBody(req, maxBodyBytes);
      response = await handleOperationRequest({ method: req.method, url: req.url, body }, deps);
    } catch (e) {
      response = fail(e && e.httpStatus ? e.httpStatus : 500, String(e?.message ?? e));
    }
    const text = `${JSON.stringify(response.body, null, 2)}\n`;
    const headers = { ...response.headers };
    if (Array.isArray(response.body?.allow)) headers.allow = response.body.allow.join(', ');
    res.writeHead(response.status, headers);
    res.end(text);
  };
}

/** Collect and parse a JSON request body. Returns `undefined` for a method that carries none. */
function readJsonBody(req, maxBodyBytes) {
  const verb = String(req.method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return Promise.resolve(undefined);
  return new Promise((resolveBody, rejectBody) => {
    let text = '';
    let over = false;
    req.on('data', (chunk) => {
      if (over) return;
      text += chunk;
      if (text.length > maxBodyBytes) {
        over = true;
        rejectBody(Object.assign(new Error(`request body exceeds ${maxBodyBytes} bytes`), { httpStatus: 413 }));
      }
    });
    req.on('error', rejectBody);
    req.on('end', () => {
      if (over) return;
      if (!text.trim()) { resolveBody(undefined); return; }
      try {
        resolveBody(JSON.parse(text));
      } catch (e) {
        rejectBody(Object.assign(new Error(`request body is not parseable JSON (${e.message})`), { httpStatus: 400 }));
      }
    });
  });
}
