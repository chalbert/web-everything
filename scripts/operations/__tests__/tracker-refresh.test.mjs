/**
 * @file tracker-refresh.test.mjs — the `tracker-refresh` operation's pure parts (epic #3383): the content hash that
 * ignores the render stamp, the publish decision and its 30-minute throttle, the state file, the publish worker's
 * brief, the plan and the command line's trailer, and the sink over a stubbed `exec`. The real mechanism (a real
 * git repo, the real command line, a real `.operations` directory) is `tracker-refresh-real.test.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRIEF_FILE, PAGE_FILE, PUBLISH_MIN_INTERVAL_MINUTES, PUBLISH_SESSION, RESULT_FILE, STATE_FILE, TRACKER_REFRESH_EFFECT, TRACKER_REFRESH_OP,
  buildPublishBrief, decidePublish, finishRefreshOutcome, formatState, idFromUrl, parseState, planRefresh, shapeRefreshRead, trackerRefreshOperation,
} from '../tracker-refresh.mjs';
import { createTrackerRefreshReader, createTrackerRefreshSinks, recordPublish, refreshPaths } from '../tracker-refresh-io.mjs';
import { main as stateMain } from '../tracker-refresh-state.mjs';
import { contentHash, stripStamp } from '../../lib/tracker-page-hash.mjs';
import { parsePriorityRows, renderCompactHtml } from '../../lib/prototype-tracker-compact.mjs';
import { parseTracker } from '../../lib/prototype-tracker-data.mjs';
import { trackerCardText, TITLES } from '../../__tests__/fixtures/tracker-compact-fixture.mjs';
import { importGraph } from './import-graph.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = '2026-09-21T13:00:00.000Z';
const minutesAgo = (m) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

const text = trackerCardText();
const page = (over = {}) => renderCompactHtml(parseTracker(text), { priority: parsePriorityRows(text), titles: new Map(Object.entries(TITLES)), needsYou: [], tip: 'abc1234', generatedAt: '2026-09-21 09:00 EDT', ...over });

describe('the content hash', () => {
  it('ignores the render stamp (tip and time) and nothing else', () => {
    const a = page({ tip: 'aaaaaaa', generatedAt: '2026-09-21 09:00 EDT' });
    const b = page({ tip: 'bbbbbbb', generatedAt: '2026-09-21 09:31 EDT' });
    expect(a).not.toBe(b);
    expect(contentHash(a)).toBe(contentHash(b));
    expect(stripStamp(a)).toBe(stripStamp(b));
  });

  it('changes when the content changes: a row, the NEEDS YOU lines, a note', () => {
    const base = contentHash(page());
    expect(contentHash(page({ needsYou: ['PR #1 needs you'] }))).not.toBe(base);
    expect(contentHash(page({ titles: new Map([['3901', 'Another title']]) }))).not.toBe(base);
    expect(contentHash(page({ priority: parsePriorityRows(trackerCardText({ ordered: [] })) }))).not.toBe(base);
  });

  it('is a sha-256 hex digest', () => {
    expect(contentHash(page())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('decidePublish', () => {
  const hash = 'h'.repeat(64);
  const state = (o = {}) => ({ url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: hash, lastPublishedAt: minutesAgo(5), ...o });

  it('is current when the content hash equals the recorded one', () => {
    expect(decidePublish({ hash, state: state(), now: NOW })).toMatchObject({ publish: 'current', dispatchDue: false });
  });

  it('is needed, and due, when nothing was ever published', () => {
    expect(decidePublish({ hash, state: null, now: NOW })).toMatchObject({ publish: 'needed', dispatchDue: true, ageMinutes: null });
  });

  it('is needed but NOT due when the page changed less than 30 minutes after the last publish', () => {
    const d = decidePublish({ hash, state: state({ lastPublishedHash: 'x', lastPublishedAt: minutesAgo(29) }), now: NOW });
    expect(d).toMatchObject({ publish: 'needed', dispatchDue: false, ageMinutes: 29 });
    expect(d.reason).toContain('minimum 30');
  });

  it('is due at exactly 30 minutes and after', () => {
    expect(PUBLISH_MIN_INTERVAL_MINUTES).toBe(30);
    expect(decidePublish({ hash, state: state({ lastPublishedHash: 'x', lastPublishedAt: minutesAgo(30) }), now: NOW }).dispatchDue).toBe(true);
    expect(decidePublish({ hash, state: state({ lastPublishedHash: 'x', lastPublishedAt: minutesAgo(600) }), now: NOW }).dispatchDue).toBe(true);
  });

  it('counts a publish time that does not parse as never published', () => {
    expect(decidePublish({ hash, state: state({ lastPublishedHash: 'x', lastPublishedAt: 'not a time' }), now: NOW })).toMatchObject({ publish: 'needed', dispatchDue: true, ageMinutes: null });
  });

  it('is needed when a hash is recorded but no page url is (it could not be updated in place)', () => {
    expect(decidePublish({ hash, state: state({ url: null }), now: NOW }).publish).toBe('needed');
  });

  it('never dispatches when current, however old the last publish is', () => {
    expect(decidePublish({ hash, state: state({ lastPublishedAt: minutesAgo(5000) }), now: NOW }).dispatchDue).toBe(false);
  });
});

describe('the state file', () => {
  it('round-trips { url, id, lastPublishedHash, lastPublishedAt } in a fixed order with one trailing newline', () => {
    const s = { url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: 'deadbeef', lastPublishedAt: NOW };
    const out = formatState(s);
    expect(out.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(out))).toEqual(['url', 'id', 'lastPublishedHash', 'lastPublishedAt']);
    expect(parseState(out)).toEqual(s);
  });

  it('reads an absent, empty, broken or non-object file as no state, and drops non-string fields', () => {
    for (const bad of [undefined, null, '', '   ', '{not json', '[]', '3', 'null']) expect(parseState(bad)).toBeNull();
    expect(parseState('{"url": 5, "id": "", "lastPublishedHash": "h"}')).toEqual({ url: null, id: null, lastPublishedHash: 'h', lastPublishedAt: null });
  });

  it('takes the artifact id from the end of a page url', () => {
    expect(idFromUrl('https://claude.ai/artifact/9f3a-77')).toBe('9f3a-77');
    expect(idFromUrl('https://claude.ai/artifact/9f3a-77/')).toBe('9f3a-77');
    expect(idFromUrl('https://claude.ai/code/artifact/9f3a-77?x=1')).toBe('9f3a-77');
    expect(idFromUrl('https://example.test/page')).toBeNull();
  });

  it('is written by `record` with the page\'s own content hash, the time, the id and the url (the worker never hand-writes it)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tracker-state-'));
    try {
      const htmlPath = join(dir, PAGE_FILE);
      const html = page();
      recordPublish({ htmlPath, url: 'https://claude.ai/artifact/abc', now: () => NOW, read: () => html });
      const written = parseState(readFileSync(join(dir, STATE_FILE), 'utf8'));
      expect(written).toEqual({ url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: contentHash(html), lastPublishedAt: NOW });
      expect(() => recordPublish({ htmlPath, url: 'https://example.test/nope', now: () => NOW, read: () => html })).toThrow(/no artifact id/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('the state command line', () => {
  const run = (argv, files = {}) => {
    const out = []; const err = [];
    const code = stateMain(argv, { out: (s) => out.push(s), err: (s) => err.push(s), read: (p) => { if (!(p in files)) throw new Error(`no ${p}`); return files[p]; }, now: () => NOW });
    return { code, out: out.join(''), err: err.join('') };
  };

  it('verify exits 0 for the same content (stamp aside) and 1 for a changed page', () => {
    const html = page();
    const hash = contentHash(html);
    expect(run(['verify', '--html=/p.html', `--hash=${hash}`], { '/p.html': page({ tip: 'zzzzzzz', generatedAt: 'later' }) }).code).toBe(0);
    const changed = run(['verify', '--html=/p.html', `--hash=${hash}`], { '/p.html': page({ needsYou: ['a new line'] }) });
    expect(changed.code).toBe(1);
    expect(changed.out).toContain('changed since the brief');
  });

  it('refuses a call missing its flags, and an unknown command', () => {
    expect(run(['verify']).code).toBe(2);
    expect(run(['record', '--html=/p.html']).code).toBe(2);
    expect(run(['nope']).code).toBe(2);
  });
});

describe('the publish worker brief', () => {
  const args = {
    htmlPath: '/ops/tracker/prototype-tracker.html', statePath: '/ops/tracker/artifact.json', resultPath: '/ops/jobs/tracker-publish.result.md',
    hash: 'a'.repeat(64), state: null, stateScript: '/repo/scripts/operations/tracker-refresh-state.mjs', trackerPath: '/repo/backlog/3383-x.md',
    queueScript: '/main/scripts/operations/operator-queue.mjs', queueRoot: '/main', renderedAt: NOW,
  };

  it('is complete and fixed: the same input gives the same text, with every path and command in it', () => {
    const brief = buildPublishBrief(args);
    expect(buildPublishBrief(args)).toBe(brief);
    for (const s of [args.htmlPath, args.statePath, args.resultPath, args.hash, args.stateScript, args.trackerPath, args.queueScript]) expect(brief).toContain(s);
    expect(brief).toContain(`verify --html=${args.htmlPath} --hash=${args.hash}`);
    expect(brief).toContain(`record --html=${args.htmlPath} --url=`);
    expect(brief).toContain('auto mode');
    expect(brief).toContain('denied');
    expect(brief).not.toMatch(/undefined|null/);
  });

  it('creates a new private page when none is recorded, and updates the recorded page in place when one is', () => {
    const first = buildPublishBrief(args);
    expect(first).toContain('Create a NEW private page');
    expect(first).toContain('last publish: never');
    expect(first).not.toContain('action:"read"');
    const url = 'https://claude.ai/artifact/abc';
    const again = buildPublishBrief({ ...args, state: { url, id: 'abc', lastPublishedHash: 'old', lastPublishedAt: minutesAgo(90) } });
    expect(again).toContain(`Artifact(action:"read", url:"${url}")`);
    expect(again).toContain(`Artifact(action:"publish", file_path:"${args.htmlPath}", url:"${url}")`);
    expect(again).toContain('UPDATE the page in place');
    expect(again).not.toContain('Create a NEW');
  });

  it('checks NEEDS YOU against the operator queue and the first rows against the priority list', () => {
    const brief = buildPublishBrief(args);
    expect(brief).toContain(`node ${args.queueScript}`);
    expect(brief).toContain(`grep -E '^[0-9]+\\. #' ${args.trackerPath} | head -3`);
    expect(buildPublishBrief({ ...args, queueScript: null, queueRoot: null })).toContain('must say "unavailable"');
  });
});

describe('the declaration', () => {
  it('reaches nothing that can act (no fs, child_process or crypto): the io is injected', () => {
    expect(importGraph(resolve(HERE, '..', 'tracker-refresh.mjs')).external).toEqual([]);
  });

  it('refuses to be built without a reader', () => {
    expect(() => trackerRefreshOperation()).toThrow(/readFacts/);
  });

  it('shapes the read and plans the sequence, naming every path', () => {
    const read = shapeRefreshRead({ root: '/repo', trackerPath: '/repo/backlog/3383-x.md', ...refreshPaths('/ops'), state: null, now: NOW });
    expect(read).toMatchObject({ htmlPath: join('/ops/tracker', PAGE_FILE), statePath: join('/ops/tracker', STATE_FILE), briefPath: join('/ops/jobs', BRIEF_FILE), resultPath: join('/ops/jobs', RESULT_FILE) });
    expect(() => shapeRefreshRead({})).toThrow(/no checkout/);
    const plan = planRefresh(read, { apply: true, ref: 'origin/main', fetch: true });
    expect(plan.steps[0]).toBe('git fetch origin');
    expect(plan.steps).toContain('priority-sync --apply --ref=origin/main');
    expect(plan.steps.indexOf('priority-sync --apply --ref=origin/main')).toBeLessThan(plan.steps.indexOf('check-priority --ref=origin/main --strict'));
    expect(plan.steps.indexOf('check-priority --ref=origin/main --strict')).toBeLessThan(plan.steps.indexOf('render --ref=origin/main'));
    expect(planRefresh(read, { apply: false, fetch: false }).steps[0]).toMatch(/^priority-sync/);
    expect(plan.paths.html).toBe(read.htmlPath);
  });
});

describe('the command line trailer', () => {
  const plan = planRefresh(shapeRefreshRead({ root: '/repo', trackerPath: '/repo/backlog/3383-x.md', ...refreshPaths('/ops'), state: null, now: NOW }), { apply: true });
  const result = (o = {}) => ({
    fetched: 'fetched origin/main', sync: 'priority-sync: APPLIED — 0 added', check: { ok: true, summary: 'priority order OK', details: [] }, htmlPath: '/ops/tracker/prototype-tracker.html',
    statePath: '/ops/tracker/artifact.json', bytes: 51234, hash: 'c'.repeat(64), publish: 'needed', dispatchDue: true, ageMinutes: null, reason: 'no page has been published yet',
    lastPublishedAt: null, briefPath: '/ops/jobs/tracker-publish-task.md', resultPath: '/ops/jobs/tracker-publish.result.md', ...o,
  });
  const finish = (r, over = {}) => finishRefreshOutcome({ run: { verdict: plan, effects: [{ type: TRACKER_REFRESH_EFFECT, status: 'applied', result: r }], ...over }, code: 0, lines: ['run x — complete.'] });

  it('ends with exactly `publish: needed` or `publish: current`', () => {
    expect(finish(result()).lines.at(-1)).toBe('publish: needed');
    const current = finish(result({ publish: 'current', dispatchDue: false, briefPath: null, ageMinutes: 4, lastPublishedAt: NOW }));
    expect(current.lines.at(-1)).toBe('publish: current');
    expect(current.lines).toContain('dispatch: none');
    expect(current.code).toBe(0);
  });

  it('says on the line above whether the worker is due, with the dispatch command, or must wait', () => {
    expect(finish(result()).lines.at(-2)).toBe(`dispatch: due: node scripts/operations/run.mjs dispatch-task --brief=/ops/jobs/tracker-publish-task.md --session=${PUBLISH_SESSION}`);
    expect(finish(result({ dispatchDue: false, ageMinutes: 12 })).lines.at(-2)).toBe('dispatch: wait (minimum 30 min between publishes)');
  });

  it('exits 1 on drift but still renders the last line', () => {
    const out = finish(result({ check: { ok: false, summary: 'priority order DRIFT — 1 finding(s)', details: ['missing: open card #3999 has no line'] } }));
    expect(out.code).toBe(1);
    expect(out.lines).toContain('  missing: open card #3999 has no line');
    expect(out.lines.at(-1)).toBe('publish: needed');
  });

  it('prints no `publish:` line for a dry run or a failed effect (its absence means do not dispatch)', () => {
    const dry = finishRefreshOutcome({ run: { verdict: { ...plan, apply: false }, effects: [] }, code: 0, lines: ['run x'] });
    expect(dry.lines.join('\n')).toContain('dry run');
    expect(dry.lines.some((l) => l.startsWith('publish:'))).toBe(false);
    const failed = finishRefreshOutcome({ run: { verdict: plan, effects: [{ type: TRACKER_REFRESH_EFFECT, status: 'failed', error: 'priority-sync failed (exit 1): boom' }] }, code: 0, lines: [] });
    expect(failed.code).toBe(1);
    expect(failed.lines[0]).toContain('FAILED — priority-sync failed (exit 1): boom');
    expect(failed.lines.some((l) => l.startsWith('publish:'))).toBe(false);
  });

  it('leaves --json to the adapter', () => {
    expect(finishRefreshOutcome({ run: { verdict: plan }, code: 0, lines: ['{}'], json: true })).toEqual({ code: 0, lines: ['{}'] });
  });
});

describe('the sink, over a stubbed exec and an in-memory file system', () => {
  const html = page();
  const payload = (over = {}) => ({
    root: '/repo', trackerPath: '/repo/backlog/3383-x.md', ref: 'origin/main', fetch: true, htmlPath: '/ops/tracker/prototype-tracker.html', statePath: '/ops/tracker/artifact.json',
    briefPath: '/ops/jobs/tracker-publish-task.md', resultPath: '/ops/jobs/tracker-publish.result.md', state: null, now: NOW, ...over,
  });
  const harness = ({ syncStatus = 0, checkStatus = 0, renderOut = html, fetchStatus = 0, queueRoot = '/main' } = {}) => {
    const calls = []; const files = new Map();
    const exec = (program, args, opts) => {
      calls.push({ program, args, cwd: opts.cwd });
      const tail = args.join(' ');
      if (program === 'git') return { status: fetchStatus, stdout: '', stderr: fetchStatus ? 'fatal: no network' : '' };
      if (tail.includes('priority-sync')) return { status: syncStatus, stdout: syncStatus ? 'error: section changed\n' : 'priority-sync: APPLIED — 1 added, 0 dropped\n', stderr: '' };
      if (tail.includes('check-priority')) return { status: checkStatus, stdout: checkStatus ? 'prototype-tracker: priority order DRIFT — 1 finding(s) (2 open cards under #3383, 3 lines)\n  missing: open card #3999 has no line\n' : 'prototype-tracker: priority order OK — 2 open cards under #3383, 3 lines\n', stderr: '' };
      return { status: 0, stdout: renderOut, stderr: '' };
    };
    const sink = createTrackerRefreshSinks({ exec, findQueueRoot: () => queueRoot, fs: { mkdir: () => {}, write: (p, s) => files.set(p, s), rename: (a, b) => { files.set(b, files.get(a)); files.delete(a); } } })[TRACKER_REFRESH_EFFECT];
    return { calls, files, sink };
  };

  it('runs fetch, priority-sync --apply, check-priority --strict, render in that order, in the checkout, then writes the page', async () => {
    const h = harness();
    const r = await h.sink(payload());
    expect(h.calls.map((c) => (c.program === 'git' ? 'git fetch' : c.args.find((a) => /priority-sync|check-priority|render/.test(a))))).toEqual(['git fetch', 'priority-sync', 'check-priority', 'render']);
    expect(h.calls.every((c) => c.cwd === '/repo')).toBe(true);
    expect(h.calls[1].args).toContain('--apply');
    expect(h.calls[2].args).toContain('--strict');
    expect(h.files.get('/ops/tracker/prototype-tracker.html')).toBe(html);
    expect(r).toMatchObject({ sync: 'priority-sync: APPLIED — 1 added, 0 dropped', publish: 'needed', dispatchDue: true, hash: contentHash(html), check: { ok: true } });
  });

  it('writes the brief when the page changed, and not when it equals the last published one', async () => {
    const h = harness();
    const needed = await h.sink(payload());
    expect(needed.briefPath).toBe('/ops/jobs/tracker-publish-task.md');
    expect(h.files.get('/ops/jobs/tracker-publish-task.md')).toContain(`--hash=${contentHash(html)}`);
    const h2 = harness();
    const state = { url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: contentHash(html), lastPublishedAt: minutesAgo(3) };
    const current = await h2.sink(payload({ state }));
    expect(current).toMatchObject({ publish: 'current', briefPath: null, dispatchDue: false });
    expect(h2.files.has('/ops/jobs/tracker-publish-task.md')).toBe(false);
  });

  it('a page that differs only in its stamp is current', async () => {
    const state = { url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: contentHash(page({ tip: '1111111', generatedAt: 'earlier' })), lastPublishedAt: minutesAgo(3) };
    const r = await harness().sink(payload({ state }));
    expect(r.publish).toBe('current');
  });

  it('reports drift without throwing: the page is still rendered', async () => {
    const r = await harness({ checkStatus: 1 }).sink(payload());
    expect(r.check).toMatchObject({ ok: false });
    expect(r.check.summary).toContain('DRIFT');
    expect(r.check.details).toEqual(['missing: open card #3999 has no line']);
    expect(r.publish).toBe('needed');
  });

  it('throws when the sync or the render fails, so the run prints no publish line', async () => {
    await expect(harness({ syncStatus: 1 }).sink(payload())).rejects.toThrow(/priority-sync failed \(exit 1\): error: section changed/);
    await expect(harness({ renderOut: 'not the page' }).sink(payload())).rejects.toThrow(/not the compact tracker page/);
  });

  it('a failed fetch is reported, not fatal; --fetch=false does not fetch', async () => {
    expect((await harness({ fetchStatus: 1 }).sink(payload())).fetched).toContain('fetch of origin/main failed (fatal: no network)');
    const h = harness();
    const r = await h.sink(payload({ fetch: false }));
    expect(r.fetched).toBe('not fetched');
    expect(h.calls.some((c) => c.program === 'git')).toBe(false);
  });

  it('puts the queue script in the brief when one is found, and says so when none is', async () => {
    const withQ = harness({ queueRoot: '/main' });
    await withQ.sink(payload());
    expect(withQ.files.get('/ops/jobs/tracker-publish-task.md')).toContain('node /main/scripts/operations/operator-queue.mjs');
    const without = harness({ queueRoot: null });
    await without.sink(payload());
    expect(without.files.get('/ops/jobs/tracker-publish-task.md')).toContain('No operator-queue script was found');
  });
});

describe('the reader', () => {
  it('finds the checkout, the tracker card, the four paths and the state, and stamps the clock', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tracker-reader-'));
    try {
      mkdirSync(join(dir, 'backlog'), { recursive: true });
      writeFileSync(join(dir, 'backlog', '3383-x.md'), '# x\n');
      const port = (cwd) => createTrackerRefreshReader({
        cwd: () => cwd, git: () => Buffer.from(`${cwd}\n`), home: '/home/op', now: () => NOW,
        read: () => '{"url":"https://claude.ai/artifact/abc","id":"abc","lastPublishedHash":"h","lastPublishedAt":"t"}',
      });
      const facts = port(dir)({ operationsDir: '' });
      expect(facts).toMatchObject({
        root: dir, trackerPath: join(dir, 'backlog', '3383-x.md'), now: NOW,
        htmlPath: '/home/op/workspace/.operations/tracker/prototype-tracker.html', statePath: '/home/op/workspace/.operations/tracker/artifact.json',
        briefPath: '/home/op/workspace/.operations/jobs/tracker-publish-task.md', resultPath: '/home/op/workspace/.operations/jobs/tracker-publish.result.md',
      });
      expect(facts.state).toEqual({ url: 'https://claude.ai/artifact/abc', id: 'abc', lastPublishedHash: 'h', lastPublishedAt: 't' });
      expect(port(dir)({ operationsDir: '/custom/ops' }).htmlPath).toBe('/custom/ops/tracker/prototype-tracker.html');
      expect(() => port(join(dir, 'nowhere'))({})).toThrow(/no backlog\/3383-\*\.md/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('constants', () => {
  it('names the operation and its effect', () => {
    expect(TRACKER_REFRESH_OP).toBe('tracker-refresh');
    expect(TRACKER_REFRESH_EFFECT).toBe('tracker-refresh.run');
  });
});
