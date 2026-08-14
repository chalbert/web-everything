#!/usr/bin/env node
/**
 * decision-route.mjs — the THIN SHELL over the #2704 decision-routing core (`we:scripts/lib/decision-routing.mjs`).
 *
 * WHAT: given a cleared decision's criticality/complexity signals, this reports WHICH multi-agent process the
 * conveyor should run it through — RED-TEAM CONVERGENCE (bounded) or a DESIGN COMMITTEE (complex / critical) — and,
 * when handed the jury LEDGER that process rendered, whether the ruling AUTO-DISPOSES (shadow-first) or ESCALATES
 * to a human. It is the operator's 2026-07-26 ruling, coded into the flow instead of hand-run per decision.
 *
 * PURE-CORE / THIN-SHELL (per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment], #2607). Every
 * script-decidable call — classify, route, dispose — lives in the PURE core this shells (`planDecision`); this file
 * owns only the impure edges: parse the signals, resolve the #2651 disposition config (for the shadow/enforce land
 * mode), print the plan. The actual multi-agent CONVERGENCE RUN (spawning the adversaries / the committee) is the
 * conveyor skill's job, driven off the process this reports.
 *
 * OBSERVE-ONLY BY CONSTRUCTION (shadow-first, the ratified default). This shell NEVER mutates backlog state — it
 * does not ratify a decision, even when the plan's `apply` is true (`enforce`). Acting on an `enforce` ratify plan
 * is a deliberately SEPARATE, later-gated seam; the shell only ever COMPUTES and REPORTS the plan, so running it can
 * never auto-ratify anything.
 *
 * THE SHADOW→ENFORCE FLIP (#2754). The flip #2704 left as "a separate later ruling" is now DEFINED and GATED in the
 * pure core (`resolveLandMode` / `computeAgreementMetric`): the effective land mode is `enforce` ONLY when the
 * operator has armed it (global `landMode: enforce`) AND a confidence metric — N consecutive shadow-vs-human matches
 * with zero divergence over the trailing M decided decisions — is green. This shell wires that in: it reads the
 * shadow-vs-human AGREEMENT LEDGER (`--agreement-file`, or a stdin `agreement`) and threads it into `planDecision`,
 * so the reported disposition already reflects the gated mode. The agreement ledger is DATA, never a mode override —
 * the operator ceiling still comes only from the global config; the metric can only hold the mode DOWN or (when
 * armed) let it through. The metric is READABLE WITHOUT A SESSION here: run with just `--agreement-file` for the
 * "how many consecutive matches, zero divergences?" answer and the resolved flip state.
 *
 * Usage (CLI):
 *   node scripts/conveyor/decision-route.mjs [--blast-radius] [--size=<lines>] [--cross-repo] [--dismissed=<n>] \
 *        [--human-required] [--gate-self] [--statute] [--non-convergence] \
 *        [--ledger-file=<path>] [--agreement-file=<path>] [--band=<care-band>] [--json]
 *   # session-free flip metric only (no decision ledger needed):
 *   node scripts/conveyor/decision-route.mjs --agreement-file=<path> [--json]
 *   # append one decided decision's shadow-vs-human outcome to the agreement ledger:
 *   node scripts/conveyor/decision-route.mjs --record --shadow=<ratify|escalate> --human=<ratify|escalate>
 *   echo '{"signals":{"blastRadius":true},"ledger":[…],"agreement":[…]}' \
 *        | node scripts/conveyor/decision-route.mjs --stdin [--json]
 *
 * The `signals` are the SAME `scoreEscalation` signals the producer escalation rubric reads (#2567) — no new score
 * is invented. A `--ledger-file` (or a stdin `ledger`) is the process's #2654 jury-ledger event stream; without it
 * the shell reports only the ROUTE (the process has not run yet), and the caller runs the routed process, then
 * re-invokes with the ledger to get the DISPOSITION. The `--agreement-file` is the shadow-vs-human agreement ledger
 * (an array of `recordShadowOutcome` records) the #2754 flip metric reads.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  planDecision,
  recordShadowOutcome,
  resolveLandMode,
  DECISION_PROCESSES,
  RULING_ACTIONS,
} from '../lib/decision-routing.mjs';
import { resolveDispositionConfig } from '../lib/review-policy.mjs';
import { writeLineSync } from '../lib/write-all-sync.mjs';

/** Parse `--flag` / `--flag=value` argv into a flat map (value `true` for a bare flag). Pure. */
export function parseArgs(argv) {
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
 * Build the routing inputs (`signals` / `humanRequired` / `dispositionSignals`) from a flat flag map merged over an
 * optional stdin payload. PURE. Flags take precedence over the stdin object for the boolean signal switches, while
 * the stdin object can carry richer values (a full `signals` object, a `ledger` array). `humanRequired` is set by
 * ANY of `--human-required` / `--gate-self` / `--statute` (a statute / policy-tier decision is maximum criticality).
 * @param {Record<string,string|boolean>} f - parsed flags
 * @param {{signals?:object, humanRequired?:boolean, ledger?:Array, dispositionSignals?:object}} [payload]
 * @returns {{signals:object, humanRequired:boolean, dispositionSignals:object, ledger:(Array|null)}}
 */
export function buildInputs(f, payload = {}) {
  const base = payload && typeof payload.signals === 'object' && payload.signals ? { ...payload.signals } : {};
  if (f['blast-radius']) base.blastRadius = true;
  if (f['cross-repo']) base.crossRepo = true;
  if (f.size !== undefined && f.size !== true) base.size = Number(f.size);
  if (f.dismissed !== undefined && f.dismissed !== true) base.dismissedFindings = Number(f.dismissed);

  const gateSelf = !!f['gate-self'] || !!(payload.dispositionSignals && payload.dispositionSignals.gateSelf);
  const statute = !!f.statute;
  const humanReqFlag = !!f['human-required'] || !!(payload.dispositionSignals && payload.dispositionSignals.humanRequired);
  const humanRequired = payload.humanRequired === true || humanReqFlag || gateSelf || statute;
  const nonConvergence = !!f['non-convergence'] || !!(payload.dispositionSignals && payload.dispositionSignals.nonConvergence);

  const ledger = Array.isArray(payload.ledger) ? payload.ledger : null;
  // NOTE: the land `mode` is NOT taken from any input — it is GLOBAL-only (#2675), resolved from the disposition
  // config's `landMode` in `main`, so a stdin/flag can never misreport `enforce` while the ratified stance is shadow.
  return {
    signals: base,
    humanRequired,
    dispositionSignals: { gateSelf, humanRequired, nonConvergence },
    ledger,
  };
}

/** Read + JSON-parse a file, exiting(2) with a friendly message on any error. Optionally require an array. */
function readJsonFile(path, label, { requireArray = false } = {}) {
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
    console.error(`decision-route: could not read ${label} (${e.message})`);
    process.exit(2);
  }
  if (requireArray && !Array.isArray(data)) {
    console.error(`decision-route: ${label} must be a JSON array`);
    process.exit(2);
  }
  return data;
}

function main(argv) {
  const f = parseArgs(argv);

  // --record: append-one helper (#2754). Print ONE shadow-vs-human outcome record the caller pipes into the
  // agreement ledger. Pure/side-effect-free — the shell prints, the caller persists (keeps observe-only intact).
  if (f.record) {
    const rec = recordShadowOutcome({
      shadowAction: f.shadow === true ? undefined : f.shadow,
      humanAction: f.human === true ? undefined : f.human,
    });
    writeLineSync(1, JSON.stringify(rec));
    process.exit(0);
  }

  let payload = {};
  if (f.stdin) {
    try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch (e) {
      console.error(`decision-route: --stdin expects one JSON object (${e.message})`);
      process.exit(2);
    }
  }
  const inputs = buildInputs(f, payload);

  // A ledger from a --ledger-file overrides / supplies the process's rendered jury ledger.
  let ledger = inputs.ledger;
  if (f['ledger-file'] && typeof f['ledger-file'] === 'string') {
    ledger = readJsonFile(f['ledger-file'], '--ledger-file');
  }

  // The shadow-vs-human AGREEMENT LEDGER (#2754) — DATA the flip metric reads (never a mode override). A
  // --agreement-file wins over a stdin `agreement` array.
  let agreement = Array.isArray(payload.agreement) ? payload.agreement : null;
  if (f['agreement-file'] && typeof f['agreement-file'] === 'string') {
    agreement = readJsonFile(f['agreement-file'], '--agreement-file', { requireArray: true });
  }

  // Resolve the disposition config only when we have a ledger to dispose (it carries the global shadow/enforce
  // landMode — the ONLY source of the operator CEILING; never an input override). A bad band fails loud here at the
  // impure boundary, never inside the pure core.
  let config;
  let mode;
  if (Array.isArray(ledger)) {
    try { config = resolveDispositionConfig({ band: f.band === true ? undefined : f.band }); } catch (e) {
      console.error(`decision-route: ${e.message}`);
      process.exit(2);
    }
    mode = config.landMode; // shadow by default (the ratified stance) — global-only, never overridable
  }

  // #2754 SESSION-FREE METRIC: an --agreement-file with NO decision ledger reports just the flip state. This is the
  // "how many consecutive matches, zero divergences?" answer, readable without a session.
  if (Array.isArray(agreement) && !Array.isArray(ledger)) {
    // landMode is GLOBAL-only (review-policy.mjs :381-383) — no band/decision layer touches it, so resolve it
    // with NO band. Keep the try/catch anyway if you ever pass a band: resolveDispositionConfig THROWS on an
    // unknown band, and this file's contract is "a bad band fails loud at the impure boundary" (:155-157).
    const resolution = resolveLandMode({ records: agreement, configMode: resolveDispositionConfig().landMode });
    if (f.json) {
      writeLineSync(1, JSON.stringify({ metric: resolution.metric, landMode: { mode: resolution.mode, reason: resolution.reason, trail: resolution.trail } }));
    } else {
      console.log([
        `flip-metric: ${resolution.metric.answer}`,
        `  trigger: N=${resolution.metric.N} consecutive matches, 0 divergences over the last M=${resolution.metric.M}`,
        `land-mode: ${resolution.mode} (${resolution.reason})`,
        ...resolution.trail.slice(1).map((t) => `  ${t}`),
      ].join('\n'));
    }
    process.exit(0);
  }

  const plan = planDecision({
    signals: inputs.signals,
    humanRequired: inputs.humanRequired,
    ledger: Array.isArray(ledger) ? ledger : null,
    config,
    dispositionSignals: inputs.dispositionSignals,
    mode,
    agreementRecords: Array.isArray(agreement) ? agreement : null,
  });

  // Emit the shadow/enforce observation to stderr (the ledger stream) — kept off stdout so --json stays clean.
  if (plan.disposition) process.stderr.write(`${plan.disposition.observation}\n`);

  if (f.json) {
    console.log(JSON.stringify(plan));
  } else {
    const r = plan.route;
    const lines = [`process: ${r.process} (${r.reason})`, ...r.trail.map((t) => `  ${t}`)];
    if (plan.landMode) {
      lines.push(`land-mode: ${plan.landMode.mode} (${plan.landMode.reason})`, ...plan.landMode.trail.map((t) => `  ${t}`));
    }
    if (plan.disposition) {
      const d = plan.disposition;
      lines.push(`disposition: ${d.action} [${d.mode}]${d.apply ? ' — APPLY' : ''} (${d.reason})`, `  ${d.observation}`);
    } else {
      lines.push('disposition: (no ledger yet — run the routed process, then re-invoke with its jury ledger)');
    }
    console.log(lines.join('\n'));
  }
  process.exit(0);
}

export { DECISION_PROCESSES, RULING_ACTIONS };

// Run only as a CLI (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
