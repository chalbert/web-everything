// @vitest-environment node
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import schema from './plateau-progress-view.schema.json';
import examples from './plateau-progress-view.examples.json';

const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const snapshot = () => structuredClone(examples['partial-history'].snapshot);

describe('Plateau progress-view declarative contract', () => {
  it.each(Object.entries(examples))('accepts %s', (_name, example) => {
    expect(validate(example.snapshot), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(Object.keys(snapshot().summary))('rejects negative summary count: %s', key => {
    const value = snapshot();
    value.summary[key as keyof typeof value.summary].value = -1;
    expect(validate(value)).toBe(false);
  });

  it.each(['today', 'current', 'previous'])('rejects negative delivery count: %s', window => {
    const value = snapshot();
    if (window === 'today') value.deliveries.today.count = -1;
    else value.deliveries.trend[window as 'current' | 'previous'].count = -1;
    expect(validate(value)).toBe(false);
  });

  it.each([0, 3, '2', null])('rejects unsupported version %s', major => {
    expect(validate({ ...snapshot(), schema: major })).toBe(false);
  });

  it('requires source freshness on the envelope', () => {
    const { sources: _sources, ...value } = snapshot();
    expect(validate(value)).toBe(false);
    expect(validate({ ...value, sources: {} })).toBe(false);
  });

  for (const source of Object.keys(snapshot().sources)) {
    it.each(['observedAt', 'lastSuccessAt', 'expectedEveryMs', 'staleAfterMs', 'status', 'complete', 'reason'])(
      `requires ${source}.%s even when unknown`, field => {
        const value = snapshot();
        Reflect.deleteProperty(value.sources[source as keyof typeof value.sources], field);
        expect(validate(value)).toBe(false);
      });
  }

  it('rejects a comparable trend without a measured baseline', () => {
    const value = structuredClone(examples['missing-trend-baseline'].snapshot);
    value.deliveries.trend.status = 'comparable';
    expect(validate(value)).toBe(false);
  });

  it('keeps schema 1 free of required progress sections', () => {
    const value = examples['schema-1-compatibility'].snapshot;
    expect(validate(value)).toBe(true);
    expect(value).not.toHaveProperty('summary');
    expect(validate({ ...value, schema: 2 })).toBe(false);
  });

  it.each(['pending-review-without-human-action', 'red-ci-without-human-action'] as const)(
    '%s records flow without operator work', name => {
      const value = examples[name].snapshot;
      expect(value.items).toHaveLength(1);
      expect(value.actions).toEqual([]);
      expect(value.summary.humanPending.value).toBe(0);
      expect(value.summary.humanActionable.value).toBe(0);
    });

  it('accepts an explicitly pending human review with system prerequisites', () => {
    const value = snapshot();
    const action = {
      id: 'review:chalbert/web-everything#123', kind: 'human-review',
      ref: 'chalbert/web-everything#123', description: 'Review the contract change.',
      operatorReason: 'Explicit human review requested.', ready: false,
      blockingSystemPrerequisites: ['clean CI'],
      url: 'https://github.com/chalbert/web-everything/pull/123', forkRef: null,
    };
    const example = { ...value, actions: [action] };
    example.summary.humanPending.value = 1;
    example.coverage.collections.actions = { total: 1, included: 1, complete: true, source: 'actions' };
    expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...example, actions: [{ ...action, kind: 'red-ci' }] })).toBe(false);
  });
});
