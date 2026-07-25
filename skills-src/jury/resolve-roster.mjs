#!/usr/bin/env node
/**
 * resolve-roster.mjs — the THIN engine-invoker the subject-agnostic jury workflow shells (#2658, S6 / F1 front
 * door of epic #2649).
 *
 * WHY THIS FILE EXISTS. The jury METHOD lives ONCE in the subject-agnostic core (`we:scripts/lib/jury-core.mjs`,
 * the #2656 F2 seam) and each SUBJECT plugs in through a thin per-domain adapter (PR-diff in `review-core.mjs`,
 * design-pixels / decision-prose in their own `*-adapter.mjs` modules). The `/jury` workflow harness
 * (`subject-jury.workflow.js`, next to this file) is a Workflow SANDBOX with NO `import` — it cannot pull in a
 * repo module, so it cannot call `resolveAdapterRoster` / `materializeRoster` / `buildMandate` directly. This shim
 * is the ONE place those engine calls happen: an `agent()` step in the workflow shells `node resolve-roster.mjs`
 * exactly as the review-parked workflow shells `node scripts/review-core-cli.mjs`. It is the jury analogue of
 * `review-core-cli.mjs` — engine-tier GLUE, not method.
 *
 * IT CONTAINS ZERO JURY LOGIC (the F1 ruling). It does NOT decide who is on the jury, how many rounds run, how a
 * split verdict reduces, or which lens is mandatory — every one of those is a pure derivation it IMPORTS from
 * `jury-core.mjs` and calls. This shim only: (1) selects the adapter for a `--subject`, (2) calls the engine's
 * `resolveAdapterRoster` + `materializeRoster` to get the roster plan and its jurors, (3) asks the adapter for
 * each lens's mandate text (its own `buildMandate`), and (4) prints the result as JSON. If a rule about the jury
 * changes, it changes in `jury-core.mjs` / the adapter — never here.
 *
 * HOME NOTE (#2658 scope = `we:skills-src/`). The engine-tier CLI convention would put a shim like this under
 * `scripts/` next to `review-core-cli.mjs`; it lives here beside the workflow it serves because this slice's scope
 * is `skills-src/`, and — being pure glue with no method — its home is not load-bearing. The METHOD it invokes
 * stays in `scripts/lib/` (#96 / F2 boundary intact).
 *
 * Usage:
 *   node skills-src/jury/resolve-roster.mjs --subject=pr-diff       --care-level=low  --input='["src/a.ts"]' --json
 *   node skills-src/jury/resolve-roster.mjs --subject=design-pixels --care-level=high --input='{"surfaces":["board"],"hasTarget":true}' --json
 *   node skills-src/jury/resolve-roster.mjs --subject=decision-prose --care-level=elevated --input='{"approach":"…"}' --json
 *   # optional: --overrides='[{"op":"add","lens":"perf"}]'   (the F3 minimal ledger-trailed override layer)
 *
 * Output (JSON on stdout): {
 *   subject, careLevel, plan, mandatoryLenses, jurors: [{ id, lens, charter, method?, mandate }], rosterEvent
 * }
 * — `plan` is the `resolveAdapterRoster` output (dial + seats), `jurors` the materialized roster with each juror's
 * per-lens mandate attached, `rosterEvent` the schema-valid #2654 `roster-picked` event (the ledger seed), or null
 * when the roster is empty (care `none` / empty subject input → no jury).
 *
 * Exit codes: 0 = ok; 2 = usage error (unknown subject / bad flags / bad --input JSON); 1 = an engine derivation
 * threw (e.g. an unknown care-level) — the message is printed as `{error}`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveAdapterRoster,
  materializeRoster,
  rosterPickedEvent,
  MANDATORY_LENSES,
} from '../../scripts/lib/jury-core.mjs';
import { PR_DIFF_ADAPTER } from '../../scripts/lib/review-core.mjs';
import { DESIGN_PIXELS_ADAPTER } from '../../scripts/lib/design-pixels-adapter.mjs';
import { DECISION_PROSE_ADAPTER } from '../../scripts/lib/decision-prose-adapter.mjs';

/** subject id → its shipped adapter. The ONLY subject-specific knowledge in this shim: which plug to hand the
 *  engine. Every adapter conforms to `SUBJECT_ADAPTER_CONTRACT`; the engine validates it before building a roster. */
const ADAPTERS = {
  'pr-diff': PR_DIFF_ADAPTER,
  'design-pixels': DESIGN_PIXELS_ADAPTER,
  'decision-prose': DECISION_PROSE_ADAPTER,
};

/** Parse `--k=v` / bare `--flag` argv into a plain object (matches review-core-cli's parser). Pure. */
export function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/**
 * Resolve the jury roster for a subject through its adapter and materialize it into jurors + per-lens mandates.
 * Pure GLUE — it calls the engine and the adapter, deriving nothing itself. Returns the object the workflow
 * consumes. Throws (loudly) on an unknown subject or an engine derivation error, so a misconfigured launch fails
 * at this boundary, not deep in a fan-out.
 *
 * @param {{subject: string, careLevel: string, input?: *, overrides?: Array<{op:string,lens:string}>}} o
 * @returns {{subject: string, careLevel: string, plan: object, mandatoryLenses: string[],
 *   jurors: Array<{id:string, lens:string, charter:string, method?:string, mandate:string}>,
 *   rosterEvent: object|null}}
 */
export function resolveJuryRoster({ subject, careLevel, input, overrides = [] } = {}) {
  const adapter = ADAPTERS[subject];
  if (!adapter) {
    throw new Error(`resolve-roster: unknown subject "${String(subject)}" — must be one of ${Object.keys(ADAPTERS).join(', ')}`);
  }

  // (1)+(2) — the engine builds the roster from the adapter (validates the adapter, extracts the touch-set,
  // runs the stateless recompute, applies the minimal overrides). ctx carries careLevel for the PR-diff adapter's
  // per-band method registry; the other adapters ignore it.
  const plan = resolveAdapterRoster({ adapter, careLevel, input, overrides, ctx: { careLevel } });

  // The engine materializes the plan into jurors (the diverse jury a high-care band earns) using the adapter's
  // own charter text. No re-derivation — `materializeRoster` owns the id/charter/method shape.
  const jurors = materializeRoster(plan, { charterForLens: adapter.charterForLens });

  // (3) — the adapter's OWN mandate framing for each lens (the subject-neutral skeleton lives in `buildSubjectMandate`
  // inside the core; the adapter supplies the subject parts). Cache per lens so a jurors-per-lens>1 jury shares one
  // mandate string. An adapter without a `buildMandate` (contract-optional) yields no mandate — the workflow then
  // asks the juror to fetch its mandate itself, mirroring the review-parked reviewer.
  const buildMandate = typeof adapter.buildMandate === 'function' ? adapter.buildMandate : null;
  const mandateByLens = {};
  const mandateFor = (lens) => {
    if (!buildMandate) return undefined;
    if (!(lens in mandateByLens)) {
      // Pass lens under every key the three adapters read (`lens`, `mandate`) plus `approach` (decision-prose's
      // input) so ONE uniform call frames the right mandate whichever subject this is; extra keys are ignored.
      mandateByLens[lens] = buildMandate({ lens, mandate: lens, approach: decisionApproachOf(input) });
    }
    return mandateByLens[lens];
  };

  const jurorsOut = jurors.map((j) => {
    const mandate = mandateFor(j.lens);
    return mandate != null ? { ...j, mandate } : { ...j };
  });

  // (4-seed) — the schema-valid #2654 roster-picked event, the ledger seed the workflow returns (null when empty).
  const rosterEvent = rosterPickedEvent(plan, { round: 0, charterForLens: adapter.charterForLens });

  const mandatoryLenses = Array.isArray(adapter.mandatoryLenses) && adapter.mandatoryLenses.length
    ? [...adapter.mandatoryLenses]
    : [...MANDATORY_LENSES];

  return { subject, careLevel, plan, mandatoryLenses, jurors: jurorsOut, rosterEvent };
}

/** The decision-prose subject frames its mandate around the proposed APPROACH prose; pull it from the input for
 *  the uniform `buildMandate` call (a no-op for the other subjects, whose buildMandate ignores it). Pure. */
function decisionApproachOf(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && !Array.isArray(input)) return input.approach ?? input.task ?? '';
  return '';
}

// ── thin impure CLI ──────────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) main(process.argv.slice(2));

function fail(msg, code) {
  process.stdout.write(`${JSON.stringify({ error: msg })}\n`);
  process.exit(code);
}

/** Read a JSON flag value directly (`--k={...}`) or, when it names a path via `--k-file=`, from that file. */
function readJsonFlag(flags, key) {
  if (typeof flags[`${key}-file`] === 'string') {
    return JSON.parse(readFileSync(flags[`${key}-file`], 'utf8'));
  }
  if (typeof flags[key] === 'string') return JSON.parse(flags[key]);
  return undefined;
}

function main(argv) {
  const flags = parseFlags(argv.slice(0)); // no subcommand — all flags
  const subject = typeof flags.subject === 'string' ? flags.subject : '';
  const careLevel = typeof flags['care-level'] === 'string' ? flags['care-level'] : '';
  if (!subject) return fail('resolve-roster: --subject=<pr-diff|design-pixels|decision-prose> is required', 2);
  if (!careLevel) return fail('resolve-roster: --care-level=<none|low|elevated|high> is required', 2);

  let input;
  let overrides;
  try {
    input = readJsonFlag(flags, 'input');
    overrides = readJsonFlag(flags, 'overrides') ?? [];
  } catch (e) {
    return fail(`resolve-roster: could not parse --input/--overrides JSON: ${String((e && e.message) || e)}`, 2);
  }

  let result;
  try {
    result = resolveJuryRoster({ subject, careLevel, input, overrides });
  } catch (e) {
    // An unknown subject / bad flags is a usage error (2); an engine derivation throw (e.g. unknown care-level) is 1.
    const msg = String((e && e.message) || e);
    return fail(msg, /unknown subject|is required/.test(msg) ? 2 : 1);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
  return process.exit(0);
}
