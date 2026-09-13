/**
 * @file scripts/conveyor/__tests__/fix-autofix-gate.test.mjs
 * @description Unit proof of the Part-3 blacklist-first auto-fix gate — pure, no I/O. Pins: the strict tier's
 *   deny surface (statute, gate-self, blast-radius, supply-chain/config/`.claude/`, security-sensitive paths),
 *   the lenient tier as a STRICT SUBSET (fewer denials), the blocker/high-severity gate (strict-tier only), and
 *   the `{selfClears, batched, escalate, reason}` return contract mirroring `assessMissingOperationConfidence`
 *   (#3649 Fork 6).
 */
import { describe, it, expect } from 'vitest';
import {
  AUTO_FIX_TIERS, isStrictDenyPath, isLenientDenyPath, isSecuritySensitivePath, isHighSeverityFinding,
  classifyFindingForAutoFix, resolveAutoFixTier,
} from '../fix-autofix-gate.mjs';

describe('isStrictDenyPath — the strict tier deny surface', () => {
  it('denies the statute layer', () => {
    expect(isStrictDenyPath('docs/agent/platform-decisions.md')).toBe(true);
  });
  it('denies blast-radius surfaces (scripts/, CI, hooks, skills-src)', () => {
    expect(isStrictDenyPath('scripts/pr-land.mjs')).toBe(true);
    expect(isStrictDenyPath('.github/workflows/ci.yml')).toBe(true);
    expect(isStrictDenyPath('.githooks/pre-commit')).toBe(true);
    expect(isStrictDenyPath('skills-src/review/SKILL.md')).toBe(true);
  });
  it('denies supply-chain / build-config / full .claude/ (EXTRA_DENY, reused not re-listed)', () => {
    expect(isStrictDenyPath('package.json')).toBe(true);
    expect(isStrictDenyPath('package-lock.json')).toBe(true);
    expect(isStrictDenyPath('vitest.config.mjs')).toBe(true);
    expect(isStrictDenyPath('.claude/settings.json')).toBe(true);
  });
  it('denies security-sensitive code paths', () => {
    expect(isStrictDenyPath('src/auth/session.ts')).toBe(true);
    expect(isStrictDenyPath('lib/crypto/hash.mjs')).toBe(true);
    expect(isStrictDenyPath('config/secrets.yaml')).toBe(true);
    expect(isStrictDenyPath('.env.production')).toBe(true);
    expect(isStrictDenyPath('scripts/guard-bash.mjs')).toBe(true);
  });
  it('an ordinary leaf file is NOT denied — blacklist-first, not allowlist-first', () => {
    expect(isStrictDenyPath('src/components/Button.tsx')).toBe(false);
    expect(isStrictDenyPath('docs/guides/getting-started.md')).toBe(false);
  });
  it('an empty/unknown path fails closed (denied)', () => {
    expect(isStrictDenyPath('')).toBe(true);
    expect(isStrictDenyPath(null)).toBe(true);
  });
});

describe('isLenientDenyPath — the POC-branch tier is a STRICT SUBSET of the strict tier', () => {
  it('still denies statute and security-sensitive paths', () => {
    expect(isLenientDenyPath('docs/agent/platform-decisions.md')).toBe(true);
    expect(isLenientDenyPath('src/auth/session.ts')).toBe(true);
  });
  it('drops the generic blast-radius / supply-chain / config denials the strict tier has', () => {
    expect(isLenientDenyPath('scripts/pr-land.mjs')).toBe(false);
    expect(isLenientDenyPath('package.json')).toBe(false);
    expect(isLenientDenyPath('vitest.config.mjs')).toBe(false);
    expect(isLenientDenyPath('.claude/settings.json')).toBe(false);
  });
  it('subset property: every lenient-denied path is also strict-denied, over a mixed sample', () => {
    const sample = [
      'docs/agent/platform-decisions.md', 'src/auth/session.ts', 'scripts/pr-land.mjs', 'package.json',
      '.github/workflows/ci.yml', 'src/components/Button.tsx', '.env', 'lib/crypto/x.mjs',
    ];
    for (const p of sample) {
      if (isLenientDenyPath(p)) expect(isStrictDenyPath(p), p).toBe(true);
    }
  });
});

describe('isSecuritySensitivePath', () => {
  it('matches auth/authn/authz, crypto, secrets, credentials, .env*, and the write-time security hooks', () => {
    expect(isSecuritySensitivePath('src/authz/policy.ts')).toBe(true);
    expect(isSecuritySensitivePath('src/authn.ts')).toBe(true);
    expect(isSecuritySensitivePath('secrets/api-key.txt')).toBe(true);
    expect(isSecuritySensitivePath('credentials.json')).toBe(true);
    expect(isSecuritySensitivePath('.env.local')).toBe(true);
    expect(isSecuritySensitivePath('scripts/guard-lane.mjs')).toBe(true);
  });
  it('does not match an unrelated path', () => {
    expect(isSecuritySensitivePath('src/components/Header.tsx')).toBe(false);
  });
});

describe('isHighSeverityFinding', () => {
  it('true for a blocker disposition', () => {
    expect(isHighSeverityFinding({ disposition: 'blocker' })).toBe(true);
  });
  it('true for broken/unrecoverable impact', () => {
    expect(isHighSeverityFinding({ impactIfUnfixed: 'broken' })).toBe(true);
    expect(isHighSeverityFinding({ impactIfUnfixed: 'unrecoverable' })).toBe(true);
  });
  it('false for a nit/carve-out or cosmetic/degraded finding', () => {
    expect(isHighSeverityFinding({ disposition: 'nit' })).toBe(false);
    expect(isHighSeverityFinding({ impactIfUnfixed: 'cosmetic' })).toBe(false);
    expect(isHighSeverityFinding({ impactIfUnfixed: 'degraded' })).toBe(false);
  });
  it('false for a missing/malformed finding', () => {
    expect(isHighSeverityFinding(null)).toBe(false);
    expect(isHighSeverityFinding({})).toBe(false);
  });
});

describe('classifyFindingForAutoFix — the gate, mirroring assessMissingOperationConfidence\'s return shape', () => {
  it('a clean finding on an ordinary file self-clears (auto-applies) under the strict tier', () => {
    const risk = classifyFindingForAutoFix({ finding: { file: 'src/components/Button.tsx', summary: 'x' }, tier: AUTO_FIX_TIERS.STRICT });
    expect(risk).toMatchObject({ selfClears: true, batched: false, escalate: false, reason: 'clean', tier: 'strict' });
  });

  it('a path-blacklist hit escalates — independent of severity — under either tier', () => {
    const risk = classifyFindingForAutoFix({
      finding: { file: 'docs/agent/platform-decisions.md', summary: 'x', disposition: 'nit' },
      tier: AUTO_FIX_TIERS.STRICT,
    });
    expect(risk).toMatchObject({ selfClears: false, batched: false, escalate: true, reason: 'path-blacklisted' });
  });

  it('a blocker/high-severity finding on an ordinary file is BATCHED (no auto-apply) under the strict tier', () => {
    const risk = classifyFindingForAutoFix({
      finding: { file: 'src/components/Button.tsx', summary: 'x', disposition: 'blocker' },
      tier: AUTO_FIX_TIERS.STRICT,
    });
    expect(risk).toMatchObject({ selfClears: false, batched: true, escalate: false, reason: 'blocker-or-high-severity' });
  });

  it('the SAME blocker finding self-clears under the lenient (POC) tier — dropped there on purpose', () => {
    const risk = classifyFindingForAutoFix({
      finding: { file: 'src/components/Button.tsx', summary: 'x', disposition: 'blocker' },
      tier: AUTO_FIX_TIERS.LENIENT,
    });
    expect(risk).toMatchObject({ selfClears: true, reason: 'clean', tier: 'lenient' });
  });

  it('a generic blast-radius file self-clears under the lenient tier but not the strict tier', () => {
    const strict = classifyFindingForAutoFix({ finding: { file: 'scripts/pr-land.mjs', summary: 'x' }, tier: AUTO_FIX_TIERS.STRICT });
    const lenient = classifyFindingForAutoFix({ finding: { file: 'scripts/pr-land.mjs', summary: 'x' }, tier: AUTO_FIX_TIERS.LENIENT });
    expect(strict.selfClears).toBe(false);
    expect(lenient.selfClears).toBe(true);
  });

  it('security-sensitive paths never self-clear, in either tier', () => {
    const strict = classifyFindingForAutoFix({ finding: { file: 'src/auth/session.ts', summary: 'x' }, tier: AUTO_FIX_TIERS.STRICT });
    const lenient = classifyFindingForAutoFix({ finding: { file: 'src/auth/session.ts', summary: 'x' }, tier: AUTO_FIX_TIERS.LENIENT });
    expect(strict.selfClears).toBe(false);
    expect(lenient.selfClears).toBe(false);
  });

  it('defaults to the strict tier when none is given', () => {
    const risk = classifyFindingForAutoFix({ finding: { file: 'scripts/pr-land.mjs', summary: 'x' } });
    expect(risk.tier).toBe('strict');
    expect(risk.selfClears).toBe(false);
  });
});

describe('resolveAutoFixTier', () => {
  const registry = { branches: [{ branch: 'lane/mechanical-dispatcher', target: 'main' }] };
  it('resolves LENIENT for a PR based on a registered POC branch', () => {
    expect(resolveAutoFixTier({ baseRefName: 'lane/mechanical-dispatcher', registry })).toBe(AUTO_FIX_TIERS.LENIENT);
  });
  it('resolves STRICT for main', () => {
    expect(resolveAutoFixTier({ baseRefName: 'main', registry })).toBe(AUTO_FIX_TIERS.STRICT);
  });
  it('resolves STRICT for an unregistered branch (fail closed to the stricter tier)', () => {
    expect(resolveAutoFixTier({ baseRefName: 'lane/some-other-feature', registry })).toBe(AUTO_FIX_TIERS.STRICT);
  });
});
