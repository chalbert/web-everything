/**
 * @file fake-claude.mjs — a REAL `claude` executable on `PATH` that costs nothing to run.
 *
 * WHY THIS EXISTS, stated as the hole it closes. `we:scripts/operations/dispatch-lane-io.mjs`'s own
 * integration test says it outright:
 *
 *     *"NOT YET PROVEN LIVE. No test starts a `claude` process."*
 *
 * Starting an agent is the ONE effect this whole delivery loop is built around, and nothing exercised it.
 * `buildAgentArgv` is pure and asserted, which pins the argv's SPELLING — but the same argument
 * `we:scripts/operations/__tests__/helpers/real-repo.mjs` makes about git applies here: asserting the argv
 * never says whether a CLI ACCEPTS it. That file's line is the general rule, and this is its second instance:
 *
 *     *"A STUB RETURNING `''` CANNOT HAVE CLONE GEOMETRY … asserting the argv only pins today's spelling,
 *      it never says whether the spelling WORKS."*
 *
 * The argv here has a specific reason to be doubted rather than assumed. `dispatch-lane-io.mjs`'s own
 * comment records that the prompt's position was decided WITHOUT a live check — *"untested against the real
 * CLI, and a wrong bet turns into a dispatch with a mangled prompt"* — and worked around by refusing a
 * leading dash. A shim that parses its argv the same way a real CLI would turns that bet into an assertion.
 *
 * WHAT THIS IS NOT. It does not run a model, spend a token, or prove an agent does useful work. It proves
 * the PLUMBING: that the argv parses, that `--bg` returns immediately rather than blocking, that the session
 * id the dispatcher pins is the id the observer later finds, and that a spawn failure surfaces as a failure.
 * The quality of what an agent produces is a different test and a different budget — this is the harness that
 * makes that test a swap of one binding rather than a new build.
 *
 * HOW IT WORKS. `withFakeClaude` writes an executable `claude` into a temp directory and hands back the
 * `PATH` prefix plus readers over what it recorded. Point `PATH` at it and the REAL
 * `defaultSpawnAgent`/`execFileSync` path runs unmodified — no injected spawner, no replaced production
 * path. That is deliberate, and it is the same reasoning `dispatch-lane-io.mjs` gives for separating `exec`
 * from `runNode`: overriding the high seam replaces the code under test, overriding the low one exercises it.
 */

import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The shim, as a node script. Kept in one string so the fixture is a single file with nothing to resolve. */
const SHIM = `#!/usr/bin/env node
// A stand-in for the \`claude\` CLI. Records every invocation, emulates the two sub-commands the delivery
// loop actually uses, and exits fast. Written by fake-claude.mjs — see that file for why.
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const LOG = process.env.FAKE_CLAUDE_LOG;
const argv = process.argv.slice(2);

const read = () => { try { return JSON.parse(readFileSync(LOG, 'utf8')); } catch { return { calls: [], sessions: [] }; } };
const write = (s) => writeFileSync(LOG, JSON.stringify(s, null, 2), 'utf8');

const state = read();
state.calls.push({ argv, cwd: process.cwd(), at: state.calls.length });

// \`claude agents --json\` — the liveness listing the observer reads. Only sessions this shim was asked to
// start appear, so a test can assert the spawn->observe round trip rather than a hand-written fixture.
if (argv[0] === 'agents') {
  write(state);
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(state.sessions));
  process.exit(0);
}

// Parse the way a commander-style CLI would: options first, operands wherever they fall. A lone operand
// beginning with '-' is read as an unknown FLAG and rejected — which is exactly the failure the real
// dispatcher refuses a leading-dash brief to avoid, so the refusal can now be proven rather than assumed.
let sessionId = null, name = null, bg = false;
const operands = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--bg') { bg = true; continue; }
  if (a === '--session-id') { sessionId = argv[i += 1]; continue; }
  if (a === '-n' || a === '--name') { name = argv[i += 1]; continue; }
  if (a === '--') { operands.push(...argv.slice(i + 1)); break; }
  if (a.startsWith('-')) {
    process.stderr.write('error: unknown option ' + a + '\\n');
    write(state); process.exit(2);
  }
  operands.push(a);
}

const prompt = operands.join(' ');
if (!prompt.trim()) { process.stderr.write('error: no prompt\\n'); write(state); process.exit(2); }

if (process.env.FAKE_CLAUDE_FAIL === '1') {
  process.stderr.write('error: simulated spawn failure\\n');
  write(state); process.exit(1);
}

if (bg) {
  // The real CLI returns IMMEDIATELY and the session may not be listed yet. It is listed here so the round
  // trip is assertable; the not-yet-listed grace window is the dispatcher's own concern and is unit-tested.
  const id = sessionId || 'generated-' + state.sessions.length;
  state.sessions.push({ id: id.slice(0, 8), sessionId: id, name, kind: 'background', state: 'running', cwd: process.cwd() });
  write(state);
  process.stdout.write('  claude attach ' + id.slice(0, 8) + '    open in this terminal\\n');
  process.exit(0);
}

write(state);
process.stdout.write('ok\\n');
process.exit(0);
`;

/**
 * Stand up a fake `claude` on disk.
 *
 * @returns {{
 *   pathPrefix: string, dir: string, env: Record<string,string>,
 *   calls: () => Array<{argv: string[], cwd: string}>,
 *   sessions: () => Array<object>,
 *   lastArgv: () => string[] | null,
 *   cleanup: () => void,
 * }}
 */
export function withFakeClaude() {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const bin = join(dir, 'claude');
  const log = join(dir, 'calls.json');
  writeFileSync(bin, SHIM, 'utf8');
  chmodSync(bin, 0o755);
  writeFileSync(log, JSON.stringify({ calls: [], sessions: [] }), 'utf8');

  const read = () => (existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) : { calls: [], sessions: [] });

  return {
    dir,
    pathPrefix: dir,
    env: { PATH: `${dir}:${process.env.PATH}`, FAKE_CLAUDE_LOG: log },
    calls: () => read().calls,
    sessions: () => read().sessions,
    lastArgv: () => {
      const c = read().calls;
      return c.length ? c[c.length - 1].argv : null;
    },
    cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } },
  };
}
