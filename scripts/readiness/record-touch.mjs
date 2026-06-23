/**
 * @file scripts/readiness/record-touch.mjs
 * @description PostToolUse(Edit|Write) hook — records the file a tool just edited against the active
 *              session's `touched` set in the claim registry (the 2-C union source, backlog #1661).
 *
 * Reads the PostToolUse payload from stdin (`{ tool_input: { file_path } }`), maps the path to repo-relative
 * (matching `git status --porcelain`), and appends it to the **most-recently-claimed** session's `touched`
 * row in `.claude/skills/batch-backlog-items/claims.json`. With that recorded, `check:standards
 * --scope=<slug>` attributes a finding on a file *already dirty at claim* but edited by THIS session as
 * **mine** (closing the #953 hole) rather than demoting it as foreign.
 *
 * **Session signal:** the newest `at` row in the registry (`mostRecentSession`) — the cheapest reliable
 * signal for a single active batch. Residual: with two concurrent batches, a touch can mis-attribute to the
 * other's session; that only ever *adds* a file to the wrong "mine" (an extra, safe stop), never hides a red.
 *
 * **Fail-silent by construction** — a hook must NEVER break the Edit/Write it follows: any error (no stdin,
 * bad JSON, no claimed session, unwritable registry) exits 0 with no output. Touch-recording is best-effort
 * advisory devtools state.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  parseClaims,
  serializeClaims,
  pruneExpiredClaims,
  recordTouch,
  mostRecentSession,
} from './claimScope.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CLAIMS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/claims.json');

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Pull the edited file path(s) from a PostToolUse payload (Edit/Write/MultiEdit shapes). */
function touchedPaths(payload) {
  const input = payload?.tool_input ?? {};
  const out = [];
  if (typeof input.file_path === 'string') out.push(input.file_path);
  // MultiEdit / future shapes: a top-level `edits[].file_path` or `file_paths[]`.
  if (Array.isArray(input.file_paths)) for (const p of input.file_paths) if (typeof p === 'string') out.push(p);
  return out;
}

/** Map an absolute (or already-relative) path to repo-relative, matching git porcelain. `null` if outside the repo. */
function toRepoRelative(p) {
  const rel = isAbsolute(p) ? relative(ROOT, p) : p;
  if (rel.startsWith('..')) return null; // outside the repo — not a tracked file
  return rel.split('\\').join('/');
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin());
  } catch {
    return; // no/garbage payload → nothing to record
  }
  const files = touchedPaths(payload).map(toRepoRelative).filter(Boolean);
  if (!files.length) return;

  let state;
  try {
    state = parseClaims(readFileSync(CLAIMS_PATH, 'utf8'));
  } catch {
    return; // no registry yet → nothing claimed, nothing to attribute
  }
  const session = mostRecentSession(state);
  if (!session) return; // no active claimed session

  try {
    const next = recordTouch(state, { session, files, nowIso: new Date().toISOString() });
    writeFileSync(CLAIMS_PATH, serializeClaims(pruneExpiredClaims(next, Date.now())));
  } catch {
    // unwritable registry / race — best-effort, never break the tool
  }
}

main();
