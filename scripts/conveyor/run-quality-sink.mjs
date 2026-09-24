/**
 * @file scripts/conveyor/run-quality-sink.mjs
 * @description THE RUN-QUALITY FINDING SINK (`#3649` Fork 6) — a SIBLING to
 *   `we:scripts/conveyor/hiccup-sink.mjs#fileHiccup`, NOT a reuse of it. The card's own skeptic verified
 *   `fileHiccup` throws on any `kind` but `guard-suppression`/`free-form-response`, ignores the caller's
 *   `summary`/`blocking`, and hardcodes `approvalPending: true` — "this file only exists for the NEW blocking
 *   path" per its own header. What genuinely carries over is the SHAPE: an `approvalPending` pool entry,
 *   held out of `/harvest` clustering, cleared by an approve verb — reimplemented here against a run-quality
 *   finding's own fields rather than forced through `fileHiccup`'s.
 *
 * DEDUP KEYS ON `(item, criterion)`, NEVER SUMMARY TEXT. `hiccup-sink.mjs#isUnresolvedDuplicate` dedups on
 * exact summary text, which is safe there because hiccup summaries are deterministic per `(kind, num, by)`.
 * An LLM-or-detector-authored run-quality summary is not deterministic wording, so a text-keyed dedup would
 * flood the pool with reworded duplicates of the same finding — the card's own named correction.
 *
 * ITS OWN STORE, deliberately not the shared `learnings-drop.mjs` pool: that pool's `ALLOWED_KEYS`/
 * `FIELD_CAPS` structurally cannot hold a deduction-shaped finding (`#3649`'s own grounding digest, verified
 * against `we:scripts/conveyor/learnings-drop.mjs`) — this is a capability gap, not a preference, so a
 * second small store is the correct move, not a workaround.
 *
 * NOT YET WIRED TO `/harvest` OR `hiccup-approve.mjs` — that integration is real, owed follow-on work (the
 * card's own "owed work, not a free import" framing), and is out of scope for getting the recording
 * mechanism itself built and proven. `approvalPending`/`blocking` are recorded here so that integration has
 * something correct to consume once it is built.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RUN_QUALITY_FINDINGS_PATH = join(__dirname, 'run-quality-findings.json');

/** Read the findings pool. Never throws — degrades to empty. */
export function readFindings({ path = RUN_QUALITY_FINDINGS_PATH, read = (p) => readFileSync(p, 'utf8'), exists = existsSync } = {}) {
  try {
    if (!exists(path)) return { version: 1, findings: [] };
    const parsed = JSON.parse(read(path));
    return { version: parsed?.version ?? 1, findings: Array.isArray(parsed?.findings) ? parsed.findings : [] };
  } catch {
    return { version: 1, findings: [] };
  }
}

/** Write the findings pool back to disk. */
export function writeFindings(pool, { path = RUN_QUALITY_FINDINGS_PATH, write = (p, s) => writeFileSync(p, s) } = {}) {
  write(path, `${JSON.stringify({ version: pool.version ?? 1, findings: pool.findings ?? [] }, null, 2)}\n`);
}

/**
 * Is `dedupKey` already an UNRESOLVED entry in the pool? (Mirrors `hiccup-sink.mjs`'s intent, keyed
 * correctly this time — see file header.)
 */
export function isUnresolvedDuplicate(pool, dedupKey) {
  return (pool.findings ?? []).some((f) => f.dedupKey === dedupKey && f.approvalPending && !f.resolvedAt);
}

/**
 * File ONE run-quality finding. Refuses to duplicate an unresolved entry with the same `dedupKey`
 * (`item:criterion`, per the card's own correction — never summary text).
 *
 * @param {{summary:string, area:string, proposedFix?:object|null, approvalPending?:boolean, blocking?:boolean, dedupKey:string}} finding
 * @param {{session?:string}} [meta]
 * @param {object} [io]
 * @returns {object|null} the stored finding, or `null` if it was a duplicate (nothing written).
 */
export function fileRunQualityFinding(finding, meta = {}, io = {}) {
  if (!finding || typeof finding.dedupKey !== 'string' || !finding.dedupKey.trim()) {
    throw new TypeError('run-quality-sink: `dedupKey` is required (e.g. `${item}:${criterion}`) — never summary text');
  }
  const pool = readFindings(io);
  if (isUnresolvedDuplicate(pool, finding.dedupKey)) return null;
  const stored = {
    id: randomUUID(),
    dedupKey: finding.dedupKey,
    summary: String(finding.summary ?? ''),
    area: String(finding.area ?? ''),
    proposedFix: finding.proposedFix ?? null,
    approvalPending: finding.approvalPending !== false,
    blocking: !!finding.blocking,
    session: meta.session ?? null,
    filedAt: new Date().toISOString(),
    resolvedAt: null,
  };
  pool.findings.push(stored);
  writeFindings(pool, io);
  return stored;
}
