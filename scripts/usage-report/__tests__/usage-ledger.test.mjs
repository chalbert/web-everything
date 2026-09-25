import { describe, it, expect } from 'vitest';
import {
  previousWeeklyRenewalUtc, sumClaudeOtelUsage, sumProviderTokenTelemetry, buildUsageLedger, renderLedgerSummary,
  ANTHROPIC_RENEWAL, OPENAI_RENEWAL,
} from '../usage-report.mjs';

// ── previousWeeklyRenewalUtc — mirrors usage-report.test.mjs's own nextWeeklyRenewalUtc fixtures/dates, one
// cadence step earlier, so the two DST-boundary claims stay directly comparable. ─────────────────────────
describe('previousWeeklyRenewalUtc — "how long ago did the current cycle start," DST-aware', () => {
  it('finds the prior Friday 16:00 America/New_York from an ordinary mid-week instant (EDT, no DST crossing)', () => {
    // Sunday 2026-09-13 12:00 UTC = 08:00 EDT. The prior Friday is 2026-09-11, still EDT (UTC-4).
    const now = new Date('2026-09-13T12:00:00Z');
    const target = previousWeeklyRenewalUtc(now, ANTHROPIC_RENEWAL);
    expect(target.toISOString()).toBe('2026-09-11T20:00:00.000Z');
  });

  it('uses LAST week\'s occurrence when today IS the renewal weekday but the time has not yet passed', () => {
    // Friday 2026-09-18 19:00 UTC = 15:00 EDT — before today's 16:00 renewal, so the CURRENT cycle started
    // the PRIOR Friday, not today.
    const now = new Date('2026-09-18T19:00:00Z');
    const target = previousWeeklyRenewalUtc(now, ANTHROPIC_RENEWAL);
    expect(target.toISOString()).toBe('2026-09-11T20:00:00.000Z');
  });

  it('uses TODAY\'s own occurrence when the renewal weekday has arrived and the time has already passed', () => {
    // Friday 2026-09-18 21:00 UTC = 17:00 EDT — an hour past today's 16:00 renewal.
    const now = new Date('2026-09-18T21:00:00Z');
    const target = previousWeeklyRenewalUtc(now, ANTHROPIC_RENEWAL);
    expect(target.toISOString()).toBe('2026-09-18T20:00:00.000Z');
  });

  it('DST BOUNDARY: a "now" just after spring-forward resolves the PRIOR week\'s occurrence (before the ' +
    'transition) in EST, not in "now"\'s own EDT offset', () => {
    // Monday 2026-03-09 12:00 UTC is already EDT (the 2026-03-08 02:00->03:00 transition already happened).
    // The prior Friday is 2026-03-06 — BEFORE the transition, so it must resolve in EST (UTC-5): 16:00 EST =
    // 21:00 UTC. A bug that reused "now"'s EDT offset would produce 20:00 UTC instead — a full hour off.
    const now = new Date('2026-03-09T12:00:00Z');
    const target = previousWeeklyRenewalUtc(now, ANTHROPIC_RENEWAL);
    expect(target.toISOString()).toBe('2026-03-06T21:00:00.000Z');
  });

  it('DST BOUNDARY: OpenAI\'s Saturday renewal resolves the same way straddling the same transition', () => {
    // Sunday 2026-03-15 12:00 UTC = EDT. Prior Saturday is 2026-03-14 — AFTER the transition, so EDT
    // (09:02 EDT = 13:02 UTC).
    const now = new Date('2026-03-15T12:00:00Z');
    const target = previousWeeklyRenewalUtc(now, OPENAI_RENEWAL);
    expect(target.toISOString()).toBe('2026-03-14T13:02:00.000Z');
  });

  it('throws on a dayOfWeek that is not a real weekday name', () => {
    expect(() => previousWeeklyRenewalUtc(new Date('2026-09-13T12:00:00Z'), { dayOfWeek: 'Fridayy', time: '16:00', timezone: 'America/New_York' }))
      .toThrow(/not a weekday name/);
  });
});

// ── sumClaudeOtelUsage — the Anthropic (Claude) side, from claude-otel-collector.mjs's own store shape ────
describe('sumClaudeOtelUsage', () => {
  const WINDOW = { sinceIso: '2026-09-11T00:00:00.000Z', untilIso: '2026-09-13T00:00:00.000Z' };

  it('sums token.usage by type and cost.usage by model, within the window, from the real OTLP-derived store shape', () => {
    const events = [
      { v: 1, receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', unit: 'tokens', value: 1000, attributes: { type: 'input', model: 'claude-sonnet-4-6' } },
      { v: 1, receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', unit: 'tokens', value: 200, attributes: { type: 'output', model: 'claude-sonnet-4-6' } },
      { v: 1, receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.cost.usage', unit: 'USD', value: 0.05, attributes: { model: 'claude-sonnet-4-6' } },
      // OUTSIDE the window — must be excluded from every total.
      { v: 1, receivedAt: '2026-09-01T00:00:00.000Z', name: 'claude_code.token.usage', unit: 'tokens', value: 9999, attributes: { type: 'input', model: 'claude-opus-4-8' } },
    ];
    const out = sumClaudeOtelUsage(events, WINDOW);
    expect(out.totalsByType).toEqual({ input: 1000, output: 200, cacheRead: 0, cacheCreation: 0 });
    expect(out.totalUsd).toBeCloseTo(0.05, 10);
    expect(Object.keys(out.byModel)).toEqual(['claude-sonnet-4-6']);
    expect(out.byModel['claude-sonnet-4-6'].input).toBe(1000);
    expect(out.byModel['claude-sonnet-4-6'].output).toBe(200);
    expect(out.byModel['claude-sonnet-4-6'].usd).toBeCloseTo(0.05, 10);
    // cost-rates.mjs cross-check: sonnet rates are in:3/out:15 per Mtok — (1000/1e6)*3 + (200/1e6)*15 = 0.006.
    expect(out.byModel['claude-sonnet-4-6'].estimatedUsd).toBeCloseTo(0.006, 10);
  });

  it('is tolerant of an empty/missing event list', () => {
    const out = sumClaudeOtelUsage([], WINDOW);
    expect(out.totalsByType).toEqual({ input: 0, output: 0, cacheRead: 0, cacheCreation: 0 });
    expect(out.totalUsd).toBe(0);
    expect(out.byModel).toEqual({});
  });

  it('folds a missing model under "(unknown)" rather than dropping the sample', () => {
    const out = sumClaudeOtelUsage([
      { receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', value: 42, attributes: { type: 'input' } },
    ], WINDOW);
    expect(out.totalsByType.input).toBe(42);
    expect(out.byModel['(unknown)'].input).toBe(42);
  });
});

// ── sumProviderTokenTelemetry — the OpenAI (Codex) side, from telemetry-store.mjs's own metric event shape ─
describe('sumProviderTokenTelemetry', () => {
  const WINDOW = { sinceIso: '2026-09-11T00:00:00.000Z', untilIso: '2026-09-13T00:00:00.000Z', provider: 'codex' };

  it('sums dispatch.tokens.* metrics for the given provider, within the window', () => {
    const events = [
      { event: 'metric', name: 'dispatch.tokens.input', value: 500, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
      { event: 'metric', name: 'dispatch.tokens.output', value: 100, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
      { event: 'metric', name: 'dispatch.tokens.cache_read', value: 20, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
      // A different provider's own tokens — must never be counted into Codex's total (Claude is tracked via
      // the OTEL path instead; this metric family would only ever carry `provider: 'claude'` in a bug).
      { event: 'metric', name: 'dispatch.tokens.input', value: 777, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'claude', model: 'claude-sonnet-4-6' } },
      // A non-metric event (a span) sharing this store — must be ignored, not just zero-valued.
      { event: 'span.end', name: 'agent.turn', traceId: 'i1', spanId: 'a', startedAt: '2026-09-12T00:00:00.000Z', endedAt: '2026-09-12T00:01:00.000Z', status: 'ok', kind: 'fix' },
      // Outside the window.
      { event: 'metric', name: 'dispatch.tokens.input', value: 9999, timestamp: '2026-09-01T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
    ];
    const out = sumProviderTokenTelemetry(events, WINDOW);
    expect(out.totalsByType).toEqual({ input: 500, output: 100, cacheRead: 20, cacheWrite: 0 });
    expect(out.byModel['gpt-6-astra']).toEqual({ input: 500, output: 100, cacheRead: 20, cacheWrite: 0, estimatedUsd: null });
  });

  it('reports estimatedUsd as null (never 0) for a model cost-rates.mjs has no row for — the "not available" convention', () => {
    const out = sumProviderTokenTelemetry([
      { event: 'metric', name: 'dispatch.tokens.input', value: 1000, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
    ], WINDOW);
    expect(out.byModel['gpt-6-astra'].estimatedUsd).toBeNull();
  });

  it('DOES price a Claude-family model name via cost-rates.mjs when one somehow appears under this provider tag', () => {
    // Not a realistic Codex model, but proves the cross-check math itself (rather than always hitting the
    // null branch) without inventing a second code path just for the test.
    const out = sumProviderTokenTelemetry([
      { event: 'metric', name: 'dispatch.tokens.input', value: 1_000_000, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'claude-haiku-4-5' } },
    ], WINDOW);
    expect(out.byModel['claude-haiku-4-5'].estimatedUsd).toBeCloseTo(1, 10); // haiku: $1/Mtok input
  });

  it('is tolerant of an empty/missing event list', () => {
    const out = sumProviderTokenTelemetry([], WINDOW);
    expect(out.totalsByType).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(out.byModel).toEqual({});
  });
});

// ── buildUsageLedger / renderLedgerSummary — the assembled two-provider report ─────────────────────────────
describe('buildUsageLedger', () => {
  it('windows each provider by its OWN renewal boundary and sums only events inside it', () => {
    const now = new Date('2026-09-13T12:00:00Z'); // see previousWeeklyRenewalUtc's own first fixture above
    const claudeOtelEvents = [
      // inside the Anthropic window (since 2026-09-11T20:00:00.000Z)
      { receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', value: 10, attributes: { type: 'input', model: 'claude-sonnet-4-6' } },
      // before the Anthropic window boundary — excluded
      { receivedAt: '2026-09-11T00:00:00.000Z', name: 'claude_code.token.usage', value: 999, attributes: { type: 'input', model: 'claude-sonnet-4-6' } },
    ];
    const codexTelemetryEvents = [
      // inside the OpenAI window (since 2026-09-12T13:02:00.000Z)
      { event: 'metric', name: 'dispatch.tokens.output', value: 5, timestamp: '2026-09-13T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
      // before the OpenAI window boundary — excluded
      { event: 'metric', name: 'dispatch.tokens.output', value: 999, timestamp: '2026-09-12T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
    ];
    const ledger = buildUsageLedger({ now, claudeOtelEvents, codexTelemetryEvents });
    expect(ledger.anthropic.windowStart).toBe('2026-09-11T20:00:00.000Z');
    expect(ledger.anthropic.usage.totalsByType.input).toBe(10);
    expect(ledger.openai.windowStart).toBe('2026-09-12T13:02:00.000Z');
    expect(ledger.openai.usage.totalsByType.output).toBe(5);
  });
});

describe('renderLedgerSummary', () => {
  it('labels the whole report a self-tracked estimate, never an official figure, and shows the cost-rates cross-check', () => {
    const ledger = buildUsageLedger({
      now: new Date('2026-09-13T12:00:00Z'),
      claudeOtelEvents: [
        { receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.token.usage', value: 1000, attributes: { type: 'input', model: 'claude-sonnet-4-6' } },
        { receivedAt: '2026-09-12T00:00:00.000Z', name: 'claude_code.cost.usage', value: 0.05, attributes: { model: 'claude-sonnet-4-6' } },
      ],
      codexTelemetryEvents: [
        { event: 'metric', name: 'dispatch.tokens.input', value: 500, timestamp: '2026-09-13T00:00:00.000Z', attributes: { provider: 'codex', model: 'gpt-6-astra' } },
      ],
    });
    const text = renderLedgerSummary(ledger);
    expect(text).toMatch(/self-tracked estimate/i);
    expect(text).toMatch(/NOT an official provider-reported figure/);
    expect(text).toMatch(/claude-sonnet-4-6/);
    expect(text).toMatch(/cost-rates\.mjs cross-check/);
    expect(text).toMatch(/gpt-6-astra/);
    expect(text).toMatch(/not available \(no cost-rates\.mjs row for this model\)/);
  });

  it('says plainly when no Codex dispatches were recorded this cycle', () => {
    const ledger = buildUsageLedger({ now: new Date('2026-09-13T12:00:00Z'), claudeOtelEvents: [], codexTelemetryEvents: [] });
    const text = renderLedgerSummary(ledger);
    expect(text).toMatch(/no Codex dispatches recorded this cycle/);
  });
});
