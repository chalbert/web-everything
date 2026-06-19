/**
 * Web Policy conformance demo (#1079, slice C of #1028) — the runnable proof of the webpolicy DMN
 * contract+engine and proof-of-compliance (#406/#407/#408).
 *
 * Exercises the REAL runtime (`webpolicy/enforcement.ts` PDP + `webpolicy/proof.ts` ProofChain), not a
 * stub: a DMN-style decision table is evaluated under each hit policy, then every decision is appended to
 * a hash-linked proof chain that verifies — and a tampered chain is caught. The app knows only the
 * `PolicyRuleSet` meta-schema (#406); the rule-evaluator is the swappable seam (#093). `setPlaygroundReady`
 * reports the pass count the e2e smoke reads.
 */
import { PolicyDecisionPoint, HitPolicyViolation } from '/webpolicy/enforcement.ts';
import { ProofChain } from '/webpolicy/proof.ts';
import type { PolicyRuleSet, Facts } from '/webpolicy/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

/** A trivial but deterministic non-crypto hash (demo only — a real venue injects SHA-256). */
function demoHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').repeat(8); // 64 hex chars
}

const root = document.getElementById('play-root')!;

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];
const assert = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

// A loan-tier decision table (DMN-aligned): inputs (score, amount) → verdict + tier.
const ruleSet: PolicyRuleSet = {
  id: 'loan-tier',
  version: '1.0.0',
  hitPolicy: 'FIRST',
  inputs: ['score', 'amount'],
  default: 'deny',
  rules: [
    { when: [{ input: 'score', op: 'gte', value: 750 }], then: [{ name: 'verdict', value: 'permit' }, { name: 'tier', value: 'prime' }] },
    { when: [{ input: 'score', op: 'gte', value: 650 }], then: [{ name: 'verdict', value: 'permit' }, { name: 'tier', value: 'standard' }] },
    { when: [{ input: 'amount', op: 'gt', value: 100000 }], then: [{ name: 'verdict', value: 'deny' }, { name: 'reason', value: 'over-limit' }] },
  ],
};

const pdp = new PolicyDecisionPoint();

// 1) FIRST hit policy resolves to the first matching row (prime for a high score).
const vPrime = pdp.decide(ruleSet, { score: 800, amount: 50000 });
assert('FIRST: high score → prime/permit', vPrime.verdict === 'permit' && vPrime.outputs.tier === 'prime', `verdict=${vPrime.verdict} tier=${String(vPrime.outputs.tier)}`);

// 2) A mid score falls to the standard tier (document order matters under FIRST).
const vStd = pdp.decide(ruleSet, { score: 680, amount: 50000 });
assert('FIRST: mid score → standard', vStd.outputs.tier === 'standard', `tier=${String(vStd.outputs.tier)}`);

// 3) No rule matches → the ruleset default verdict.
const vNone = pdp.decide(ruleSet, { score: 500, amount: 10000 });
assert('default verdict when no rule matches', vNone.verdict === 'deny' && vNone.matched.length === 0, `verdict=${vNone.verdict}`);

// 4) UNIQUE hit policy throws when >1 row matches (the DMN UNIQUE guarantee).
const ambiguous: PolicyRuleSet = {
  ...ruleSet,
  hitPolicy: 'UNIQUE',
  rules: [
    { when: [{ input: 'score', op: 'gte', value: 600 }], then: [{ name: 'verdict', value: 'a' }] },
    { when: [{ input: 'score', op: 'gte', value: 700 }], then: [{ name: 'verdict', value: 'b' }] },
  ],
};
let threw = false;
try { pdp.decide(ambiguous, { score: 800, amount: 0 }); } catch (e) { threw = e instanceof HitPolicyViolation; }
assert('UNIQUE: multiple matches throws HitPolicyViolation', threw, threw ? 'threw' : 'did not throw');

// 5) PRIORITY hit policy picks the highest-priority matching row.
const prioritized: PolicyRuleSet = {
  ...ruleSet,
  hitPolicy: 'PRIORITY',
  rules: [
    { when: [{ input: 'score', op: 'gte', value: 600 }], then: [{ name: 'verdict', value: 'low' }], priority: 1 },
    { when: [{ input: 'score', op: 'gte', value: 600 }], then: [{ name: 'verdict', value: 'high' }], priority: 9 },
  ],
};
const vPrio = pdp.decide(prioritized, { score: 700, amount: 0 });
assert('PRIORITY: highest priority wins', vPrio.verdict === 'high', `verdict=${vPrio.verdict}`);

// 6) Proof-of-compliance: append each decision to a hash-linked chain; it verifies.
const chain = new ProofChain({ hash: demoHash });
for (const facts of [{ score: 800, amount: 50000 }, { score: 680, amount: 50000 }, { score: 500, amount: 10000 }] as Facts[]) {
  const v = pdp.decide(ruleSet, facts);
  chain.append({ rule: { id: ruleSet.id, version: ruleSet.version }, inputs: facts, verdict: v.verdict, actor: 'demo', time: '2026-06-19T00:00:00Z' });
}
const verified = chain.verify();
assert('proof chain of 3 decisions verifies', verified.ok, `ok=${verified.ok}`);

// 7) Tamper detection: mutate a record's verdict → verify catches the break.
const tampered = ProofChain.from(
  chain.records.map((r, i) => (i === 1 ? { ...r, verdict: 'FORGED' } : r)),
  { hash: demoHash },
);
const tamperResult = tampered.verify();
assert('tampered proof chain is rejected', !tamperResult.ok, `ok=${tamperResult.ok} brokenAt=${String(tamperResult.brokenAt)}`);

// ── Render ──────────────────────────────────────────────────────────────────────
const passCount = checks.filter((c) => c.pass).length;
root.innerHTML = '';
const list = document.createElement('ul');
list.className = 'conformance-list';
for (const c of checks) {
  const li = document.createElement('li');
  li.className = c.pass ? 'pass' : 'fail';
  li.textContent = `${c.pass ? '✓' : '✗'} ${c.name} — ${c.detail}`;
  list.appendChild(li);
}
const summary = document.createElement('p');
summary.className = 'conformance-summary';
summary.textContent = `${passCount}/${checks.length} conformance checks passed`;
root.append(summary, list);

setPlaygroundReady(passCount);
