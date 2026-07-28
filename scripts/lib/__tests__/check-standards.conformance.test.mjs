/**
 * @file check-standards.conformance.test.mjs — the CONFORMANCE SUITE for the check:standards
 * definition-of-green contract (#2769, executing the #2625 contract-split ruling, fork (d)).
 *
 * WHAT THIS PROVES, AND WHY IT IS THE OTHER HALF OF THE CONTRACT.
 * `scripts/check-standards.contract.json` declares the gate's DEFINITION OF GREEN as DATA: the per-rule
 * ENFORCEMENT flags (is a finding a hard ERROR or a WARNING) and the semantic THRESHOLDS a finding is
 * measured against. The IMPLEMENTATION — scripts/check-standards.mjs + scripts/check-standards-rules.mjs —
 * is the hand-written realization of that policy: it holds the live constants (COMPOSE_TRAITS_ENFORCED,
 * DIGEST_MAX_WORDS, FIB, …) and the imperative rules that consume them. This suite proves the impl CONFORMS
 * to the contract — every declared knob equals its live constant, and no enforcement knob exists in the impl
 * that the contract fails to declare — so that:
 *
 *   • a diff to the CONTRACT is a definition-of-green change (its basename is registered on the trust-chain
 *     POLICY tier in ../gate-config.mjs → review:human), and
 *   • an implementation change that keeps THIS suite green is agent-clearable: a behaviour-preserving refactor
 *     of the ~3900 lines of rules conforms; a change to WHAT the gate accepts (flip an enforcement flag, loosen
 *     a threshold) diverges from the contract and turns this suite RED, which forces the author to ALSO edit
 *     the contract (→ the policy tier → a human). That is the #2625 gate-self split made mechanical: a real
 *     weakening of the gate forces review:human, routine rule churn does not.
 *
 * WHY IT PINS (not imports). The #2769 scope deliberately does not touch the engine files, so — unlike
 * review-policy, where the impl imports the numbers FROM the contract — here the contract MIRRORS the impl's
 * exported constants and this suite pins the two EQUAL. The guarantee is identical: the impl and the contract
 * cannot diverge silently.
 *
 * SELF-REFERENCE (load-bearing). This file's basename is registered on the trust-chain policy tier
 * (../gate-config.mjs), so weakening a conformance assertion here is itself a human-gated change — you cannot
 * quietly relax the bridge to make an engine diff pass. If the contract is genuinely wrong, change the
 * CONTRACT (a deliberate, human-reviewed edit), not this suite.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as rules from '../../check-standards-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// scripts/lib/__tests__/ → up two → scripts/  ⇒ scripts/check-standards.contract.json
const CONTRACT = JSON.parse(
  readFileSync(join(here, '..', '..', 'check-standards.contract.json'), 'utf8'),
);

/** Deep-equal for the threshold values (numbers and the allowed-size array/Set). */
function sameValue(contractValue, implValue) {
  const impl = implValue instanceof Set ? [...implValue] : implValue;
  return JSON.stringify(impl) === JSON.stringify(contractValue);
}

describe('static conformance — contract shape + prose (#2564 schema + prose layer)', () => {
  it('the contract identifies itself and is versioned', () => {
    expect(CONTRACT.contract).toBe('check-standards-definition-of-green');
    expect(typeof CONTRACT.version).toBe('number');
    expect(CONTRACT.summary.trim().length).toBeGreaterThan(0);
  });

  it('every enforcement flag and threshold carries prose + an impl symbol name', () => {
    for (const [key, entry] of Object.entries(CONTRACT.enforcement.flags)) {
      expect(typeof entry.description, `enforcement.${key}.description`).toBe('string');
      expect(entry.description.trim().length, `enforcement.${key}.description`).toBeGreaterThan(0);
      expect(typeof entry.impl, `enforcement.${key}.impl`).toBe('string');
      expect(typeof entry.value, `enforcement.${key}.value`).toBe('boolean');
    }
    for (const [key, entry] of Object.entries(CONTRACT.thresholds)) {
      if (key === 'description') continue;
      expect(typeof entry.description, `thresholds.${key}.description`).toBe('string');
      expect(entry.description.trim().length, `thresholds.${key}.description`).toBeGreaterThan(0);
      expect(typeof entry.impl, `thresholds.${key}.impl`).toBe('string');
    }
  });
});

describe('value conformance — contract knobs equal the live impl constants', () => {
  it('every enforcement flag matches its exported *_ENFORCED constant', () => {
    for (const [key, entry] of Object.entries(CONTRACT.enforcement.flags)) {
      expect(rules[entry.impl], `impl export ${entry.impl} (enforcement.${key}) must exist`).not.toBeUndefined();
      expect(rules[entry.impl], `enforcement.${key}: contract says ${entry.value}, impl ${entry.impl} is ${rules[entry.impl]}`).toBe(entry.value);
    }
  });

  it('every threshold matches its exported constant', () => {
    for (const [key, entry] of Object.entries(CONTRACT.thresholds)) {
      if (key === 'description') continue;
      expect(rules[entry.impl], `impl export ${entry.impl} (thresholds.${key}) must exist`).not.toBeUndefined();
      expect(
        sameValue(entry.value, rules[entry.impl]),
        `thresholds.${key}: contract ${JSON.stringify(entry.value)} vs impl ${entry.impl} ${JSON.stringify(rules[entry.impl] instanceof Set ? [...rules[entry.impl]] : rules[entry.impl])}`,
      ).toBe(true);
    }
  });
});

describe('coverage conformance — no enforcement knob escapes the contract', () => {
  it('every *_ENFORCED constant exported by the engine is declared in the contract', () => {
    const declared = new Set(Object.values(CONTRACT.enforcement.flags).map((e) => e.impl));
    const exported = Object.keys(rules).filter((k) => k.endsWith('_ENFORCED'));
    expect(exported.length).toBeGreaterThan(0); // guard: the engine really does export enforcement flags
    for (const symbol of exported) {
      expect(
        declared.has(symbol),
        `engine exports ${symbol} but the contract does not declare it — a new definition-of-green knob must be added to check-standards.contract.json (the policy tier), not left un-governed`,
      ).toBe(true);
    }
  });
});
