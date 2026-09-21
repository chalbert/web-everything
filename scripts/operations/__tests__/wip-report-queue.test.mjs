/**
 * #3736: the PURE classification of `/wip` Attention findings (queued / gap / overdue). Hand-made findings for each class
 * and the boundaries, then the real fixture through `buildReport`. The classification files nothing: that is asserted too.
 */
import { it, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeInput, buildReport } from '../wip-report.mjs';
import { OVERDUE_MS, dedupKey, classifyFinding, buildQueue, gapsLine, overdueLine, renderQueuePlan, HANDLER_WORDS } from '../wip-report-queue.mjs';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const finding = (over = {}) => ({ rule: 'ci-failed-no-fixer', target: 'we#7', ref: 'we#7', item: 'web-everything#7', what: 'CI failed and no fixer is running', since: NOW - 60000, remedy: 'auto', ...over });
const gap = (over = {}) => finding({ rule: 'session-stalled', target: 'review-9', ref: 'review-9', item: 'review-9 (PR #9)', what: 'no activity for 46m', remedy: 'no-handler', ...over });

describe('classification: each Attention finding is handled, a gap, or still shown', () => {
  it.each([
    ['auto', 'handled'],
    ['no-handler', 'no-handler'],
    ['auto (runner down)', 'shown'],
    ['auto (runner unknown)', 'shown'],
    ['run: session-reaper', 'shown'],
    ['start: /conveyor', 'shown'],
  ])('remedy %s is %s', (remedy, want) => expect(classifyFinding({ remedy })).toBe(want));

  it('(a) HANDLED: a live handler and a live runner take it out of Attention and make it a `queued` Work-items row', () => {
    const q = buildQueue([finding()], { now: NOW });
    expect(q.shown).toEqual([]);
    expect(q.plan).toEqual([]);
    expect(q.handled.map((h) => h.key)).toEqual(['ci-failed-no-fixer:we#7']);
    expect(q.handledRows).toEqual([expect.objectContaining({ ref: 'we#7', target: 'we#7', state: 'queued', words: 'CI fix' })]);
  });
  it('(a) several handled findings on one target are ONE queued row that names each handler', () => {
    const q = buildQueue([finding(), finding({ rule: 'stale-tag', since: NOW - 120000 })], { now: NOW });
    expect(q.handled).toHaveLength(2);
    expect(q.handledRows).toEqual([expect.objectContaining({ ref: 'we#7', words: 'CI fix+tag clear', since: NOW - 120000 })]);
  });
  it('(b) NO HANDLER: it is listed once in the queue plan under its dedup key and is not shown as handled', () => {
    const q = buildQueue([gap()], { now: NOW });
    expect(q.plan).toEqual([expect.objectContaining({ key: 'session-stalled:review-9', rule: 'session-stalled', target: 'review-9', class: 'no-handler' })]);
    expect(q.handled).toEqual([]);
    expect(q.handledRows).toEqual([]);
    expect(q.shown).toEqual([]);
  });
  it('(b) two findings with the same rule and target are one plan entry (dedup)', () => {
    const q = buildQueue([gap(), gap({ what: 'no activity for 50m', since: NOW - 5000 })], { now: NOW });
    expect(q.plan).toHaveLength(1);
    expect(q.plan[0].what).toBe('no activity for 46m');
  });
  it('a handler exists but the runner is not live: it stays in Attention with its remedy (neither queued nor a gap)', () => {
    const rows = ['auto (runner down)', 'auto (runner unknown)', 'run: session-reaper', 'start: /conveyor'].map((remedy) => finding({ remedy }));
    const q = buildQueue(rows, { now: NOW });
    expect(q.shown).toEqual(rows);
    expect([q.handled, q.handledRows, q.plan, q.overdue].map((x) => x.length)).toEqual([0, 0, 0, 0]);
  });
  it('keeps the input order within each class', () => {
    const a = finding({ target: 'we#1', ref: 'we#1' }), b = finding({ target: 'we#2', ref: 'we#2' }), c = gap({ target: 'x', ref: 'x' }), d = gap({ target: 'y', ref: 'y' });
    const q = buildQueue([d, a, c, b], { now: NOW });
    expect(q.handled.map((h) => h.target)).toEqual(['we#1', 'we#2']);
    expect(q.plan.map((p) => p.target)).toEqual(['y', 'x']);
  });
});

describe('the dedup key is rule plus target, and nothing else', () => {
  it('is `<rule>:<target>`, and just the rule for an aggregate finding with no single target', () => {
    expect(dedupKey('ci-failed-no-fixer', 'we#2349')).toBe('ci-failed-no-fixer:we#2349');
    expect(dedupKey('pre-today-pr-open', '')).toBe('pre-today-pr-open');
    expect(dedupKey('pre-today-pr-open', undefined)).toBe('pre-today-pr-open');
  });
  it('is stable: a changed age, wording, count or remedy gives the same key, and a run gives it again', () => {
    const a = buildQueue([gap()], { now: NOW }).plan[0].key;
    const b = buildQueue([gap({ what: 'other words', since: NOW - 9e6, item: 'renamed', ref: 'r' })], { now: NOW + 9e8 }).plan[0].key;
    expect(b).toBe(a);
    const agg = (n) => buildQueue([gap({ rule: 'over-capacity', target: '', ref: `x${n}`, item: `${n} workers`, what: `${n} workers` })], { now: NOW }).plan[0].key;
    expect(agg(4)).toBe(agg(9));
    expect(agg(4)).toBe('over-capacity');
  });
  it('differs by rule and by target, and ignores case and spaces in the target', () => {
    const keys = new Set([dedupKey('a', 'we#1'), dedupKey('a', 'we#2'), dedupKey('b', 'we#1'), dedupKey('a', '')]);
    expect(keys.size).toBe(4);
    expect(dedupKey('stale-tag', ' We#7 ')).toBe(dedupKey('stale-tag', 'we#7'));
    expect(dedupKey('r', 'two words')).toBe('r:two-words');
  });
});

describe('(c) OVERDUE: unresolved past the deadline', () => {
  it('the default deadline is a named constant: 2 hours', () => expect(OVERDUE_MS).toBe(2 * 60 * 60 * 1000));
  it('the boundary: exactly at the deadline is not overdue, one millisecond past it is', () => {
    const at = (age) => buildQueue([finding({ since: NOW - age })], { now: NOW }).overdue.length;
    expect(at(OVERDUE_MS - 1)).toBe(0);
    expect(at(OVERDUE_MS)).toBe(0);
    expect(at(OVERDUE_MS + 1)).toBe(1);
  });
  it('applies to a handled finding and to a gap, most overdue first, and names each by its key', () => {
    const q = buildQueue([finding({ since: NOW - 3 * 3600000 }), gap({ since: NOW - 26 * 3600000 - 5 * 60000 }), gap({ target: 'fresh', since: NOW - 1000 })], { now: NOW });
    expect(q.overdue.map((o) => o.key)).toEqual(['session-stalled:review-9', 'ci-failed-no-fixer:we#7']);
    expect(overdueLine(q.overdue[0])).toBe('overdue 1d 2h: session-stalled:review-9');
    expect(overdueLine(q.overdue[1])).toBe('overdue 3h 0m: ci-failed-no-fixer:we#7');
  });
  it('never guesses: no known start means never overdue; a still-shown finding is not counted here', () => {
    expect(buildQueue([finding({ since: null })], { now: NOW }).overdue).toEqual([]);
    expect(buildQueue([finding({ remedy: 'auto (runner down)', since: NOW - 9 * 3600000 })], { now: NOW }).overdue).toEqual([]);
  });
  it('honours a different deadline', () => {
    expect(buildQueue([finding({ since: NOW - 40 * 60000 })], { now: NOW, overdueMs: 30 * 60000 }).overdue).toHaveLength(1);
    expect(buildQueue([finding({ since: NOW - 40 * 60000 })], { now: NOW, overdueMs: 60 * 60000 }).overdue).toHaveLength(0);
  });
});

describe('the one-line and plan output', () => {
  it('gapsLine: `N gaps queued (<keys>)`, singular for one, null for none', () => {
    expect(gapsLine(buildQueue([], { now: NOW }))).toBeNull();
    expect(gapsLine(buildQueue([gap()], { now: NOW }))).toBe('1 gap queued (session-stalled:review-9)');
    expect(gapsLine(buildQueue([gap(), gap({ rule: 'pre-today-pr-open', target: '' })], { now: NOW }))).toBe('2 gaps queued (session-stalled:review-9, pre-today-pr-open)');
  });
  it('renderQueuePlan says it files nothing, lists each key, and reports handled and overdue', () => {
    expect(renderQueuePlan(buildQueue([], { now: NOW }))).toBe('Queue plan: nothing to file.');
    const text = renderQueuePlan(buildQueue([gap(), finding({ since: NOW - 3 * 3600000 })], { now: NOW }));
    expect(text).toContain('Queue plan: 1 to file (read-only: this report files nothing)');
    expect(text).toContain('- session-stalled:review-9 — no activity for 46m');
    expect(text).toContain('Already queued for a live handler: 1 (ci-failed-no-fixer:we#7)');
    expect(text).toContain('overdue 3h 0m: ci-failed-no-fixer:we#7');
  });
  it('every handled rule has phone-short handler words', () => {
    for (const w of Object.values(HANDLER_WORDS)) expect(w.length).toBeLessThanOrEqual(13);
  });
});

describe('through buildReport on the real fixture (2026-09-20)', () => {
  const RAW = JSON.parse(readFileSync(resolve('scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json'), 'utf8'));
  const make = (runner) => {
    const raw = structuredClone(RAW);
    const s = raw.wipData.agents.find((a) => a.name === 'review-148');
    raw.wipData.facts[s.sessionId].transcriptMtimeMs = raw.now - 130 * 60000;
    raw.runner = runner;
    return buildReport(composeInput(raw));
  };
  it('with a live runner: the auto findings are queued, the no-handler ones are the plan, and `attention` still holds them all', () => {
    const r = make({ state: 'alive-and-idle' });
    expect(r.queue.plan.map((p) => p.key)).toEqual(['ci-failed-no-fixer:we#2349', 'session-stalled:review-148', 'session-stalled:fix-2347', 'pre-today-pr-open']);
    expect(r.queue.handledRows.map((h) => h.ref)).toEqual(['we#2344', 'we#2170', 'pa#148', 'x8']);
    expect(r.queue.shown).toEqual([]);
    expect(r.attention).toHaveLength(r.queue.handled.length + r.queue.plan.length + r.queue.shown.length); // nothing is dropped from the data
    expect(r.queue.overdue.length).toBeGreaterThan(0);
    for (const o of r.queue.overdue) expect(o.ageMs).toBeGreaterThan(OVERDUE_MS);
  });
  it('with the runner down: nothing is handled, the no-handler findings are still the plan, the rest stay shown', () => {
    const r = make({ state: 'down', stalledReason: 'No singleton runner lease exists; no runner is registered.' });
    expect(r.queue.handled).toEqual([]);
    expect(r.queue.plan.map((p) => p.key)).toEqual(['ci-failed-no-fixer:we#2349', 'session-stalled:review-148', 'session-stalled:fix-2347', 'pre-today-pr-open']);
    expect(r.queue.shown.map((a) => a.remedy)).toEqual(expect.arrayContaining(['auto (runner down)', 'run: session-reaper', 'start: /conveyor']));
    expect(r.queue.shown.every((a) => !['auto', 'no-handler'].includes(a.remedy))).toBe(true);
  });
  it('is deterministic', () => {
    const runner = { state: 'alive-and-idle' };
    expect(JSON.stringify(make(runner).queue)).toBe(JSON.stringify(make(runner).queue));
  });
});

it('the classification is read-only: the module imports nothing, so it cannot read a file, run a command or file an item', () => {
  const src = readFileSync(resolve('scripts/operations/wip-report-queue.mjs'), 'utf8');
  expect(src).not.toMatch(/^\s*import\b/m);
  expect(src).not.toMatch(/\b(writeFile|appendFile|execFile|spawn|fetch|process\.)/);
});
