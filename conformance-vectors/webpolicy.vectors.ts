/**
 * webpolicy conformance-vector suite (#1800, cascade #1294) — the facts→verdict standard's behavioral
 * corpus. The first **synchronous** (clock-free, #1789/#1790) suite: every step is order-only (no `atMs`),
 * the candidate is a DMN policy engine, and the observable outcome is the decision `verdict` plus the
 * runtime venue's tamper-evident **proof** surfaces (#407).
 *
 * The vectors judge only the **observable** outcome read through the binding's surfaces — the combined
 * `verdict` under each DMN hit policy (UNIQUE/FIRST/PRIORITY/COLLECT + default), whether the PEP `allowed`
 * the action, and that a runtime-venue decision yields a verifiable proof record (`proofRecordCount` /
 * `proofVerified` / `proofVerdict`) — never the engine's internals (the `comparatorEvaluator`, the hash
 * function, the chain links). A component is conformant if it produces these observations, however it is
 * built (the #506/#899 golden-vectors model). The runtime engine impl is FUI's (#1799, statute #1282); the
 * contract it judges stays WE's `@webeverything/contracts/webpolicy`.
 *
 * The runtime *driver* (the #1790 plateau runner) dispatches each step to FUI's synchronous binding
 * (`fui:webpolicy/webpolicyConformance.ts`) and grades the trace; this module is the build-agnostic data.
 */
import type { PolicyRuleSet } from '../webpolicy/contract.js';
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/webpolicy';

/** A FIRST-policy order-approval ruleset: the amount cap fires before the manager grant (document order). */
const orderApproval: PolicyRuleSet = {
  id: 'order-approval',
  version: '1',
  hitPolicy: 'FIRST',
  inputs: ['amount', 'role'],
  default: 'deny',
  rules: [
    { when: [{ input: 'amount', op: 'gt', value: 10000 }], then: [{ name: 'verdict', value: 'deny' }] },
    { when: [{ input: 'role', op: 'eq', value: 'manager' }], then: [{ name: 'verdict', value: 'permit' }] },
  ],
};

/** A PRIORITY ruleset: two rules match the same fact, the higher `priority` wins. */
const escalation: PolicyRuleSet = {
  id: 'escalation',
  version: '1',
  hitPolicy: 'PRIORITY',
  inputs: ['risk'],
  rules: [
    { when: [{ input: 'risk', op: 'gt', value: 0 }], then: [{ name: 'verdict', value: 'review' }], priority: 1 },
    { when: [{ input: 'risk', op: 'gt', value: 0 }], then: [{ name: 'verdict', value: 'block' }], priority: 9 },
  ],
};

/** A COLLECT ruleset: every matching row contributes; the merged `verdict` output is the last writer. */
const tagging: PolicyRuleSet = {
  id: 'tagging',
  version: '1',
  hitPolicy: 'COLLECT',
  inputs: ['amount'],
  rules: [
    { when: [{ input: 'amount', op: 'gte', value: 0 }], then: [{ name: 'verdict', value: 'logged' }] },
    { when: [{ input: 'amount', op: 'gt', value: 1000 }], then: [{ name: 'verdict', value: 'flagged' }] },
  ],
};

export const webpolicySuite: ConformanceVectorSuite = {
  standard: 'webpolicy',
  contract: CONTRACT,
  vectors: [
    {
      // FIRST hit policy: the amount-cap rule precedes the manager-grant rule in document order, so a
      // large order denies even for a manager — the canonical "first match wins" proof.
      id: 'webpolicy/hit-policy/first-cap-precedes-grant',
      contract: CONTRACT,
      description: 'FIRST takes the earliest matching rule in document order (amount cap beats manager grant).',
      steps: [
        { do: 'setRuleSet', ruleSet: orderApproval },
        { do: 'decide', facts: { amount: 50000, role: 'manager' } },
      ],
      expect: { verdict: 'deny' },
      observeVia: ['verdict'],
    },
    {
      // FIRST hit policy: a small order by a manager falls through to the grant rule and permits.
      id: 'webpolicy/hit-policy/first-grant-applies',
      contract: CONTRACT,
      description: 'FIRST falls through to a later matching rule when the earlier ones do not fire.',
      steps: [
        { do: 'setRuleSet', ruleSet: orderApproval },
        { do: 'decide', facts: { amount: 100, role: 'manager' } },
      ],
      expect: { verdict: 'permit' },
      observeVia: ['verdict'],
    },
    {
      // No rule matches → the ruleset `default` verdict stands.
      id: 'webpolicy/hit-policy/default-when-no-match',
      contract: CONTRACT,
      description: 'A ruleset returns its declared default verdict when no rule matches.',
      steps: [
        { do: 'setRuleSet', ruleSet: orderApproval },
        { do: 'decide', facts: { amount: 100, role: 'clerk' } },
      ],
      expect: { verdict: 'deny' },
      observeVia: ['verdict'],
    },
    {
      // PRIORITY hit policy: both rules match the same fact; the higher-priority verdict wins.
      id: 'webpolicy/hit-policy/priority-highest-wins',
      contract: CONTRACT,
      description: 'PRIORITY combines matches by selecting the highest-priority rule.',
      steps: [
        { do: 'setRuleSet', ruleSet: escalation },
        { do: 'decide', facts: { risk: 5 } },
      ],
      expect: { verdict: 'block' },
      observeVia: ['verdict'],
    },
    {
      // COLLECT hit policy: every matching row fires; the merged `verdict` output is the last writer.
      id: 'webpolicy/hit-policy/collect-merges-outputs',
      contract: CONTRACT,
      description: 'COLLECT fires every matching rule and merges their outputs (last writer wins on key).',
      steps: [
        { do: 'setRuleSet', ruleSet: tagging },
        { do: 'decide', facts: { amount: 5000 } },
      ],
      expect: { verdict: 'flagged' },
      observeVia: ['verdict'],
    },
    {
      // Runtime venue (#407/#408): a PEP wired to a proof chain decides AND appends a tamper-evident,
      // verifiable proof record carrying the same verdict — the observable proof-of-compliance surface.
      id: 'webpolicy/proof/runtime-venue-emits-verifiable-proof',
      contract: CONTRACT,
      description: 'The runtime venue permits and emits one verifiable proof record carrying the verdict.',
      steps: [
        { do: 'setRuleSet', ruleSet: orderApproval },
        { do: 'enforce', facts: { amount: 100, role: 'manager' }, actor: 'svc-orders', traceSpan: 'span-7' },
      ],
      expect: { verdict: 'permit', allowed: true, proofRecordCount: 1, proofVerified: true, proofVerdict: 'permit' },
      observeVia: ['verdict', 'allowed', 'proofRecordCount', 'proofVerified', 'proofVerdict'],
    },
    {
      // Build/gate venue: the PDP decides with no proof sink — it denies and emits zero proof records.
      id: 'webpolicy/proof/build-venue-decides-without-proof',
      contract: CONTRACT,
      description: 'The build/gate venue (no proof chain) decides and enforces but emits no proof record.',
      steps: [
        { do: 'setRuleSet', ruleSet: orderApproval },
        { do: 'decide', facts: { amount: 99999, role: 'manager' } },
      ],
      expect: { verdict: 'deny', proofRecordCount: 0 },
      observeVia: ['verdict', 'proofRecordCount'],
    },
  ],
};

export default webpolicySuite;
