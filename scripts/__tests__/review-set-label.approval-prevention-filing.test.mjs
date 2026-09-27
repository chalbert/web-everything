/**
 * @file review-set-label.approval-prevention-filing.test.mjs — proof of the APPROVAL-TIME PREVENTION-FILING
 * DEFAULT (operator, 2026-09-27, "prevention outstanding should be filed by default on approval"), wired into
 * `runReviewLabelCli` — the single label home every approval path (`--to=accepted`, `--to=clear-human`) passes
 * through. See `we:scripts/lib/approval-prevention-notice.mjs`'s header for the decision this exercises, and
 * `we:scripts/review-set-label.mjs`'s own `runApprovalPreventionFiling` for the wiring.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  derivePreventionParent, fileApprovalPreventionCard, findApprovalPreventionCardOnDisk, runApprovalPreventionFiling,
  runReviewLabelCli,
} from '../review-set-label.mjs';
import { buildApprovalPreventionKey } from '../lib/approval-prevention-notice.mjs';

describe('derivePreventionParent — #4075 default, unless a finding names a better one', () => {
  it('defaults to 4075 when no finding names a parent', () => {
    expect(derivePreventionParent([{ prevention: 'add a test' }])).toBe('4075');
    expect(derivePreventionParent([])).toBe('4075');
  });

  it('uses an explicitly-named parent/epic/under reference from a finding\'s own prevention text', () => {
    expect(derivePreventionParent([{ prevention: 'file this under parent #1234' }])).toBe('1234');
    expect(derivePreventionParent([{ prevention: 'covered by epic #5555 already' }])).toBe('5555');
    expect(derivePreventionParent([{ prevention: 'tracked under #77' }])).toBe('77');
  });

  it('does not mistake an unrelated "#N" mention (e.g. a cited PR) for a naming', () => {
    expect(derivePreventionParent([{ prevention: 'see PR #9999 for context' }])).toBe('4075');
  });

  it('the FIRST naming across several findings wins, deterministically', () => {
    expect(derivePreventionParent([
      { prevention: 'no naming here' },
      { prevention: 'parent #111' },
      { prevention: 'epic #222' },
    ])).toBe('111');
  });
});

describe('fileApprovalPreventionCard — the real (injectable) file-item subprocess seam', () => {
  const input = {
    title: 't', kind: 'story', size: '3', digest: 'd', scope: 'we:a.mjs', parent: '4075', queue: 'true',
  };

  it('builds the exact file-item argv and parses its --json payload', () => {
    const calls = [];
    const exec = (file, args) => {
      calls.push([file, args]);
      return JSON.stringify({ verdict: { num: 4999, rel: 'backlog/4999-x.md' } });
    };
    const result = fileApprovalPreventionCard(input, { exec });
    expect(calls[0][0]).toBe('node');
    expect(calls[0][1]).toEqual([
      'scripts/operations/run.mjs', 'file-item',
      '--title=t', '--kind=story', '--size=3', '--digest=d', '--scope=we:a.mjs',
      '--parent=4075', '--queue=true', '--json',
    ]);
    expect(result).toEqual({ ok: true, num: 4999, rel: 'backlog/4999-x.md', error: null });
  });

  it('omits --parent when input.parent is empty', () => {
    const calls = [];
    const exec = (file, args) => { calls.push(args); return JSON.stringify({ verdict: { num: 1, rel: 'r' } }); };
    fileApprovalPreventionCard({ ...input, parent: '' }, { exec });
    expect(calls[0]).not.toContain('--parent=');
    expect(calls[0].some((a) => a.startsWith('--parent='))).toBe(false);
  });

  it('tolerates a leading warning line before the JSON payload', () => {
    const exec = () => '(node:1) DeprecationWarning: x\n' + JSON.stringify({ verdict: { num: 2, rel: 'r2' } });
    const result = fileApprovalPreventionCard(input, { exec });
    expect(result).toEqual({ ok: true, num: 2, rel: 'r2', error: null });
  });

  it('reports a clean failure (never throws) when exec throws', () => {
    const exec = () => { const e = new Error('boom'); e.stderr = 'file-item: refused\n'; throw e; };
    const result = fileApprovalPreventionCard(input, { exec });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/refused/);
  });

  it('reports a clean failure when exec succeeds but produces no parseable JSON', () => {
    const exec = () => 'no json here';
    const result = fileApprovalPreventionCard(input, { exec });
    expect(result).toMatchObject({ ok: false, num: null, rel: null });
    expect(result.error).toMatch(/no parseable JSON/);
  });

  // chalbert/web-everything#2766's OWN approval (2026-09-27, ~09:00 ET) FAILED live with this exact reported
  // stderr: "…FAILED (the approval above already landed and is UNAFFECTED) — Idempotency key (do not edit):
  // approval-prevention-key:chalbert/web-everything#2766@d2453a58216d6cc4b14a4e1f30c673451ca93485
  // --scope=we:scripts/lib/revi…" — a fragment of THIS CALL'S OWN argv (the multi-line digest running straight
  // into the next `--scope=` flag), not the real reason `file-item` refused. Reproduced here exactly:
  // `execFileSync` throws on file-item's real non-zero exit, `e.stderr` is empty (an ordinary `effect-halted`
  // refusal prints nothing to stderr), and the old code's `ghErr(e, …)` fell back to `e.message` — Node's own
  // "Command failed: <cmd> <args…>" reconstruction, whose last "line" (split on the digest's embedded newlines)
  // is that meaningless argv fragment. The REAL reason (`file-item`'s own `.error`, e.g. the #883 locus-prefix
  // write refusal) was sitting right there in `e.stdout`, unread.
  it('#2766 live repro: on a real file-item refusal (empty stderr, a real payload on stdout), reports the '
    + 'REAL `.error` — never a leaked fragment of this call\'s own argv', () => {
    const digest = 'Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should '
      + 'be filed by default on approval") — this PR\'s latest advisory review named the guard(s) below as owed. '
      + 'None of them blocked the approval; the debt is tracked here instead:\n\n'
      + '1. `we:scripts/lib/review-loop-policy.mjs:454` — some guard text\n'
      + '2. `we:scripts/operations/review-loop-cli.mjs:368` — some other guard text\n\n'
      + 'Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2766'
      + '@d2453a58216d6cc4b14a4e1f30c673451ca93485';
    const realError = 'locus-prefix: 1 bare code-path ref(s) in backlog/x41qokn-file-the-prevention-guard-s-'
      + 'owed-by-chalbert-web-everything.md lack a <repo>: prefix (#883; e.g. '
      + '"scripts/lib/__tests__/review-loop-policy.test.mjs" → "we:scripts/lib/__tests__/review-loop-policy.'
      + 'test.mjs"). Prefix them now — don\'t leave it for the gate.';
    const stdout = JSON.stringify({
      runId: 'file-item-x', op: 'file-item', stopped: 'effect-halted', applied: [], inFlight: [],
      pending: { kind: 'effect', step: 'write', stepIndex: 3, count: 1 }, error: realError,
    });
    const exec = () => {
      const e = new Error(
        `Command failed: node scripts/operations/run.mjs file-item --digest=${digest} --scope=we:x --json`,
      );
      e.status = 1;
      e.stdout = stdout;
      e.stderr = '';
      throw e;
    };
    const result = fileApprovalPreventionCard({ ...input, digest }, { exec });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(realError);
    // RED before the fix: the old code reported a fragment of the digest/idempotency text plus the next flag,
    // never the real reason.
    expect(result.error).not.toContain('Idempotency key (do not edit)');
    expect(result.error).not.toContain('--scope=');
  });
});

describe('findApprovalPreventionCardOnDisk — the durable, card-side idempotency lookup', () => {
  it('finds a backlog card whose body carries the approval key, and nothing else', () => {
    const root = mkdtempSync(join(tmpdir(), 'approval-prevention-'));
    try {
      mkdirSync(join(root, 'backlog'));
      const key = buildApprovalPreventionKey({ repo: 'o/r', pr: 7, headSha: 'A'.repeat(40) });
      writeFileSync(join(root, 'backlog', '0100-unrelated.md'), '---\nstatus: open\n---\nnothing here\n');
      writeFileSync(join(root, 'backlog', '0101-file-the-prevention.md'), `---\nstatus: open\n---\nbody\n${key}\n`);
      expect(findApprovalPreventionCardOnDisk(key, { root })).toEqual({ num: 101, rel: 'backlog/0101-file-the-prevention.md' });
      const otherHead = buildApprovalPreventionKey({ repo: 'o/r', pr: 7, headSha: 'b'.repeat(40) });
      expect(findApprovalPreventionCardOnDisk(otherHead, { root })).toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('returns a hash-style card id as-is (new cards are named `<hash>-<slug>.md`)', () => {
    const root = mkdtempSync(join(tmpdir(), 'approval-prevention-'));
    try {
      mkdirSync(join(root, 'backlog'));
      const key = buildApprovalPreventionKey({ repo: 'O/R', pr: 7, headSha: 'a'.repeat(40) });
      writeFileSync(join(root, 'backlog', 'x3k9ab2-file-the-prevention.md'), `body\n${key}\n`);
      // Repo case never splits the key (GitHub slugs are case-insensitive).
      const sameKey = buildApprovalPreventionKey({ repo: 'o/r', pr: 7, headSha: 'a'.repeat(40) });
      expect(findApprovalPreventionCardOnDisk(sameKey, { root }))
        .toEqual({ num: 'x3k9ab2', rel: 'backlog/x3k9ab2-file-the-prevention.md' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('returns null (never throws) when the backlog directory is missing', () => {
    expect(findApprovalPreventionCardOnDisk('approval-prevention-key:o/r#1@abc', { root: join(tmpdir(), 'no-such-root-x') }))
      .toBeNull();
  });
});

describe('runApprovalPreventionFiling — the orchestration, in isolation', () => {
  function fakeProvider() {
    const posted = [];
    return { posted, postComment: (repo, pr, body) => posted.push({ repo, pr, body }) };
  }

  const OWED_COMMENT = [
    '**Verdict:** ✅ pass — no blocking findings',
    '- `scripts/a.mjs:1` — an issue',
    '  - _Prevention (OWED — file it):_ add a guard',
  ].join('\n');

  it('does nothing when there is nothing to file (no owed findings)', () => {
    const provider = fakeProvider();
    let fileCalls = 0;
    runApprovalPreventionFiling({
      to: 'accepted', repo: 'o/r', pr: 1, headSha: 'a'.repeat(40),
      commentBody: '**Verdict:** ✅ pass — no blocking findings', prComments: [], provider,
      fileApprovalPrevention: () => { fileCalls += 1; return { ok: true, num: 1, rel: 'r' }; },
    });
    expect(fileCalls).toBe(0);
    expect(provider.posted).toHaveLength(0);
  });

  it('files the card and posts a marker comment when there IS an owed, non-blocking finding', () => {
    const provider = fakeProvider();
    const filedWith = [];
    runApprovalPreventionFiling({
      to: 'accepted', repo: 'o/r', pr: 42, headSha: 'deadbeef'.repeat(5),
      commentBody: OWED_COMMENT, prComments: [], provider,
      fileApprovalPrevention: (input) => { filedWith.push(input); return { ok: true, num: 5001, rel: 'backlog/5001-x.md' }; },
    });
    expect(filedWith).toHaveLength(1);
    expect(filedWith[0].title).toContain('o/r#42');
    expect(filedWith[0].parent).toBe('4075');
    expect(filedWith[0].digest).toContain('APPROVAL');
    expect(provider.posted).toHaveLength(1);
    expect(provider.posted[0].body).toContain('approval-prevention-filed:');
    expect(provider.posted[0].body).toContain('backlog/5001-x.md');
    expect(provider.posted[0].body).toContain('#5001');
  });

  it('is idempotent: does not file again when the head already carries the marker', () => {
    const headSha = 'cafe1234'.repeat(5);
    const provider = fakeProvider();
    let fileCalls = 0;
    runApprovalPreventionFiling({
      to: 'accepted', repo: 'o/r', pr: 42, headSha,
      commentBody: OWED_COMMENT,
      prComments: [{ body: `<!-- approval-prevention-filed:${headSha} -->\nalready filed`, author: { login: 'web-everything' } }],
      provider,
      fileApprovalPrevention: () => { fileCalls += 1; return { ok: true, num: 1, rel: 'r' }; },
    });
    expect(fileCalls).toBe(0);
    expect(provider.posted).toHaveLength(0);
  });

  it('reports a filing failure to stderr but never throws, and posts no marker', () => {
    const provider = fakeProvider();
    const stderrChunks = [];
    const realWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (s) => { stderrChunks.push(String(s)); return true; };
    try {
      expect(() => runApprovalPreventionFiling({
        to: 'accepted', repo: 'o/r', pr: 7, headSha: 'a'.repeat(40),
        commentBody: OWED_COMMENT, prComments: [], provider,
        fileApprovalPrevention: () => ({ ok: false, num: null, rel: null, error: 'boom' }),
      })).not.toThrow();
    } finally { process.stderr.write = realWrite; }
    expect(stderrChunks.join('')).toMatch(/FAILED/);
    expect(stderrChunks.join('')).toMatch(/UNAFFECTED/);
    expect(provider.posted).toHaveLength(0);
  });

  it('reports a marker-post failure to stderr but never throws (the card is already filed)', () => {
    const stderrChunks = [];
    const realWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (s) => { stderrChunks.push(String(s)); return true; };
    const provider = { postComment: () => { throw new Error('gh down'); } };
    try {
      expect(() => runApprovalPreventionFiling({
        to: 'accepted', repo: 'o/r', pr: 7, headSha: 'a'.repeat(40),
        commentBody: OWED_COMMENT, prComments: [], provider,
        fileApprovalPrevention: () => ({ ok: true, num: 9, rel: 'backlog/9-x.md' }),
      })).not.toThrow();
    } finally { process.stderr.write = realWrite; }
    expect(stderrChunks.join('')).toMatch(/marker comment failed to post/);
  });

  // PR #2805 review (codex-correctness) — the card is the durable record, not the marker comment: a marker post
  // that fails after a successful file must not let the NEXT approval attempt file a second card.
  it('a marker-post failure followed by a retried approval files exactly one card', () => {
    const headSha = 'a'.repeat(40);
    const store = [];
    const fileApprovalPrevention = (input) => {
      store.push(input);
      return { ok: true, num: 9000 + store.length, rel: `backlog/${9000 + store.length}-x.md` };
    };
    const findFiledApprovalPrevention = (key) => {
      const i = store.findIndex((card) => card.digest.includes(key));
      return i === -1 ? null : { num: 9001 + i, rel: `backlog/${9001 + i}-x.md` };
    };
    const realWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = () => true;
    const posted = [];
    try {
      runApprovalPreventionFiling({
        to: 'accepted', repo: 'o/r', pr: 7, headSha, commentBody: OWED_COMMENT, prComments: [],
        provider: { postComment: () => { throw new Error('gh down'); } },
        fileApprovalPrevention, findFiledApprovalPrevention,
      });
      runApprovalPreventionFiling({
        to: 'accepted', repo: 'o/r', pr: 7, headSha, commentBody: OWED_COMMENT, prComments: [],
        provider: { postComment: (_r, _p, body) => posted.push(body) },
        fileApprovalPrevention, findFiledApprovalPrevention,
      });
    } finally { process.stderr.write = realWrite; }
    expect(store).toHaveLength(1);
    // The retry heals the missing marker, pointing at the card the first attempt already filed.
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain(`approval-prevention-filed:${headSha}`);
    expect(posted[0]).toContain('backlog/9001-x.md');
  });

  it('never fires for clear-human when the underlying source is prevention-outstanding (#2766 owns it)', () => {
    const provider = fakeProvider();
    let fileCalls = 0;
    runApprovalPreventionFiling({
      to: 'accepted', repo: 'o/r', pr: 1, headSha: 'a'.repeat(40),
      commentBody: [
        '**Verdict:** 🚩 prevention outstanding — file the guard before accept',
        '- `scripts/a.mjs:1` — x',
        '  - _Prevention (OWED — file it):_ guard it',
      ].join('\n'),
      prComments: [], provider,
      fileApprovalPrevention: () => { fileCalls += 1; return { ok: true, num: 1, rel: 'r' }; },
    });
    expect(fileCalls).toBe(0);
  });
});

/** Full end-to-end proof, through the real `runReviewLabelCli`, with a stub `gh` provider (#x8xf5rl style). */
describe('runApprovalPreventionFiling wired end-to-end through runReviewLabelCli', () => {
  const OWED_BODY = [
    '**Verdict:** ✅ pass — no blocking findings',
    '- `scripts/a.mjs:1` — an issue',
    '  - _Prevention (OWED — file it):_ add a guard',
  ].join('\n');

  function stubProvider({ labels = [], comments = [] } = {}) {
    const calls = [];
    return {
      calls,
      name: 'stub',
      currentRepo: () => 'o/n',
      readPrState: () => ({
        labels: labels.map((name) => ({ name })), headRefOid: 'a'.repeat(40), headRefName: 'lane/x',
        state: 'OPEN', body: '', title: '', comments,
      }),
      readLabels: () => labels.map((name) => ({ name })),
      setLabels: (_r, _p, spec) => { calls.push(['setLabels', spec]); },
      postComment: (_r, _p, body) => { calls.push(['postComment', body]); },
    };
  }

  const run = (provider, argv, config = {}) => {
    const chunks = [];
    const realExit = process.exit.bind(process);
    process.exit = (code) => { const e = new Error('process.exit'); e.exitCode = code; throw e; };
    let exitCode = 0;
    try {
      runReviewLabelCli({
        defaultActor: 'test',
        usage: 'usage: test',
        buildComment: () => OWED_BODY,
        successResult: (o) => ({ ok: true, ...o }),
        refusalResult: ({ decision }) => ({ error: decision.reason }),
        emit: (l) => chunks.push(String(l)),
        // Hermetic: never scan the real checkout's backlog/ for an already-filed card.
        findFiledApprovalPrevention: () => null,
        provider, argv, ...config,
      });
    } catch (e) { if (typeof e.exitCode === 'number') exitCode = e.exitCode; else throw e; }
    finally { process.exit = realExit; }
    return { exitCode, payload: JSON.parse(chunks.join('') || '{}') };
  };

  it('files a card and posts a marker on an ordinary accept whose rendered comment carries an owed guard', () => {
    const provider = stubProvider({ labels: ['review:pending'] });
    const filed = [];
    run(provider, ['1048', '--repo=o/n', '--to=accepted', '--actor=op'], {
      fileApprovalPrevention: (input) => { filed.push(input); return { ok: true, num: 6001, rel: 'backlog/6001-x.md' }; },
    });
    expect(filed).toHaveLength(1);
    const markerComments = provider.calls.filter(([kind, body]) => kind === 'postComment' && body.includes('approval-prevention-filed:'));
    expect(markerComments).toHaveLength(1);
  });

  it('does not file again on a re-run once the marker for this head is already posted', () => {
    const marker = `<!-- approval-prevention-filed:${'a'.repeat(40)} -->\nalready filed`;
    const provider = stubProvider({ labels: ['review:pending'], comments: [{ body: marker, author: { login: 'web-everything' } }] });
    let fileCalls = 0;
    run(provider, ['1048', '--repo=o/n', '--to=accepted', '--actor=op'], {
      fileApprovalPrevention: () => { fileCalls += 1; return { ok: true, num: 1, rel: 'r' }; },
    });
    expect(fileCalls).toBe(0);
  });

  it('a filing failure does not affect the approval\'s own success/exit code', () => {
    const provider = stubProvider({ labels: ['review:pending'] });
    const { exitCode, payload } = run(provider, ['1048', '--repo=o/n', '--to=accepted', '--actor=op'], {
      fileApprovalPrevention: () => ({ ok: false, num: null, rel: null, error: 'boom' }),
    });
    expect(exitCode).toBe(0);
    expect(payload.ok).toBe(true);
  });

  it('never runs at all for a --to=changes bounce', () => {
    const provider = stubProvider({ labels: ['review:pending'] });
    let fileCalls = 0;
    run(provider, ['1048', '--repo=o/n', '--to=changes', '--actor=op', '--reason=x'], {
      buildComment: () => 'RENDERED FINDINGS\n- one',
      verdictBody: 'RENDERED FINDINGS\n- one',
      fileApprovalPrevention: () => { fileCalls += 1; return { ok: true, num: 1, rel: 'r' }; },
    });
    expect(fileCalls).toBe(0);
  });
});
