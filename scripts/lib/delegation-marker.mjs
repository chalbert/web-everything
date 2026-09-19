/** PR-open delegation metadata; pure helpers, no IO. */
import { TASK_TYPES } from '../conveyor/log-delegation-trial.mjs';

export const DELEGATION_MARKER = 'delegation';
export const DELEGATION_TASK_TYPES = TASK_TYPES;
const validToken = (value) => typeof value === 'string' && value !== '' && !/[\s<>]/.test(value);

/** Invalid input yields no marker, never a partial attribution. */
export function buildDelegationMarker(triple) {
  const { provider, model, taskType } = triple ?? {};
  if (!validToken(provider) || !validToken(model) || !DELEGATION_TASK_TYPES.includes(taskType)) return '';
  const payload = `provider=${provider} model=${model} taskType=${taskType}`;
  // Keep every emitted marker readable by the bounded parser below.
  if (payload.length > 300) return '';
  return `<!-- ${DELEGATION_MARKER}: ${payload} -->`;
}

/** Resolve only agreeing complete triples. Malformed or conflicting stamps resolve to null. */
export function parseDelegationMarker(body) {
  if (typeof body !== 'string') return null;
  const re = new RegExp(`<!--\\s*${DELEGATION_MARKER}:`, 'g');
  let resolved = null;
  let close = -1;
  let end = -1;
  while (re.exec(body)) {
    let start = re.lastIndex;
    // Reuse the next delimiter for nested/oversized candidates: rescanning the
    // remaining body for every opening would itself make this quadratic.
    if (close < start) {
      close = body.indexOf('-->', start);
      if (close === -1) break;
      end = close;
      while (end > start && /\s/.test(body[end - 1])) end -= 1;
    }
    while (start < end && /\s/.test(body[start])) start += 1;
    if (end - start > 300 || start === close) continue;
    // The old non-empty capture matched one character in a whitespace-only
    // occurrence, then failed field parsing. A truly empty occurrence is skipped.
    if (start === end) return null;
    const content = body.slice(start, end);
    if (content.includes('>')) continue;
    re.lastIndex = close + 3;
    // Delimiter and whitespace scans cover disjoint spans; field regexes only
    // see at most 300 characters. Total work is linear in the body's length.
    const triple = {};
    for (const field of ['provider', 'model', 'taskType']) {
      const values = [...content.matchAll(new RegExp(`(?:^|\\s)${field}=(\\S+)`, 'g'))];
      if (values.length !== 1) return null;
      triple[field] = values[0][1];
    }
    if (!buildDelegationMarker(triple)) return null;
    if (resolved && Object.keys(triple).some((field) => resolved[field] !== triple[field])) return null;
    resolved = triple;
  }
  return resolved;
}
