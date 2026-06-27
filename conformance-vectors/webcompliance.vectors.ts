/**
 * webcompliance conformance-vector suite (#1809, cascade #1294) — the gate/waiver standard's behavioral
 * corpus. A **synchronous** (clock-free, #1789/#1790) facts→verdict suite: the candidate is the #437
 * compliance gate, the "facts" are a `CompliancePolicy` + measured conformance signals, and the observable
 * outcome is the gate verdict (`blocked`/`passed` + violation count) plus the #438 waiver effects
 * (`waivedCount` / `expiredCount`).
 *
 * The vectors judge only the **observable** outcome read through the binding's surfaces — never the engine's
 * internals (the `clears` comparator, the `extends` resolution). A component is conformant if it produces
 * these observations, however it is built (the #506/#899 golden-vectors model). The runtime engine impl is
 * FUI's (#1814, statute #1282); the contract it judges stays WE's `@webeverything/contracts/webcompliance`.
 *
 * The runtime *driver* (the #1790 plateau runner) dispatches each step to FUI's synchronous binding
 * (`fui:webcompliance/webcomplianceConformance.ts`) and grades the trace; this module is the build-agnostic data.
 */
import type { CompliancePolicy } from '../webcompliance/contract.js';
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/webcompliance';

/** A platform-default baseline: a `block` aria-sort rule (fails CI) + a `warn` coverage rule (reports only). */
const baseline: CompliancePolicy = {
  id: 'platform-default',
  version: '1',
  rules: [
    { id: 'aria-sort', measure: 'app-conformance:aria-sort', severity: 'block', threshold: 'L2' },
    { id: 'coverage', measure: 'coverage:lines', severity: 'warn', threshold: 80 },
  ],
};

export const webcomplianceSuite: ConformanceVectorSuite = {
  standard: 'webcompliance',
  contract: CONTRACT,
  vectors: [
    {
      // Every rule clears its threshold → the gate passes, nothing blocks.
      id: 'webcompliance/gate/passes-when-every-rule-clears',
      contract: CONTRACT,
      description: 'The gate passes (not blocked) when every measured signal clears its rule threshold.',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [
          { measure: 'app-conformance:aria-sort', value: 'L2' },
          { measure: 'coverage:lines', value: 95 },
        ] },
      ],
      expect: { blocked: false, passed: true, violationCount: 0 },
      observeVia: ['blocked', 'passed', 'violationCount'],
    },
    {
      // A block-severity rule is violated → the gate blocks (CI must fail).
      id: 'webcompliance/gate/blocks-on-block-severity-violation',
      contract: CONTRACT,
      description: 'A block-severity rule below its threshold blocks the gate (CI fails).',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [
          { measure: 'app-conformance:aria-sort', value: 'L1' },
          { measure: 'coverage:lines', value: 95 },
        ] },
      ],
      expect: { blocked: true, passed: false, violationCount: 1 },
      observeVia: ['blocked', 'passed', 'violationCount'],
    },
    {
      // A warn-severity violation is reported (a violation) but does NOT block the gate.
      id: 'webcompliance/gate/warn-violation-reports-without-blocking',
      contract: CONTRACT,
      description: 'A warn-severity violation is recorded but does not block the gate.',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [
          { measure: 'app-conformance:aria-sort', value: 'L2' },
          { measure: 'coverage:lines', value: 50 },
        ] },
      ],
      expect: { blocked: false, passed: true, violationCount: 1 },
      observeVia: ['blocked', 'passed', 'violationCount'],
    },
    {
      // A required block measure is absent → flagged as a missing-measure violation, the gate blocks.
      id: 'webcompliance/gate/missing-block-measure-blocks',
      contract: CONTRACT,
      description: 'An absent block-severity measure is a violation; the gate blocks.',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [{ measure: 'coverage:lines', value: 95 }] },
      ],
      expect: { blocked: true, violationCount: 1 },
      observeVia: ['blocked', 'violationCount'],
    },
    {
      // An active waiver on the violated block rule suppresses it → the gate passes, the override is audited.
      id: 'webcompliance/waiver/active-waiver-suppresses-block',
      contract: CONTRACT,
      description: 'An active waiver on a block violation lets the gate pass; the override is recorded as waived.',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [
          { measure: 'app-conformance:aria-sort', value: 'L1' },
          { measure: 'coverage:lines', value: 95 },
        ] },
        { do: 'applyWaivers', waivers: [
          { ruleId: 'aria-sort', who: 'lead', why: 'tracked exception', until: '2027-01-01' },
        ], now: '2026-06-01' },
      ],
      expect: { blocked: false, passed: true, violationCount: 0, waivedCount: 1, expiredCount: 0 },
      observeVia: ['blocked', 'passed', 'violationCount', 'waivedCount', 'expiredCount'],
    },
    {
      // An expired waiver does NOT suppress the violation and is surfaced for renewal/removal.
      id: 'webcompliance/waiver/expired-waiver-does-not-suppress',
      contract: CONTRACT,
      description: 'An expired waiver suppresses nothing (the gate still blocks) and is surfaced as expired.',
      steps: [
        { do: 'setPolicy', policy: baseline },
        { do: 'runGate', measures: [
          { measure: 'app-conformance:aria-sort', value: 'L1' },
          { measure: 'coverage:lines', value: 95 },
        ] },
        { do: 'applyWaivers', waivers: [
          { ruleId: 'aria-sort', who: 'lead', why: 'lapsed exception', until: '2025-01-01' },
        ], now: '2026-06-01' },
      ],
      expect: { blocked: true, violationCount: 1, waivedCount: 0, expiredCount: 1 },
      observeVia: ['blocked', 'violationCount', 'waivedCount', 'expiredCount'],
    },
  ],
};

export default webcomplianceSuite;
