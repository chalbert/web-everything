/**
 * #4194 — ADDED NON-CLAUDE REVIEW SEATS: advisory lenses + one extra juror routed to Codex/Gemini through the
 * direct-task scripts, BESIDE Claude's mandatory seats. No real codex/agy/git/GitHub process: every effect is a fake.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  reviewSeatRoutes, ROUTED_ADVISORY_LENSES, EXTRA_JUROR_MANDATE, REVIEW_SEAT_MODELS,
} from '../review-dispatch.mjs';
import {
  runExtraSeats, extraSeatsEnabled, resolveDailyCap, callsUsedToday, quotaHold, claudeFindingsFromLoop,
  buildSeatTask, parseSeatAnswer, classifySeatCall, buildSeatRows, seatCallArgv, capDay, renderSeatSummary,
  EXTRA_SEATS_ENV, DAILY_CAP_ENV, DEFAULT_DAILY_CAP, toIsoInstant, extractAnswerJson, reserveSeatCalls,
  createExtraSeatsIo, withLedgerLock, isPinnedRev, repoRelativeFindings,
} from '../review-extra-seats.mjs';
import { runReviewJob, summarizeExtraSeats } from '../review-job.mjs';
import { ADVISORY_JUDGE_LENS, JUDGE_SEATS } from '../review-pr.mjs';
import {
  selectReviewSeatProvider, reviewSeatTaskType, REVIEW_SEAT_DISPATCH_KIND,
} from '../../lib/provider-routing.mjs';
import { ADVISORY_LENSES, MANDATORY_LENSES, findingCorroboratedBy } from '../../lib/jury-core.mjs';
import { validateScorecard, appendScorecard } from '../../conveyor/run-scorecard-store.mjs';
import { buildCodexDirectTaskArgv, buildCodexPrompt } from '../../codex-direct-task.mjs';
import {
  buildAgyPrompt, buildAgyDirectTaskArgv, runAgyDirectExec, parseFlags as parseAgyFlags,
} from '../../gemini-direct-task.mjs';
import { EventEmitter } from 'node:events';

const REPO = 'chalbert/web-everything';
const NOW = Date.parse('2026-09-26T15:00:00Z');

const CLAUDE_FINDING = { summary: 'isMechanicalMergeCommit trusts the message headline alone, so a forged merge headline bypasses the gate', file: 'scripts/lib/ai-pr-authorship.mjs', line: 41 };
const LOOP_PAYLOAD = {
  runId: 'review-pr-1', stopped: 'complete', verdict: { verdict: 'changes' },
  findings: {
    read: {
      title: 'fix the thing', body: 'Claims: adds a guard.', diffText: 'diff --git a/x b/x\n+1\n',
      netChangedFiles: ['scripts/lib/ai-pr-authorship.mjs'], netBasis: { base: 'b'.repeat(40), rev: 'a'.repeat(40) },
    },
    judge: { findings: [CLAUDE_FINDING] },
    judgeSecurity: { findings: [] },
  },
};

const answer = (lenses) => `I reviewed it.\n\n\`\`\`json\n${JSON.stringify({ lenses })}\n\`\`\``;

/** A fake seat io recording every effect. */
function fakeSeatIo(over = {}, ledgerBox = { value: null }) {
  const calls = [];
  const rows = [];
  const io = {
    now: () => NOW,
    newId: (() => { let n = 0; return () => `call-${++n}`; })(),
    log: (l) => calls.push(['log', l]),
    readRecords: () => [],
    // The shared reservation ledger; pass one `ledgerBox` to several fakes to model concurrent review jobs.
    reserveCalls: ({ want, dailyCap, now }) => {
      const r = reserveSeatCalls({ ledger: ledgerBox.value, records: io.readRecords(), want, dailyCap, now, newId: io.newId });
      ledgerBox.value = r.ledger;
      calls.push(['reserve', want, r.callIds.length]);
      return r;
    },
    append: (row) => { const v = validateScorecard({ v: 1, scoredAt: new Date(NOW).toISOString(), ...row }); if (!v.ok) throw new Error(v.errors.join('; ')); rows.push(row); },
    cliAvailable: () => true,
    makeScratch: (o) => { calls.push(['scratch', o]); return '/tmp/seat-scratch'; },
    removeScratch: (d) => calls.push(['rm', d]),
    writeFile: (p) => calls.push(['write', p]),
    runSeat: async (o) => {
      calls.push(['seat', o]);
      if (o.provider === 'codex') {
        return { exitCode: 0, report: { lastMessage: answer({
          'extra-juror:correctness': { verdict: 'changes', findings: [{ summary: 'a forged merge headline bypasses isMechanicalMergeCommit', file: 'scripts/lib/ai-pr-authorship.mjs', line: 44, impactIfUnfixed: 'broken' }] },
          'claim-accuracy': { verdict: 'changes', findings: [{ summary: 'PR body says tests were added; none were', file: null, impactIfUnfixed: 'cosmetic' }] },
        }), quotaUsedPercent: 12, quotaResetsAt: null } };
      }
      return { exitCode: 0, report: { events: { finalResponse: answer({ 'standards-conformance': { verdict: 'accept', findings: [] } }) } } };
    },
    ...over,
  };
  return { io, calls, rows };
}

describe('#4194 reviewSeatRoutes — which seats, on which provider', () => {
  it('routes the ADVISORY lenses and ONE extra juror to codex/gemini, and never a mandatory lens\'s own seat', () => {
    const { routes, skipped } = reviewSeatRoutes({});
    expect(skipped).toEqual([]);
    expect(routes.map((r) => r.seat)).toEqual(['extra-juror', 'advisory-lens', 'advisory-lens']);
    expect(routes.filter((r) => r.seat === 'extra-juror')).toHaveLength(1);
    for (const r of routes) {
      expect(['codex', 'gemini']).toContain(r.provider);
      expect(r.model).toBe(REVIEW_SEAT_MODELS[r.provider].model);
      if (r.seat === 'advisory-lens') expect(MANDATORY_LENSES).not.toContain(r.lens);
    }
    // spread across both providers when both are usable
    expect(new Set(routes.map((r) => r.provider)).size).toBe(2);
    // live-caught: agy refuses gemini-3.1-pro at `medium` ("available: low, high")
    expect(['low', 'high']).toContain(REVIEW_SEAT_MODELS.gemini.effort);
  });

  it('routes every advisory lens review-pr does not already seat off-Claude, and leaves Claude\'s mandatory seats alone', () => {
    expect(ROUTED_ADVISORY_LENSES).toEqual(ADVISORY_LENSES.filter((l) => l !== ADVISORY_JUDGE_LENS));
    expect(ROUTED_ADVISORY_LENSES).toEqual(expect.arrayContaining(['standards-conformance', 'claim-accuracy']));
    expect(EXTRA_JUROR_MANDATE).toBe('correctness');
    // Claude's own seats are still exactly review-pr's two mandatory ones.
    expect(JUDGE_SEATS.map((s) => s.step)).toEqual(['judge', 'judgeSecurity']);
  });

  it('daily cap: 0 calls left skips every seat; 1 call left puts every seat on one provider', () => {
    const none = reviewSeatRoutes({ callsRemaining: 0 });
    expect(none.routes).toEqual([]);
    expect(none.skipped.every((s) => /daily-cap/.test(s.reason))).toBe(true);
    const one = reviewSeatRoutes({ callsRemaining: 1 });
    expect(new Set(one.routes.map((r) => r.provider)).size).toBe(1);
    expect(one.routes).toHaveLength(3);
  });

  it('only available providers are picked; none available → named skips', () => {
    expect(reviewSeatRoutes({ available: ['gemini'] }).routes.every((r) => r.provider === 'gemini')).toBe(true);
    const none = reviewSeatRoutes({ available: [] });
    expect(none.routes).toEqual([]);
    expect(none.skipped).toHaveLength(3);
  });
});

describe('#4194 provider-routing selectReviewSeatProvider', () => {
  const row = (provider, status, scoredAt, lens = 'claim-accuracy') => ({ dispatchKind: REVIEW_SEAT_DISPATCH_KIND, provider, status, scoredAt, taskType: reviewSeatTaskType(lens) });

  it('ranks a provider whose last seat row for the lens failed after a clean one', () => {
    const scorecards = [row('codex', 'timeout', '2026-09-26T10:00:00Z'), row('gemini', 'ok', '2026-09-26T09:00:00Z'), row('gemini', 'ok', '2026-09-26T08:00:00Z')];
    expect(selectReviewSeatProvider({ lens: 'claim-accuracy', scorecards }).provider).toBe('gemini');
    // a LATER clean codex row lifts the penalty; then fewer rows (explore evenly) wins
    const recovered = [...scorecards, row('gemini', 'ok', '2026-09-26T07:00:00Z'), row('codex', 'ok', '2026-09-26T11:00:00Z')];
    expect(selectReviewSeatProvider({ lens: 'claim-accuracy', scorecards: recovered }).provider).toBe('codex');
  });

  it('a different lens\'s rows never count, and planned load spreads seats', () => {
    const scorecards = [row('codex', 'error', '2026-09-26T10:00:00Z', 'standards-conformance')];
    const pick = selectReviewSeatProvider({ lens: 'claim-accuracy', scorecards, plannedLoad: { gemini: 1 } });
    expect(pick.provider).toBe('codex');
    expect(pick.auditTrail.length).toBeGreaterThan(1);
  });

  it('returns null with a reason when nothing is available, and is deterministic', () => {
    expect(selectReviewSeatProvider({ lens: 'x', available: [] }).provider).toBeNull();
    expect(selectReviewSeatProvider({ lens: 'x' })).toEqual(selectReviewSeatProvider({ lens: 'x' }));
  });
});

describe('#4194 cost controls — kill switch, cap, quota', () => {
  it('kill switch: only an explicit off value disables', () => {
    expect(extraSeatsEnabled({})).toBe(true);
    for (const v of ['0', 'off', 'false', 'no']) expect(extraSeatsEnabled({ [EXTRA_SEATS_ENV]: v })).toBe(false);
    expect(resolveDailyCap({})).toBe(DEFAULT_DAILY_CAP);
    expect(resolveDailyCap({ [DAILY_CAP_ENV]: '3' })).toBe(3);
    expect(resolveDailyCap({ [DAILY_CAP_ENV]: 'lots' })).toBe(DEFAULT_DAILY_CAP);
  });

  it('counts distinct calls on today\'s New York calendar day only', () => {
    const r = (callId, scoredAt) => ({ dispatchKind: REVIEW_SEAT_DISPATCH_KIND, callId, scoredAt });
    const records = [r('a', '2026-09-26T14:00:00Z'), r('a', '2026-09-26T14:00:01Z'), r('b', '2026-09-26T05:00:00Z'), r('c', '2026-09-26T03:00:00Z')];
    // 03:00Z is still Sep 25 in New York
    expect(capDay('2026-09-26T03:00:00Z')).toBe('2026-09-25');
    expect(callsUsedToday(records, NOW)).toBe(2);
  });

  it('a provider sits out after a quota hit until its reset (or the cool-off), and a later clean row ends it', () => {
    const q = { dispatchKind: REVIEW_SEAT_DISPATCH_KIND, provider: 'codex', status: 'quota-exhausted', scoredAt: '2026-09-26T14:30:00Z' };
    expect(quotaHold([q], 'codex', NOW)).toMatch(/quota exhausted/);
    expect(quotaHold([q], 'codex', NOW + 2 * 60 * 60 * 1000)).toBeNull();
    expect(quotaHold([q, { ...q, status: 'ok', scoredAt: '2026-09-26T14:40:00Z' }], 'codex', NOW)).toBeNull();
    expect(quotaHold([{ ...q, status: 'ok', quotaUsedPercent: 99, quotaResetsAt: '2026-09-26T18:00:00Z' }], 'codex', NOW)).toMatch(/99%/);
    expect(quotaHold([q], 'gemini', NOW)).toBeNull();
    // live-caught: codex reports resets_at in epoch SECONDS
    expect(toIsoInstant(1790430415)).toBe(new Date(1790430415 * 1000).toISOString());
    expect(toIsoInstant('2026-09-26T18:00:00Z')).toBe('2026-09-26T18:00:00.000Z');
    expect(toIsoInstant(null)).toBeNull();
  });
});

describe('#4194 the direct-task scripts in --review mode', () => {
  it('codex runs read-only with a review suffix; the default stays workspace-write', () => {
    expect(buildCodexDirectTaskArgv({ cwd: '/d', review: true })).toEqual(expect.arrayContaining(['-s', 'read-only']));
    expect(buildCodexDirectTaskArgv({ cwd: '/d' })).toEqual(expect.arrayContaining(['-s', 'workspace-write']));
    expect(buildCodexPrompt('Review it', { review: true })).toMatch(/READ-ONLY review/);
    expect(buildCodexPrompt('Review it', { review: true })).not.toMatch(/Make the change directly/);
  });

  it('gemini accepts --review and forbids edits in the prompt', () => {
    expect(parseAgyFlags(['--review', '--task=x'])).toMatchObject({ review: true });
    const p = buildAgyPrompt('Review it', '/abs/dir', { review: true });
    expect(p).toMatch(/READ-ONLY review/);
    expect(p).not.toMatch(/Make the change directly/);
  });

  it('gemini in --review mode never gets --dangerously-skip-permissions, so agy denies its shell and writes', () => {
    expect(buildAgyDirectTaskArgv({ review: true })).not.toContain('--dangerously-skip-permissions');
    expect(buildAgyDirectTaskArgv({ review: true, resumeConversationId: 'c-1' })).not.toContain('--dangerously-skip-permissions');
    expect(buildAgyDirectTaskArgv({})).toContain('--dangerously-skip-permissions');
    // an extra dir would re-grant the reads outside --dir that review mode denies
    expect(() => buildAgyDirectTaskArgv({ review: true, addDirs: ['/elsewhere'] })).toThrow(/add-dir/);
    const p = buildAgyPrompt('Review it', '/abs/dir', { review: true });
    expect(p).toMatch(/cannot run commands or write any file/);
    expect(p).not.toMatch(/\brg\b|grep|via your shell/);
  });

  it('gemini --review drops the permission bypass through the real run (initial attempt and resume alike)', async () => {
    const argvs = [];
    const spawnFn = (_cli, argv) => {
      argvs.push(argv);
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = Object.assign(new EventEmitter(), { end: () => {} });
      child.kill = () => {};
      setImmediate(() => { child.stdout.emit('data', Buffer.from('{"type":"result","status":"success"}\n')); child.emit('close', 0); });
      return child;
    };
    const dir = mkdtempSync(join(tmpdir(), 'we-agy-review-'));
    try {
      await runAgyDirectExec({ dir, task: 'Review it', review: true, timeoutMs: 60_000, logFile: join(dir, 'log.jsonl'), stream: false, spawnFn });
      await runAgyDirectExec({ dir, task: 'Review it', review: true, timeoutMs: 60_000, logFile: join(dir, 'log.jsonl'), stream: false, spawnFn, resumeConversationId: 'c-1' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(argvs).toHaveLength(2);
    for (const a of argvs) expect(a).not.toContain('--dangerously-skip-permissions');
  });

  it('seatCallArgv shells the existing scripts in review mode (gemini halves its per-attempt budget)', () => {
    const c = seatCallArgv({ provider: 'codex', taskFile: '/t', dir: '/d', model: 'm', effort: 'medium', timeoutMs: 600000, root: '/r' });
    expect(c[0]).toBe('/r/scripts/codex-direct-task.mjs');
    expect(c).toEqual(expect.arrayContaining(['--review', '--json', '--no-stream', '--timeout-ms=600000']));
    const g = seatCallArgv({ provider: 'gemini', taskFile: '/t', dir: '/d', model: 'm', effort: 'medium', timeoutMs: 600000, root: '/r' });
    expect(g[0]).toBe('/r/scripts/gemini-direct-task.mjs');
    expect(g).toEqual(expect.arrayContaining(['--review', '--json', '--timeout-ms=300000']));
  });
});

describe('#4194 prompt, answer parsing, confirmation, rows', () => {
  const seats = reviewSeatRoutes({}).routes.map((r) => ({ ...r }));

  it('the brief names each seat, the files, and the JSON contract', () => {
    const t = buildSeatTask({ pr: 5, repo: REPO, title: 'T', dir: '/s', diffFile: '/s/.git/d', bodyFile: '/s/.git/b', seats });
    for (const s of seats) expect(t).toContain(`"${s.key}"`);
    expect(t).toContain('/s/.git/d');
    expect(t).toMatch(/```json/);
  });

  it('an INLINE brief (the gemini seat) carries the diff and PR body in the message and points at no file', () => {
    const t = buildSeatTask({ pr: 5, repo: REPO, title: 'T', inline: { diffText: 'diff --git a/q b/q\n+NEEDLE\n', body: 'BODY-TEXT' }, seats });
    expect(t).toContain('+NEEDLE');
    expect(t).toContain('BODY-TEXT');
    expect(t).toMatch(/cannot run commands or write files/);
    expect(t).toMatch(/UNTRUSTED/);
    expect(t).not.toMatch(/checked out at|read what a seat needs/);
    const big = buildSeatTask({ pr: 5, repo: REPO, title: 'T', inline: { diffText: 'x'.repeat(500_000), body: '' }, seats });
    expect(big.length).toBeLessThan(260_000);
    expect(big).toMatch(/truncated/);
  });

  it('parses the last fenced JSON; a seat missing from it is not ok', () => {
    const text = answer({ 'claim-accuracy': { verdict: 'changes', findings: [{ summary: 'wrong count', file: 'a.md', line: 3 }] } });
    const parsed = parseSeatAnswer(text, seats);
    expect(parsed['claim-accuracy']).toMatchObject({ ok: true, verdict: 'changes' });
    expect(parsed['claim-accuracy'].findings[0]).toMatchObject({ summary: 'wrong count', file: 'a.md', line: 3 });
    expect(parsed['standards-conformance'].ok).toBe(false);
  });

  it('finds an unfenced answer however its JSON is spaced or indented', () => {
    const lenses = { 'claim-accuracy': { verdict: 'accept', findings: [] } };
    expect(extractAnswerJson(`Done.\n${JSON.stringify({ lenses })}`)).toEqual({ lenses });
    expect(extractAnswerJson(`Done.\n{ "lenses": { "claim-accuracy": { "verdict": "accept", "findings": [] } } }`)).toEqual({ lenses });
    expect(extractAnswerJson(`Done.\n${JSON.stringify({ lenses }, null, 2)}\n`)).toEqual({ lenses });
    expect(extractAnswerJson('Done.\n{\n\t"lenses"  :  {}\n}')).toEqual({ lenses: {} });
    expect(extractAnswerJson('no answer at all')).toBeNull();
  });

  it('classifies timeouts, quota hits, garbage and success', () => {
    expect(classifySeatCall('codex', { timedOut: true, report: null }).status).toBe('timeout');
    expect(classifySeatCall('gemini', { report: { events: { finalResponse: '', errorMessage: 'RESOURCE_EXHAUSTED: quota' } } }).status).toBe('quota-exhausted');
    expect(classifySeatCall('codex', { report: { lastMessage: 'I looked around.' } }).status).toBe('unparseable');
    expect(classifySeatCall('codex', { report: null, exitCode: 1, stderr: 'boom' }).status).toBe('error');
    expect(classifySeatCall('codex', { report: { lastMessage: answer({}) } }).status).toBe('ok');
  });

  it('confirmation: same file + near line, or same file + shared words; different file never', () => {
    expect(findingCorroboratedBy({ summary: 'forged headline', file: 'scripts/lib/ai-pr-authorship.mjs', line: 44 }, [CLAUDE_FINDING])).toBe(CLAUDE_FINDING);
    expect(findingCorroboratedBy({ summary: 'forged merge headline bypasses gate', file: './scripts/lib/ai-pr-authorship.mjs', line: 300 }, [CLAUDE_FINDING])).toBe(CLAUDE_FINDING);
    expect(findingCorroboratedBy({ summary: 'forged merge headline bypasses gate', file: 'other.mjs', line: 41 }, [CLAUDE_FINDING])).toBeNull();
    expect(findingCorroboratedBy({ summary: 'unrelated typo' }, [CLAUDE_FINDING])).toBeNull();
  });

  it('a seat citing the ABSOLUTE scratch path is cut back to the repo-relative path, so corroboration still matches', () => {
    const scratch = '/var/folders/xy/T/we-review-seat-AbC123';
    const parsed = { s: { ok: true, verdict: 'changes', findings: [
      { summary: 'a', file: `${scratch}/scripts/lib/ai-pr-authorship.mjs` },
      { summary: 'b', file: `/private${scratch}/x/y.mjs` },
      { summary: 'c', file: 'already/relative.mjs' },
      { summary: 'd', file: null },
    ] } };
    expect(repoRelativeFindings(parsed, scratch).s.findings.map((f) => f.file)).toEqual(['scripts/lib/ai-pr-authorship.mjs', 'x/y.mjs', 'already/relative.mjs', null]);
    const f = repoRelativeFindings(parsed, scratch).s.findings[0];
    expect(findingCorroboratedBy({ ...f, line: 41 }, [CLAUDE_FINDING])).toBe(CLAUDE_FINDING);
  });

  it('two DIFFERENT files that merely share a path tail never corroborate, even at a near line', () => {
    const claude = { summary: 'config default is read before the env override', file: 'lib/config.mjs', line: 104 };
    expect(findingCorroboratedBy({ summary: 'port parsing drops the scheme', file: 'apps/api/lib/config.mjs', line: 100 }, [claude])).toBeNull();
    expect(findingCorroboratedBy({ summary: 'port parsing drops the scheme', file: 'scripts/other/lib/x.mjs', line: 5 }, [{ ...claude, file: 'scripts/lib/x.mjs', line: 5 }])).toBeNull();
    // the same file, cited with or without a diff prefix / line suffix, still does
    expect(findingCorroboratedBy({ summary: 'x', file: 'b/lib/config.mjs:101', line: 101 }, [claude])).toBe(claude);
  });

  it('rows are valid scorecard rows carrying provider, model, lens, findings and Claude confirmation', () => {
    const group = seats.filter((s) => s.provider === 'codex');
    const call = { status: 'ok', text: '', error: null };
    const parsed = { 'extra-juror:correctness': { ok: true, verdict: 'changes', findings: [{ summary: 'forged headline', file: 'scripts/lib/ai-pr-authorship.mjs', line: 40 }] }, 'claim-accuracy': { ok: true, verdict: 'accept', findings: [] } };
    const rows = buildSeatRows({ callId: 'c1', pr: 5, repo: REPO, provider: 'codex', model: 'gpt-6-astra', effort: 'medium', seats: group, call, parsed, claudeFindings: [CLAUDE_FINDING] });
    for (const r of rows) expect(validateScorecard(r)).toEqual({ ok: true, errors: [] });
    const juror = rows.find((r) => r.seat === 'extra-juror');
    expect(juror).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', lens: 'correctness', status: 'ok', findingsCount: 1, confirmedCount: 1, claudeConfirmed: true, taskType: 'review-lens:extra-juror:correctness' });
    // real store write, in memory
    let text = null;
    const io = { path: '/mem/store.json', read: () => text, write: (_p, t) => { text = t; }, exists: () => text !== null };
    appendScorecard(juror, io);
    expect(JSON.parse(text).records.at(-1)).toMatchObject({ dispatchKind: 'review-seat', lens: 'correctness', confirmedCount: 1 });
  });

  it('claudeFindingsFromLoop reads only Claude\'s mandatory judge steps; no judged step → null', () => {
    expect(claudeFindingsFromLoop(LOOP_PAYLOAD)).toEqual([CLAUDE_FINDING]);
    expect(claudeFindingsFromLoop({ findings: { read: {} } })).toBeNull();
  });
});

describe('#4194 runExtraSeats — the arc, with fakes', () => {
  it('runs both providers in parallel, writes one evidence row per seat, stamps Claude confirmation, cleans up', async () => {
    const { io, calls, rows } = fakeSeatIo();
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('ran');
    expect(r.rowsWritten).toBe(3);
    expect(rows.map((x) => `${x.seat}:${x.lens}@${x.provider}`).sort()).toEqual([
      'advisory-lens:claim-accuracy@codex', 'advisory-lens:standards-conformance@gemini', 'extra-juror:correctness@codex',
    ]);
    const juror = rows.find((x) => x.seat === 'extra-juror');
    expect(juror.findings[0]).toMatchObject({ confirmedByClaude: true });
    const claim = rows.find((x) => x.lens === 'claim-accuracy');
    expect(claim.findings[0]).toMatchObject({ confirmedByClaude: false });
    expect(claim.quotaUsedPercent).toBe(12);
    expect(calls.filter((c) => c[0] === 'seat')).toHaveLength(2);
    expect(calls.find((c) => c[0] === 'scratch')[1]).toMatchObject({ lanePath: '/lane', rev: 'a'.repeat(40) });
    expect(calls.at(-1)).toEqual(['rm', '/tmp/seat-scratch']);
    expect(renderSeatSummary(r).join('\n')).toMatch(/also raised by Claude/);
  });

  it('the gemini seat gets an inline brief; the codex seat (OS read-only sandbox) reads the checkout', async () => {
    const written = new Map();
    const { io } = fakeSeatIo({ writeFile: (p, text) => written.set(p, text) });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('ran');
    const gem = [...written].find(([p]) => p.endsWith('task-gemini.md'))[1];
    const cod = [...written].find(([p]) => p.endsWith('task-codex.md'))[1];
    expect(gem).toContain(LOOP_PAYLOAD.findings.read.diffText.trim());
    expect(gem).not.toContain('/tmp/seat-scratch');
    expect(cod).toContain('/tmp/seat-scratch');
  });

  it('no pinned rev on the loop payload → skipped before any reservation, scratch or spawn (never the released lane\'s HEAD)', async () => {
    const { io, calls } = fakeSeatIo();
    const payload = { ...LOOP_PAYLOAD, findings: { ...LOOP_PAYLOAD.findings, read: { ...LOOP_PAYLOAD.findings.read, netBasis: { base: 'b'.repeat(40) } } } };
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: payload, env: {} }, io);
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/pinned/);
    expect(calls.some((c) => ['reserve', 'scratch', 'seat'].includes(c[0]))).toBe(false);
  });

  it('soak: a seat that fails, times out or throws never fails the run — it is only that seat\'s status', async () => {
    const { io, rows } = fakeSeatIo({
      runSeat: async (o) => {
        if (o.provider === 'codex') throw new Error('spawn ENOENT');
        return { timedOut: true, report: null };
      },
    });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('ran');
    expect(rows.find((x) => x.provider === 'codex').status).toBe('error');
    expect(rows.find((x) => x.provider === 'gemini').status).toBe('timeout');
    expect(rows.every((x) => x.findingsCount === 0)).toBe(true);
  });

  it('kill switch: nothing is read or spawned', async () => {
    const { io, calls } = fakeSeatIo({ readRecords: () => { throw new Error('must not read'); } });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: { [EXTRA_SEATS_ENV]: '0' } }, io);
    expect(r.status).toBe('disabled');
    expect(calls).toEqual([]);
  });

  it('no CLI on PATH → skipped, logged with the reason, nothing spawned', async () => {
    const { io, calls } = fakeSeatIo({ cliAvailable: () => false });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/CLI not found/);
    expect(calls.some((c) => c[0] === 'seat')).toBe(false);
    expect(calls.filter((c) => c[0] === 'log').map((c) => c[1]).join('\n')).toMatch(/skipping codex/);
  });

  it('daily cap reached → skipped without spawning', async () => {
    const used = Array.from({ length: 3 }, (_, i) => ({ dispatchKind: REVIEW_SEAT_DISPATCH_KIND, callId: `k${i}`, scoredAt: '2026-09-26T14:00:00Z' }));
    const { io, calls } = fakeSeatIo({ readRecords: () => used });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: { [DAILY_CAP_ENV]: '3' } }, io);
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/daily-cap/);
    expect(calls.some((c) => c[0] === 'seat')).toBe(false);
  });

  it('concurrent reviews cannot reserve more than the remaining daily budget', async () => {
    // Both jobs read the same store snapshot (0 used) before either has written a row — the race the cap must
    // survive. Each wants 2 calls (codex + gemini); the cap is 2, so together they may launch 2, not 4.
    const ledgerBox = { value: null };
    let release;
    const gate = new Promise((r) => { release = r; });
    let launched = 0;
    const runSeat = async (o) => { launched += 1; await gate; return fakeSeatIo().io.runSeat(o); };
    const a = fakeSeatIo({ runSeat }, ledgerBox);
    const b = fakeSeatIo({ runSeat, newId: (() => { let n = 0; return () => `b-call-${++n}`; })() }, ledgerBox);
    const env = { [DAILY_CAP_ENV]: '2' };
    const pa = runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env }, a.io);
    const pb = runExtraSeats({ pr: 6, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env }, b.io);
    release();
    const [ra, rb] = await Promise.all([pa, pb]);
    expect(launched).toBe(2);
    expect(ra.status).toBe('ran');
    expect(rb.status).toBe('skipped');
    expect(rb.reason).toMatch(/daily-cap/);
    expect(ledgerBox.value.reservations).toHaveLength(2);
  });

  it('a short grant (a concurrent review took one) re-plans every seat onto the one granted call', async () => {
    // The snapshot says 2 left; the ledger already holds a reservation the store has not seen, so 1 is granted.
    const ledgerBox = { value: { version: 1, reservations: [{ callId: 'other', at: new Date(NOW).toISOString() }] } };
    const { io, calls, rows } = fakeSeatIo({}, ledgerBox);
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: { [DAILY_CAP_ENV]: '2' } }, io);
    expect(r.status).toBe('ran');
    expect(calls.find((c) => c[0] === 'reserve')).toEqual(['reserve', 2, 1]);
    expect(calls.filter((c) => c[0] === 'seat')).toHaveLength(1);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((x) => x.provider)).size).toBe(1);
    expect(r.callsUsedToday).toBe(2);
    // the row carries the RESERVED call id, so the store and the ledger count it once
    expect(ledgerBox.value.reservations.map((x) => x.callId)).toContain(rows[0].callId);
  });

  it('a reservation that cannot be made fails closed — nothing spawned', async () => {
    const { io, calls } = fakeSeatIo({ reserveCalls: () => { throw new Error('EACCES ledger'); } });
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/EACCES ledger/);
    expect(calls.some((c) => c[0] === 'seat' || c[0] === 'scratch')).toBe(false);
  });

  it('a loop that never read the PR → skipped; a crashing store append is survived', async () => {
    const { io } = fakeSeatIo({ append: () => { throw new Error('disk full'); } });
    expect((await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: { stopped: 'refused' }, env: {} }, io)).status).toBe('skipped');
    const r = await runExtraSeats({ pr: 5, repo: REPO, lanePath: '/lane', loopPayload: LOOP_PAYLOAD, env: {} }, io);
    expect(r.status).toBe('ran');
    expect(r.rowsWritten).toBe(0);
  });
});

describe('#4194 review-job — the seats run AFTER the arc, and can never change its outcome', () => {
  function fakeJobIo(over = {}) {
    const calls = [];
    const io = {
      root: '/daemon',
      now: (() => { let t = 1_000; return () => { t += 10; return t; }; })(),
      newActorId: () => 'actor',
      readPrevCompletion: () => null,
      report: (f) => calls.push(['report', f.status]),
      claim: () => { calls.push(['claim']); return { ok: true }; },
      updateRecord: () => calls.push(['update']),
      unclaim: () => calls.push(['unclaim']),
      acquireLane: () => { calls.push(['acquire']); return { lanePath: '/lanes/lane-7' }; },
      runLoop: () => { calls.push(['loop']); return { status: 0, stdout: JSON.stringify(LOOP_PAYLOAD), stderr: '' }; },
      releaseLane: () => calls.push(['release']),
      log: () => {},
      runExtraSeats: (input) => { calls.push(['seats', input]); return { status: 'ran', seats: [], skipped: [], rowsWritten: 0, callsUsedToday: 1, dailyCap: 40 }; },
      ...over,
    };
    return { io, calls };
  }

  it('Claude\'s loop runs first; the added seats run only after done/release/unclaim, with the loop payload', () => {
    const { io, calls } = fakeJobIo();
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(calls.map((c) => c[0])).toEqual(['claim', 'report', 'acquire', 'update', 'loop', 'report', 'release', 'unclaim', 'seats']);
    expect(calls.at(-1)[1]).toMatchObject({ pr: 10, repo: REPO, lanePath: '/lanes/lane-7', loopPayload: LOOP_PAYLOAD });
    expect(out).toMatchObject({ outcome: 'bounced', extraSeats: { status: 'ran' } });
  });

  it('a crashing seat stage leaves the review outcome untouched', () => {
    const { io } = fakeJobIo({ runExtraSeats: () => { throw new Error('seat runner exploded'); } });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out.outcome).toBe('bounced');
    expect(out.extraSeats).toMatchObject({ status: 'error', reason: expect.stringMatching(/exploded/) });
  });

  it('no seats when the loop timed out or printed nothing parseable', () => {
    const { io, calls } = fakeJobIo({ runLoop: () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '', timedOut: true }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(calls.some((c) => c[0] === 'seats')).toBe(false);
    expect(out.extraSeats).toBeUndefined();
  });

  it('no seats when the loop timed out even though it had already flushed a parseable payload', () => {
    // The child can print its whole JSON and then be SIGKILLed past the wall during cleanup: `parsed` is
    // non-null, so only the `timedOut` half of the guard keeps the seats from firing on an unfinished review.
    const { io, calls } = fakeJobIo({ runLoop: () => ({ status: null, signal: 'SIGKILL', stdout: JSON.stringify(LOOP_PAYLOAD), stderr: '', timedOut: true }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(calls.some((c) => c[0] === 'seats')).toBe(false);
    expect(out.extraSeats).toBeUndefined();
  });

  it('no seats when the loop finished in time but printed nothing parseable', () => {
    const { io, calls } = fakeJobIo({ runLoop: () => ({ status: 1, signal: null, stdout: 'not json', stderr: '', timedOut: false }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(calls.some((c) => c[0] === 'seats')).toBe(false);
    expect(out.extraSeats).toBeUndefined();
  });

  it('summarizeExtraSeats keeps findings and confirmation, drops the bulk', () => {
    const s = summarizeExtraSeats({ status: 'ran', seats: [{ seat: 'extra-juror', lens: 'correctness', provider: 'codex', model: 'm', status: 'ok', seatVerdict: 'changes', findings: [{ summary: 's', file: 'f', line: 1, impactIfUnfixed: 'broken', confirmedByClaude: true }] }], rowsWritten: 1, callsUsedToday: 2, dailyCap: 40 });
    expect(s.seats[0].findings[0]).toEqual({ summary: 's', file: 'f', line: 1, impact: 'broken', confirmedByClaude: true });
    expect(s).toMatchObject({ rowsWritten: 1, callsUsedToday: 2, dailyCap: 40 });
  });
});

describe('#4194 reserveSeatCalls — the daily budget is reserved BEFORE a call launches', () => {
  const at = (iso) => ({ callId: iso, at: iso });
  const ids = () => { let n = 0; return () => `r${++n}`; };

  it('grants up to what is left, counting both stored rows and outstanding reservations', () => {
    const records = [{ dispatchKind: REVIEW_SEAT_DISPATCH_KIND, callId: 'done-1', scoredAt: '2026-09-26T14:00:00Z' }];
    const ledger = { version: 1, reservations: [at('2026-09-26T14:30:00Z')] };
    const r = reserveSeatCalls({ ledger, records, want: 3, dailyCap: 4, now: NOW, newId: ids() });
    expect(r.callIds).toEqual(['r1', 'r2']);
    expect(r.used).toBe(2);
    expect(r.ledger.reservations).toHaveLength(3);
  });

  it('a reservation whose row has since landed is counted once, not twice', () => {
    const records = [{ dispatchKind: REVIEW_SEAT_DISPATCH_KIND, callId: 'x', scoredAt: '2026-09-26T14:00:00Z' }];
    const ledger = { version: 1, reservations: [{ callId: 'x', at: '2026-09-26T13:59:00Z' }] };
    expect(reserveSeatCalls({ ledger, records, want: 5, dailyCap: 3, now: NOW, newId: ids() }).callIds).toHaveLength(2);
  });

  it('yesterday\'s reservations are dropped and do not count; nothing is granted at or over the cap', () => {
    const ledger = { version: 1, reservations: [at('2026-09-25T12:00:00Z'), at('2026-09-26T12:00:00Z')] };
    const r = reserveSeatCalls({ ledger, records: [], want: 5, dailyCap: 2, now: NOW, newId: ids() });
    expect(r.callIds).toEqual(['r1']);
    expect(r.ledger.reservations.map((x) => x.at.slice(0, 10))).toEqual(['2026-09-26', '2026-09-26']);
    expect(reserveSeatCalls({ ledger: r.ledger, records: [], want: 1, dailyCap: 2, now: NOW, newId: ids() }).callIds).toEqual([]);
    expect(reserveSeatCalls({ ledger: null, records: [], want: 0, dailyCap: 2, now: NOW, newId: ids() }).callIds).toEqual([]);
  });
});

describe('#4194 createExtraSeatsIo — real effects, on a throwaway repo and store', () => {
  let root;
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'we-seat-io-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('makeScratch is a SELF-CONTAINED copy of the pinned commit: no alternates, and it survives the lane being gc\'d or deleted', () => {
    const lane = join(root, 'lane');
    mkdirSync(lane);
    git(lane, 'init', '--quiet');
    writeFileSync(join(lane, 'a.txt'), 'one\n');
    git(lane, 'add', 'a.txt');
    git(lane, 'commit', '--quiet', '-m', 'one');
    const pinned = git(lane, 'rev-parse', 'HEAD');
    writeFileSync(join(lane, 'a.txt'), 'two\n');
    git(lane, 'commit', '--quiet', '-am', 'two');
    const io = createExtraSeatsIo({ env: process.env });
    const dir = io.makeScratch({ lanePath: lane, rev: pinned });
    try {
      expect(git(dir, 'rev-parse', 'HEAD')).toBe(pinned);
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('one\n');
      expect(existsSync(join(dir, '.git', 'objects', 'info', 'alternates'))).toBe(false);
      // The lane is re-acquired and reset (its objects pruned) — or gone entirely. The scratch must not care.
      rmSync(lane, { recursive: true, force: true });
      expect(git(dir, 'cat-file', '-p', `${pinned}:a.txt`)).toBe('one');
      expect(git(dir, 'fsck', '--no-progress', '--connectivity-only')).toBe('');
    } finally { io.removeScratch(dir); }
  });

  it('makeScratch with no pinned rev REFUSES — the released lane\'s HEAD may already be another PR', () => {
    const lane = join(root, 'lane');
    mkdirSync(lane);
    git(lane, 'init', '--quiet');
    writeFileSync(join(lane, 'a.txt'), 'x\n');
    git(lane, 'add', 'a.txt');
    git(lane, 'commit', '--quiet', '-m', 'x');
    const io = createExtraSeatsIo({ env: process.env });
    for (const rev of [null, undefined, '', 'HEAD', 'main']) {
      expect(() => io.makeScratch({ lanePath: lane, rev })).toThrow(/pinned/);
    }
  });

  it('a held reservation lock FAILS CLOSED: past the wait, reserveCalls throws and writes no reservation', () => {
    const storePath = join(root, 'state', 'run-scorecards.json');
    const ledger = join(root, 'state', 'review-seat-reservations.json');
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(`${ledger}.lock`, '99999'); // a live holder (fresh mtime) that never lets go
    const io = createExtraSeatsIo({ env: process.env, storePath, lockTimeoutMs: 50 });
    expect(() => io.reserveCalls({ want: 2, dailyCap: 3, now: Date.now() })).toThrow(/lock/);
    expect(existsSync(ledger)).toBe(false);
    expect(existsSync(`${ledger}.lock`)).toBe(true); // someone else's lock is never removed
  });

  it('a STALE reservation lock (a crashed holder) is taken over, not waited on forever', () => {
    const storePath = join(root, 'state', 'run-scorecards.json');
    const ledger = join(root, 'state', 'review-seat-reservations.json');
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(`${ledger}.lock`, '99999');
    const old = new Date(Date.now() - 60_000);
    utimesSync(`${ledger}.lock`, old, old);
    const r = createExtraSeatsIo({ env: process.env, storePath, lockTimeoutMs: 50 }).reserveCalls({ want: 1, dailyCap: 3, now: Date.now() });
    expect(r.callIds).toHaveLength(1);
    expect(existsSync(`${ledger}.lock`)).toBe(false);
  });

  it('a holder only ever removes ITS OWN lock — a lock taken over while it ran is left standing', () => {
    const p = join(root, 'state', 'x.json');
    withLedgerLock(p, () => {
      writeFileSync(`${p}.lock`, 'someone-else'); // a waiter took our lock over while we held it
    });
    expect(readFileSync(`${p}.lock`, 'utf8')).toBe('someone-else');
  });

  it('isPinnedRev accepts only a full commit id — never a ref name or an abbreviation git would read as a ref', () => {
    expect(isPinnedRev('a'.repeat(40))).toBe(true);
    expect(isPinnedRev('b'.repeat(64))).toBe(true);
    for (const r of ['deadbeef', 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), 'HEAD', 'main', '', null]) expect(isPinnedRev(r)).toBe(false);
  });

  it('reserveCalls persists the ledger beside the store, so a second job sees the first one\'s reservation', () => {
    const storePath = join(root, 'state', 'run-scorecards.json');
    const now = Date.now();
    const first = createExtraSeatsIo({ env: process.env, storePath }).reserveCalls({ want: 2, dailyCap: 3, now });
    const second = createExtraSeatsIo({ env: process.env, storePath }).reserveCalls({ want: 2, dailyCap: 3, now });
    expect(first.callIds).toHaveLength(2);
    expect(second.callIds).toHaveLength(1);
    expect(second.used).toBe(2);
    expect(existsSync(`${join(root, 'state', 'review-seat-reservations.json')}.lock`)).toBe(false);
  });

  it('a corrupt ledger fails closed: reserveCalls throws and leaves the file for a human, never overwrites it', () => {
    const storePath = join(root, 'state', 'run-scorecards.json');
    const ledger = join(root, 'state', 'review-seat-reservations.json');
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(ledger, '{ not json');
    expect(() => createExtraSeatsIo({ env: process.env, storePath }).reserveCalls({ want: 1, dailyCap: 3, now: Date.now() })).toThrow();
    expect(readFileSync(ledger, 'utf8')).toBe('{ not json');
  });
});
