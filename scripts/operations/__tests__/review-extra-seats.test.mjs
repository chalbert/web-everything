/**
 * #4194 — ADDED NON-CLAUDE REVIEW SEATS: advisory lenses + one extra juror routed to Codex/Gemini through the
 * direct-task scripts, BESIDE Claude's mandatory seats. No real codex/agy/git/GitHub process: every effect is a fake.
 */
import { describe, it, expect } from 'vitest';

import {
  reviewSeatRoutes, ROUTED_ADVISORY_LENSES, EXTRA_JUROR_MANDATE, REVIEW_SEAT_MODELS,
} from '../review-dispatch.mjs';
import {
  runExtraSeats, extraSeatsEnabled, resolveDailyCap, callsUsedToday, quotaHold, claudeFindingsFromLoop,
  buildSeatTask, parseSeatAnswer, classifySeatCall, buildSeatRows, seatCallArgv, capDay, renderSeatSummary,
  EXTRA_SEATS_ENV, DAILY_CAP_ENV, DEFAULT_DAILY_CAP, toIsoInstant,
} from '../review-extra-seats.mjs';
import { runReviewJob, summarizeExtraSeats } from '../review-job.mjs';
import { ADVISORY_JUDGE_LENS, JUDGE_SEATS } from '../review-pr.mjs';
import {
  selectReviewSeatProvider, reviewSeatTaskType, REVIEW_SEAT_DISPATCH_KIND,
} from '../../lib/provider-routing.mjs';
import { ADVISORY_LENSES, MANDATORY_LENSES, findingCorroboratedBy } from '../../lib/jury-core.mjs';
import { validateScorecard, appendScorecard } from '../../conveyor/run-scorecard-store.mjs';
import { buildCodexDirectTaskArgv, buildCodexPrompt } from '../../codex-direct-task.mjs';
import { buildAgyPrompt, parseFlags as parseAgyFlags } from '../../gemini-direct-task.mjs';

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
function fakeSeatIo(over = {}) {
  const calls = [];
  const rows = [];
  const io = {
    now: () => NOW,
    newId: (() => { let n = 0; return () => `call-${++n}`; })(),
    log: (l) => calls.push(['log', l]),
    readRecords: () => [],
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

  it('parses the last fenced JSON; a seat missing from it is not ok', () => {
    const text = answer({ 'claim-accuracy': { verdict: 'changes', findings: [{ summary: 'wrong count', file: 'a.md', line: 3 }] } });
    const parsed = parseSeatAnswer(text, seats);
    expect(parsed['claim-accuracy']).toMatchObject({ ok: true, verdict: 'changes' });
    expect(parsed['claim-accuracy'].findings[0]).toMatchObject({ summary: 'wrong count', file: 'a.md', line: 3 });
    expect(parsed['standards-conformance'].ok).toBe(false);
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

  it('summarizeExtraSeats keeps findings and confirmation, drops the bulk', () => {
    const s = summarizeExtraSeats({ status: 'ran', seats: [{ seat: 'extra-juror', lens: 'correctness', provider: 'codex', model: 'm', status: 'ok', seatVerdict: 'changes', findings: [{ summary: 's', file: 'f', line: 1, impactIfUnfixed: 'broken', confirmedByClaude: true }] }], rowsWritten: 1, callsUsedToday: 2, dailyCap: 40 });
    expect(s.seats[0].findings[0]).toEqual({ summary: 's', file: 'f', line: 1, impact: 'broken', confirmedByClaude: true });
    expect(s).toMatchObject({ rowsWritten: 1, callsUsedToday: 2, dailyCap: 40 });
  });
});
