// Tests for the interim reference vision provider (backlog #485). Proves the request the provider
// builds and the verdict it derives — without the @anthropic-ai/sdk dependency, a network call, or a
// key — by exercising the pure buildVisionRequest / mapVisionResponse functions. Importing the module
// also self-registers the `anthropic` provider into the seam registry, which we assert.

import { describe, it, expect } from 'vitest';
import { listVisionProviders, getVisionProvider, VERDICTS } from '../../vision.mjs';
import { buildVisionRequest, mapVisionResponse, VERDICT_SCHEMA, DEFAULT_MODEL } from '../anthropic-vision.mjs';

describe('provider registration (no-leakage seam)', () => {
  it('self-registers as the `anthropic` provider on import', () => {
    expect(listVisionProviders()).toContain('anthropic');
    expect(typeof getVisionProvider('anthropic').classifyCandidate).toBe('function');
  });
});

describe('buildVisionRequest (vision base64 message format)', () => {
  const input = { url: 'https://app.example.com/dashboard', pngBase64: 'BASE64PNG', dims: { width: 1440, height: 900 }, selectorState: 'confirmed' };

  it('puts the base64 PNG in an image block followed by the text instruction', () => {
    const req = buildVisionRequest(input);
    const [img, txt] = req.messages[0].content;
    expect(img).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'BASE64PNG' } });
    expect(txt.type).toBe('text');
    expect(txt.text).toContain('https://app.example.com/dashboard');
  });

  it('requests structured JSON output constrained to the verdict taxonomy', () => {
    const req = buildVisionRequest(input);
    expect(req.output_config.format).toEqual({ type: 'json_schema', schema: VERDICT_SCHEMA });
    expect(VERDICT_SCHEMA.properties.verdict.enum).toEqual([...VERDICTS]);
    expect(VERDICT_SCHEMA.additionalProperties).toBe(false);
    expect(req.output_config.effort).toBe('low'); // cheap gate
  });

  it('defaults to claude-opus-4-8 and honours an explicit model override', () => {
    expect(buildVisionRequest(input).model).toBe(DEFAULT_MODEL);
    expect(buildVisionRequest(input).model).toBe('claude-opus-4-8');
    expect(buildVisionRequest(input, 'claude-haiku-4-5').model).toBe('claude-haiku-4-5');
  });
});

describe('mapVisionResponse', () => {
  const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

  it('reads the structured verdict + reasons from the text block', () => {
    expect(mapVisionResponse(ok({ verdict: 'app', reasons: ['toolbar + canvas visible'] })))
      .toEqual({ verdict: 'app', reasons: ['toolbar + canvas visible'] });
  });

  it('normalises an unknown verdict to the safe quarantine side', () => {
    expect(mapVisionResponse(ok({ verdict: 'splash', reasons: [] })).verdict).toBe('non-app');
  });

  it('treats a model refusal as non-app rather than throwing', () => {
    expect(mapVisionResponse({ stop_reason: 'refusal', content: [] })).toEqual({ verdict: 'non-app', reasons: ['model refused'] });
  });

  it('defends against an empty / malformed reply', () => {
    expect(mapVisionResponse({ content: [] }).verdict).toBe('non-app');
    expect(mapVisionResponse({ content: [{ type: 'text', text: 'not json' }] }).verdict).toBe('non-app');
    expect(mapVisionResponse(null).verdict).toBe('non-app');
  });
});

// The acceptance scenario from #485, expressed against the provider's pure mapping: the verdicts a
// real model would return for the two known-bad targets resolve to quarantine; a clean app admits.
describe('acceptance — Photopea / Grafana / clean app via the provider mapping', () => {
  const reply = (verdict, reasons) => ({ content: [{ type: 'text', text: JSON.stringify({ verdict, reasons }) }] });
  it('Photopea marketing splash → marketing (quarantine)', () => {
    expect(mapVisionResponse(reply('marketing', ['hero + Start button, not the editor'])).verdict).toBe('marketing');
  });
  it('Grafana stale deep-link → error (quarantine)', () => {
    expect(mapVisionResponse(reply('error', ['dashboard-not-found panel'])).verdict).toBe('error');
  });
  it('clean dashboard → app (admit)', () => {
    expect(mapVisionResponse(reply('app', ['data table + nav rail'])).verdict).toBe('app');
  });
});
