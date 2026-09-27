/**
 * @file scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs
 * @description we:backlog/heal-wait-for-rerun (landing-freeze fix, 2026-09-27) — pins the durable, HEAD-SCOPED
 *   ci-heal escalation marker: build/parse round-trip, the trusted-author gate (mirrors every sibling marker),
 *   and the head-scoping that makes a new push re-arm auto-heal with no human intervention. Real incident:
 *   chalbert/web-everything#2783 (three ci-heal sessions in one evening, each escalating identically on the
 *   same head with nothing durable recorded).
 */
import { describe, it, expect } from 'vitest';
import {
  buildCiHealEscalationComment, parseCiHealEscalations, latestCiHealEscalationForHead,
  CI_HEAL_ESCALATION_MARKER, CI_HEAL_ESCALATION_OUTCOMES,
} from '../ci-heal-escalation-mark.mjs';

const AUTOMATION = { login: 'web-everything' };
const HEAD = '70326866f0f299ddd005f9da54f0b87a3c169ac4'; // PR #2783's real head, 2026-09-27

describe('CI_HEAL_ESCALATION_OUTCOMES', () => {
  it('is exactly the two-valued enum the file header describes', () => {
    expect(CI_HEAL_ESCALATION_OUTCOMES).toEqual(['needs-human', 'waiting-on-system-fix']);
  });
});

describe('buildCiHealEscalationComment', () => {
  it('leads with the stable marker line', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human', reason: 'not a CI break' });
    expect(body.startsWith(CI_HEAL_ESCALATION_MARKER)).toBe(true);
  });
  it('lowercases and trims the head sha (case/whitespace must never fork the comparison)', () => {
    const body = buildCiHealEscalationComment({ headSha: `  ${HEAD.toUpperCase()}  `, outcome: 'needs-human' });
    expect(body).toContain(`head: ${HEAD}`);
  });
  it('needs-human requires no systemFixRef and omits the system-fix line', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human', reason: 'genuine defect' });
    expect(body).not.toContain('system-fix:');
    expect(body).toContain('outcome: needs-human');
  });
  it('waiting-on-system-fix carries the system-fix line', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'waiting-on-system-fix', systemFixRef: 2784 });
    expect(body).toContain('outcome: waiting-on-system-fix');
    expect(body).toContain('system-fix: #2784');
  });
  it('waiting-on-system-fix WITHOUT a systemFixRef throws — never a half-formed marker', () => {
    expect(() => buildCiHealEscalationComment({ headSha: HEAD, outcome: 'waiting-on-system-fix' })).toThrow();
  });
  it('an unknown outcome throws rather than posting a marker parseCiHealEscalations could not read back', () => {
    expect(() => buildCiHealEscalationComment({ headSha: HEAD, outcome: 'bogus' })).toThrow();
  });
  it('a missing headSha throws', () => {
    expect(() => buildCiHealEscalationComment({ outcome: 'needs-human' })).toThrow();
  });
});

describe('parseCiHealEscalations — the round trip and the trusted-author gate', () => {
  it('round-trips a built comment back to its fields', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human', reason: 'not a CI break' });
    const [parsed] = parseCiHealEscalations([{ body, author: AUTOMATION, createdAt: '2026-09-27T01:23:00Z' }]);
    expect(parsed).toMatchObject({ headSha: HEAD, outcome: 'needs-human', reason: 'not a CI break', systemFixRef: null });
  });
  it('round-trips the waiting-on-system-fix shape including the ref', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'waiting-on-system-fix', systemFixRef: 2784, reason: 'soak-replay-gate false red' });
    const [parsed] = parseCiHealEscalations([{ body, author: AUTOMATION }]);
    expect(parsed).toMatchObject({ headSha: HEAD, outcome: 'waiting-on-system-fix', systemFixRef: '2784' });
  });
  it('#3383 — an UNTRUSTED author\'s identical-looking comment never counts (forgeable "already escalated" would suppress a real ci-heal)', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human' });
    expect(parseCiHealEscalations([{ body, author: { login: 'some-random-account' } }])).toEqual([]);
  });
  it('a human quoting the marker in a REPLY (not the leading line) never counts', () => {
    const marker = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human' });
    const quoted = `> ${marker.split('\n')[0]}\n\nI disagree, please retry.`;
    expect(parseCiHealEscalations([{ body: quoted, author: AUTOMATION }])).toEqual([]);
  });
  it('a non-array / empty input is zero escalations, never a throw', () => {
    expect(parseCiHealEscalations(null)).toEqual([]);
    expect(parseCiHealEscalations([])).toEqual([]);
  });
  it('a bare-string comment array is tolerated (author unknown → untrusted → excluded), matching every sibling marker\'s contract', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human' });
    expect(parseCiHealEscalations([body])).toEqual([]);
  });
});

describe('latestCiHealEscalationForHead — the head-scoping that makes a new push re-arm auto-heal', () => {
  const OLD_HEAD = 'c2bd9d5b8bc2bd9d5b8bc2bd9d5b8bc2bd9d5b8b';

  it('finds an escalation matching the CURRENT head', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human', reason: 'genuine defect' });
    const result = latestCiHealEscalationForHead([{ body, author: AUTOMATION }], HEAD);
    expect(result).toMatchObject({ headSha: HEAD, outcome: 'needs-human' });
  });

  it('LIVE INCIDENT #2783 shape: an escalation on the OLD head does not match once a new push moves the head — auto-heal re-arms with no human clear', () => {
    const body = buildCiHealEscalationComment({ headSha: OLD_HEAD, outcome: 'needs-human', reason: 'not a CI break' });
    // The PR has since been rebased/re-pushed onto a NEW head — the stale escalation comment is still in
    // `comments` (comments are never deleted), but it names a head this PR no longer has.
    expect(latestCiHealEscalationForHead([{ body, author: AUTOMATION }], HEAD)).toBeNull();
  });

  it('no headSha given → null, never a false match', () => {
    const body = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human' });
    expect(latestCiHealEscalationForHead([{ body, author: AUTOMATION }], null)).toBeNull();
    expect(latestCiHealEscalationForHead([{ body, author: AUTOMATION }], undefined)).toBeNull();
  });

  it('multiple escalations on the SAME head: the LAST one in comments order wins', () => {
    const first = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'needs-human', reason: 'first look' });
    const second = buildCiHealEscalationComment({ headSha: HEAD, outcome: 'waiting-on-system-fix', systemFixRef: 2784, reason: 'second look' });
    const result = latestCiHealEscalationForHead(
      [{ body: first, author: AUTOMATION }, { body: second, author: AUTOMATION }], HEAD,
    );
    expect(result).toMatchObject({ outcome: 'waiting-on-system-fix', systemFixRef: '2784' });
  });
});
