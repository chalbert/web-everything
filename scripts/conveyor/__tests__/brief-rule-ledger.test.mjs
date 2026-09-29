// #4070 — the brief-rule ledger: every imperative line in a dispatched brief, mapped to its enforcer or marked
// judgment / prose-only / descriptive. Fixture briefs pin the audit; the real ledger pins the three rules the
// 2026-09-24 incident broke to code enforcers whose own tests exist.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT, auditLedger, extractImperatives, lineKey, listBriefs, loadLedger, missingEnforcerFiles,
  readBriefs, validateLedger, weakestStatus,
} from '../brief-rule-ledger.mjs';

const BRIEF = 'skills-src/conveyor/x-agent-brief.md';
const TEXT = [
  '# Fixture brief',
  'Never merge the PR.',
  'Always   reproduce the bug first.',
  'Do not release the lane, and do NOT merge.',
  "Don't rewrite a card through Bash.",
  'Plain guidance with no rule word.',
].join('\n');
const entry = (text) => ({ brief: BRIEF, key: lineKey(text), text });
const LEDGER = {
  enforcers: { merge: { kind: 'hook', ref: 'scripts/guard-bash.mjs' } },
  rules: [
    { id: 'never-merge', status: 'enforced', enforcers: ['merge'], lines: [entry('Never merge the PR.'), entry('Do not release the lane, and do NOT merge.')] },
    { id: 'no-release', status: 'prose-only', proposed: 'deny lane-pool release', lines: [entry('Do not release the lane, and do NOT merge.')] },
    { id: 'repro', status: 'judgment', lines: [entry('Always reproduce the bug first.')] },
  ],
};

describe('extractImperatives (#4070)', () => {
  it('finds every rule-word line, with 1-based line numbers and whitespace-normalised text', () => {
    const found = extractImperatives(TEXT);
    expect(found.map((l) => l.line)).toEqual([2, 3, 4, 5]);
    expect(found[1].text).toBe('Always reproduce the bug first.');
  });

  it('keys on normalised text, so re-wrapping whitespace keeps the key and a wording change does not', () => {
    expect(lineKey('Never  merge the PR. ')).toBe(lineKey('Never merge the PR.'));
    expect(lineKey('Never merge a PR.')).not.toBe(lineKey('Never merge the PR.'));
  });

  it('matches the curly-apostrophe prohibition and "before you"', () => {
    expect(extractImperatives('Don’t do it\nRead it before you build')).toHaveLength(2);
  });
});

describe('auditLedger (#4070)', () => {
  const result = auditLedger([{ brief: BRIEF, text: TEXT }], LEDGER);

  it('names the unlisted imperative line', () => {
    expect(result.unlisted.map((l) => l.line)).toEqual([5]);
    expect(result.unlisted[0].text).toMatch(/rewrite a card/);
  });

  it('counts a multi-rule line under its weakest rule', () => {
    const row = result.lines.find((l) => l.line === 4);
    expect(row.rules).toEqual(['never-merge', 'no-release']);
    expect(row.status).toBe('prose-only');
    expect(result.counts).toMatchObject({ enforced: 1, judgment: 1, 'prose-only': 1, unlisted: 1 });
  });

  it('reports a ledger line whose text is no longer in the brief as stale', () => {
    const edited = TEXT.replace('Never merge the PR.', 'Never merge any PR.');
    const r = auditLedger([{ brief: BRIEF, text: edited }], LEDGER);
    expect(r.stale.map((s) => s.rule)).toEqual(['never-merge']);
    expect(r.unlisted.map((l) => l.text)).toContain('Never merge any PR.');
  });

  it('orders statuses weakest first', () => {
    expect(weakestStatus(['enforced', 'judgment'])).toBe('judgment');
    expect(weakestStatus(['descriptive', 'enforced'])).toBe('enforced');
    expect(weakestStatus([])).toBe('unlisted');
  });
});

describe('validateLedger (#4070)', () => {
  it('accepts the fixture', () => {
    expect(validateLedger(LEDGER)).toEqual([]);
  });

  it('refuses an enforced rule with no enforcer, an unknown enforcer, and a prose-only rule with no proposal', () => {
    const errors = validateLedger({ enforcers: {}, rules: [
      { id: 'a', status: 'enforced', lines: [] },
      { id: 'b', status: 'enforced', enforcers: ['ghost'], lines: [] },
      { id: 'c', status: 'prose-only', lines: [] },
      { id: 'd', status: 'maybe', lines: [] },
    ] });
    expect(errors.join('\n')).toMatch(/a: enforced but names no enforcer/);
    expect(errors.join('\n')).toMatch(/b: unknown enforcer ghost/);
    expect(errors.join('\n')).toMatch(/c: prose-only but names no proposed enforcer/);
    expect(errors.join('\n')).toMatch(/d: status must be one of/);
  });
});

describe('the committed ledger (#4070)', () => {
  const ledger = loadLedger();

  it('is structurally valid and every enforcer file it cites exists', () => {
    expect(validateLedger(ledger)).toEqual([]);
    expect(missingEnforcerFiles(ledger)).toEqual([]);
  });

  it('covers the dispatched briefs under both skill directories', () => {
    const briefs = listBriefs();
    expect(briefs).toContain('skills-src/conveyor/delivery-agent-brief.md');
    expect(briefs).toContain('skills-src/review/review-agent-brief.md');
    expect(briefs.some((b) => b.endsWith('SKILL.md'))).toBe(false);
    expect(auditLedger(readBriefs(), ledger).lines.length).toBeGreaterThan(0);
  });

  // The three rules the 2026-09-24 incident broke. Each must stay enforced by a code enforcer that has a test.
  it.each([
    ['completion-record', 'guard-stop-completion-record'],
    ['card-edit-via-tools', 'guard-bash-card-shell-write'],
    ['no-wait-poll', 'guard-stop-passive-wait'],
  ])('%s is enforced by %s, which has a test on disk', (ruleId, enforcerId) => {
    const rule = ledger.rules.find((r) => r.id === ruleId);
    expect(rule.status).toBe('enforced');
    expect(rule.enforcers).toContain(enforcerId);
    expect(rule.lines.length).toBeGreaterThan(0);
    const enforcer = ledger.enforcers[enforcerId];
    expect(['hook', 'wrapper', 'gate']).toContain(enforcer.kind);
    expect(existsSync(join(REPO_ROOT, enforcer.test))).toBe(true);
  });
});
