/**
 * @file scripts/autofix/modelFixer.mjs
 * @description Model-backed fixer provider — backlog #196, a REAL provider behind the same
 *   `CustomFixerRegistry` seam as the deterministic reference fixers (#095).
 *
 * The reference `deprecated-status` fixer (#095) handles a class whose fix the conformance CONTRACT
 * already encodes — no model needed. This is its sibling for the classes whose fix is **content
 * generation**, not a mechanical rewrite: `missing-description` (a block / plug / research topic in the
 * spec with no `*-descriptions/*.njk`). The model drafts a spec-conformant description grounded in the
 * entity's own registry data, and the engine's verify gate re-runs `check:standards` and keeps the
 * file ONLY if the failure cleared and introduced no new error — exactly where the #089 moat lives: a
 * generic model emits plausible prose; only here is it gated by a machine-checkable conformance target.
 *
 * Rules carried from the upgrader's model analyzer (#188):
 *   1. **The model VENDOR is swappable.** `fix()` delegates to a `ModelClient` — the Anthropic/OpenAI
 *      choice is config, not architecture. A thin `fetch` Anthropic client is the reference real
 *      provider; a scripted client drives tests + dry runs with NO key.
 *   2. **Validate before trusting.** The drafted njk is checked (non-empty, real markup, no leftover
 *      prompt scaffolding) before it's offered as a patch — and then the engine's vendor-neutral
 *      verify gate does the heavy lifting (existence cleared + no new error, else reverted).
 */

// ── Model vendor seam (swappable, mirrors modelComponent.ts's ModelClient) ───────
//
/**
 * @typedef {Object} ModelClient
 * @property {string} id  Vendor id — flows into the fixer id + diagnostics (e.g. `anthropic`).
 * @property {(prompt: string) => Promise<string>} complete  Prompt in, raw completion text out. May
 *           call the network; throws with a clear message on a transport/auth failure or empty response.
 */

// ── Entity → registry data (so the draft is grounded, not invented) ──────────────
//
// Each entity that can lack a description maps to the registry JSON the descriptor's `id` resolves in,
// so the fixer can read the entity's own `name`/`summary` and prompt the model with real context
// rather than asking it to invent a component from a bare id.
// Every hand-authored array registry is now split one-file-per-entity (#882 blocks, #1145 research/intents,
// #1146 protocols/demos, #1157 plugs/capabilities/…), so an entity's data is its own
// src/_data/<dir>/<id>.json (a single object) — resolved per-id in lookupEntity via PER_ID_DIR. ENTITY_DATA
// remains the fallback for any entity still backed by a monolithic registry JSON.
const ENTITY_DATA = {};
// Per-id-file entities: data lives one-file-per-id under this directory, the file's whole content IS the row.
const PER_ID_DIR = { Block: 'blocks', Research: 'researchTopics', Plug: 'plugs', CapabilityAdapter: 'capabilities' };

/** Find the entity row (by id) in its registry JSON, or null. Tolerant of array or grouped shapes. */
function lookupEntity(entity, id, read) {
  const file = PER_ID_DIR[entity] ? `src/_data/${PER_ID_DIR[entity]}/${id}.json` : ENTITY_DATA[entity];
  if (!file) return null;
  let parsed;
  try {
    parsed = JSON.parse(read(file));
  } catch {
    return null;
  }
  if (PER_ID_DIR[entity]) return parsed && parsed.id === id ? parsed : null;
  const rows = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
  return rows.find((r) => r && r.id === id) ?? null;
}

// ── Prompt + output contract ─────────────────────────────────────────────────────

/** Build the description-drafting prompt, grounded in the entity's own registry data. */
export function buildDescriptionPrompt(entity, id, data) {
  const name = data?.name ?? id;
  const summary = data?.summary ?? '(no summary on record)';
  const extra = data?.type ? `\nType: ${data.type}` : '';
  return [
    `You write reference documentation for a "${entity}" in the Web Everything standard.`,
    'Output ONLY an HTML fragment (Nunjucks-compatible) for the description partial — no front matter,',
    'no <html>/<body>, no code fences, no preamble. Use <h3 id="..."> section headings and <p>/<ul>/',
    '<code> markup. Open with an <h3 id="overview"> Overview section that explains what it is and when',
    'to use it, grounded ONLY in the facts below — do not invent APIs or behaviours not implied here.',
    '',
    `Entity: ${entity}`,
    `Id (custom-element / registry key): ${id}`,
    `Name: ${name}`,
    `Summary: ${summary}${extra}`,
  ].join('\n');
}

// ── Validate the drafted description before the engine trusts it ─────────────────

/** A prompt-scaffolding leak or empty/non-markup draft — caught before it's offered as a patch. */
export class DraftError extends Error {
  constructor(why) {
    super(`model description draft rejected: ${why}`);
    this.name = 'DraftError';
  }
}

/**
 * Turn a raw model completion into a clean description-partial body, or throw `DraftError`. Strips a
 * stray ``` fence if present, then requires real HTML markup and rejects the most common failures
 * (empty output, the model echoing the prompt, a leftover Markdown code fence).
 */
export function parseDescriptionDraft(raw) {
  let body = String(raw ?? '').trim();
  // Strip a single wrapping code fence the model may add despite instructions.
  const fenced = body.match(/^```(?:html|njk|nunjucks)?\s*([\s\S]*?)```$/);
  if (fenced) body = fenced[1].trim();
  if (!body) throw new DraftError('empty draft.');
  if (/```/.test(body)) throw new DraftError('draft still contains a Markdown code fence.');
  if (!/<\w+[\s>]/.test(body)) throw new DraftError('draft contains no HTML markup.');
  if (/^(?:You write|Output ONLY|Entity:)/m.test(body)) throw new DraftError('draft echoed the prompt scaffolding.');
  return body.endsWith('\n') ? body : `${body}\n`;
}

// ── The fixer (a real provider, same contract as the reference fixers) ───────────

/**
 * A model-backed fixer for the `missing-description` class. Reads the entity's registry data for
 * grounding, asks the model to draft the description partial, validates it, and returns a patch that
 * CREATES the `*-descriptions/*.njk` file. Returns null when it can't safely produce one (unknown
 * entity, model error, or a draft that fails validation) — the engine records a give-up, never a guess.
 * @param {ModelClient} client
 * @returns {import('./engine.mjs').Fixer}
 */
export function missingDescriptionFixer(client) {
  return {
    id: `model:${client.id}:missing-description`,
    handles: (f) => f.descriptor?.kind === 'missing-description',
    fix: async (f, { read }) => {
      const d = f.descriptor;
      if (!d?.file || !d.id || !d.entity) return null;
      const data = lookupEntity(d.entity, d.id, read);
      let draft;
      try {
        const raw = await client.complete(buildDescriptionPrompt(d.entity, d.id, data));
        draft = parseDescriptionDraft(raw);
      } catch {
        return null; // model/transport error or a rejected draft — give up safely, the gate never sees it
      }
      return {
        file: d.file,
        newContent: draft,
        summary: `drafted ${d.entity} "${d.id}" description (${d.file})`,
      };
    },
  };
}

/** Register the model fixer(s) into a registry. A BYO-AI provider is just this call with a real client. */
export function registerModelFixers(registry, client) {
  registry.register(missingDescriptionFixer(client));
  return registry;
}

// ── No-key client: deterministic stand-in for tests + dry runs ───────────────────

/**
 * A scripted `ModelClient` — `responder(prompt)` returns a canned completion. Proves the seam and
 * exercises the verify gate WITHOUT a key, so tests and a `--dry-run` run the same pipeline a real
 * model would.
 */
export function createScriptedClient(responder, id = 'scripted') {
  return { id, async complete(prompt) { return responder(prompt); } };
}

// ── Reference real provider: a thin Anthropic client (BYO key, never bundled) ────

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * A minimal Anthropic Messages-API client over native `fetch` — the reference real `ModelClient` for
 * the fixer (mirrors `createAnthropicClient` in modelComponent.ts, kept in `.mjs` so the Node CLI can
 * use it without a TS loader). BYO key from `ANTHROPIC_API_KEY` (or `{ apiKey }`); never bundled.
 */
export function createAnthropicClient(opts = {}) {
  const model = opts.model ?? DEFAULT_MODEL;
  const baseUrl = (opts.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const maxTokens = opts.maxTokens ?? 1024;
  return {
    id: 'anthropic',
    async complete(prompt) {
      const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('no Anthropic API key — set ANTHROPIC_API_KEY (BYO key; never bundled).');
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = (data.content ?? []).filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
      if (!text) throw new Error('Anthropic API returned no text content.');
      return text;
    },
  };
}
