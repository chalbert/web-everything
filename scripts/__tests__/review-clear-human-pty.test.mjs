/**
 * @file review-clear-human-pty.test.mjs — the SUCCESS path of the #2895 gate-self clearance ceremony, driven
 *   through a REAL pseudo-terminal against a fake `gh`. This is the test whose absence let PR #1056's B1 ship.
 *
 * WHY A PTY, AND WHY THE SUCCESS PATH. Every other ceremony test targets the pure `decideHumanCeremony`; the
 * impure read had zero coverage, and the PR's two end-to-end runs were both REFUSALS — and a refusal looks
 * identical whether the gate works or is dead. It was dead: `process.stdin.isTTY` instantiated Node's lazy
 * `tty.ReadStream` on fd 0, putting the descriptor in non-blocking mode, so the following `readFileSync(0)`
 * threw EAGAIN into a bare `catch`, the answer came back empty, and the ceremony ALWAYS refused. The only test
 * that catches that class is one where the operator gets THROUGH.
 *
 * THE SAME HARNESS IS THE HONEST DEMONSTRATION OF M1. Allocating a pty is all it takes to satisfy the terminal
 * check — `script(1)` ships on macOS and Linux, `python3`'s `pty.fork()` on both. This test IS an agent typing
 * at a "live terminal", by construction. So it doubles as the executable proof that the check is a deliberate
 * speed bump against clearing your own homework incidentally, NOT a structural barrier: see the canonical
 * statement at `we:scripts/review-set-label.mjs#decideHumanCeremony`. If you came here to make this test prove
 * that an agent "cannot" run the clearance, it proves the opposite, on purpose.
 *
 * PLATFORM: gated to darwin/linux — `script(1)` is a POSIX tool and its flag shape differs between the two.
 * There is no Windows path, and adding one is not worth a shim; the point is that it RUNS locally and in CI on
 * the platforms this repo is developed on. Nothing here touches a real PR: `gh` is a recording stub on PATH.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { REVIEW_LABELS } from '../lib/review-escalation.mjs';

const PTY_OK = process.platform === 'darwin' || process.platform === 'linux';
const CLI = resolve('scripts/review-set-label.mjs');
const PR = '1048';
const REPO = 'chalbert/web-everything';
const HEAD = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';

let sandbox = '';

/**
 * Build a case directory holding a recording `gh` stub on PATH. The stub answers the two `pr view` shapes the
 * harness needs and APPENDS every argv it is called with to `calls.jsonl`, so the test can assert what would
 * have hit GitHub without any network. The comment body is copied out of the CLI's temp file before it unlinks
 * it. Returns `{ dir, bin }`.
 */
function makeCase(name, labels) {
  const dir = mkdtempSync(join(sandbox, `${name}-`));
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const stub = `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const DIR = ${JSON.stringify(dir)};
appendFileSync(DIR + '/calls.jsonl', JSON.stringify(argv) + '\\n');
const j = argv.indexOf('--json');
if (argv[0] === 'pr' && argv[1] === 'view' && j !== -1) {
  const want = argv[j + 1].split(',');
  const out = {};
  if (want.includes('labels')) out.labels = ${JSON.stringify(labels.map((n) => ({ name: n })))};
  if (want.includes('headRefOid')) out.headRefOid = ${JSON.stringify(HEAD)};
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
if (argv[0] === 'pr' && argv[1] === 'comment') {
  writeFileSync(DIR + '/posted-comment.md', readFileSync(argv[argv.indexOf('--body-file') + 1], 'utf8'));
}
process.exit(0);
`;
  writeFileSync(join(bin, 'gh.mjs'), stub, 'utf8');
  // A tiny sh wrapper so the stub is a plain executable named `gh` on PATH.
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\nexec node ${join(bin, 'gh.mjs')} "$@"\n`, 'utf8');
  chmodSync(join(bin, 'gh'), 0o755);
  writeFileSync(join(dir, 'calls.jsonl'), '', 'utf8');
  return { dir, bin };
}

const shq = (s) => `'${String(s).split("'").join(`'\\''`)}'`;

/**
 * Run the real CLI under a real pty (`script(1)`), typing `answer` once the prompt appears. Returns everything
 * the terminal saw plus the CLI's exit code (`script` propagates it; `-e` asks for that on util-linux).
 *
 * Two shapes here look odd and are load-bearing:
 *   • `cat |` in front. `script(1)` on macOS runs `tcgetattr` on its OWN stdin and treats anything but `ENOTTY`
 *     as fatal — and a Node `'pipe'` stdio is a socketpair, which yields `EOPNOTSUPP` ("Operation not supported
 *     on socket"), as does a named FIFO. Piping through `cat` hands `script` an ordinary anonymous pipe, which
 *     it accepts, while we still drive the input from Node.
 *   • WAITING for the prompt before typing. A pre-piped answer races the child's `open('/dev/tty')`: the data
 *     plus its EOF can be consumed before the child ever reads, and the read then returns an empty line — which
 *     is a false NEGATIVE that looks exactly like the bug this file exists to catch.
 * We close our stdin only once the CLI has printed its JSON result, so `cat` (and therefore the shell) exits.
 */
function runUnderPty({ dir, bin, args, answer, timeoutMs = 20000 }) {
  const cmd = ['node', CLI, ...args].map(shq).join(' ');
  const pty = process.platform === 'darwin'
    ? `script -q /dev/null ${cmd}`
    : `script -q -e -c ${shq(['node', CLI, ...args].map(shq).join(' '))} /dev/null`;
  return new Promise((done, reject) => {
    const child = spawn('sh', ['-c', `exec cat | ${pty}`], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: dir,
    });
    let out = '';
    let answered = false;
    let closed = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`pty run timed out; the terminal saw:\n${out}`));
    }, timeoutMs);
    const onData = (b) => {
      out += b.toString('utf8');
      if (!answered && /Type the PR number/.test(out)) {
        answered = true;
        child.stdin.write(`${answer}\n`);
      }
      if (answered && !closed && /\{"ok":|\{"error":/.test(out)) {
        closed = true;
        child.stdin.end();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); done({ out, code }); });
  });
}

const ghCalls = (dir) => readFileSync(join(dir, 'calls.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe.skipIf(!PTY_OK)('clear-human END TO END through a real pty (#2895, PR #1056 B1 + M1)', () => {
  beforeAll(() => { sandbox = mkdtempSync(join(tmpdir(), 'clear-human-pty-')); });
  afterAll(() => { if (sandbox) rmSync(sandbox, { recursive: true, force: true }); });

  // THE test. Before the fix this refused with `confirmation did not match — expected the PR number "1048",
  // got ""`, having returned instantly without ever waiting for input.
  it('the operator types the PR number at the terminal and the clearance is ALLOWED', async () => {
    const { dir, bin } = makeCase('ok', [REVIEW_LABELS.human, 'ready-to-merge']);
    const bodyFile = join(dir, 'findings.md');
    writeFileSync(bodyFile, '## Findings\n\nOne minor, addressed.\n', 'utf8');

    const { out, code } = await runUnderPty({
      dir, bin, answer: PR,
      args: [PR, `--repo=${REPO}`, '--to=clear-human', '--actor=Nicolas Gilbert', `--body-file=${bodyFile}`],
    });

    // 1. It actually WAITED for input and accepted it — the JSON success payload, not a refusal.
    expect(out).toMatch(/"ok":true/);
    expect(out).not.toMatch(/confirmation did not match/);
    expect(out).not.toMatch(/could not read the confirmation/);
    expect(code).toBe(0);

    // 2. The swap the ceremony authorised actually reached `gh`: accepted added, review:human removed.
    const edit = ghCalls(dir).find((a) => a[0] === 'pr' && a[1] === 'edit');
    expect(edit).toBeTruthy();
    expect(edit.join(' ')).toContain(`--add-label ${REVIEW_LABELS.accepted}`);
    expect(edit.join(' ')).toContain(`--remove-label ${REVIEW_LABELS.human}`);

    // 3. The durable record was posted, attributed, and carries the reviewed-sha stamp.
    const posted = readFileSync(join(dir, 'posted-comment.md'), 'utf8');
    expect(posted).toContain('gate-self CLEARED by a human');
    expect(posted).toContain('Cleared by Nicolas Gilbert');
    expect(posted).toContain(HEAD);
    expect(posted).toContain('One minor, addressed.');
    // …and it must NOT repeat the claim this same pty disproves (PR #1056, M1).
    expect(posted).not.toMatch(/no agent can reach this path/);

    // 4. m2 — the prompt disclosed what the operator was attesting to, not just the label swap.
    expect(out).toMatch(/actor\s+Nicolas Gilbert/);
    expect(out).toMatch(/comment\s+\d+ chars, sha256 [0-9a-f]{12}/);
    expect(out).toContain('One minor, addressed.');
  }, 30000);

  // The control. If the read were broken in the OTHER direction (accepting anything), the test above would pass
  // for the wrong reason. This proves the ceremony reads and compares what was actually typed.
  it('a WRONG answer typed at the same terminal refuses, and no label swap reaches gh', async () => {
    const { dir, bin } = makeCase('no', [REVIEW_LABELS.human]);

    const { out, code } = await runUnderPty({
      dir, bin, answer: '1047', args: [PR, `--repo=${REPO}`, '--to=clear-human', '--actor=op'],
    });

    expect(out).toMatch(/confirmation did not match/);
    expect(code).not.toBe(0);
    expect(ghCalls(dir).some((a) => a[1] === 'edit')).toBe(false);
    expect(ghCalls(dir).some((a) => a[1] === 'comment')).toBe(false);
    expect(existsSync(join(dir, 'posted-comment.md'))).toBe(false);
  }, 30000);
});
