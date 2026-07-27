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
