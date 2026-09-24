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
  API_EVENT_FIELDS, errorTypeOf, parseOtlpApiEvents, summarizeApiEvents, runClaudeOtelCollectorCli,
} from '../claude-otel-collector.mjs';

const kv = (key, v) => ({ key, value: typeof v === 'number' ? (Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }) : { stringValue: v } });
/** A logs export as Claude Code sends it: two API events, and content-bearing events and attributes that must never be kept. */
const LOGS = { resourceLogs: [{
  resource: { attributes: [kv('service.name', 'claude-code'), kv('session.id', 's-1'), kv('user.email', 'someone@example.com'), kv('user.account_uuid', 'acct')] },
  scopeLogs: [{ logRecords: [
    { body: { stringValue: 'claude_code.api_request' }, attributes: [kv('event.name', 'api_request'), kv('event.timestamp', '2026-09-23T19:10:00.000Z'), kv('model', 'claude-opus-5-5'), kv('duration_ms', 4200), kv('input_tokens', 10), kv('output_tokens', 20), kv('cost_usd', 0.01), kv('prompt', 'SECRET PROMPT')] },
    { body: { stringValue: 'claude_code.api_error' }, attributes: [kv('event.name', 'api_error'), kv('event.timestamp', '2026-09-23T19:20:00.000Z'), kv('model', 'claude-opus-5-5'), kv('status_code', 429), kv('attempt', 2), kv('duration_ms', 300), kv('error', 'rate_limit_error: Number of request tokens has exceeded your per-minute rate limit (request id req_abc)')] },
    { body: { stringValue: 'claude_code.user_prompt' }, attributes: [kv('event.name', 'user_prompt'), kv('prompt', 'SECRET PROMPT'), kv('prompt_length', 13)] },
    { body: { stringValue: 'claude_code.tool_result' }, attributes: [kv('event.name', 'tool_result'), kv('tool_parameters', '{"command":"cat ~/.ssh/id_rsa"}')] },
  ] }],
}] };

describe('parseOtlpApiEvents — allowlisted API events only (#3383 capacity audit 2026-09-23)', () => {
  const recs = parseOtlpApiEvents(LOGS, '2026-09-23T20:00:00.000Z');
  it('keeps exactly the api_request and api_error events', () => {
    expect(recs.map((r) => r.name)).toEqual(['claude_code.api_request', 'claude_code.api_error']);
  });
  it('keeps only allowlisted fields: no prompt, no tool input, no identity', () => {
    for (const r of recs) for (const k of Object.keys(r.attributes)) expect(API_EVENT_FIELDS).toContain(k);
    const text = JSON.stringify(recs);
    for (const leak of ['SECRET PROMPT', 'id_rsa', 'someone@example.com', 'acct', 'req_abc']) expect(text).not.toContain(leak);
    expect(recs[0].attributes).toEqual({ 'event.timestamp': '2026-09-23T19:10:00.000Z', 'session.id': 's-1', model: 'claude-opus-5-5', duration_ms: 4200, input_tokens: 10, output_tokens: 20, cost_usd: 0.01 });
    expect(recs[1].attributes).toMatchObject({ status_code: 429, attempt: 2, error_type: 'rate_limit_error' });
  });
  it('reduces an error message to its type', () => {
    expect(errorTypeOf('overloaded_error: Overloaded')).toBe('overloaded_error');
    expect(errorTypeOf('socket hang up')).toBe('other');
    expect(errorTypeOf(undefined)).toBeNull();
  });
  it('tolerates junk', () => {
    expect(parseOtlpApiEvents(undefined, 'x')).toEqual([]);
    expect(parseOtlpApiEvents({ resourceLogs: [{ scopeLogs: [{ logRecords: [null, {}] }] }] }, 'x')).toEqual([]);
  });
  it('rolls up per hour: requests, p50/p90 duration, errors with 429 and 529 named', () => {
    expect(summarizeApiEvents(recs)).toEqual([{ hour: '2026-09-23T19', requests: 1, errors: 1, rateLimited: 1, overloaded: 0, errorTypes: { rate_limit_error: 1 }, durationP50Ms: 4200, durationP90Ms: 4200 }]);
  });
  it('the api-report CLI prints the rollup from the event store', async () => {
    const apiStore = createMemoryOtelStore();
    for (const r of recs) apiStore.append(r);
    let text = '';
    await runClaudeOtelCollectorCli(['api-report', '--hours=24'], { out: (s) => { text += s; }, apiStore, nowMs: Date.parse('2026-09-23T20:00:00.000Z') });
    expect(text).toContain('2026-09-23T19:00Z  1 req  p50 4200 ms');
    expect(text).toContain('errors 1 (429: 1, 529: 0)');
  });
});

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

  it('answers 200 on /v1/logs and keeps only allowlisted API events, never in the metric store', async () => {
    const store = createMemoryOtelStore(); const apiStore = createMemoryOtelStore();
    const { port, close } = await startOtelCollectorServer({ port: 0, store, apiStore, now: () => new Date('2026-09-23T20:00:00.000Z'), log: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/v1/logs`, { method: 'POST', body: JSON.stringify(LOGS) });
      expect(res.status).toBe(200);
      expect(store.readAll()).toEqual([]);
      expect(apiStore.readAll().map((r) => r.name)).toEqual(['claude_code.api_request', 'claude_code.api_error']);
      const junk = await fetch(`http://localhost:${port}/v1/logs`, { method: 'POST', body: JSON.stringify({ resourceLogs: [{ x: 1 }] }) });
      expect(junk.status).toBe(200);
      expect(apiStore.readAll()).toHaveLength(2);
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
