/**
 * @file blocks/renderers/upgrader/analyzers/modelComponent.ts
 * @description Model-backed analyzer — backlog #188, a REAL provider behind the registry seam.
 *
 * The reference analyzer (#094) lifts a structured subset of vanilla web components with NO model
 * key. This is its sibling: a `CustomAnalyzer` that asks a model to lift the messier input the
 * heuristic deliberately rejects — dynamic `${…}` templates, framework idioms, multi-`innerHTML`
 * shapes — into the same neutral `ComponentIR`. It registers into the SAME `CustomAnalyzerRegistry`
 * with NO change to the engine core: exactly the swap-in the registry was built for.
 *
 * Three rules carried from the pipeline:
 *   1. **The model VENDOR is itself swappable.** `analyze()` delegates to a `ModelClient` — the
 *      Anthropic/OpenAI/etc. choice is config, not architecture. The thin `fetch` Anthropic client
 *      here is the *reference real provider*; a `@anthropic-ai/sdk`-backed client is a drop-in
 *      implementing the same interface. (Native `fetch` keeps the browser playground dep-free; the
 *      real client is Node/CI-side — BYO key, never bundled.)
 *   2. **Force a structured contract, then validate before trusting.** The prompt asks the model to
 *      RESOLVE dynamics into a static declarative template and emit a JSON `ComponentIR`;
 *      `parseModelIR` checks the shape and rejects leftover `${…}` *before* the engine runs.
 *   3. **The verify gate is unchanged and does the heavy lifting.** A model that hallucinates
 *      structure fails the engine's parse / fidelity / intent checks and is never offered
 *      (`offered: false`) — the whole propose-and-verify moat, no model-specific trust required.
 */
import type { CustomAnalyzer, ComponentIR, SourceInput, CustomAnalyzerRegistry } from '../upgraderEngine';
import type { ShadowMode } from '../../component/declarativeComponent';

// ── Model vendor seam (swappable, like CustomAnalyzer is swappable) ─────────────

export interface ModelClient {
  /** Vendor id — flows into the analyzer id + diagnostics (e.g. `model:anthropic`). */
  id: string;
  /**
   * Prompt in, raw completion text out. May call the network. Throw with a clear message on a
   * transport/auth failure or empty response — `upgrade()` turns that into a `model:`-tagged
   * diagnostic, which is what makes a model failure read distinctly from a subset rejection.
   */
  complete(prompt: string): Promise<string>;
}

// ── Routing: claim the input the reference subset rejects ───────────────────────
//
// The registry resolves the FIRST provider that `handles()` the input, so this provider is meant to
// be registered AHEAD of the reference one (see registerModelAnalyzer). It claims only component-
// shaped input that is messier than the reference subset — dynamic interpolation, a framework render
// idiom, or more than one innerHTML assignment — so clean vanilla components still fall through to
// the deterministic, no-key reference path.

const COMPONENTISH = /customElements\s*\.\s*define|extends\s+HTMLElement|extends\s+(?:React\.)?Component|export\s+default\s+function\s+[A-Z]/;
const DYNAMIC_SIGNALS = [
  /\.innerHTML\s*=\s*`[^`]*\$\{/, // interpolated template literal assigned to innerHTML
  /\breturn\s*\(?\s*</, // a JSX-style render return
  /\b(?:useState|useEffect|createElement)\b/, // framework idioms
];

function looksMessy(code: string): boolean {
  if (!COMPONENTISH.test(code)) return false;
  if (DYNAMIC_SIGNALS.some((re) => re.test(code))) return true;
  // More than one innerHTML write (`=` or `+=`): the reference subset reads only the first
  // assignment, so escalate to the model to lift the whole template rather than lift it lossily.
  return (code.match(/\.innerHTML\s*\+?=/g)?.length ?? 0) > 1;
}

// ── Prompt + output contract ────────────────────────────────────────────────────

/**
 * The neutral structure the model must emit, as a JSON Schema — passed to the Anthropic client's
 * structured-output config so the response is guaranteed to be a valid `ComponentIR` JSON object.
 */
export const COMPONENT_IR_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    shadow: { type: 'string', enum: ['open', 'closed', 'none'] },
    template: { type: 'string' },
    intents: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'shadow', 'template'],
  additionalProperties: false,
} as const;

/** Build the lift prompt. `knownIntents` lets the model reference only intents the standard knows. */
export function buildPrompt(input: SourceInput, knownIntents?: readonly string[]): string {
  return [
    'You upgrade an existing/legacy web UI component onto a declarative standard.',
    'Return ONLY a JSON object: { "name", "shadow", "template", "intents"?, "notes"? }.',
    '',
    '- name: the custom-element tag — lowercase and MUST contain a hyphen.',
    '- shadow: "open" | "closed" | "none" (use "none" for light-DOM components).',
    '- template: STATIC HTML for the declarative <component> body. RESOLVE any dynamic',
    '  `${...}` interpolation, attribute reads, or framework binding into static markup or',
    '  <slot> elements. The template MUST NOT contain `${` — emit a real declarative form.',
    knownIntents && knownIntents.length
      ? `- intents: zero or more of these standard intents (use ONLY these, omit if unsure): ${knownIntents.join(', ')}.`
      : '- intents: omit unless you are certain a standard intent applies.',
    '- notes: short remarks on what you inferred or dropped.',
    '',
    `Source dialect hint: ${input.language ?? '(auto-detect)'}`,
    'SOURCE:',
    input.code,
  ].join('\n');
}

// ── Validate the model output before the engine trusts it ────────────────────────

/** Pull a JSON object out of a completion (handles a fenced block or surrounding prose). */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return body;
  return body.slice(start, end + 1);
}

/**
 * Turn a raw model completion into a validated `ComponentIR`, or throw a clear message (which the
 * orchestrator surfaces as a `model:`-tagged diagnostic). This is the model-specific guard that
 * sits in front of the engine's vendor-neutral verify gate — it rejects malformed JSON, a bad
 * shape, and the most common hallucination (leaving the dynamic `${…}` unresolved).
 */
export function parseModelIR(raw: string): ComponentIR {
  let data: unknown;
  try {
    data = JSON.parse(extractJson(raw));
  } catch (e) {
    throw new Error(`model did not return valid JSON: ${(e as Error).message}`);
  }
  if (typeof data !== 'object' || data === null) throw new Error('model output was not a JSON object.');

  const { name, shadow, template, intents, notes } = data as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) throw new Error('model output is missing a string "name".');
  if (shadow !== 'open' && shadow !== 'closed' && shadow !== 'none')
    throw new Error(`model output "shadow" must be "open" | "closed" | "none" (got ${JSON.stringify(shadow)}).`);
  if (typeof template !== 'string') throw new Error('model output is missing a string "template".');
  if (/\$\{/.test(template))
    throw new Error('model left `${…}` interpolation in the template — it did not resolve the dynamic source to a static form.');
  if (intents != null && (!Array.isArray(intents) || intents.some((i) => typeof i !== 'string')))
    throw new Error('model output "intents" must be an array of strings.');
  if (notes != null && (!Array.isArray(notes) || notes.some((n) => typeof n !== 'string')))
    throw new Error('model output "notes" must be an array of strings.');

  return {
    name: name.trim(),
    shadow: shadow as ShadowMode,
    template: template.trim(),
    intents: (intents as string[] | undefined) ?? [],
    notes: [...((notes as string[] | undefined) ?? []), 'lifted by a model provider (dynamic source resolved to a static template).'],
  };
}

// ── The analyzer (a real provider, same contract as the reference one) ───────────

export interface ModelAnalyzerOptions {
  /** Standard intents to offer the model in the prompt (it may reference only these). */
  knownIntents?: readonly string[];
}

export function modelComponentAnalyzer(client: ModelClient, opts: ModelAnalyzerOptions = {}): CustomAnalyzer {
  return {
    id: `model:${client.id}`,
    handles: (input) => input.language === 'model' || (input.language == null && looksMessy(input.code)),
    analyze: async (input) => parseModelIR(await client.complete(buildPrompt(input, opts.knownIntents))),
  };
}

/**
 * Register the model provider AHEAD of any already-registered providers (it `unshift`s by
 * re-registering after a fresh push is not possible, so register it FIRST, then the reference one)
 * — so the messy input it claims escalates to the model while clean input falls through to the
 * deterministic reference. Mirrors `registerReferenceAnalyzers`; a BYO-AI provider is just this.
 */
export function registerModelAnalyzer(
  registry: CustomAnalyzerRegistry,
  client: ModelClient,
  opts: ModelAnalyzerOptions = {},
): void {
  registry.register(modelComponentAnalyzer(client, opts));
}

// ── Reference real provider: a thin Anthropic client (BYO key, never bundled) ────

export interface AnthropicClientOptions {
  /** BYO key. Defaults to `ANTHROPIC_API_KEY` from the environment. NEVER bundle a key. */
  apiKey?: string;
  /** Model id — defaults to the latest Opus. Swap freely; the frontier is config. */
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
}

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-8';

function resolveKey(explicit?: string): string {
  // Node/CI reads it from the env; the browser playground never calls this (it uses a scripted
  // client) — so a missing key is a clean, surfaced error, not a crash.
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ANTHROPIC_API_KEY;
  const key = explicit ?? fromEnv;
  if (!key)
    throw new Error('no Anthropic API key — set ANTHROPIC_API_KEY (BYO key; never bundled) or pass { apiKey }.');
  return key;
}

/**
 * A minimal Anthropic Messages-API client over native `fetch` — the reference REAL `ModelClient`.
 * Uses structured output (`output_config.format`) so the response is a guaranteed-valid
 * `ComponentIR` JSON object. Intended for Node/CI; for a production app, a `@anthropic-ai/sdk`
 * client implementing `ModelClient` drops in unchanged. (Direct browser calls would additionally
 * need the dangerous-direct-browser-access opt-in and expose the key — don't; keep this server-side.)
 */
export function createAnthropicClient(opts: AnthropicClientOptions = {}): ModelClient {
  const model = opts.model ?? DEFAULT_MODEL;
  const baseUrl = (opts.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const maxTokens = opts.maxTokens ?? 1024;

  return {
    id: 'anthropic',
    async complete(prompt) {
      const apiKey = resolveKey(opts.apiKey);
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          output_config: { format: { type: 'json_schema', schema: COMPONENT_IR_SCHEMA } },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('');
      if (!text) throw new Error('Anthropic API returned no text content.');
      return text;
    },
  };
}

// ── No-key client: deterministic stand-in for tests + the playground ─────────────

/**
 * A scripted `ModelClient` — `responder(prompt)` returns a canned completion. Proves the seam and
 * exercises the verify gate (including hallucination cases) WITHOUT a key, so the demo's badges and
 * CI run the exact same pipeline a real model would.
 */
export function createScriptedClient(responder: (prompt: string) => string, id = 'scripted'): ModelClient {
  return { id, async complete(prompt) { return responder(prompt); } };
}
