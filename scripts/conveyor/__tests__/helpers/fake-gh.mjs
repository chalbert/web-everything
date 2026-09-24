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
 *
 * LOGGING IS ONE `appendFileSync` PER CALL, NEVER A READ-MODIFY-WRITE OF THE WHOLE LOG (x3xz8qp/#3988). The
 * shim used to `readFileSync` the log, push onto its parsed `.calls` array, then `writeFileSync` it back whole —
 * safe for one caller at a time, but `dispatch-plan.mjs`'s already-done ground-truth pass (#3457/#3460) spawns
 * MANY of these concurrently (`Promise.all`, by design — see that file's own header comment on why sequential
 * was the bug). Many concurrent shim processes racing the same read→modify→write lost entries under real
 * concurrency (measured live: 70 concurrent calls logged as few as 55) — a silent undercount that would have
 * hidden, not caught, a spawn-count regression in exactly the kind of test this file exists to support. Each
 * call now `appendFileSync`s its OWN one-line JSON record (mirrors `node-spy.mjs`'s already-safe technique); a
 * small single `write()` to an `O_APPEND` file descriptor is atomic on POSIX, so concurrent appends interleave
 * as whole lines and no entry is ever lost or torn.
 *
 * THE RESPONSE NEVER CALLS `process.exit()` RIGHT AFTER `process.stdout.write()` (x3xz8qp/#3988, the SAME
 * incident that found the logging race above — a large-fixture spawn-count test is what finally exercised a
 * `pr list` payload big enough to hit this). `stdout` to a pipe is written ASYNCHRONOUSLY in Node; an immediate
 * `process.exit()` can tear down the process before the write actually drains, silently truncating the parent's
 * read. Small fixtures (a handful of PRs) never crossed the ~8KB pipe-buffer threshold where this bites, so it
 * went unnoticed until a 150-PR fixture came back as `"Unterminated string in JSON at position 8192"` —
 * `execFileSync('gh', …)`'s caller in `conveyor-state.mjs` degraded that to an empty `state.prs` (its own
 * fail-soft `catch`), which would have made a spawn-count test pass for the wrong reason (nothing to count
 * because the payload never arrived) rather than proving the real thing. Fixed by never calling `process.exit()`
 * on the success paths at all: the script just returns, Node drains stdout and exits on its own once the event
 * loop is empty.
 */

import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The shim, as a node script. One string so the fixture is a single file with nothing to resolve. */
const SHIM = `#!/usr/bin/env node
// A stand-in for the \`gh\` CLI. Answers exactly the two calls the readiness/tick machinery shells — see
// fake-gh.mjs for why. Written by fake-gh.mjs.
const { readFileSync, appendFileSync } = require('node:fs');
const FIXTURE = JSON.parse(readFileSync(process.env.FAKE_GH_FIXTURE, 'utf8'));
const LOG = process.env.FAKE_GH_LOG;
const argv = process.argv.slice(2);

// One line per call, appended atomically (never a read-modify-write of the whole log — see this file's own
// header on why: concurrent shim processes racing a read/write cycle silently lose entries).
appendFileSync(LOG, JSON.stringify({ argv }) + '\\n');

if (argv[0] === 'pr' && argv[1] === 'list') {
  // No \`process.exit()\` here on purpose — see this file's own header on why an immediate exit can truncate a
  // large payload before the async pipe write drains. The process exits on its own once the event loop empties.
  process.stdout.write(JSON.stringify(FIXTURE.prs || []));
} else if (argv[0] === 'pr' && argv[1] === 'view') {
  const num = Number(argv[2]);
  const comments = (FIXTURE.comments && FIXTURE.comments[num]) || [];
  process.stdout.write(JSON.stringify({ comments }));
} else {
  process.stderr.write('fake-gh: unhandled subcommand ' + argv.join(' ') + '\\n');
  process.exitCode = 1;
}
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
  const logPath = join(dir, 'calls.json'); // NDJSON despite the name — one `{argv}` record per line, see header.
  writeFileSync(bin, SHIM, 'utf8');
  chmodSync(bin, 0o755);
  writeFileSync(fixturePath, JSON.stringify({ prs, comments }), 'utf8');
  writeFileSync(logPath, '', 'utf8');

  return {
    env: { PATH: `${dir}:${process.env.PATH}`, FAKE_GH_FIXTURE: fixturePath, FAKE_GH_LOG: logPath },
    calls: () => {
      try {
        return readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
      } catch { return []; }
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
