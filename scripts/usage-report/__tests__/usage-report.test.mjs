import { describe, it, expect, vi } from 'vitest';
import {
  parseEnvFile, readKeychainSecret, loadSecrets,
  buildAnthropicParams, buildOpenAIParams,
  sumAnthropicUsage, sumAnthropicCost, sumOpenAIUsage, sumOpenAICost,
  extractRateLimitHeaders, daysUntilNextUtcMonth, fmtNum, fmtUsd, renderSummary,
  runUsageReportCli,
} from '../usage-report.mjs';

// Fixture data shaped EXACTLY like the real response bodies (quoted in usage-report.mjs's own header,
// captured from platform.claude.com/docs and developers.openai.com/openai's own reference this session) —
// never a live network call, per this task's own instruction.
const ANTHROPIC_USAGE_FIXTURE = {
  data: [
    {
      starting_at: '2025-08-01T00:00:00Z',
      ending_at: '2025-08-02T00:00:00Z',
      results: [
        {
          model: 'claude-opus-5', uncached_input_tokens: 1500, cache_read_input_tokens: 200, output_tokens: 500,
        },
        {
          model: 'claude-sonnet-5', uncached_input_tokens: 300, cache_read_input_tokens: 0, output_tokens: 100,
        },
      ],
    },
    { starting_at: '2025-08-02T00:00:00Z', ending_at: '2025-08-03T00:00:00Z', results: [] },
  ],
  has_more: false,
  next_page: null,
};

const ANTHROPIC_COST_FIXTURE = {
  data: [
    {
      starting_at: '2025-08-01T00:00:00Z',
      ending_at: '2025-08-02T00:00:00Z',
      results: [
        { amount: '123.78912', currency: 'USD', model: 'claude-opus-5' },
        { amount: '10.00', currency: 'USD', model: 'claude-sonnet-5' },
      ],
    },
  ],
  has_more: false,
  next_page: null,
};

const OPENAI_USAGE_FIXTURE = {
  object: 'page',
  data: [
    {
      object: 'bucket',
      start_time: 1735689600,
      end_time: 1735776000,
      results: [
        {
          object: 'organization.usage.completions.result',
          input_tokens: 1000, output_tokens: 200, input_cached_tokens: 50, num_model_requests: 4, model: 'gpt-5',
        },
      ],
    },
  ],
  has_more: false,
  next_page: null,
};

const OPENAI_COST_FIXTURE = {
  object: 'page',
  data: [
    {
      object: 'bucket',
      start_time: 1735689600,
      end_time: 1735776000,
      results: [
        { object: 'organization.costs.result', amount: { value: 0.06, currency: 'usd' }, line_item: 'gpt-5' },
        { object: 'organization.costs.result', amount: { value: 0.01, currency: 'usd' }, line_item: null },
      ],
    },
  ],
  has_more: false,
  next_page: null,
};

describe('parseEnvFile', () => {
  it('parses KEY=VALUE lines, skipping blanks and comments', () => {
    const text = '# a comment\n\nANTHROPIC_ADMIN_KEY=sk-ant-admin-abc\nOPENAI_ADMIN_KEY=sk-oai-xyz\n';
    expect(parseEnvFile(text)).toEqual({ ANTHROPIC_ADMIN_KEY: 'sk-ant-admin-abc', OPENAI_ADMIN_KEY: 'sk-oai-xyz' });
  });

  it('is tolerant of a missing/empty file', () => {
    expect(parseEnvFile('')).toEqual({});
    expect(parseEnvFile(undefined)).toEqual({});
  });

  it('ignores a line with no `=`', () => {
    expect(parseEnvFile('not-a-kv-line\nFOO=bar')).toEqual({ FOO: 'bar' });
  });
});

describe('readKeychainSecret', () => {
  it('returns null outright on a non-macOS platform, without shelling out', () => {
    const execFileSyncFn = vi.fn();
    expect(readKeychainSecret('anthropic-admin-key', { platform: 'linux', execFileSyncFn })).toBeNull();
    expect(execFileSyncFn).not.toHaveBeenCalled();
  });

  it('returns the trimmed secret on a successful macOS lookup', () => {
    const execFileSyncFn = vi.fn(() => 'sk-ant-admin-from-keychain\n');
    const v = readKeychainSecret('anthropic-admin-key', { platform: 'darwin', execFileSyncFn });
    expect(v).toBe('sk-ant-admin-from-keychain');
    expect(execFileSyncFn).toHaveBeenCalledWith('security', [
      'find-generic-password', '-s', 'we-usage-report', '-a', 'anthropic-admin-key', '-w',
    ], expect.any(Object));
  });

  it('returns null (never throws) when the item does not exist', () => {
    const execFileSyncFn = vi.fn(() => { throw new Error('security: item not found'); });
    expect(readKeychainSecret('anthropic-admin-key', { platform: 'darwin', execFileSyncFn })).toBeNull();
  });
});

describe('loadSecrets', () => {
  it('prefers an already-set env var over Keychain or the file', () => {
    const s = loadSecrets({
      env: { ANTHROPIC_ADMIN_KEY: 'from-env' },
      readKeychain: () => 'from-keychain',
      existsSyncFn: () => true,
      readFileSyncFn: () => 'ANTHROPIC_ADMIN_KEY=from-file',
    });
    expect(s.anthropicKey).toBe('from-env');
    expect(s.anthropicSource).toBe('env');
  });

  it('falls back to Keychain when no env var is set', () => {
    const s = loadSecrets({
      env: {}, readKeychain: () => 'from-keychain', existsSyncFn: () => false, readFileSyncFn: () => '',
    });
    expect(s.anthropicKey).toBe('from-keychain');
    expect(s.anthropicSource).toBe('keychain');
  });

  it('falls back to the external file when neither env nor Keychain has it', () => {
    const s = loadSecrets({
      env: {}, readKeychain: () => null, existsSyncFn: () => true,
      readFileSyncFn: () => 'ANTHROPIC_ADMIN_KEY=from-file\nOPENAI_ADMIN_KEY=also-from-file',
    });
    expect(s.anthropicKey).toBe('from-file');
    expect(s.anthropicSource).toBe('file');
    expect(s.openaiKey).toBe('also-from-file');
  });

  it('reports null/null when no source has it anywhere', () => {
    const s = loadSecrets({ env: {}, readKeychain: () => null, existsSyncFn: () => false, readFileSyncFn: () => '' });
    expect(s.anthropicKey).toBeNull();
    expect(s.anthropicSource).toBeNull();
    expect(s.openaiKey).toBeNull();
  });
});

describe('buildAnthropicParams / buildOpenAIParams', () => {
  it('builds the Anthropic query string with RFC 3339 timestamps and repeated group_by[]', () => {
    const p = buildAnthropicParams({
      startingAt: '2026-09-01T00:00:00.000Z', endingAt: '2026-09-02T00:00:00.000Z', bucketWidth: '1h', groupBy: ['model'],
    });
    expect(p.get('starting_at')).toBe('2026-09-01T00:00:00.000Z');
    expect(p.get('bucket_width')).toBe('1h');
    expect(p.getAll('group_by[]')).toEqual(['model']);
  });

  it('builds the OpenAI query string with unix-second start/end times', () => {
    const p = buildOpenAIParams({ startTime: 1735689600, endTime: 1735776000, bucketWidth: '1d' });
    expect(p.get('start_time')).toBe('1735689600');
    expect(p.get('end_time')).toBe('1735776000');
    expect(p.get('bucket_width')).toBe('1d');
  });
});

describe('sumAnthropicUsage', () => {
  it('sums input/output/cache-read tokens per model and overall, from the real fixture shape', () => {
    const s = sumAnthropicUsage(ANTHROPIC_USAGE_FIXTURE);
    expect(s.totalInputTokens).toBe(1800);
    expect(s.totalOutputTokens).toBe(600);
    expect(s.totalCacheReadTokens).toBe(200);
    expect(s.byModel['claude-opus-5']).toEqual({ inputTokens: 1500, outputTokens: 500, cacheReadTokens: 200 });
    expect(s.byModel['claude-sonnet-5']).toEqual({ inputTokens: 300, outputTokens: 100, cacheReadTokens: 0 });
  });

  it('folds a null (ungrouped) model under one bucket rather than dropping it', () => {
    const s = sumAnthropicUsage({ data: [{ results: [{ model: null, uncached_input_tokens: 10, output_tokens: 5 }] }] });
    expect(s.byModel['(ungrouped)']).toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 0 });
  });

  it('is tolerant of an empty/missing report', () => {
    expect(sumAnthropicUsage({})).toEqual({ totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, byModel: {} });
    expect(sumAnthropicUsage(null)).toEqual({ totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, byModel: {} });
  });
});

describe('sumAnthropicCost', () => {
  it('converts the cents-string `amount` to USD (the API reference\'s own worked example: "123.45" ⇒ $1.23)', () => {
    const s = sumAnthropicCost(ANTHROPIC_COST_FIXTURE);
    expect(s.totalUsd).toBeCloseTo(1.3378912, 6);
    expect(s.byModel['claude-opus-5']).toBeCloseTo(1.2378912, 6);
    expect(s.byModel['claude-sonnet-5']).toBeCloseTo(0.1, 6);
  });
});

describe('sumOpenAIUsage', () => {
  it('sums tokens and request counts from the real fixture shape', () => {
    const s = sumOpenAIUsage(OPENAI_USAGE_FIXTURE);
    expect(s.totalInputTokens).toBe(1000);
    expect(s.totalOutputTokens).toBe(200);
    expect(s.totalCachedTokens).toBe(50);
    expect(s.totalRequests).toBe(4);
    expect(s.byModel['gpt-5'].requests).toBe(4);
  });
});

describe('sumOpenAICost', () => {
  it('sums the already-whole-unit `amount.value` (no /100 — unlike Anthropic\'s cents string)', () => {
    const s = sumOpenAICost(OPENAI_COST_FIXTURE);
    expect(s.totalUsd).toBeCloseTo(0.07, 6);
    expect(s.byLineItem['gpt-5']).toBeCloseTo(0.06, 6);
    expect(s.byLineItem['(ungrouped)']).toBeCloseTo(0.01, 6);
  });
});

describe('extractRateLimitHeaders', () => {
  it('keeps only headers matching a given prefix list', () => {
    const headers = { 'anthropic-ratelimit-tokens-remaining': '99000', 'content-type': 'application/json', 'retry-after': '5' };
    expect(extractRateLimitHeaders(headers, ['anthropic-ratelimit-', 'retry-after'])).toEqual({
      'anthropic-ratelimit-tokens-remaining': '99000', 'retry-after': '5',
    });
  });

  it('returns an empty object when none match (the honest, expected case for a metadata GET)', () => {
    expect(extractRateLimitHeaders({ 'content-type': 'application/json' }, ['x-ratelimit-'])).toEqual({});
  });
});

describe('daysUntilNextUtcMonth', () => {
  it('computes the fixed UTC-calendar-month boundary Anthropic\'s spend cap resets on', () => {
    const r = daysUntilNextUtcMonth(new Date('2026-09-13T12:00:00Z'));
    expect(r.resetsAt).toBe('2026-10-01T00:00:00.000Z');
    expect(r.days).toBe(17);
  });
});

describe('fmtNum / fmtUsd', () => {
  it('formats large numbers with thousands separators, and USD to two decimals', () => {
    expect(fmtNum(1234567)).toBe('1,234,567');
    expect(fmtUsd(1.2378912)).toBe('$1.24');
    expect(fmtNum(NaN)).toBe('—');
  });
});

describe('renderSummary', () => {
  it('renders a "no key configured" line for a provider with no admin key', () => {
    const text = renderSummary({
      generatedAt: '2026-09-13T12:00:00.000Z',
      anthropic: { keyConfigured: false },
      openai: { keyConfigured: false },
    });
    expect(text).toContain('ANTHROPIC_ADMIN_KEY');
    expect(text).toContain('OPENAI_ADMIN_KEY');
  });

  it('renders usage/cost totals and an explicit "(none — expected)" line when no rate-limit headers came back', () => {
    const text = renderSummary({
      generatedAt: '2026-09-13T12:00:00.000Z',
      anthropic: {
        keyConfigured: true, keySource: 'keychain',
        usage: sumAnthropicUsage(ANTHROPIC_USAGE_FIXTURE), cost: sumAnthropicCost(ANTHROPIC_COST_FIXTURE),
        rateLimitHeaders: {},
      },
      openai: { keyConfigured: false },
    });
    expect(text).toContain('admin key source: keychain');
    expect(text).toContain('claude-opus-5');
    expect(text).toContain('(none — expected; these are metadata GETs, not inference calls)');
  });
});

describe('runUsageReportCli', () => {
  const fakeFetch = (bodies) => vi.fn(async (url) => {
    const key = String(url).includes('cost') ? 'cost' : 'usage';
    const provider = String(url).includes('api.anthropic.com') ? 'anthropic' : 'openai';
    return {
      ok: true,
      status: 200,
      headers: { forEach: (fn) => fn('99000', 'anthropic-ratelimit-tokens-remaining') },
      json: async () => bodies[provider][key],
    };
  });

  it('emits JSON with --json, using an injected fetch and a fixed clock — no real network', async () => {
    const bodies = {
      anthropic: { usage: ANTHROPIC_USAGE_FIXTURE, cost: ANTHROPIC_COST_FIXTURE },
      openai: { usage: OPENAI_USAGE_FIXTURE, cost: OPENAI_COST_FIXTURE },
    };
    let captured = '';
    const code = await runUsageReportCli(['--json'], {
      loadSecretsFn: () => ({ anthropicKey: 'sk-ant-admin-x', anthropicSource: 'env', openaiKey: 'sk-oai-y', openaiSource: 'env' }),
      fetchFn: fakeFetch(bodies),
      now: () => new Date('2026-09-13T12:00:00Z'),
      out: (s) => { captured = s; },
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(captured);
    expect(parsed.anthropic.usage.totalInputTokens).toBe(1800);
    expect(parsed.openai.cost.totalUsd).toBeCloseTo(0.07, 6);
  });

  it('reports a per-provider HTTP error without throwing, when a fetch resolves non-ok', async () => {
    const badFetch = vi.fn(async () => ({
      ok: false, status: 401, headers: { forEach: () => {} }, json: async () => ({ error: { message: 'invalid x-api-key' } }),
    }));
    let captured = '';
    const code = await runUsageReportCli(['--json'], {
      loadSecretsFn: () => ({ anthropicKey: 'bad-key', anthropicSource: 'env', openaiKey: null, openaiSource: null }),
      fetchFn: badFetch,
      now: () => new Date('2026-09-13T12:00:00Z'),
      out: (s) => { captured = s; },
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(captured);
    expect(parsed.anthropic.usageError).toMatch(/401/);
    expect(parsed.openai.keyConfigured).toBe(false);
  });

  it('prints usage text mentioning --help without touching fetch at all', async () => {
    let captured = '';
    const fetchFn = vi.fn();
    const code = await runUsageReportCli(['--help'], { fetchFn, out: (s) => { captured = s; } });
    expect(code).toBe(0);
    expect(captured).toContain('usage: usage-report.mjs');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
