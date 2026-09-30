/**
 * @file skills-src/conveyor/__tests__/role-test-soak-author-brief.test.mjs
 * @description #4361 phase 1 — the test & soak-break author role brief exists with its anchors, the builder
 *   brief points at it, and the brief-rule ledger covers every imperative line of both files.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { auditLedger, loadLedger, readBriefs } from '../../../scripts/conveyor/brief-rule-ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');
const ROLE = 'skills-src/conveyor/role-test-soak-author-brief.md';
const BUILDER = 'skills-src/conveyor/delivery-agent-brief.md';

describe('role-test-soak-author-brief.md', () => {
  const text = read('../role-test-soak-author-brief.md');

  it('carries its anchors', () => {
    for (const anchor of ['scripts/conveyor/soak/red-green.mjs', 'soak-waiver', 'scripts/conveyor/soak/breaks/',
      'skills-src/conveyor/', 'scripts/conveyor/', 'scripts/lane-pool']) {
      expect(text).toContain(anchor);
    }
  });

  it('tells the builder when to request it', () => {
    expect(text).toMatch(/## When a builder should request this role/);
  });
});

describe('delivery-agent-brief.md', () => {
  it('links the role brief', () => {
    expect(read('../delivery-agent-brief.md')).toContain('role-test-soak-author-brief.md');
  });
});

describe('brief-rule ledger', () => {
  it('has no unlisted or stale line for the role brief (the builder brief has pre-existing reds, out of scope)', () => {
    const audit = auditLedger(readBriefs(), loadLedger());
    const mine = (r) => r.brief === ROLE || (r.brief === BUILDER && /role-test-soak-author/.test(r.text ?? ''));
    expect(audit.unlisted.filter(mine)).toEqual([]);
    expect(audit.stale.filter(mine)).toEqual([]);
    expect(audit.lines.some((l) => l.brief === ROLE)).toBe(true);
  });
});
