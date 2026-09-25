/**
 * @file scripts/operations/__tests__/claude-otel-collector.test.mjs
 * @description Coverage for the pure OTLP/HTTP-JSON parsing core of `claude-otel-collector.mjs` (#3383
 * usage-ledger follow-up), plus a real round-trip through the actual `node:http` server on an ephemeral port
 * — no mocked transport for that one, since the whole point of this file is "does a real POST body get
 * parsed and stored," and `node:http`/`fetch` are both already real in this test runtime.
 */
import { describe, it, expect } from 'vitest';
import { rmSync } from 'node:fs';
import {
  parseOtlpAttributes, parseOtlpMetricsExport, otelSampleToRecord, claudeOtelDayKey,
  createMemoryOtelStore, createFileOtelStore, startOtelCollectorServer,
} from '../claude-otel-collector.mjs';

describe('parseOtlpAttributes', () => {
  it('reads stringValue/intValue/doubleValue/boolValue, skipping empty/unkeyed entries', () => {
    const out = parseOtlpAttributes([
      { key: 'model', value: { stringValue: 'claude-sonnet-4-6' } },
      { key: 'count', value: { intValue: '42' } }, // OTLP/JSON encodes int64 AS A STRING
      { key: 'ratio', value: { doubleValue: 0.5 } },
      { key: 'flag', value: { boolValue: true } },
      { value: { stringValue: 'no key, skipped' } },
    ]);
    expect(out).toEqual({ model: 'claude-sonnet-4-6', count: 42, ratio: 0.5, flag: true });
  });

  it('is tolerant of a missing/non-array input', () => {
    expect(parseOtlpAttributes(undefined)).toEqual({});
    expect(parseOtlpAttributes(null)).toEqual({});
  });
});

describe('parseOtlpMetricsExport', () => {
  it('flattens a real-shaped ExportMetricsServiceRequest body into one sample per data point, merging resource + point attributes', () => {
    const body = {
      resourceMetrics: [{
        resource: { attributes: [{ key: 'session.id', value: { stringValue: 'sess-1' } }] },
        scopeMetrics: [{
          metrics: [
            {
              name: 'claude_code.token.usage', unit: 'tokens',
              sum: { dataPoints: [{ attributes: [{ key: 'type', value: { stringValue: 'input' } }, { key: 'model', value: { stringValue: 'claude-sonnet-4-6' } }], asInt: '123', timeUnixNano: '1700000000000000000' }] },
            },
            {
              name: 'claude_code.cost.usage', unit: 'USD',
              sum: { dataPoints: [{ attributes: [{ key: 'model', value: { stringValue: 'claude-sonnet-4-6' } }], asDouble: 0.045 }] },
            },
          ],
        }],
      }],
    };
    const out = parseOtlpMetricsExport(body);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'claude_code.token.usage', unit: 'tokens', value: 123, attributes: { 'session.id': 'sess-1', type: 'input', model: 'claude-sonnet-4-6' } });
    expect(out[1]).toMatchObject({ name: 'claude_code.cost.usage', unit: 'USD', value: 0.045, attributes: { 'session.id': 'sess-1', model: 'claude-sonnet-4-6' } });
  });

  it('reads gauge data points the same way as sum', () => {
    const body = {
      resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'claude_code.session.count', gauge: { dataPoints: [{ attributes: [], asInt: '1' }] } }] }] }],
    };
    expect(parseOtlpMetricsExport(body)).toEqual([{ name: 'claude_code.session.count', unit: '', value: 1, timeUnixNano: null, attributes: {} }]);
  });

  it('drops any metric NOT namespaced claude_code. — this receiver exists for exactly one exporter', () => {
    const body = {
      resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'some.other.metric', sum: { dataPoints: [{ asInt: '1' }] } }] }] }],
    };
    expect(parseOtlpMetricsExport(body)).toEqual([]);
  });

  it('is tolerant of a missing/malformed body shape at every level, never throwing', () => {
    expect(parseOtlpMetricsExport({})).toEqual([]);
    expect(parseOtlpMetricsExport(null)).toEqual([]);
    expect(parseOtlpMetricsExport({ resourceMetrics: [{}] })).toEqual([]);
    expect(parseOtlpMetricsExport({ resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'claude_code.x' }] }] }] })).toEqual([]);
  });
});

describe('otelSampleToRecord', () => {
  it('adds the receivedAt stamp and keeps the rest as-is', () => {
    const rec = otelSampleToRecord({ name: 'claude_code.token.usage', unit: 'tokens', value: 10, attributes: { model: 'x' } }, '2026-09-12T00:00:00.000Z');
    expect(rec).toEqual({ v: 1, receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', unit: 'tokens', value: 10, attributes: { model: 'x' } });
  });
});

describe('claudeOtelDayKey', () => {
  it('takes the UTC calendar day of an ISO instant', () => {
    expect(claudeOtelDayKey('2026-09-12T23:59:59.999Z')).toBe('2026-09-12');
  });
});

describe('createMemoryOtelStore', () => {
  it('round-trips records by day, sorted', () => {
    const store = createMemoryOtelStore();
    store.append(otelSampleToRecord({ name: 'claude_code.token.usage', unit: 'tokens', value: 1, attributes: {} }, '2026-09-11T00:00:00.000Z'));
    store.append(otelSampleToRecord({ name: 'claude_code.token.usage', unit: 'tokens', value: 2, attributes: {} }, '2026-09-12T00:00:00.000Z'));
    expect(store.days()).toEqual(['2026-09-11', '2026-09-12']);
    expect(store.readAll()).toHaveLength(2);
    expect(store.readDay('2026-09-11')).toHaveLength(1);
  });
});

describe('createFileOtelStore', () => {
  it('honors OPERATION_CLAUDE_OTEL_DIR-style explicit dir override and round-trips through real disk', () => {
    const dir = `/tmp/we-claude-otel-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const store = createFileOtelStore({ dir });
    try {
      store.append(otelSampleToRecord({ name: 'claude_code.cost.usage', unit: 'USD', value: 0.1, attributes: { model: 'x' } }, '2026-09-12T00:00:00.000Z'));
      expect(store.days()).toEqual(['2026-09-12']);
      const all = store.readAll();
      expect(all).toHaveLength(1);
      expect(all[0].value).toBe(0.1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads a missing day/dir as empty, never throwing', () => {
    const store = createFileOtelStore({ dir: '/tmp/we-claude-otel-does-not-exist-at-all' });
    expect(store.days()).toEqual([]);
    expect(store.readDay('2026-01-01')).toEqual([]);
    expect(store.readAll()).toEqual([]);
  });
});

describe('startOtelCollectorServer — real HTTP round trip on an ephemeral port', () => {
  it('accepts a real OTLP/HTTP-JSON POST to /v1/metrics and persists the claude_code.* samples', async () => {
    const store = createMemoryOtelStore();
    const { port, close } = await startOtelCollectorServer({ port: 0, store, now: () => new Date('2026-09-12T00:00:00.000Z'), log: () => {} });
    try {
      const body = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{ metrics: [{ name: 'claude_code.token.usage', unit: 'tokens', sum: { dataPoints: [{ attributes: [{ key: 'type', value: { stringValue: 'input' } }], asInt: '7' }] } }] }],
        }],
      };
      const res = await fetch(`http://localhost:${port}/v1/metrics`, { method: 'POST', body: JSON.stringify(body) });
      expect(res.status).toBe(200);
      const all = store.readAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ name: 'claude_code.token.usage', value: 7 });
    } finally { await close(); }
  });

  it('answers 200 on /v1/logs without persisting anything (logs are dropped, never stored)', async () => {
    const store = createMemoryOtelStore();
    const { port, close } = await startOtelCollectorServer({ port: 0, store, log: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/v1/logs`, { method: 'POST', body: JSON.stringify({ resourceLogs: [{ x: 1 }] }) });
      expect(res.status).toBe(200);
      expect(store.readAll()).toEqual([]);
    } finally { await close(); }
  });

  it('never throws on a malformed body — answers 200 and records nothing', async () => {
    const store = createMemoryOtelStore();
    const { port, close } = await startOtelCollectorServer({ port: 0, store, log: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/v1/metrics`, { method: 'POST', body: 'not json at all' });
      expect(res.status).toBe(200);
      expect(store.readAll()).toEqual([]);
    } finally { await close(); }
  });

  it('404s any other path', async () => {
    const { port, close } = await startOtelCollectorServer({ port: 0, log: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/nope`);
      expect(res.status).toBe(404);
    } finally { await close(); }
  });
});
