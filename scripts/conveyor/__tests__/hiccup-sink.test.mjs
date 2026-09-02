/**
 * @file scripts/conveyor/__tests__/hiccup-sink.test.mjs
 * @description Unit proof of the #3421 mechanical sink: a blocking hiccup is appended into the SAME
 *   learnings-pool store as any other entry, stamped `blocking:true` + a proposed fix + `approvalPending:true`;
 *   a repeat classification of the SAME hiccup does not flood the pool with duplicate entries.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileHiccup, fileHiccups, guardSuppressionSummary, freeFormReturnSummary } from '../hiccup-sink.mjs';
import { classifySuppressedBuilds, classifyAgentReturn } from '../hiccup-classify.mjs';
import { approveEntry } from '../hiccup-approve.mjs';

let dir;
let file;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-hiccup-sink-'));
  file = join(dir, 'sess.jsonl');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const readLines = () => readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('fileHiccup — guard-suppression (#3416 shape)', () => {
  it('appends a blocking entry with the classifier-generated proposedFix and approvalPending:true', () => {
    const [hiccup] = classifySuppressedBuilds([{ num: 3416, lane: 5, by: 'num' }]);
    const r = fileHiccup(hiccup, { file });
    expect(r.filed).toBe(true);
    const [rec] = readLines();
    expect(rec.blocking).toBe(true);
    expect(rec.approvalPending).toBe(true);
    expect(rec.kind).toBe('friction');
    expect(rec.summary).toBe(guardSuppressionSummary(hiccup));
    expect(rec.proposedFix).toBe(hiccup.proposedFix);
    expect(typeof rec.ts).toBe('string');
  });

  it('does not re-file an identical unresolved hiccup on a second call (idempotent across ticks)', () => {
    const [hiccup] = classifySuppressedBuilds([{ num: 3416, lane: 5, by: 'num' }]);
    fileHiccup(hiccup, { file });
    const r2 = fileHiccup(hiccup, { file });
    expect(r2.filed).toBe(false);
    expect(readLines()).toHaveLength(1);
  });

  it('files a NEW entry once the hiccup shape changes (different num)', () => {
    fileHiccup(classifySuppressedBuilds([{ num: 1, lane: 2, by: 'num' }])[0], { file });
    fileHiccup(classifySuppressedBuilds([{ num: 2, lane: 3, by: 'lane' }])[0], { file });
    expect(readLines()).toHaveLength(2);
  });
});

describe('fileHiccup — free-form-response (#3412 shape)', () => {
  it('appends a blocking entry for a free-form agent return', () => {
    const hiccup = classifyAgentReturn({ num: 3412, text: 'What would you like me to do here?' });
    const r = fileHiccup(hiccup, { file });
    expect(r.filed).toBe(true);
    const [rec] = readLines();
    expect(rec.blocking).toBe(true);
    expect(rec.summary).toBe(freeFormReturnSummary(hiccup));
  });
});

describe('fileHiccups — batch, tolerant of one bad hiccup', () => {
  it('files every valid hiccup and counts skips for duplicates', () => {
    const hiccups = classifySuppressedBuilds([{ num: 1, lane: 2, by: 'num' }, { num: 2, lane: 3, by: 'lane' }]);
    const r1 = fileHiccups(hiccups, { file });
    expect(r1).toEqual({ filed: 2, skipped: 0, errors: [] });
    const r2 = fileHiccups(hiccups, { file });
    expect(r2).toEqual({ filed: 0, skipped: 2, errors: [] });
  });

  it('reports an unknown hiccup kind as an error without throwing or blocking the rest', () => {
    const bad = { kind: 'not-a-real-kind', num: 9 };
    const good = classifySuppressedBuilds([{ num: 1, lane: 2, by: 'num' }])[0];
    const r = fileHiccups([bad, good], { file });
    expect(r.filed).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].hiccup).toBe(bad);
  });
});

describe('fileHiccup — #3421 review fix: strictly-increasing ts, never a collision', () => {
  it('two hiccups filed with the SAME explicit now get DISTINCT ts stamps', () => {
    const sameNow = '2026-09-02T00:00:00.000Z';
    const [h1, h2] = classifySuppressedBuilds([{ num: 1, lane: 2, by: 'num' }, { num: 2, lane: 3, by: 'lane' }]);
    const r1 = fileHiccup(h1, { file, now: sameNow });
    const r2 = fileHiccup(h2, { file, now: sameNow });
    expect(r1.record.ts).not.toBe(r2.record.ts);
    // strictly increasing, not just "different"
    expect(new Date(r2.record.ts).getTime()).toBeGreaterThan(new Date(r1.record.ts).getTime());
  });

  it('a batch of many hiccups filed in one fileHiccups call never collides — every approval key is unique', () => {
    const suppressed = Array.from({ length: 20 }, (_, i) => ({ num: i, lane: i + 100, by: 'num' }));
    const hiccups = classifySuppressedBuilds(suppressed);
    fileHiccups(hiccups, { file, session: 'batch-sess', now: '2026-09-02T00:00:00.000Z' });
    const lines = readLines();
    const tsSet = new Set(lines.map((l) => l.ts));
    expect(tsSet.size).toBe(lines.length); // no two entries share a ts (the approval-key collision this closes)
  });
});

describe('fileHiccup — #3421 review fix: a RESOLVED (approved) entry does not suppress a genuine recurrence', () => {
  it('re-files the same hiccup shape after its prior filing was approved', () => {
    const [hiccup] = classifySuppressedBuilds([{ num: 42, lane: 7, by: 'num' }]);
    const first = fileHiccup(hiccup, { file, session: 'sess' });
    expect(first.filed).toBe(true);

    // still unresolved — a second filing of the SAME shape is correctly suppressed (the ordinary dedup case).
    const second = fileHiccup(hiccup, { file, session: 'sess' });
    expect(second.filed).toBe(false);

    approveEntry({ session: 'sess', ts: first.record.ts }, { dir });

    // NOW a genuine recurrence must be re-filed, not silently swallowed forever.
    const third = fileHiccup(hiccup, { file, session: 'sess' });
    expect(third.filed).toBe(true);
    expect(readLines().filter((l) => l.summary === first.record.summary)).toHaveLength(2);
  });
});
