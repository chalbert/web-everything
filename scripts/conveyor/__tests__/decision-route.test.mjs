/**
 * @file decision-route.test.mjs — proof of the #2704 decision-route SHELL's pure edges (`parseArgs` / `buildInputs`)
 *   and an end-to-end CLI smoke: route-only (no ledger) and route+dispose (with a ledger). The routing/disposition
 *   LOGIC is proven in the pure core's test (`we:scripts/lib/__tests__/decision-routing.test.mjs`); this covers only
 *   the shell's flag→signal mapping and that the CLI prints a well-formed plan and never mutates state.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs, buildInputs } from '../decision-route.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'decision-route.mjs');

function run(args, input) {
  const out = execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    input: input ?? undefined,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

/** Like `run`, but returns the raw stdout string — for the human-readable (non-`--json`) assertions. */
function runRaw(args, input) {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    input: input ?? undefined,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });
}

describe('parseArgs', () => {
  it('parses bare flags as true and =value flags as their value', () => {
    expect(parseArgs(['--blast-radius', '--size=500', '--json'])).toEqual({ 'blast-radius': true, size: '500', json: true });
  });
});

describe('buildInputs — flag → signal mapping', () => {
  it('maps the scored-signal flags into a scoreEscalation signals object', () => {
    const inp = buildInputs({ 'blast-radius': true, 'cross-repo': true, size: '300', dismissed: '2' });
    expect(inp.signals).toEqual({ blastRadius: true, crossRepo: true, size: 300, dismissedFindings: 2 });
    expect(inp.humanRequired).toBe(false);
  });

  it('any of --human-required / --gate-self / --statute sets humanRequired', () => {
    expect(buildInputs({ 'human-required': true }).humanRequired).toBe(true);
    expect(buildInputs({ 'gate-self': true }).humanRequired).toBe(true);
    expect(buildInputs({ statute: true }).humanRequired).toBe(true);
  });

  it('threads the hard-escalate disposition signals', () => {
    const inp = buildInputs({ 'gate-self': true, 'non-convergence': true });
    expect(inp.dispositionSignals).toEqual({ gateSelf: true, humanRequired: true, nonConvergence: true });
  });

  it('a stdin payload supplies a richer signals object and a ledger, flags still win on switches', () => {
    const inp = buildInputs({ 'blast-radius': true }, { signals: { size: 900 }, ledger: [{ type: 'roster-picked' }] });
    expect(inp.signals).toEqual({ size: 900, blastRadius: true });
    expect(inp.ledger).toEqual([{ type: 'roster-picked' }]);
  });
});

describe('CLI end-to-end', () => {
  it('route-only (no ledger): reports the process and a null disposition', () => {
    const bounded = run(['--json']);
    expect(bounded.route.process).toBe('red-team-convergence');
    expect(bounded.disposition).toBeNull();

    const complex = run(['--blast-radius', '--json']);
    expect(complex.route.process).toBe('design-committee');
  });

  it('a humanRequired decision routes to the committee', () => {
    const r = run(['--statute', '--json']);
    expect(r.route.process).toBe('design-committee');
    expect(r.route.reason).toBe('critical');
  });

  it('with a converged jury ledger on stdin: shadow-first RATIFY, apply:false (never mutates state)', () => {
    // A clean, diverse, all-accept ledger over the two mandatory decision lenses (#2657).
    const jurors = [];
    const verdicts = [];
    for (const lens of ['root-cause', 'completeness']) {
      for (const slot of [1, 2]) {
        const id = `${lens}#${slot}`;
        jurors.push({ id, lens, charter: 'judge' });
        verdicts.push({ type: 'verdict', round: 0, jurorId: id, verdict: 'accept' });
      }
    }
    const ledger = [{ type: 'roster-picked', round: 0, jurors }, ...verdicts];
    const r = run(['--stdin', '--json'], JSON.stringify({ ledger }));
    expect(r.disposition.action).toBe('ratify');
    expect(r.disposition.apply).toBe(false); // shadow default — a human still confirms
    expect(r.disposition.mode).toBe('shadow');
  });
});

describe('#2787 session-free flip metric — CLI must distinguish metric-green from operator-armed', () => {
  it('20 matches: stdout shows the metric AND land-mode: shadow (metric-green-but-operator-shadow) AND the un-armed sentence, never an "enforce armed" claim', () => {
    const agreement = Array.from({ length: 20 }, () => ({ match: true }));
    const out = runRaw(['--stdin'], JSON.stringify({ agreement }));
    expect(out).toMatch(/flip-metric: 20\/20 consecutive matches, 0 divergence\(s\) in the last 20\/20 decided → FLIP-READY/);
    expect(out).toMatch(/land-mode: shadow \(metric-green-but-operator-shadow\)/);
    expect(out).toMatch(/held observe-only.*arm with landMode: enforce/);
    expect(out).not.toMatch(/enforce armed/);
  });

  it('a below-trigger ledger: land-mode: shadow (operator-shadow-ceiling), still no armed claim', () => {
    const agreement = Array.from({ length: 5 }, () => ({ match: true }));
    const out = runRaw(['--stdin'], JSON.stringify({ agreement }));
    expect(out).toMatch(/flip-metric: 5\/20 consecutive matches, 0 divergence\(s\) in the last 5\/20 decided → below trigger/);
    expect(out).toMatch(/land-mode: shadow \(operator-shadow-ceiling\)/);
    expect(out).not.toMatch(/enforce armed/);
  });

  it('--json on the session-free path emits { metric, landMode: { mode, reason, trail } }, metric keys unchanged', () => {
    const agreement = Array.from({ length: 20 }, () => ({ match: true }));
    const r = run(['--stdin', '--json'], JSON.stringify({ agreement }));
    expect(Object.keys(r.metric).sort()).toEqual(
      ['N', 'M', 'answer', 'consecutiveMatches', 'decided', 'divergencesInWindow', 'flipReady', 'windowSize'].sort(),
    );
    expect(r.landMode.mode).toBe('shadow');
    expect(r.landMode.reason).toBe('metric-green-but-operator-shadow');
    expect(r.landMode.trail.length).toBe(2);
  });
});
