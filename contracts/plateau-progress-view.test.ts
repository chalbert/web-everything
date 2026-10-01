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

// Walk the supplied health evidence to exercise every nested closed object.
const healthSnapshot = () => structuredClone(examples['health-stop-pending'].snapshot);
type Path = (string | number)[];
function entries(value: unknown, path: Path = []): { path: Path; value: unknown }[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = [...path, Array.isArray(value) ? Number(key) : key];
    return [{ path: childPath, value: child }, ...entries(child, childPath)];
  });
}
function replace(value: object, path: Path, replacement: unknown) {
  const parent = path.slice(0, -1).reduce((node, key) => Reflect.get(node, key), value);
  Reflect.set(parent, path[path.length - 1], replacement);
}
const healthEntries = [{ path: ['health'], value: healthSnapshot().health },
  ...entries(healthSnapshot().health, ['health'])];
const timestampPaths = healthEntries.filter(({ path }) => /At$|^since$/.test(String(path.at(-1))));
const countPaths = healthEntries.filter(({ path }) =>
  ['limit', 'remaining', 'used', 'measured', 'estimated', 'unattributed', 'expectedEveryMs', 'staleAfterMs'].includes(String(path.at(-1))));
const objectPaths = healthEntries.filter(({ value }) => value !== null && typeof value === 'object' && !Array.isArray(value));

describe('optional, strictly validated health evidence', () => {
  it('retains all existing schema-2 examples without health', () => {
    for (const [name, example] of Object.entries(examples)) {
      if (name.startsWith('health-') || example.snapshot.schema !== 2) continue;
      expect(example.snapshot).not.toHaveProperty('health');
      expect(validate(example.snapshot)).toBe(true);
    }
  });

  for (const { path } of timestampPaths) {
    it.each(['yesterday', '', 0, '2026-13-01T00:00:00Z', '2026-02-29T00:00:00Z',
      '2100-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-09-30T24:00:00Z',
      '2026-09-30T16:60:00Z', '2026-09-30T16:00:60Z', '2026-09-30T16:00:00+00:00'])(
      `rejects invalid ${path.join('.')}: %s`, invalid => {
        const value = healthSnapshot();
        replace(value, path, invalid);
        expect(validate(value)).toBe(false);
      });
  }
  it.each(['2024-02-29T00:00:00Z', '2000-02-29T23:59:59.123Z'])(
    'accepts calendar-valid leap timestamp %s', instant => {
      const value = healthSnapshot();
      for (const { path } of timestampPaths) replace(value, path, instant);
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    });

  for (const { path } of countPaths) {
    it.each([-1, 1.5, '1', true])(`rejects invalid ${path.join('.')}: %s`, invalid => {
      const value = healthSnapshot();
      replace(value, path, invalid);
      expect(validate(value)).toBe(false);
    });
  }
  for (const { path, value: object } of objectPaths) {
    it(`rejects unknown keys at ${path.join('.')}`, () => {
      const value = healthSnapshot();
      replace(value, path, { ...object as object, surprise: true });
      expect(validate(value)).toBe(false);
    });
    it.each(Object.keys(object as object))(`requires ${path.join('.')}.%s`, key => {
      const value = healthSnapshot();
      const replacement = { ...object as object };
      Reflect.deleteProperty(replacement, key);
      replace(value, path, replacement);
      expect(validate(value)).toBe(false);
    });
  }
  it.each([null, [], 'healthy', {}])('rejects malformed health %j', health => {
    expect(validate({ ...snapshot(), health })).toBe(false);
  });
  it('requires explanation for unavailable evidence', () => {
    const value = structuredClone(examples['health-unknown'].snapshot);
    value.health.episodes.freshness.reason = '';
    expect(validate(value)).toBe(false);
  });
  it('does not allow unavailable rows to certify healthy completeness', () => {
    const value = healthSnapshot();
    replace(value, ['health', 'episodes', 'rows'], null);
    expect(validate(value)).toBe(false);
  });
  it('requires an explanation for unknown control evidence', () => {
    const value = healthSnapshot();
    replace(value, ['health', 'overnight', 'reason'], null);
    expect(validate(value)).toBe(false);
  });
  it('preserves pending stop, unknown scope and independent source ages', () => {
    const pending = examples['health-stop-pending'].snapshot.health.overnight;
    expect(pending).toMatchObject({ desiredMode: 'stop', observedState: 'running', status: 'pending', nextCheckAt: null });
    expect(pending.affectedJobRefs).toEqual(['runner:job-7']);
    expect(examples['health-unknown'].snapshot.health.overnight).toMatchObject({ observedState: null, affectedJobRefs: null });
    const stale = examples['health-stale'].snapshot;
    expect(stale.health.daemons.rows[0].heartbeatAt).toBe(stale.observedAt);
    expect(stale.health.daemons.rows[0].completedPassAt).not.toBe(stale.observedAt);
    expect(stale.health.budgetWindows.rows[0].freshness.observedAt).not.toBe(stale.observedAt);
    expect(examples['health-conflict'].snapshot.health.overnight.observedState).toBe('controller-vNext:active');
  });
});
