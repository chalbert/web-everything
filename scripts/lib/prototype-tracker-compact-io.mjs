/**
 * @file scripts/lib/prototype-tracker-compact-io.mjs
 * @description The IO SHELL of the compact tracker page (`prototype-tracker-compact.mjs`): everything the page needs
 *   that is not in the tracker card itself. Read-only. Every port is injectable so a test never touches gh or the
 *   home directory; the real-mechanism test runs the defaults over a temp git repo.
 *
 *   - card titles and statuses: the checkout's own `backlog/` and, when `ref` resolves (default `origin/main`), that
 *     ref too — the prototype branch lags `main`, and new cards are filed there. The checkout's file wins for a
 *     title; a status follows `mergeCards` (resolved on either side is resolved). A ref that does not resolve is
 *     skipped, not an error: the page then shows the cut "why" text for a card only `main` has.
 *   - the branch tip: `git rev-parse --short HEAD`, or `''`.
 *   - NEEDS YOU: the operator-queue script's own section, verbatim. `operator-queue.mjs` lives on `main`, not on the
 *     prototype branch, so it is run from the first checkout that has it (the same search `/wip` makes, plus the
 *     operator's main checkout). Nothing found or a failed run is `{error}`, never an empty "none".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultGit, mergeCards, parseCard } from './priority-order.mjs';
import { cardTitleFromText } from './prototype-tracker-compact.mjs';
import { readRawFromDir, readRawFromRef } from '../operations/priority-sync-io.mjs';
import { parseNeedsYou } from '../operations/wip-report.mjs';
import { defaultRoots, findRoot } from '../operations/wip-report-io.mjs';

/** The default ref cards are also read from. */
export const DEFAULT_REF = 'origin/main';

/** `{titles: Map<id, string>, claimedIds: Set<string>}` for the given card ids. */
export function readCardFacts(ids, { backlogDir, ref = DEFAULT_REF, git = defaultGit, cwd, readdir = readdirSync, read = (p) => readFileSync(p, 'utf8') } = {}) {
  const local = readRawFromDir(backlogDir, { readdir, read });
  let fromRef = new Map();
  if (ref && ref !== 'none') {
    try { fromRef = readRawFromRef(ref, { git, cwd }); } catch { fromRef = new Map(); }
  }
  const parsed = (m) => new Map([...m].map(([id, f]) => [id, parseCard(id, f.text)]).filter(([, c]) => c));
  const status = mergeCards(parsed(local), parsed(fromRef));
  const titles = new Map();
  const claimedIds = new Set();
  for (const id of ids) {
    const file = local.get(id) ?? fromRef.get(id);
    const t = file ? cardTitleFromText(file.text) : null;
    if (t) titles.set(id, t);
    if (status.get(id)?.status === 'active') claimedIds.add(id);
  }
  return { titles, claimedIds };
}

/** The branch tip's short sha, or `''`. */
export function readTip({ git = defaultGit, cwd } = {}) {
  try { return git(['rev-parse', '--short', 'HEAD'], { cwd }).toString('utf8').trim(); } catch { return ''; }
}

/** Where `operator-queue.mjs` is looked for: `/wip`'s roots plus the operator's main checkout. */
export const queueRoots = (home = homedir(), env = process.env) => [...defaultRoots(home, env), join(home, 'workspace/webeverything')];

/**
 * NEEDS YOU, verbatim. `{lines}` (empty = nothing needs the operator) or `{error}`.
 * @param {{roots?: string[], exists?: Function, exec?: (root: string) => string}} [ports]
 */
export function readNeedsYou({ roots = queueRoots(), exists = existsSync, exec = (root) => String(execFileSync('node', [join(root, 'scripts/operations/operator-queue.mjs')], { cwd: root, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] })) } = {}) {
  const root = findRoot('scripts/operations/operator-queue.mjs', { roots, exists });
  if (!root) return { error: 'operator-queue.mjs is not on any checkout found' };
  let text;
  try { text = exec(root); } catch (e) { return { error: `operator-queue failed: ${String(e.message ?? e).split('\n')[0]}` }; }
  const lines = parseNeedsYou(text);
  if (lines === null) return { error: 'operator-queue printed no NEEDS YOU section' };
  return { lines };
}
