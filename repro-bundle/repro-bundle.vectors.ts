/**
 * Repro-bundle conformance vectors (#1664) — the golden corpus a conforming reader/writer round-trips.
 *
 * `reproBundleGolden` is the canonical valid bundle that exercises all four parts (declared state, action
 * trace, declared rules, ownership) — every conforming serializer must emit it byte-stable and every reader
 * must accept it. `invalidReproBundleCases` are the malformed shapes the validator must reject, each with
 * the substring its `ReproBundleSchemaError` carries — the discrimination half of the conformance check.
 */
import type { ReproBundle } from './contract.js';
import { REPRO_BUNDLE_VERSION } from './schema.js';

/** The canonical valid bundle — all four parts populated, one total `seq` order across state + trace. */
export const reproBundleGolden: ReproBundle = {
  version: REPRO_BUNDLE_VERSION,
  capturedAtMs: 1_700_000_000_000,
  state: [
    { seq: 0, atMs: 1_700_000_000_000, label: 'initial', state: { form: { value: '', valid: false } } },
    { seq: 3, atMs: 1_700_000_000_500, label: 'after-submit', state: { form: { value: 'hi', valid: true } } },
  ],
  trace: [
    { kind: 'intent', seq: 1, atMs: 1_700_000_000_200, intent: 'type', target: '#field', detail: { value: 'hi' } },
    { kind: 'intent', seq: 2, atMs: 1_700_000_000_400, intent: 'submit', target: '#save' },
    { kind: 'transition', seq: 4, atMs: 1_700_000_000_600, from: 'editing', to: 'saved', via: 'submit' },
  ],
  rules: [
    {
      id: 'form/required',
      kind: 'validation',
      contract: '@webeverything/validator-resolution',
      description: 'The field is required before submit.',
      vectorIds: ['validator-resolution/required/empty-blocks-submit'],
    },
    { id: 'a11y/announce', kind: 'conformance', contract: '@webeverything/presentation-a11y' },
  ],
  ownership: [
    { nodeId: '#field', owner: 'webforms', ownerKind: 'project' },
    { nodeId: '#save', owner: 'webforms', ownerKind: 'project' },
  ],
};

/** Each malformed case: the value and the substring its rejection error must contain. */
export const invalidReproBundleCases: ReadonlyArray<{ label: string; value: unknown; errorIncludes: string }> = [
  { label: 'not an object', value: 42, errorIncludes: 'not an object' },
  { label: 'missing version', value: { ...reproBundleGolden, version: undefined }, errorIncludes: '`version` is required' },
  { label: 'incompatible major', value: { ...reproBundleGolden, version: '2.0.0' }, errorIncludes: 'incompatible major version' },
  { label: 'non-semver version', value: { ...reproBundleGolden, version: 'v1' }, errorIncludes: 'incompatible major version' },
  { label: 'state not array', value: { ...reproBundleGolden, state: {} }, errorIncludes: '`state` must be an array' },
  { label: 'snapshot missing seq', value: { ...reproBundleGolden, state: [{ atMs: 1, state: {} }] }, errorIncludes: 'state[0] needs an integer `seq`' },
  { label: 'bad trace kind', value: { ...reproBundleGolden, trace: [{ kind: 'wat', seq: 0, atMs: 0 }] }, errorIncludes: 'trace[0].kind must be' },
  { label: 'rule bad kind', value: { ...reproBundleGolden, rules: [{ id: 'r', kind: 'nope', contract: 'c' }] }, errorIncludes: 'rules[0].kind must be' },
  { label: 'ownership missing owner', value: { ...reproBundleGolden, ownership: [{ nodeId: '#x' }] }, errorIncludes: 'ownership[0] needs a non-empty `owner`' },
];
