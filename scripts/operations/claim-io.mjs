/**
 * @file scripts/operations/claim-io.mjs
 * @description THE IO SHELL of the `claim` declaration (#3034, under epic #3029) — the reader its `read` step
 *   is injected with, and the sink that applies its one declared effect.
 *
 * WHY IT IS A SEPARATE FILE. {@link ./claim.mjs} is the declaration: what the operation IS. This is the only
 * place it touches the world — the same pure-core / io-shell split {@link ./dispatch-lane-io.mjs} and
 * {@link ./review-pr-io.mjs} use, and what lets the declaration be unit-tested with a stub reader.
 *
 * EVERY READ HERE COMPOSES THE SAME SOURCES `we:scripts/backlog.mjs`'s `transition()` reads today:
 *   - file resolution mirrors `resolveFile` (`we:scripts/backlog.mjs:245-254`) — `idFromName`/`normalizeId`
 *     off `we:scripts/backlog/id.mjs`.
 *   - the ready-to-merge (queued) guard reads `we:scripts/readiness/queued-state.mjs#isQueued` off
 *     `.claude/skills/batch-backlog-items/queued.json`.
 *   - the prepare-hold guard reads `we:scripts/readiness/prepare-hold-state.mjs#isHeld`/`#heldBy` off
 *     `.claude/skills/batch-backlog-items/prepare-hold.json`.
 *   - the claim-first dirty-file guard is a scoped `git status --porcelain -- <rel>`, best-effort exactly as
 *     `we:scripts/backlog.mjs:353-355` is (a git hiccup reads as clean — never block a claim on an IO hiccup).
 *
 * THE SINK APPLIES THE ONE EFFECT THROUGH THE EXTRACTED GUARDED WRITER
 * (`we:scripts/backlog/guarded-write.mjs#writeBacklogMd`) — never a bare `writeFileSync`. That writer THROWS
 * (it cannot exit the caller's process); the effect executor turns that throw into a `pending`/`failed` effect
 * entry, exactly as any other sink's failure does.
 *
 * IMPURE by construction: `fs`, `git` (via `execFileSync`).
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { idFromName, normalizeId } from '../backlog/id.mjs';
import { readField } from '../backlog/frontmatter.mjs';
import { writeBacklogMd } from '../backlog/guarded-write.mjs';
import { parseQueued, isQueued } from '../readiness/queued-state.mjs';
import { parseHolds, isHeld, heldBy as heldByFn } from '../readiness/prepare-hold-state.mjs';
import { localToday } from '../lib/local-date.mjs';
import { CLAIM_EFFECT } from './claim.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION, never CWD — same reason `run-store.mjs#RUNS_ROOT` does it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** Repo-relative paths the reader/sink compose off `root`. */
const backlogDir = (root) => join(root, 'backlog');
const queuedPath = (root) => join(root, '.claude', 'skills', 'batch-backlog-items', 'queued.json');
const prepareHoldPath = (root) => join(root, '.claude', 'skills', 'batch-backlog-items', 'prepare-hold.json');

/** Tolerant text read — a missing/unreadable sidecar degrades to `''`, which each state's own `parse*`
 *  function already treats as empty. Never let a corrupt token wedge a claim (mirrors `we:scripts/backlog.mjs`'s
 *  own `loadQueued`/`loadHolds`). */
function readTextOrEmpty(path, readText) {
  try { return readText(path); } catch { return ''; }
}

/**
 * Resolve `ref` (NNN or `xNNNNNN`) to exactly one backlog file, mirroring `we:scripts/backlog.mjs#resolveFile`'s
 * matching rule (a prefix match on `<padded>-`) without its process-exiting `die()` — an unresolved or
 * ambiguous ref reads as `null` here, and {@link shapeClaimRead} turns that into the operation's own refusal.
 * @returns {string|null} the matched filename, or `null`.
 */
function resolveClaimFile(ref, root, listFiles) {
  const idTok = idFromName(String(ref ?? ''));
  if (!idTok) return null;
  const padded = normalizeId(idTok);
  const matches = listFiles(backlogDir(root)).filter((f) => f.endsWith('.md') && f.startsWith(`${padded}-`));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * READ ONE CLAIM CONTEXT. The `readClaimContext` the declaration is injected with.
 *
 * @param {object} o
 * @param {string} [o.root]
 * @param {(dir: string) => string[]} [o.listFiles] - injectable `backlog/` lister, so the reader is testable
 *   without touching a real checkout.
 * @param {(path: string) => string} [o.readText] - injectable file reader.
 * @param {(argv: string[], opts: object) => string} [o.exec] - injectable `git status --porcelain` runner.
 * @param {() => string} [o.today] - injectable clock; stamps the `dateStarted` the write step splices in.
 * @returns {{root: string, listFiles: Function, readText: Function, exec: Function, today: Function}} the bound
 *   `readClaimContext({ref})` closure's config — see the returned function below.
 */
export function createClaimReader({
  root = REPO_ROOT,
  listFiles = (dir) => readdirSync(dir),
  readText = (path) => readFileSync(path, 'utf8'),
  exec = execFileSync,
  today = localToday,
} = {}) {
  return ({ ref }) => {
    const file = resolveClaimFile(ref, root, listFiles);
    if (!file) return { found: false };

    const abs = join(backlogDir(root), file);
    const rel = `backlog/${file}`;
    const content = readText(abs);
    const id = idFromName(file);
    const status = readField(content, 'status') || 'open';

    const queuedState = parseQueued(readTextOrEmpty(queuedPath(root), readText));
    const queued = isQueued(queuedState, id);

    const holdState = parseHolds(readTextOrEmpty(prepareHoldPath(root), readText));
    const nowMs = Date.now();
    const held = isHeld(holdState, id, nowMs);
    const holder = held ? heldByFn(holdState, id, nowMs) : null;

    // Best-effort, scoped to the one file — a git hiccup must never block a claim (mirrors
    // `we:scripts/backlog.mjs:353-355`).
    let dirty = false;
    try {
      const out = exec('git', ['status', '--porcelain', '--', rel], { cwd: root, encoding: 'utf8' });
      dirty = String(out).trim().length > 0;
    } catch { /* best-effort */ }

    return { found: true, abs, rel, id, status, content, queued, held, heldBy: holder, dirty, today: today() };
  };
}

/**
 * BUILD THE SINK MAP for `claim`'s one effect type. Applies the already-computed new file bytes through the
 * extracted guarded writer — never a bare `writeFileSync`.
 *
 * @param {{root?: string}} [o]
 * @returns {Record<string, Function>}
 */
export function createClaimSinks({ root = REPO_ROOT } = {}) {
  return {
    [CLAIM_EFFECT]: async (payload) => {
      writeBacklogMd(payload.abs, payload.rel, payload.content, { root });
      return { abs: payload.abs, rel: payload.rel };
    },
  };
}
