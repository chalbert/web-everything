// design-refs/providers/anthropic-vision.mjs — interim reference vision provider (backlog #485)
//
// A thin, NO-LEAKAGE client that calls a vision model directly to gate design-ref captures, per the
// #475 ruling's *interim* shape: it stands in until the Plateau vision service exists, at which point
// the gate is repointed at Plateau and this module is retired. It lives OUTSIDE the design-refs core
// (loaded on demand via DESIGN_REFS_VISION_PROVIDER_MODULE) so no vendor name ever appears in the
// pipeline core — the swappable-provider boundary the ruling requires.
//
// Usage (bring-your-own-key, opt-in):
//   npm i @anthropic-ai/sdk
//   ANTHROPIC_API_KEY=… \
//   DESIGN_REFS_VISION_PROVIDER=anthropic \
//   DESIGN_REFS_VISION_PROVIDER_MODULE=./scripts/design-refs/providers/anthropic-vision.mjs \
//   npm run design-refs collect
//
// Model defaults to claude-opus-4-8 (vision-capable); override with DESIGN_REFS_VISION_MODEL — the
// model is the operator's call, not a cost decision baked in here.
//
// The request-building and response-mapping are pure exported functions (buildVisionRequest /
// mapVisionResponse) so the contract is unit-tested without the SDK, a network call, or a key; the
// registered provider is the thin wrapper that wires them to `@anthropic-ai/sdk`.

import { registerVisionProvider, VERDICTS, normalizeVerdict } from '../vision.mjs';

export const DEFAULT_MODEL = 'claude-opus-4-8';

const SYSTEM =
  'You are a strict quality-control gate for a design-reference screenshot corpus. You judge whether '
  + 'a single screenshot shows a real, unobstructed web-APPLICATION surface — a product UI such as a '
  + 'dashboard, console, editor, inbox, settings page, data table, or in-product flow — and NOT a '
  + 'marketing/landing page, a modal/cookie/consent overlay covering the app, an error page, or a '
  + 'blank/loading screen. Return exactly one verdict.';

// Structured-output schema (output_config.format). enum + additionalProperties:false are supported.
export const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: [...VERDICTS] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'reasons'],
};

function instruction({ url, selectorState } = {}) {
  return [
    `URL: ${url ?? '(unknown)'}`,
    selectorState && selectorState !== 'none' ? `A deterministic readiness selector reports: ${selectorState}.` : null,
    'Classify the screenshot into exactly one verdict:',
    '- app: a clean, unobstructed application surface.',
    '- obstructed: a real app behind a dismissible modal / cookie / consent overlay.',
    '- marketing: a marketing / landing / pricing / brochure page, not the app.',
    '- error: an error / not-found / stale-deep-link page.',
    '- blank: blank, loading, or skeleton with no real content.',
    '- non-app: anything else that is not an application surface.',
    'Give 1–3 short reasons grounded in what is actually visible.',
  ].filter(Boolean).join('\n');
}

// Pure: build the messages.create() params for one candidate frame. Vision base64 message format per
// the Claude API: an image block (base64 PNG) followed by the text instruction.
export function buildVisionRequest(input, model = DEFAULT_MODEL) {
  return {
    model,
    max_tokens: 512,
    // effort:low keeps the gate cheap/fast; format constrains the reply to the verdict schema.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: input.pngBase64 } },
        { type: 'text', text: instruction(input) },
      ],
    }],
  };
}

// Pure: map a Messages API response to the seam's verdict envelope. Reads the JSON the structured
// format produced in the text block; defends against a refusal / empty / malformed reply by falling
// back to the safe (quarantine) side.
export function mapVisionResponse(res) {
  if (res?.stop_reason === 'refusal') return { verdict: 'non-app', reasons: ['model refused'] };
  const text = (res?.content ?? []).find((b) => b?.type === 'text')?.text;
  let parsed;
  try { parsed = JSON.parse(text ?? '{}'); } catch { parsed = {}; }
  return {
    verdict: normalizeVerdict(parsed.verdict),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
  };
}

let clientPromise = null;
async function getClient() {
  if (!clientPromise) {
    // Computed specifier: keep the optional dep a true runtime import (bundlers must not try to
    // resolve it at build/transform time — it isn't installed by default).
    const sdk = '@anthropic-ai/sdk';
    clientPromise = import(sdk)
      .then((m) => new m.default())
      .catch(() => {
        throw new Error(
          'design-refs anthropic vision provider requires `@anthropic-ai/sdk` (run `npm i @anthropic-ai/sdk`) '
          + 'and ANTHROPIC_API_KEY in the environment.',
        );
      });
  }
  return clientPromise;
}

registerVisionProvider('anthropic', {
  async classifyCandidate(input) {
    const client = await getClient();
    const res = await client.messages.create(buildVisionRequest(input, process.env.DESIGN_REFS_VISION_MODEL || DEFAULT_MODEL));
    return mapVisionResponse(res);
  },
});
