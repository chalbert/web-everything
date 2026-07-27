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
 * is a deliberately SEPARATE, later-gated seam (the shadow→enforce flip is its own one-line ruling, #2704 (c)); the
 * shell only ever COMPUTES and REPORTS the plan, so running it can never auto-ratify anything.
 *
 * Usage (CLI):
 *   node scripts/conveyor/decision-route.mjs [--blast-radius] [--size=<lines>] [--cross-repo] [--dismissed=<n>] \
 *        [--human-required] [--gate-self] [--statute] [--non-convergence] \
 *        [--ledger-file=<path>] [--band=<care-band>] [--json]
 *   echo '{"signals":{"blastRadius":true},"humanRequired":false,"ledger":[…]}' \
 *        | node scripts/conveyor/decision-route.mjs --stdin [--json]
 *
 * The `signals` are the SAME `scoreEscalation` signals the producer escalation rubric reads (#2567) — no new score
 * is invented. A `--ledger-file` (or a stdin `ledger`) is the process's #2654 jury-ledger event stream; without it
 * the shell reports only the ROUTE (the process has not run yet), and the caller runs the routed process, then
 * re-invokes with the ledger to get the DISPOSITION.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planDecision, DECISION_PROCESSES, RULING_ACTIONS } from '../lib/decision-routing.mjs';
import { resolveDispositionConfig } from '../lib/review-policy.mjs';

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

function main(argv) {
  const f = parseArgs(argv);
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
    try { ledger = JSON.parse(readFileSync(f['ledger-file'], 'utf8')); } catch (e) {
      console.error(`decision-route: could not read --ledger-file (${e.message})`);
      process.exit(2);
    }
  }

  // Resolve the disposition config only when we have a ledger to dispose (it carries the global shadow/enforce
  // landMode — the ONLY source of the mode; never an input override). A bad band fails loud here at the impure
  // boundary, never inside the pure core.
  let config;
  let mode;
  if (Array.isArray(ledger)) {
    try { config = resolveDispositionConfig({ band: f.band === true ? undefined : f.band }); } catch (e) {
      console.error(`decision-route: ${e.message}`);
      process.exit(2);
    }
    mode = config.landMode; // shadow by default (the ratified stance) — global-only, never overridable
  }

  const plan = planDecision({
    signals: inputs.signals,
    humanRequired: inputs.humanRequired,
    ledger: Array.isArray(ledger) ? ledger : null,
    config,
    dispositionSignals: inputs.dispositionSignals,
    mode,
  });

  // Emit the shadow/enforce observation to stderr (the ledger stream) — kept off stdout so --json stays clean.
  if (plan.disposition) process.stderr.write(`${plan.disposition.observation}\n`);

  if (f.json) {
    console.log(JSON.stringify(plan));
  } else {
    const r = plan.route;
    const lines = [`process: ${r.process} (${r.reason})`, ...r.trail.map((t) => `  ${t}`)];
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
