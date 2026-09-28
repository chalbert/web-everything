/**
 * @file land-prevention-card.test.mjs — #4317. `landPreventionCard` is the detached job
 * `we:scripts/review-set-label.mjs#fileApprovalPreventionCard` spawns instead of shelling `file-item` inline:
 * it acquires a REAL lane, files the card there, commits it, runs the gate, opens the PR, and releases the
 * lane. This is the half of the #4317 regression proof that shows the card genuinely REACHES `main` — the
 * OTHER half (`review-set-label.approval-prevention-filing.test.mjs`) shows the calling checkout itself is
 * never written to.
 *
 * Every subprocess call is a scripted stub (`exec`) — no real `node`, `git`, `lane-pool.mjs` or `gh` runs
 * here, matching the no-fs/no-subprocess convention every sibling operation test already uses.
 */
import { describe, it, expect } from 'vitest';
import {
  landPreventionCard, parseLandPreventionCardArgv, parseRunJsonTail, runLandPreventionCardCli,
} from '../land-prevention-card.mjs';

const INPUT = {
  title: 'File the prevention guard(s) owed by o/r#42\'s independent review',
  kind: 'story', size: '3', digest: 'the digest text', scope: 'we:a.mjs', parent: '4075', queue: 'true',
  session: 'prevention-card-test',
};

/** A scripted `exec` keyed by which real call it stands in for, in call order. Each entry is either a JSON
 *  string to return, or a function `(cmd, args, opts) => string` for a call needing to inspect its own args. */
function scriptedExec(steps) {
  let i = 0;
  const calls = [];
  const exec = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const step = steps[i];
    i += 1;
    if (!step) throw new Error(`scriptedExec: no step scripted for call #${i} (${cmd} ${args.join(' ')})`);
    if (typeof step === 'function') return step(cmd, args, opts);
    if (step instanceof Error) throw step;
    return step;
  };
  return { exec, calls };
}

const ACQUIRE_OK = JSON.stringify({ lane: 7, path: '/workspace/.lanes/web-everything/lane-7', session: 'prevention-card-test', holder: 'h' });
const FILE_ITEM_OK = JSON.stringify({ verdict: { num: 9001, rel: 'backlog/9001-file-the-prevention.md' } });
const VERIFY_GREEN = JSON.stringify({ verdict: { ok: true, passed: 2, failed: 0, unrun: 0, blocking: [] } });
const OPEN_PR_OPENED = JSON.stringify({
  runId: 'r1', op: 'open-pr', stopped: 'complete', applied: [], inFlight: [], pending: null,
  findings: { submit: { effects: [{ result: { outcome: 'opened', pr: 5555, url: 'https://github.com/chalbert/web-everything/pull/5555' } }] } },
});

describe('landPreventionCard — the real acquire → file-item → commit → verify → open-pr → release sequence', () => {
  it('lands the card: reaches an opened, labelled PR, and releases the lane', async () => {
    const { exec, calls } = scriptedExec([ACQUIRE_OK, FILE_ITEM_OK, 'added', 'committed', VERIFY_GREEN, OPEN_PR_OPENED, 'released']);
    const written = [];
    const result = await landPreventionCard(INPUT, {
      exec, write: () => {}, mkTmp: () => '/tmp/land-prevention-card-x', writeFile: (p, c) => written.push({ p, c }),
    });
    expect(result).toEqual({ ok: true, step: 'done', num: 9001, rel: 'backlog/9001-file-the-prevention.md', pr: 5555, url: 'https://github.com/chalbert/web-everything/pull/5555', reason: null });

    // acquire — a real lane, never the daemon clone that spawned this job.
    expect(calls[0].cmd).toBe('node');
    expect(calls[0].args[0]).toMatch(/scripts[/\\]lane-pool\.mjs$/);
    expect(calls[0].args.slice(1)).toEqual(['acquire', '--purpose=prevention-card', '--session=prevention-card-test', '--json']);
    // file-item — IN the acquired lane (cwd), running the LANE's OWN run.mjs (never a run.mjs resolved from
    // wherever this script itself lives — codex plan review, 2026-09-28: `scaffold-io.mjs`/`file-item-io.mjs`
    // resolve their repo root by SCRIPT LOCATION, not cwd, so running the wrong run.mjs would silently re-file
    // the card into the WRONG checkout even with `cwd: lane` set).
    expect(calls[1].opts.cwd).toBe('/workspace/.lanes/web-everything/lane-7');
    expect(calls[1].args[0]).toBe('/workspace/.lanes/web-everything/lane-7/scripts/operations/run.mjs');
    expect(calls[1].args).toContain('file-item');
    expect(calls[1].args).toContain('--title=' + INPUT.title);
    // git add + commit, in the lane, of exactly the filed card.
    expect(calls[2].cmd).toBe('git');
    expect(calls[2].args).toEqual(['-C', '/workspace/.lanes/web-everything/lane-7', 'add', '--', 'backlog/9001-file-the-prevention.md']);
    expect(calls[3].cmd).toBe('git');
    expect(calls[3].args[0]).toBe('-C');
    expect(calls[3].args).toContain('commit');
    // verify — for real, `mode=run`, over the lane, via the LANE's OWN run.mjs.
    expect(calls[4].args[0]).toBe('/workspace/.lanes/web-everything/lane-7/scripts/operations/run.mjs');
    expect(calls[4].args).toContain('verify');
    expect(calls[4].args).toContain('--checkout=/workspace/.lanes/web-everything/lane-7');
    expect(calls[4].args).toContain('--mode=run');
    // open-pr — label-on-green, requiring the fresh verify marker, via the LANE's OWN run.mjs.
    expect(calls[5].args[0]).toBe('/workspace/.lanes/web-everything/lane-7/scripts/operations/run.mjs');
    expect(calls[5].args).toContain('open-pr');
    expect(calls[5].args).toContain('--mode=label-on-green');
    expect(calls[5].args).toContain('--requireVerified=true');
    expect(calls[5].args.some((a) => a.startsWith('--ref=lane/9001-'))).toBe(true);
    // release — the pool slot is freed once the content is pushed, by lane NUMBER.
    expect(calls[6].args).toEqual(expect.arrayContaining(['release', '--lane=7', '--session=prevention-card-test']));
    expect(written.some((w) => w.p.endsWith('commit-msg.txt') && w.c.includes('Co-Authored-By'))).toBe(true);
    expect(written.some((w) => w.p.endsWith('pr-body.md') && w.c.includes(INPUT.digest))).toBe(true);
  });

  // chalbert/web-everything#2766's own approval (2026-09-27) FAILED live because the OLD synchronous seam
  // (this file's own predecessor, inline in `review-set-label.mjs` before #4317) fell back to `execFileSync`'s
  // thrown `e.message` — Node's "Command failed: <cmd> <args…>" reconstruction — whenever `e.stderr` was empty,
  // which leaked a fragment of THIS CALL'S OWN argv (the multi-line digest running straight into the next
  // `--scope=` flag) instead of the real reason. The fix moved here with the rest of the seam: `e.stdout`
  // carries a real, structured `file-item` payload on an ordinary refusal, and it wins whenever it parses.
  it('#2766 regression, preserved at its new home: a real file-item refusal reports its own `.error`, never a leaked argv fragment', async () => {
    const digest = 'multi\nline\ndigest\ntext';
    const realError = 'locus-prefix: 1 bare code-path ref(s) lack a <repo>: prefix (#883)';
    const refusalStdout = JSON.stringify({ stopped: 'effect-halted', error: realError });
    const { exec, calls } = scriptedExec([
      ACQUIRE_OK,
      (cmd, args) => {
        const e = new Error(`Command failed: node scripts/operations/run.mjs file-item --digest=${digest} --scope=we:x --json`);
        e.status = 1; e.stdout = refusalStdout; e.stderr = '';
        throw e;
      },
      'released',
    ]);
    const result = await landPreventionCard({ ...INPUT, digest }, { exec, write: () => {} });
    expect(result).toMatchObject({ ok: false, step: 'file-item', reason: realError });
    expect(result.reason).not.toContain('--scope=');
    expect(calls).toHaveLength(3); // acquire, file-item (thrown), release — never a 4th, unretried call
  });

  it('acquire refusal: fails cleanly with no lane to release', async () => {
    const err = new Error('no free lane');
    const { exec, calls } = scriptedExec([err]);
    const result = await landPreventionCard(INPUT, { exec, write: () => {} });
    expect(result).toMatchObject({ ok: false, step: 'acquire' });
    expect(calls).toHaveLength(1); // no release call — nothing was ever acquired
  });

  it('a file-item refusal releases the lane and reports the real reason', async () => {
    const refused = JSON.stringify({ stopped: 'effect-halted', error: 'locus-prefix: bare ref' });
    const { exec, calls } = scriptedExec([ACQUIRE_OK, refused, 'released']);
    const result = await landPreventionCard(INPUT, { exec, write: () => {} });
    expect(result).toMatchObject({ ok: false, step: 'file-item', reason: 'locus-prefix: bare ref' });
    expect(calls.at(-1).args).toEqual(expect.arrayContaining(['release', '--lane=7']));
  });

  it('a red gate releases the lane and never opens a PR', async () => {
    const red = JSON.stringify({ verdict: { ok: false, blocking: [{ check: 'check:standards', why: 'failed', detail: '1 error' }] } });
    const { exec, calls } = scriptedExec([ACQUIRE_OK, FILE_ITEM_OK, 'added', 'committed', red, 'released']);
    const result = await landPreventionCard(INPUT, { exec, write: () => {}, mkTmp: () => '/tmp/x', writeFile: () => {} });
    expect(result).toMatchObject({ ok: false, step: 'verify', num: 9001, rel: 'backlog/9001-file-the-prevention.md' });
    expect(result.reason).toContain('check:standards');
    expect(calls.at(-1).args).toEqual(expect.arrayContaining(['release']));
  });

  it('a refused PR (e.g. red required check) still releases the lane and reports the PR number if one exists', async () => {
    const refused = JSON.stringify({
      findings: { submit: { effects: [{ result: { outcome: 'refused', reason: 'check-red', pr: 5556, url: 'https://x/5556' } }] } },
    });
    const { exec, calls } = scriptedExec([ACQUIRE_OK, FILE_ITEM_OK, 'added', 'committed', VERIFY_GREEN, refused, 'released']);
    const result = await landPreventionCard(INPUT, { exec, write: () => {}, mkTmp: () => '/tmp/x', writeFile: () => {} });
    expect(result).toMatchObject({ ok: false, step: 'open-pr', pr: 5556, reason: 'check-red' });
    // release happens even on an open-pr refusal (the lane's local worktree is done either way).
    expect(calls.some((c) => c.args?.includes?.('release'))).toBe(true);
  });

  // codex plan review (2026-09-28), finding 3: `mkTmp()`/`writeFile()` for the PR body used to sit OUTSIDE
  // any try/catch — a throw there (a full disk, a permission error) propagated out of this async function
  // uncaught, leaking the lane forever (never released) instead of failing cleanly.
  it('a PR-body write failure still releases the lane and fails cleanly, never leaking or throwing', async () => {
    const { exec, calls } = scriptedExec([ACQUIRE_OK, FILE_ITEM_OK, 'added', 'committed', VERIFY_GREEN, 'released']);
    const result = await landPreventionCard(INPUT, {
      exec, write: () => {}, mkTmp: () => '/tmp/x',
      // Succeeds for the commit-msg write, throws only on the LATER pr-body write.
      writeFile: (p) => { if (String(p).endsWith('pr-body.md')) throw new Error('ENOSPC: no space left'); },
    });
    expect(result).toMatchObject({ ok: false, step: 'unexpected' });
    expect(result.reason).toContain('ENOSPC');
    expect(calls.at(-1).args).toEqual(expect.arrayContaining(['release', '--lane=7']));
  });
});

describe('parseLandPreventionCardArgv — PURE', () => {
  it('parses every required flag', () => {
    expect(parseLandPreventionCardArgv([
      '--title=t', '--kind=story', '--size=3', '--digest=d', '--scope=we:a.mjs', '--parent=4075', '--queue=true', '--session=s',
    ])).toEqual({ title: 't', kind: 'story', size: '3', digest: 'd', scope: 'we:a.mjs', parent: '4075', queue: 'true', session: 's' });
  });

  it('throws, by name, on a missing required flag', () => {
    expect(() => parseLandPreventionCardArgv(['--title=t'])).toThrow(/--kind=/);
  });

  it('defaults an omitted --parent to the empty string', () => {
    expect(parseLandPreventionCardArgv([
      '--title=t', '--kind=story', '--size=3', '--digest=d', '--scope=we:a.mjs', '--queue=true', '--session=s',
    ]).parent).toBe('');
  });
});

describe('parseRunJsonTail — tolerant of a leading warning line', () => {
  it('parses the JSON payload after a deprecation warning', () => {
    expect(parseRunJsonTail('(node:1) DeprecationWarning: x\n' + JSON.stringify({ ok: true }))).toEqual({ ok: true });
  });
  it('returns null on no parseable JSON', () => {
    expect(parseRunJsonTail('nothing here')).toBeNull();
  });
});

describe('runLandPreventionCardCli — exit-code mapping', () => {
  it('exits 0 and reports the PR on a successful land', async () => {
    const { code, result } = await runLandPreventionCardCli(
      ['--title=t', '--kind=story', '--size=3', '--digest=d', '--scope=we:a.mjs', '--queue=true', '--session=s'],
      { land: async () => ({ ok: true, step: 'done', num: 1, rel: 'r', pr: 9, url: 'u', reason: null }), write: () => {} },
    );
    expect(code).toBe(0);
    expect(result.pr).toBe(9);
  });

  it('exits 1 with the reason on stderr when the land did not reach a PR', async () => {
    const stderrLines = [];
    const { code } = await runLandPreventionCardCli(
      ['--title=t', '--kind=story', '--size=3', '--digest=d', '--scope=we:a.mjs', '--queue=true', '--session=s'],
      {
        land: async () => ({ ok: false, step: 'verify', num: 1, rel: 'r', pr: null, url: null, reason: 'gate red' }),
        write: () => {}, writeErr: (l) => stderrLines.push(l),
      },
    );
    expect(code).toBe(1);
    expect(stderrLines.join('')).toContain('verify');
    expect(stderrLines.join('')).toContain('gate red');
  });

  it('exits 1 on a bad argv, before any land is attempted', async () => {
    let landCalled = false;
    const { code } = await runLandPreventionCardCli(['--title=t'], {
      land: async () => { landCalled = true; return { ok: true }; }, write: () => {}, writeErr: () => {},
    });
    expect(code).toBe(1);
    expect(landCalled).toBe(false);
  });
});
