/**
 * @file scripts/lib/salvage-index.mjs
 * @description The READ side of lane salvage (`we:scripts/lib/lane-salvage.mjs`): a backup nobody looks at is
 *   useless, so the index is what makes salvaged work findable and self-cleaning.
 *
 *   - {@link salvageHintFor} / {@link withSalvageHint}: when a dispatcher starts a session for a card or PR that
 *     has a NOT-landed salvage entry, the brief gets one line pointing at it.
 *   - {@link refreshSalvageIndex}: marks an entry `landed` once its salvaged content is already on
 *     `origin/<branch>` (needs no attention), and EXPIRES entries (files, refs, index row) older than 14 days.
 *   - {@link backfillSalvageDir}: indexes a salvage made by hand (the operator's 2026-09-26 21:36/21:42 ET runs,
 *     `<root>/<stamp>/lane-N.{bundle,uncommitted.patch,unpushed.txt,untracked.txt}`).
 *
 * The index is `<salvageRoot>/index.jsonl`; every rewrite runs under `withFileLock` so a concurrent salvage's
 * append is never lost.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { withFileLock } from './atomic-json-file.mjs';
import { resolveSalvageRoot, salvageIndexPath, deriveSalvageTargets, SALVAGE_DIR_ENV } from './lane-salvage.mjs';

export const SALVAGE_RETENTION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
const tryGit = (dir, args) => { try { return git(dir, args); } catch { return null; } };

/** Tolerant jsonl read — a torn/corrupt line is skipped, never thrown. */
export function readSalvageIndex(root = resolveSalvageRoot()) {
  const p = salvageIndexPath(root);
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip a torn line */ }
  }
  return out;
}

/** Rewrite the index under its lock: `mutate(entries) → entries`. */
export function updateSalvageIndex(root, mutate) {
  const p = salvageIndexPath(root);
  return withFileLock(`${p}.lock`, () => {
    const next = mutate(readSalvageIndex(root));
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, next.map((e) => JSON.stringify(e)).join('\n') + (next.length ? '\n' : ''));
    renameSync(tmp, p);
    return next;
  });
}

/** PURE: the not-landed entries for any of these card ids / PR numbers, newest first. */
export function salvageEntriesFor(entries, { cards = [], prs = [] } = {}) {
  const c = new Set(cards.filter((x) => x != null && x !== '').map((x) => String(x).toLowerCase()));
  const p = new Set(prs.map(Number).filter(Number.isInteger));
  if (!c.size && !p.size) return [];
  return entries
    .filter((e) => e && !e.landed && !e.expired
      && ((e.cards || []).some((x) => c.has(String(x).toLowerCase())) || (e.prs || []).some((x) => p.has(Number(x)))))
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/** PURE: the one brief line, or `null`. */
export function salvageHintLine(matches) {
  if (!matches.length) return null;
  const where = matches.map((e) => e.bundle || e.outDir).filter(Boolean);
  return `Earlier unfinished work for this item was salvaged at ${where.join(', ')} — inspect/reuse before starting over ` +
    `(\`git fetch <bundle> 'refs/salvage/*:refs/salvage/*'\`, or apply the .uncommitted.patch next to it).`;
}

/** IO: the hint for a dispatch, never throwing (a dispatch must not fail over a hint). */
export function salvageHintFor({ cards = [], prs = [], root = null, env = process.env } = {}) {
  // Under vitest, never read the operator's REAL salvage store unless a test points at one explicitly.
  if (!root && env.VITEST && !env[SALVAGE_DIR_ENV]) return null;
  root = root || resolveSalvageRoot(env);
  try { return salvageHintLine(salvageEntriesFor(readSalvageIndex(root), { cards, prs })); } catch { return null; }
}

/** IO: append the hint to a prompt when there is one. */
export function withSalvageHint(prompt, { cards = [], prs = [], root } = {}) {
  if (typeof prompt !== 'string' || !prompt) return prompt;
  const hint = salvageHintFor({ cards, prs, ...(root ? { root } : {}) });
  return hint ? `${prompt}\n\n${hint}\n` : prompt;
}

/**
 * Is every salvaged snapshot's content already on `branchRef`? Per snapshot tip (wip, else head): the files it
 * changed vs its merge-base must be identical on `branchRef`. Needs the objects: fetched from the bundle into
 * `repoDir` when missing. Returns `null` when it cannot tell (no repo, no bundle).
 */
export function isSalvageLanded(entry, { repoDir, branchRef = 'origin/main' }) {
  if (!repoDir || !existsSync(repoDir)) return null;
  const tips = (entry.snapshots || []).map((s) => s.wipSha || s.headSha).filter(Boolean);
  if (!tips.length) return null;
  const missing = tips.some((t) => tryGit(repoDir, ['cat-file', '-e', `${t}^{commit}`]) === null);
  if (missing) {
    if (!entry.bundle || !existsSync(entry.bundle)) return null;
    if (tryGit(repoDir, ['fetch', '-q', entry.bundle, 'refs/salvage/*:refs/salvage/*']) === null) return null;
  }
  const covered = new Set();
  for (const tip of tips) {
    const base = tryGit(repoDir, ['merge-base', branchRef, tip]);
    if (!base) return null;
    const files = (tryGit(repoDir, ['diff', '--name-only', base.trim(), tip]) || '').split('\n').filter(Boolean);
    if (!files.length) continue;
    const diff = tryGit(repoDir, ['diff', '--name-only', branchRef, tip, '--', ...files]);
    if (diff === null) return null;
    if (diff.trim()) return false;
    for (const f of files) covered.add(f);
  }
  // A file the entry lists as changed but no tip carries (e.g. an untracked file held only in a `git stash`'s
  // third parent, from a hand-made salvage) cannot be proven landed — say "unknown", never "landed".
  if ((entry.changedFiles || []).some((f) => !covered.has(f))) return null;
  return covered.size > 0 ? true : null;
}

/** PURE: parse a salvage stamp (`20260926-2136` or `20260927-015411`) as UTC ms; `null` if unparsable. */
export function parseSalvageStamp(stamp) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})?$/.exec(String(stamp || ''));
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

/**
 * Mark landed entries, expire old ones. Expiry deletes the entry's files, its `refs/salvage/*` in its lane (when
 * the lane still exists), its now-empty stamp dir, and the index row. `dryRun` reports without changing anything.
 * @returns {{landed:object[], expired:object[], bytesFreed:number, kept:number}}
 */
export function refreshSalvageIndex({ root = resolveSalvageRoot(), branchRef = 'origin/main', nowMs = Date.now(), retentionDays = SALVAGE_RETENTION_DAYS, dryRun = false, repoDirFor = (e) => e.dir } = {}) {
  const landed = []; const expired = []; let bytesFreed = 0;
  const cutoff = nowMs - retentionDays * DAY_MS;
  const decide = (entries) => {
    const keep = [];
    for (const e of entries) {
      const t = Date.parse(e.ts) || parseSalvageStamp(e.stamp) || nowMs;
      if (t < cutoff) {
        for (const f of entryFiles(e)) { try { bytesFreed += statSync(f).size; } catch { /* gone */ } }
        expired.push(e);
        continue;
      }
      if (!e.landed) {
        const ok = isSalvageLanded(e, { repoDir: repoDirFor(e), branchRef });
        if (ok === true) { landed.push(e); e.landed = true; e.landedAt = new Date(nowMs).toISOString(); }
      }
      keep.push(e);
    }
    return keep;
  };
  if (dryRun) {
    decide(readSalvageIndex(root).map((e) => ({ ...e })));
  } else if (existsSync(salvageIndexPath(root))) {
    updateSalvageIndex(root, decide);
    for (const e of expired) deleteEntryArtifacts(e);
  }
  return { landed, expired, bytesFreed, kept: readSalvageIndex(root).length };
}

function entryFiles(e) {
  const files = new Set([e.bundle, ...(e.patches || [])].filter(Boolean));
  if (e.outDir && existsSync(e.outDir)) {
    for (const f of readdirSync(e.outDir)) if (f.startsWith(`lane-${e.lane}.`)) files.add(join(e.outDir, f));
  }
  return [...files];
}

function deleteEntryArtifacts(e) {
  for (const f of entryFiles(e)) rmSync(f, { force: true });
  if (e.outDir && existsSync(e.outDir)) { try { if (!readdirSync(e.outDir).length) rmSync(e.outDir, { recursive: true }); } catch { /* keep */ } }
  if (e.dir && existsSync(e.dir)) {
    // Every ref this salvage made, including ones an older index row did not list (`refs/salvage/lane-N-<stamp>-*`).
    const byPrefix = e.lane != null && e.stamp
      ? (tryGit(e.dir, ['for-each-ref', '--format=%(refname)', `refs/salvage/lane-${e.lane}-${e.stamp}-*`]) || '').split('\n').filter(Boolean)
      : [];
    for (const r of new Set([...(e.refs || []), ...(e.localRefs || []), ...byPrefix])) tryGit(e.dir, ['update-ref', '-d', r]);
  }
}

/**
 * Index a hand-made salvage dir (`<dir>/lane-N.bundle` + siblings) that has no index rows yet. Idempotent: a
 * bundle already indexed is skipped. `laneDirFor(n)` gives the lane path (for its history ledger + refs).
 * @returns {object[]} the rows added
 */
export function backfillSalvageDir({ dir, pool, root = resolveSalvageRoot(), laneDirFor = () => null, readLastHolder = () => null, now = new Date() }) {
  if (!existsSync(dir)) return [];
  const stamp = basename(dir);
  const known = new Set(readSalvageIndex(root).map((e) => e.bundle).filter(Boolean));
  const rows = [];
  for (const f of readdirSync(dir).filter((x) => /^lane-\d+\.bundle$/.test(x)).sort()) {
    const bundle = join(dir, f);
    if (known.has(bundle)) continue;
    const lane = Number(/^lane-(\d+)\./.exec(f)[1]);
    const laneDir = laneDirFor(lane);
    const headsText = tryGit(laneDir && existsSync(laneDir) ? laneDir : dirname(bundle), ['bundle', 'list-heads', bundle]) || '';
    const refs = headsText.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2 && p[1].startsWith('refs/salvage/'));
    const head = refs.find(([, r]) => r.endsWith('-head'));
    const wip = refs.find(([, r]) => r.endsWith('-wip'));
    const patch = join(dir, `lane-${lane}.uncommitted.patch`);
    const changed = new Set();
    if (existsSync(patch)) for (const m of readFileSync(patch, 'utf8').matchAll(/^diff --git a\/(\S+) b\//gm)) changed.add(m[1]);
    const untracked = join(dir, `lane-${lane}.untracked.txt`);
    if (existsSync(untracked)) for (const l of readFileSync(untracked, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean)) changed.add(l);
    const lh = readLastHolder(lane) || {};
    const targets = deriveSalvageTargets({ purpose: lh.purpose, holder: lh.holder, session: lh.session });
    const ts = parseSalvageStamp(stamp);
    rows.push({
      ts: new Date(ts ?? now.getTime()).toISOString(), pool, lane, dir: laneDir, stamp, outDir: dir, bundle,
      patches: existsSync(patch) ? [patch] : [], reason: 'operator manual salvage (backfilled into the index)',
      lastHolder: { purpose: lh.purpose ?? null, holder: lh.holder ?? null, session: lh.session ?? null },
      branch: null, head: head ? head[0] : null, cards: targets.cards, prs: targets.prs,
      changedFiles: [...changed].sort(), refs: refs.map(([, r]) => r),
      snapshots: head || wip ? [{ worktree: null, headSha: head ? head[0] : null, wipSha: wip ? wip[0] : null, aheadCount: null, dirtyCount: null }] : [],
      landed: false, backfilled: true, recover: `git fetch ${bundle} 'refs/salvage/*:refs/salvage/*'`,
    });
  }
  if (rows.length) updateSalvageIndex(root, (entries) => [...entries, ...rows]);
  return rows;
}
