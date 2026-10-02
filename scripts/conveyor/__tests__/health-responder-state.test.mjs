// @vitest-environment node
import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWatchGeneration, readJournal, appendDecisions, receiptsFromJournal, readResponderConfig } from '../health-responder-state.mjs';
import { decide } from '../health-responder-core.mjs';
const replay = JSON.parse(readFileSync(new URL('./fixtures/health-responder/replay.json', import.meta.url)));
const green = replay.cases.find((c) => c.name === 'D1-fresh-green');
const roots = []; const temp = () => { const p = mkdtempSync(join(tmpdir(), 'health-responder-')); roots.push(p); return p; };
afterEach(() => roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));
function watch(dir) {
  mkdirSync(join(dir, 'episodes'));
  const tick = { completedAt: replay.now };
  writeFileSync(join(dir, 'last-tick.json'), JSON.stringify(tick));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ lastTick: tick, episodes: { [green.episode.key]: green.episode } }));
  writeFileSync(join(dir, 'episodes', `${green.episode.id}.json`), JSON.stringify(green.episode));
}
it('reads only snapshot subjects, never retained closed history', () => {
  const dir = temp(); watch(dir);
  writeFileSync(join(dir, 'episodes', 'history.json'), '{broken historical report');
  expect(readWatchGeneration(dir).episodes).toEqual([green.episode]);
  expect(readWatchGeneration(dir).watchGeneration.valid).toBe(true);
});
it('rejects changed report identity/samples/status and mixed completion generations', () => {
  for (const field of ['id', 'openedAt', 'samples', 'lastBreachAt', 'status']) {
    const dir = temp(); watch(dir);
    writeFileSync(join(dir, 'episodes', `${green.episode.id}.json`), JSON.stringify({ ...green.episode, [field]: 'changed' }));
    expect(readWatchGeneration(dir).watchGeneration.valid).toBe(false);
  }
  const dir = temp(); watch(dir);
  let n = 0;
  const result = readWatchGeneration(dir, { readJson: (p) => {
    const value = JSON.parse(readFileSync(p));
    if (p.endsWith('last-tick.json')) value.completedAt += ++n;
    return value;
  } });
  expect(result.watchGeneration).toMatchObject({ valid: false, reason: 'mixed watch generation after retry' });
});
it('rejects corrupt, missing, path-traversing and oversized watch input', () => {
  const dir = temp(); expect(readWatchGeneration(dir).watchGeneration.valid).toBe(false);
  watch(dir);
  const e = { ...green.episode, id: '../../outside' };
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ episodes: { [e.key]: e }, lastTick: { completedAt: replay.now } }));
  expect(readWatchGeneration(dir).watchGeneration.valid).toBe(false);
  writeFileSync(join(dir, 'state.json'), ' '.repeat(8 * 1024 * 1024 + 1));
  expect(readWatchGeneration(dir).watchGeneration.valid).toBe(false);
});
it('journals every decision durably; restart rebuilds only shadow prepared receipts', () => {
  const dir = temp();
  const rows = decide({ now: replay.now, episodes: [green.episode], watchGeneration: { valid: true, completedAt: replay.now },
    subjectFacts: { [green.episode.key]: green.facts }, config: { version: 1, enabled: true, mode: 'shadow', smells: { [green.episode.smell]: true } } });
  appendDecisions(dir, rows); const before = readFileSync(join(dir, 'decisions.jsonl'), 'utf8');
  appendDecisions(dir, [{ ...rows[0], decision: 'hold', rule: 'test-hold' }]);
  expect(readFileSync(join(dir, 'decisions.jsonl'), 'utf8').startsWith(before)).toBe(true);
  const receipts = receiptsFromJournal(readJournal(dir));
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({ state: 'prepared', mode: 'shadow', successfulLiveAction: false, submittedAt: null, recoveredAt: null });
  expect(JSON.parse(readFileSync(join(dir, 'receipts.json'))).liveBudgets).toEqual([]);
  writeFileSync(join(dir, 'decisions.jsonl'), before + '{partial');
  expect(() => appendDecisions(dir, rows)).toThrow('partial journal');
  expect(readFileSync(join(dir, 'decisions.jsonl'), 'utf8')).toBe(before + '{partial');
});
it('missing config defaults disabled, corrupt config stays unknown', () => {
  const dir = temp(); expect(readResponderConfig(dir).enabled).toBe(false);
  writeFileSync(join(dir, 'config.json'), '{'); expect(readResponderConfig(dir)).toBe(null);
});
