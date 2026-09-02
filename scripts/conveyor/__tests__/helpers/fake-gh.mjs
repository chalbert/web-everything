/**
 * @file fake-gh.mjs — a REAL `gh` executable on `PATH` that costs nothing to run and needs no auth/network.
 *
 * WHY THIS EXISTS (#3445, the dispatcher-fixture-root thread, #3402). `scripts/readiness/conveyor-state.mjs`
 * shells the real `gh pr list …` to build `state.prs`, and `scripts/conveyor/tick-core.mjs` shells `gh pr view
 * … --json comments` for the durable fix/ci-heal retry floor. A harness test that wants to assert the
 * conveyor-state → dispatch-plan → tick-core chain against a SYNTHETIC backlog corpus (mkdtemp + `--backlog-dir`)
 * still hits the REAL `gh` for those two calls unless something stands in for it — and a fixture corpus is
 * worthless if the PR picture behind it is still live production data. Mirrors
 * `scripts/operations/__tests__/helpers/fake-claude.mjs`: same shape (a shim written to a temp dir, prepended
 * onto `PATH`), same reasoning (exercise the real `execFileSync('gh', …)` call path unmodified, never inject a
 * replacement spawner).
 *
 * WHAT THIS IS NOT. It does not talk to GitHub, and it does not model every `gh` subcommand — only the two this
 * repo's readiness/tick machinery actually shells (`pr list`, `pr view … --json comments`). Anything else is an
 * unknown-subcommand failure, on purpose: a caller that starts relying on a THIRD `gh` verb should have that
 * surfaced as a fixture gap, not silently answered with an empty guess.
 */

import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The shim, as a node script. One string so the fixture is a single file with nothing to resolve. */
const SHIM = `#!/usr/bin/env node
// A stand-in for the \`gh\` CLI. Answers exactly the two calls the readiness/tick machinery shells — see
// fake-gh.mjs for why. Written by fake-gh.mjs.
const { readFileSync, writeFileSync } = require('node:fs');
const FIXTURE = JSON.parse(readFileSync(process.env.FAKE_GH_FIXTURE, 'utf8'));
const LOG = process.env.FAKE_GH_LOG;
const argv = process.argv.slice(2);

const readLog = () => { try { return JSON.parse(readFileSync(LOG, 'utf8')); } catch { return { calls: [] }; } };
const log = readLog();
log.calls.push({ argv });
writeFileSync(LOG, JSON.stringify(log, null, 2));

if (argv[0] === 'pr' && argv[1] === 'list') {
  process.stdout.write(JSON.stringify(FIXTURE.prs || []));
  process.exit(0);
}
if (argv[0] === 'pr' && argv[1] === 'view') {
  const num = Number(argv[2]);
  const comments = (FIXTURE.comments && FIXTURE.comments[num]) || [];
  process.stdout.write(JSON.stringify({ comments }));
  process.exit(0);
}
process.stderr.write('fake-gh: unhandled subcommand ' + argv.join(' ') + '\\n');
process.exit(1);
`;

/**
 * Stand up a fake `gh` on disk, canned to answer `pr list` with `prs` and `pr view <n> --json comments` with
 * `comments[n]` (default `[]`).
 *
 * @param {{prs?: object[], comments?: Record<number, object[]>}} [fixture]
 * @returns {{ env: Record<string,string>, calls: () => Array<{argv:string[]}>, cleanup: () => void }}
 */
export function withFakeGh({ prs = [], comments = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  const bin = join(dir, 'gh');
  const fixturePath = join(dir, 'fixture.json');
  const logPath = join(dir, 'calls.json');
  writeFileSync(bin, SHIM, 'utf8');
  chmodSync(bin, 0o755);
  writeFileSync(fixturePath, JSON.stringify({ prs, comments }), 'utf8');
  writeFileSync(logPath, JSON.stringify({ calls: [] }), 'utf8');

  return {
    env: { PATH: `${dir}:${process.env.PATH}`, FAKE_GH_FIXTURE: fixturePath, FAKE_GH_LOG: logPath },
    calls: () => {
      try { return JSON.parse(readFileSync(logPath, 'utf8')).calls; }
      catch { return []; }
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
