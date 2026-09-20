import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeLoad, groupSamples, joinOtel, renderReport } from '../load-analysis.mjs';
import {
  MIN_BUCKET_SAMPLES, buildReview, diffReviews, latestReview, limitChangedMetric, parseReviewData, recordLimitChange, resourceReviewOwed, suggestLimits, writeReview,
} from '../load-review.mjs';
import { main, readOtel } from '../load-report-cli.mjs';
import { METRIC_NAMES, parseTelemetryLines, validateTelemetryEvent } from '../telemetry.mjs';
import { createFileTelemetryStore } from '../telemetry-store.mjs';

const DAY = 86_400_000;
const T0 = Date.parse('2026-09-20T00:00:00.000Z');

// ── synthetic sampler data: `n` samples per heavy-count bucket, controllable load ──────────────────────────
const m = (name, value, sample, t, extra = {}) => ({ v: 1, event: 'metric', name, value, timestamp: new Date(t).toISOString(), attributes: { source: 'host-sampler', sample, interval_s: 30, ...extra }, resource: {} });
function synth(plan) {
  // plan: [{ heavy, load, spawn, spin, count }]
  const out = []; let i = 0;
  for (const p of plan) for (let k = 0; k < p.count; k++, i++) {
    const t = T0 + i * 60 * 60_000; // hourly so the span passes 48 h
    const s = `s${i}`;
    out.push(m('host.cpu.load1', p.load, s, t), m('host.cpu.count', 12, s, t), m('host.probe.spawn_ms', p.spawn ?? 40, s, t), m('host.probe.spin_overshoot_ms', p.spin ?? 0, s, t),
      m('host.sessions.live', p.heavy, s, t), m('lane.pool.leased', p.heavy, s, t), m('host.family.count', 0, s, t, { 'n.vitest': p.heavy, 'n.playwright': 0 }));
  }
  return out;
}

describe('suggestLimits — the recommendation method', () => {
  it('suggests the upper edge of the highest healthy heavy bucket and says why it stopped', () => {
    const r = analyzeLoad(synth([
      { heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 5, count: 40 }, { heavy: 2, load: 9, count: 40 }, { heavy: 3, load: 20, count: 40 }, { heavy: 5, load: 30, count: 40 },
    ]));
    const s = suggestLimits(r);
    expect(s.heavyAdmissionCap).toMatchObject({ suggested: 2, driver: true });
    expect(s.heavyAdmissionCap.stoppedAt).toMatchObject({ bucket: '3-4', load1P90: 20 });
    expect(s.confident).toBe(true);
    expect(s.target).toMatchObject({ load1P90AtMostCores: 12, minBucketSamples: MIN_BUCKET_SAMPLES });
  });

  it('a slow probe makes a bucket unhealthy even when load1 looks fine', () => {
    const s = suggestLimits(analyzeLoad(synth([{ heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 4, spawn: 900, count: 40 }])));
    expect(s.heavyAdmissionCap.suggested).toBe(0);
    expect(s.heavyAdmissionCap.stoppedAt).toMatchObject({ bucket: '1', spawnP90: 900 });
  });

  it('a thin bucket (< 30 samples) is not trusted, and short data is marked not confident', () => {
    const r = analyzeLoad(synth([{ heavy: 0, load: 3, count: 10 }]));
    const s = suggestLimits(r);
    expect(s.heavyAdmissionCap.suggested).toBeNull();
    expect(s.heavyAdmissionCap.basis).toMatch(/only 10 samples/);
    expect(s.confident).toBe(false);
  });

  it('every bucket healthy through the open-ended top reports no saturation evidence', () => {
    const s = suggestLimits(analyzeLoad(synth([{ heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 3, count: 40 }, { heavy: 2, load: 3, count: 40 }, { heavy: 3, load: 3, count: 40 }, { heavy: 6, load: 4, count: 40 }])));
    expect(s.heavyAdmissionCap.suggested).toBe(6);
    expect(s.heavyAdmissionCap.basis).toMatch(/no saturation evidence/);
  });
});

describe('review: persisted, comparable, never overwritten', () => {
  let d;
  beforeEach(() => { d = mkdtempSync(join(tmpdir(), 'hs-review-')); });
  afterEach(() => { rmSync(d, { recursive: true, force: true }); });

  const reportA = analyzeLoad(synth([{ heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 5, count: 40 }, { heavy: 2, load: 9, count: 40 }, { heavy: 3, load: 20, count: 40 }]));
  const reportB = analyzeLoad(synth([{ heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 5, count: 40 }, { heavy: 2, load: 9, count: 40 }, { heavy: 3, load: 11, count: 40 }, { heavy: 5, load: 25, count: 40 }]));

  it('first review has no diff; the markdown embeds parseable data and the required sections', () => {
    const r = buildReview(reportA, { generatedAt: '2026-09-20T12:00:00.000Z' });
    expect(r.diff).toBeNull();
    for (const want of ['# Resource review 2026-09-20', 'load1 p90', 'saturation', 'probe p90', 'Worst windows', 'Limit suggestion', 'Change since the previous review', 'First review']) expect(r.markdown).toContain(want);
    expect(parseReviewData(r.markdown)).toEqual(JSON.parse(JSON.stringify(r.data)));
  });

  it('the second review reports the CHANGE against the first, including a changed suggestion', () => {
    const first = buildReview(reportA, { generatedAt: '2026-09-13T12:00:00.000Z' });
    const second = buildReview(reportB, { generatedAt: '2026-09-20T12:00:00.000Z', previousData: parseReviewData(first.markdown) });
    expect(second.diff).toMatchObject({ previousAt: '2026-09-13T12:00:00.000Z', suggestionChanged: true, previousSuggestion: { heavyAdmissionCap: 2 } });
    expect(second.diff.load1P90).toBe(second.data.load1.p90 - first.data.load1.p90);
    expect(second.markdown).toMatch(/suggestion CHANGED/);
    expect(diffReviews(first.data, first.data).suggestionChanged).toBe(false);
  });

  it('writeReview never overwrites; latestReview reads the newest', () => {
    const a = buildReview(reportA, { generatedAt: '2026-09-20T12:00:00.000Z' });
    const p1 = writeReview({ dir: d, markdown: a.markdown, generatedAt: a.data.generatedAt });
    const p2 = writeReview({ dir: d, markdown: buildReview(reportB, { generatedAt: '2026-09-20T13:00:00.000Z' }).markdown, generatedAt: '2026-09-20T13:00:00.000Z' });
    expect(p1.endsWith('2026-09-20.md')).toBe(true);
    expect(p2.endsWith('2026-09-20-2.md')).toBe(true);
    expect(readdirSync(d).sort()).toEqual(['2026-09-20-2.md', '2026-09-20.md']);
    expect(readFileSync(p1, 'utf8')).toBe(a.markdown);
    expect(latestReview(d).file).toBe(p2);
    expect(latestReview(join(d, 'none'))).toBeNull();
  });

  it('`--review` end to end: writes telemetry/reviews/<date>.md and a second run diffs against it', () => {
    const tel = join(d, 'tel'); const store = createFileTelemetryStore({ dir: tel });
    for (const e of synth([{ heavy: 0, load: 3, count: 40 }, { heavy: 1, load: 5, count: 40 }])) store.append(`${JSON.stringify(e)}\n`, e.timestamp.slice(0, 10));
    const orig = process.stdout.write; process.stdout.write = () => true;
    try {
      expect(main(['--review', `--dir=${tel}`, '--no-otel'])).toBe(0);
      expect(main(['--review', `--dir=${tel}`, '--no-otel'])).toBe(0);
    } finally { process.stdout.write = orig; }
    expect(readdirSync(join(tel, 'reviews'))).toHaveLength(2);
    expect(readFileSync(latestReview(join(tel, 'reviews')).file, 'utf8')).toContain('Previous review');
  });
});

describe('config.limit.changed', () => {
  it('is in the closed vocabulary; the record validates and carries old/new/reason/who', () => {
    expect(METRIC_NAMES).toContain('config.limit.changed');
    const rec = limitChangedMetric({ limit: 'heavy-admission-cap', old: 2, new: 3, reason: 'p90 load 8 at 3 heavy', who: 'nic' }, { now: T0 });
    expect(validateTelemetryEvent(rec)).toEqual({ ok: true, errors: [] });
    expect(rec).toMatchObject({ name: 'config.limit.changed', value: 3, attributes: { limit: 'heavy-admission-cap', old: 2, new: 3, reason: 'p90 load 8 at 3 heavy', who: 'nic' } });
  });
  it('refuses an unexplained or anonymous change', () => {
    for (const bad of [{ limit: 'x', new: 1, reason: '', who: 'a' }, { limit: 'x', new: 1, reason: 'r', who: ' ' }, { new: 1, reason: 'r', who: 'a' }, { limit: 'x', new: 'many', reason: 'r', who: 'a' }]) {
      expect(() => limitChangedMetric(bad)).toThrow(TypeError);
    }
  });
  it('recordLimitChange appends one parseable line to the day file', () => {
    const d = mkdtempSync(join(tmpdir(), 'hs-limit-'));
    try {
      const store = createFileTelemetryStore({ dir: d });
      expect(recordLimitChange({ limit: 'lane-cap', old: 9, new: 6, reason: 'r', who: 'w' }, { store, now: T0 }).ok).toBe(true);
      const { events, corrupt } = parseTelemetryLines(readFileSync(join(d, '2026-09-20.jsonl'), 'utf8'));
      expect(corrupt).toBe(0);
      expect(events).toHaveLength(1);
      expect(events[0].attributes.limit).toBe('lane-cap');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('resourceReviewOwed(lastReviewAt, now, days = 7)', () => {
  it.each([
    [null, T0, true],
    ['not a date', T0, true],
    [new Date(T0 - 6 * DAY).toISOString(), T0, false],
    [new Date(T0 - 7 * DAY).toISOString(), T0, true],
    [T0 - 8 * DAY, T0, true],
    [new Date(T0 - 1 * DAY), T0, false],
  ])('last %s now %s → %s', (last, now, want) => { expect(resourceReviewOwed(last, now)).toBe(want); });
  it('honours a custom window and accepts ISO/number/Date for both arguments', () => {
    expect(resourceReviewOwed(new Date(T0 - 2 * DAY).toISOString(), new Date(T0).toISOString(), 1)).toBe(true);
    expect(resourceReviewOwed(new Date(T0 - 2 * DAY).toISOString(), new Date(T0), 3)).toBe(false);
  });
});

describe('OTEL join by session id', () => {
  const sampler = [];
  for (let i = 0; i < 4; i++) {
    const t = T0 + i * 30_000; const s = `s${i}`;
    sampler.push(m('host.cpu.load1', 10, s, t), m('host.cpu.count', 12, s, t));
    sampler.push(m('host.process.entry.cpu_pct', 100, s, t, { pid: 1, family: 'vitest', command: 'node (vitest)', lane: 'we/lane-9', session: 'fix-9', session_id: 'sess-9' }));
    sampler.push(m('host.process.entry.cpu_pct', 50, s, t, { pid: 2, family: 'other', command: 'x', lane: 'unattributed', session: 'unattributed', session_id: null }));
  }
  sampler.push({ v: 1, event: 'metric', name: 'dispatch.tokens.input', value: 1000, timestamp: new Date(T0).toISOString(), attributes: { provider: 'codex', model: 'gpt' }, resource: {} });
  sampler.push({ v: 1, event: 'metric', name: 'dispatch.tokens.output', value: 50, timestamp: new Date(T0).toISOString(), attributes: { provider: 'codex', model: 'gpt' }, resource: {} });
  const otel = [
    { name: 'claude_code.token.usage', value: 700, receivedAt: new Date(T0).toISOString(), attributes: { 'session.id': 'sess-9', model: 'claude-sonnet-5', type: 'input' } },
    { name: 'claude_code.token.usage', value: 300, receivedAt: new Date(T0).toISOString(), attributes: { 'session.id': 'sess-9', model: 'claude-sonnet-5', type: 'output' } },
    { name: 'claude_code.cost.usage', value: 1.25, receivedAt: new Date(T0).toISOString(), attributes: { 'session.id': 'sess-9', model: 'claude-sonnet-5' } },
    { name: 'claude_code.active_time.total', value: 90, receivedAt: new Date(T0).toISOString(), attributes: { 'session.id': 'sess-9' } },
    { name: 'claude_code.token.usage', value: 40, receivedAt: new Date(T0).toISOString(), attributes: { 'session.id': 'sess-other', model: 'claude-opus-5', type: 'input' } },
  ];
  const j = joinOtel(groupSamples(sampler), otel, sampler);

  it('puts CPU next to tokens, cost and active time for the same session', () => {
    expect(j.sessions[0]).toMatchObject({ sessionId: 'sess-9', name: 'fix-9', cpuCoreSeconds: 120, cpuSamples: 4, tokenTotal: 1000, costUsd: 1.25, activeSeconds: 90, models: ['claude-sonnet-5'] });
    expect(j.sessions[0].tokens).toMatchObject({ input: 700, output: 300, cacheRead: 0 });
    expect(j).toMatchObject({ joined: 1, withTokensOnly: 1, withCpuOnly: 0 });
  });
  it('rolls up by model and by provider, with codex tokens from dispatch.tokens.*', () => {
    expect(j.byModel.map((x) => x.model)).toEqual(['claude-sonnet-5', 'claude-opus-5']);
    expect(j.byProvider[0]).toMatchObject({ provider: 'claude', tokens: 1040, costUsd: 1.25 });
    expect(j.byProvider[1]).toMatchObject({ provider: 'codex', input: 1000, output: 50 });
  });
  it('analyzeLoad includes the join and the text report prints it', () => {
    const r = analyzeLoad(sampler, { otel });
    expect(r.otel.joined).toBe(1);
    expect(renderReport(r)).toContain('CPU vs usage per session');
    expect(analyzeLoad(sampler).otel).toBeNull();
  });
  it('readOtel keeps only session.id/model/type — never identity attributes', () => {
    const d = mkdtempSync(join(tmpdir(), 'hs-otel-'));
    try {
      writeFileSync(join(d, '2026-09-20.jsonl'), `${JSON.stringify({ v: 1, receivedAt: new Date(T0).toISOString(), name: 'claude_code.token.usage', value: 5, attributes: { 'session.id': 's1', model: 'm', type: 'input', 'user.email': 'a@b.c', 'user.account_id': 'user_123', 'organization.id': 'org' } })}\n{"broken\n${JSON.stringify({ name: 'claude_code.session.count', value: 1, attributes: {} })}\n`);
      const out = readOtel(d);
      expect(out).toHaveLength(1);
      expect(JSON.stringify(out)).not.toMatch(/a@b\.c|user_123|org/);
      expect(out[0].attributes).toEqual({ 'session.id': 's1', model: 'm', type: 'input' });
      expect(readOtel(join(d, 'missing'))).toBeNull();
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
