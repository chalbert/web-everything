/**
 * @file scripts/readiness/model-proposer.mjs
 * @description BYO-key model proposer + transient-failure retry — backlog #252/#253.
 *
 * The swappable AI provider that lives at the CLI boundary (it DOES touch the network), kept OUT of the
 * pure proposer engine (`proposer.mjs`) and the #250 deterministic core. It was lifted out of the CLI
 * entry (`scripts/propose-readiness.mjs`) so the network surface — and its retry/backoff — is a real,
 * injectable unit you can test with a fake `fetch` instead of a live model.
 *
 * #253 adds resilience: a single `fetch` with no retry dropped a whole chunk of a backlog-wide sweep to
 * "provider error" the moment the API returned a transient `429 rate_limit` / `529 overloaded`. The
 * provider now retries those (and `5xx`, and network throws) with bounded exponential backoff, honoring
 * a `Retry-After` header when present. Terminal client errors (`400`/`401`/`403`/other non-429 `4xx`)
 * are NOT retried — they surface as an `error` give-up exactly as before, so a bad key fails fast.
 *
 * Zero-dep on purpose (the POC's standing call — see the inline note where retry is wired): the backoff
 * is ~20 lines of hand-rolled `fetch` rather than pulling in `@anthropic-ai/sdk` for one network call.
 */

export const MODEL = 'claude-opus-4-8';

/** A status the server is telling us (or implying) is worth trying again: rate-limit or any 5xx. */
const isRetryableStatus = (status) => status === 429 || (status >= 500 && status <= 599);

/** Default async sleep — injectable so tests resolve instantly instead of waiting real wall-clock. */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse a `Retry-After` header into milliseconds. The header is either delta-seconds (an integer) or an
 * HTTP-date; anything unparseable (or absent) yields `null` so the caller falls back to its backoff
 * schedule. Negative/past values clamp to 0. Capped by the caller, not here.
 *
 * @param {string|null|undefined} value
 * @param {number} nowMs  Current epoch ms (injectable for deterministic tests).
 * @returns {number|null}
 */
export function retryAfterMs(value, nowMs = Date.now()) {
  if (value == null) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(value);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - nowMs);
}

/**
 * `fetch` with bounded exponential backoff on transient failures. Returns the final `Response` (whether
 * ok, a terminal error, or the last attempt after retries are exhausted) — it never throws on an HTTP
 * status, leaving the caller's existing `!resp.ok` handling intact. It DOES re-throw a network error
 * (a thrown `fetch`) once retries are exhausted, since there is no response to hand back.
 *
 * Retry policy: retry on a thrown network error, `429`, or any `5xx`; never on a non-429 `4xx`. The wait
 * is `Retry-After` (when the server sends one) else `baseDelayMs * 2^attempt`, each clamped to `maxDelayMs`.
 *
 * @param {string} url
 * @param {RequestInit} init
 * @param {{ fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => number,
 *          maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number }} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, init, opts = {}) {
  const {
    fetchImpl = fetch, sleep = defaultSleep, now = Date.now,
    maxAttempts = 4, baseDelayMs = 500, maxDelayMs = 30_000,
  } = opts;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isLast = attempt === maxAttempts - 1;
    let resp;
    try {
      resp = await fetchImpl(url, init);
    } catch (e) {
      // Network-level failure (DNS, reset, timeout) — transient; retry unless this was the last attempt.
      lastErr = e;
      if (isLast) throw e;
      await sleep(Math.min(baseDelayMs * 2 ** attempt, maxDelayMs));
      continue;
    }
    if (resp.ok || !isRetryableStatus(resp.status) || isLast) return resp;
    // Retryable status with attempts left: honor Retry-After, else exponential backoff.
    const header = retryAfterMs(resp.headers?.get?.('retry-after'), now());
    const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    await sleep(Math.min(header ?? backoff, maxDelayMs));
  }
  // Unreachable in practice (the loop returns/throws on the last attempt), but keeps the type honest.
  throw lastErr ?? new Error('fetchWithRetry: exhausted with no response');
}

/**
 * Construct the BYO-key model proposer. Calls the Messages API directly (no SDK dependency for a POC)
 * with adaptive thinking + a `json_schema` structured output, so the draft comes back already shaped as
 * `{ criteria, paths, rationale }`. Any non-transient failure (terminal HTTP error, unparseable body)
 * returns `null`/throws → the engine records a give-up; it never invents a draft.
 *
 * @param {string} apiKey
 * @param {{ fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => number,
 *          maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number }} [retryOpts]
 *        Forwarded to `fetchWithRetry` — injected by tests, defaulted in production.
 */
export function createModelProposer(apiKey, retryOpts = {}) {
  return {
    id: `model:${MODEL}`,
    handles: () => true,
    propose: async (c) => {
      const wantCriteria = c.gaps.includes('acceptance-criteria');
      const wantPaths = c.gaps.includes('file-paths');
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          criteria: { type: 'array', items: { type: 'string' } },
          paths: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
        },
        required: ['rationale'],
      };
      const prompt = [
        `You are drafting spec-gap fill-ins for a backlog item in the "Web Everything" repo.`,
        `The item is already DECIDED but THIN. Draft only the missing pieces a human will review;`,
        `do not restate the item or invent scope. Be concrete and grounded in the item's own text.`,
        '',
        `# ${c.title}`,
        c.summary ? `\n${c.summary}` : '',
        '\n--- full body ---\n',
        c.body,
        '\n--- end body ---\n',
        wantCriteria
          ? `Provide "criteria": 3-5 checkable acceptance criteria (each a single testable sentence).`
          : `Do NOT provide "criteria" (the item already has acceptance criteria).`,
        wantPaths
          ? `Provide "paths": the likely repo file paths this work would add or edit (relative, e.g. scripts/foo.mjs).`
          : `Do NOT provide "paths" (the item already names concrete paths).`,
        `Always provide "rationale": one sentence on how you derived the draft.`,
      ].join('\n');

      // Zero-dep retry/backoff (#253): a transient 429/529/5xx no longer drops the draft to a give-up.
      const resp = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          thinking: { type: 'adaptive' },
          output_config: { format: { type: 'json_schema', schema } },
          messages: [{ role: 'user', content: prompt }],
        }),
      }, retryOpts);
      if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      const data = await resp.json();
      const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return null; // model didn't return parseable JSON — give up, don't guess
      }
      return {
        criteria: wantCriteria ? (parsed.criteria ?? []) : undefined,
        paths: wantPaths ? (parsed.paths ?? []) : undefined,
        rationale: parsed.rationale ?? 'model draft',
      };
    },
  };
}
