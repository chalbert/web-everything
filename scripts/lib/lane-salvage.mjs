/**
 * @file scripts/lib/lane-salvage.mjs
 * @description SNAPSHOT-THEN-RECLAIM for an abandoned pool lane.
 *
 * WHY. The lane pool starved to ZERO acquirable lanes (2026-09-27, 90-lane WE pool: 16 leased, 74 unleased but
 * dirty). Finished or killed sessions left uncommitted edits, unpushed commits and `.claude/worktrees/*`
 * litter behind. `lane-whois.mjs` rightly refuses to auto-reclaim a lane whose content it cannot prove is
 * already on a remote ref (`finished-needs-review` / `unknown-work`). So those lanes were kept forever, and
 * the review daemon deferred every owed review ("no acquirable lane this tick").
 *
 * Deleting that work is unsafe. Keeping it forever starves the pool. This module is the third option: save
 * everything durably and recoverably FIRST, prove the save, and only then let `lane-pool.mjs reclaim
 * --salvage` reset the lane. The layout matches the operator's manual salvage of 2026-09-26 21:36 ET:
 *
 *   <salvageRoot>/<pool>/<stamp>/lane-N.bundle             git bundle of every salvage ref (minus origin/<branch>)
 *   <salvageRoot>/<pool>/<stamp>/lane-N.uncommitted.patch  `git diff --binary HEAD <wip>` (tracked + untracked)
 *   <salvageRoot>/<pool>/<stamp>/lane-N.unpushed.txt       `git log --oneline origin/<branch>..HEAD`
 *   <salvageRoot>/index.jsonl                              one line per salvaged lane (what, where, why)
 *   refs/salvage/lane-N-<stamp>-head / -wip                 also kept in the lane's own repo
 *
 * A registered worktree under `<lane>/.claude/worktrees/` (litter from the bg-isolation EnterWorktree episode)
 * is snapshotted the same way (`...-wt-<name>-head/-wip`) into the SAME bundle, then removed with
 * `git worktree remove --force` + `git worktree prune` — never an `rm -rf`.
 *
 * Recover: `git fetch <bundle> 'refs/salvage/*:refs/salvage/*'` in any WE clone, or `git apply` the patch.
 *
 * PURE CORE / IO SHELL: {@link salvageStamp}, {@link salvageRefNames}, {@link salvageEligibility},
 * {@link parseLsofCwds} and {@link isWorktreeLitterPath} are pure. Everything else shells git/lsof.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, statSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/** Env override for where salvage lands; default `~/.claude/lane-salvage` (the operator's manual location). */
export const SALVAGE_DIR_ENV = 'WE_LANE_SALVAGE_DIR';
/** Env override (minutes) for the quiet period: a lane touched more recently than this is never salvaged. */
export const SALVAGE_QUIET_ENV = 'WE_LANE_SALVAGE_QUIET_MIN';
export const DEFAULT_SALVAGE_QUIET_MIN = 30;
export const WORKTREE_LITTER_PREFIX = '.claude/worktrees/';

export function resolveSalvageRoot(env = process.env, home = homedir()) {
  return env[SALVAGE_DIR_ENV] && env[SALVAGE_DIR_ENV].trim() ? env[SALVAGE_DIR_ENV].trim() : join(home, '.claude', 'lane-salvage');
}

export function resolveSalvageQuietMs(env = process.env) {
  const n = Number(env[SALVAGE_QUIET_ENV]);
  return (Number.isFinite(n) && n >= 0 ? n : DEFAULT_SALVAGE_QUIET_MIN) * 60_000;
}

/** PURE: a sortable UTC stamp, `YYYYMMDD-HHMMSS`. */
export function salvageStamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
}

/** PURE: the salvage ref pair for a lane (or one of its worktrees). Same shape as the manual salvage's refs. */
export function salvageRefNames({ lane, stamp, worktree = null }) {
  const safeWt = worktree ? String(worktree).replace(/[^A-Za-z0-9._-]/g, '_') : null;
  const base = `refs/salvage/lane-${lane}-${stamp}${safeWt ? `-wt-${safeWt}` : ''}`;
  return { head: `${base}-head`, wip: `${base}-wip` };
}

/** PURE: is a porcelain path worktree litter (handled by the worktree snapshot, never by `git add`)? */
export function isWorktreeLitterPath(p) {
  return String(p || '').replace(/^\.\//, '').startsWith(WORKTREE_LITTER_PREFIX);
}

/**
 * PURE: parse `lsof -d cwd -Fpn` output into `[{pid, cwd}]`.
 * @param {string} text
 */
export function parseLsofCwds(text) {
  const out = [];
  let pid = null;
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && Number.isInteger(pid)) out.push({ pid, cwd: line.slice(1) });
  }
  return out;
}

/** PURE: does any not-finished `claude agents` entry belong to this lane — its session is one of `sessionIds`,
 *  or its cwd is the lane or anywhere inside it (a `.claude/worktrees/<x>` agent counts)? An entry with no
 *  state at all counts as live: only an explicit terminal state proves a session finished. */
export function liveAgentInLane(agents, dir, sessionIds = []) {
  const DONE = new Set(['done', 'failed', 'stopped', 'completed', 'killed']);
  const root = resolve(dir);
  const ids = new Set(sessionIds.filter(Boolean));
  return (Array.isArray(agents) ? agents : []).some((a) => {
    if (!a || DONE.has(a.state)) return false;
    const cwd = typeof a.cwd === 'string' ? resolve(a.cwd) : '';
    return ids.has(a.sessionId) || cwd === root || cwd.startsWith(root + sep);
  });
}

/** `claude agents --json`, FAIL-CLOSED: `null` when it cannot be read (callers then refuse to salvage). */
export function readAgentsStrict({ exec = execFileSync } = {}) {
  try {
    const parsed = JSON.parse(exec('claude', ['agents', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }));
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

/** PURE: the pids (other than `selfPid`) whose cwd is `dir` or inside it. */
export function pidsWithCwdIn(cwds, dir, selfPid = process.pid) {
  const root = resolve(dir);
  let real = root;
  try { real = realpathSync(root); } catch { /* pure callers pass synthetic paths */ }
  return cwds
    .filter((c) => c.pid !== selfPid && [root, real].some((r) => c.cwd === r || c.cwd.startsWith(r + sep)))
    .map((c) => c.pid);
}

/**
 * PURE: may this lane be salvaged-and-reset automatically right now? Every guard must pass:
 *   - not leased (a live lease means someone is using it),
 *   - no live owner session (`lane-whois.mjs`'s `liveOwner` — a `claude agents` hit),
 *   - no live process has its cwd inside the lane (a shell or agent still sitting there),
 *   - quiet: nothing in the lane changed within `quietMs` (a session mid-edit is never snapshotted under it).
 * @param {{leased:boolean, liveOwner:boolean, livePids:number[], newestMtimeMs:(number|null), nowMs:number, quietMs:number}} f
 * @returns {{eligible:boolean, reason:string}}
 */
export function salvageEligibility({ leased, liveOwner, livePids = [], newestMtimeMs = null, nowMs, quietMs }) {
  if (leased) return { eligible: false, reason: 'lane is leased — never salvaged under a live holder' };
  if (liveOwner) return { eligible: false, reason: 'owning session is still live (claude agents)' };
  if (livePids.length) return { eligible: false, reason: `live process(es) have cwd in the lane: pid ${livePids.join(', ')}` };
  if (Number.isFinite(newestMtimeMs) && nowMs - newestMtimeMs < quietMs) {
    const mins = Math.round((nowMs - newestMtimeMs) / 60_000);
    return { eligible: false, reason: `lane content changed ${mins} min ago (< ${Math.round(quietMs / 60_000)} min quiet period)` };
  }
  return { eligible: true, reason: 'unleased, no live owner or process, quiet' };
}

// ── IO shell ────────────────────────────────────────────────────────────────────────────────────────────

const GIT_TIMEOUT_MS = 120_000;
const git = (dir, args, extra = {}) => execFileSync('git', args, {
  cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, ...extra,
});

/** Every live process's cwd, via one `lsof` call. `null` when lsof is unavailable (callers treat as unknown ⇒ not eligible). */
export function readLiveCwds({ exec = execFileSync } = {}) {
  try {
    // lsof exits 1 when some processes are unreadable; the output is still valid, so read it from the error too.
    return parseLsofCwds(exec('lsof', ['-n', '-d', 'cwd', '-Fpn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, timeout: 30_000 }));
  } catch (e) {
    if (e && typeof e.stdout === 'string' && e.stdout.length) return parseLsofCwds(e.stdout);
    return null;
  }
}

/** Porcelain paths (NUL-safe), `-uall`, split into tracked-changed and untracked, worktree litter excluded. */
function dirtyPaths(dir) {
  const raw = git(dir, ['status', '--porcelain=v1', '-z', '-uall']);
  const entries = raw.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const code = e.slice(0, 2);
    const p = e.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // rename/copy: next entry is the source path
    if (!isWorktreeLitterPath(p)) paths.push(p);
  }
  return paths;
}

/** Registered worktrees physically under `<dir>/.claude/worktrees/`. */
export function listLitterWorktrees(dir) {
  // `git worktree list` prints REAL paths (macOS: /private/var/… for a /var/… tmpdir) — compare real to real.
  let root = resolve(dir, '.claude', 'worktrees');
  try { root = join(realpathSync(dir), '.claude', 'worktrees'); } catch { /* keep the resolved path */ }
  const out = [];
  let cur = null;
  for (const line of git(dir, ['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) { cur = { path: line.slice(9) }; out.push(cur); }
  }
  return out
    .filter((w) => w.path.startsWith(root + sep))
    .map((w) => ({ path: w.path, name: w.path.slice(root.length + 1) }));
}

/** Newest mtime (ms) across the lane's dirty paths, its index/HEAD reflog, and each litter worktree's own. */
export function newestContentMtimeMs(dir) {
  let newest = null;
  const bump = (p) => { try { const m = statSync(p).mtimeMs; if (newest === null || m > newest) newest = m; } catch { /* gone */ } };
  const scan = (d) => {
    for (const p of dirtyPaths(d)) bump(join(d, p));
    const gitDir = resolve(d, git(d, ['rev-parse', '--git-dir']).trim());
    bump(join(gitDir, 'index'));
    bump(join(gitDir, 'logs', 'HEAD'));
  };
  scan(dir);
  for (const w of listLitterWorktrees(dir)) { try { scan(w.path); } catch { /* broken worktree — its salvage will say so */ } }
  return newest;
}

/**
 * Snapshot ONE working tree (lane or worktree) into refs WITHOUT touching its working tree or real index: a
 * throwaway index gets HEAD + every tracked change + every untracked (non-ignored) file, written as a `wip`
 * commit whose parent is HEAD. Returns what it saved.
 */
export function snapshotWorkTree(dir, { refs, branchRef }) {
  const headSha = git(dir, ['rev-parse', 'HEAD']).trim();
  const paths = dirtyPaths(dir);
  let wipSha = null;
  if (paths.length) {
    const tmp = mkdtempSync(join(tmpdir(), 'lane-salvage-idx-'));
    try {
      const env = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index') };
      git(dir, ['read-tree', 'HEAD'], { env });
      git(dir, ['add', '-A', '--', '.', `:(exclude)${WORKTREE_LITTER_PREFIX.slice(0, -1)}`], { env });
      const tree = git(dir, ['write-tree'], { env }).trim();
      wipSha = git(dir, ['-c', 'user.name=lane-salvage', '-c', 'user.email=lane-salvage@noreply.local',
        'commit-tree', tree, '-p', headSha, '-m', `lane-salvage: uncommitted + untracked state of ${dir}`], { env }).trim();
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  let aheadCount = 0;
  try { aheadCount = Number(git(dir, ['rev-list', '--count', `${branchRef}..${headSha}`]).trim()) || 0; } catch { aheadCount = 0; }
  // Refs always go into the lane's shared repo (a worktree shares it), so one bundle carries everything.
  git(dir, ['update-ref', refs.head, headSha]);
  if (wipSha) git(dir, ['update-ref', refs.wip, wipSha]);
  return { dir, headSha, wipSha, aheadCount, dirtyCount: paths.length, refs: { head: refs.head, wip: wipSha ? refs.wip : null } };
}

/**
 * Salvage a whole lane: snapshot the lane + every litter worktree, write bundle/patch/unpushed files, VERIFY the
 * bundle carries every salvage ref, and append an index line. Throws on any failure — the caller must not reset
 * a lane whose salvage did not verify. Does NOT remove worktrees or reset (see {@link removeLitterWorktrees}).
 * @returns {{stamp:string, outDir:string, bundle:(string|null), refs:string[], snapshots:object[], worktrees:object[]}}
 */
export function salvageLane({ dir, lane, pool, branchRef, salvageRoot = resolveSalvageRoot(), now = new Date(), reason = '', meta = {}, includeLocalBranches = false }) {
  const stamp = salvageStamp(now);
  const outDir = join(salvageRoot, pool, stamp);
  mkdirSync(outDir, { recursive: true });
  const worktrees = listLitterWorktrees(dir);
  const snapshots = [snapshotWorkTree(dir, { refs: salvageRefNames({ lane, stamp }), branchRef })];
  for (const w of worktrees) {
    snapshots.push({ worktree: w.name, ...snapshotWorkTree(w.path, { refs: salvageRefNames({ lane, stamp, worktree: w.name }), branchRef }) });
  }
  // Only refs with content not already on origin/<branch> go in the bundle (an all-prerequisite ref would make
  // git refuse or silently drop it). Prerequisites are origin/<branch> commits — never force-pushed, always fetchable.
  const bundleRefs = [];
  for (const s of snapshots) {
    if (s.aheadCount > 0) bundleRefs.push({ ref: s.refs.head, sha: s.headSha });
    if (s.refs.wip) bundleRefs.push({ ref: s.refs.wip, sha: s.wipSha });
  }
  // A clone about to be DELETED (not just reset) also carries every local branch / stash with commits no remote
  // ref has — those die with the directory otherwise.
  if (includeLocalBranches) {
    const { head } = salvageRefNames({ lane, stamp });
    const base = head.replace(/-head$/, '');
    for (const line of git(dir, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/stash']).split('\n').filter(Boolean)) {
      const [sha, ref] = line.split(' ');
      let unique = 0;
      try { unique = Number(git(dir, ['rev-list', '--count', sha, '--not', '--remotes']).trim()) || 0; } catch { unique = 0; }
      if (!unique || bundleRefs.some((r) => r.sha === sha)) continue;
      const salvRef = `${base}-ref-${ref.replace(/^refs\//, '').replace(/[^A-Za-z0-9._-]/g, '_')}`;
      git(dir, ['update-ref', salvRef, sha]);
      bundleRefs.push({ ref: salvRef, sha });
    }
  }
  const prefix = join(outDir, `lane-${lane}`);
  let bundle = null;
  if (bundleRefs.length) {
    bundle = `${prefix}.bundle`;
    git(dir, ['bundle', 'create', bundle, ...bundleRefs.map((r) => r.ref), '--not', branchRef]);
    git(dir, ['bundle', 'verify', bundle]);
    const heads = git(dir, ['bundle', 'list-heads', bundle]);
    for (const r of bundleRefs) {
      if (!heads.includes(`${r.sha} ${r.ref}`)) throw new Error(`salvage bundle ${bundle} is missing ${r.ref} (${r.sha}) — not resetting lane-${lane}`);
    }
  }
  for (const s of snapshots) {
    const p = s.worktree ? `${prefix}.wt-${String(s.worktree).replace(/[^A-Za-z0-9._-]/g, '_')}` : prefix;
    writeFileSync(`${p}.uncommitted.patch`, s.wipSha ? git(dir, ['diff', '--binary', s.headSha, s.wipSha]) : '');
    writeFileSync(`${p}.unpushed.txt`, s.aheadCount ? git(dir, ['log', '--oneline', `${branchRef}..${s.headSha}`]) : '');
  }
  const changedFiles = new Set();
  for (const s of snapshots) {
    const tip = s.wipSha || s.headSha;
    try {
      const base = git(dir, ['merge-base', branchRef, tip]).trim();
      for (const f of git(dir, ['diff', '--name-only', base, tip]).split('\n').filter(Boolean)) changedFiles.add(f);
    } catch { /* unrelated history — the patch file still holds the diff */ }
  }
  let branch = null;
  try { branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { branch = null; }
  const worktreeBranches = worktrees.map((w) => { try { return git(w.path, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { return null; } }).filter(Boolean);
  const record = buildSalvageRecord({
    now, pool, lane, dir, stamp, outDir, bundle, reason, branch, meta: { ...meta, worktreeBranches: [...(meta.worktreeBranches || []), ...worktreeBranches] },
    refs: bundleRefs.map((r) => r.ref),
    localRefs: snapshots.flatMap((s) => [s.refs.head, s.refs.wip].filter(Boolean)),
    snapshots: snapshots.map((s) => ({ worktree: s.worktree ?? null, headSha: s.headSha, wipSha: s.wipSha, aheadCount: s.aheadCount, dirtyCount: s.dirtyCount })),
    changedFiles: [...changedFiles].sort(),
    patches: snapshots.map((s) => `${s.worktree ? `${prefix}.wt-${String(s.worktree).replace(/[^A-Za-z0-9._-]/g, '_')}` : prefix}.uncommitted.patch`),
  });
  appendSalvageIndex(salvageRoot, record);
  return { ...record, worktrees };
}

/** Card ids (`NNNN` / `xSLUG`) and PR numbers derivable from a lane's lease purpose/holder/session and branch
 *  names (`fix-2748`, `ci-heal-2783`, `review-2778`, `build-4229`, `lane/4229-slug`, `lane/x9fbg1x-slug`). PURE. */
export function deriveSalvageTargets({ purpose = '', holder = '', session = '', branches = [], cards = [], prs = [] } = {}) {
  const cardIds = new Set(cards.map(String));
  const prNumbers = new Set(prs.map(Number).filter(Number.isInteger));
  for (const s of [purpose, holder, session].filter(Boolean)) {
    const m = /(?:^|[-_])(fix|ci-heal|review|rebase|heal)-(\d{3,5})(?:$|[-_])/.exec(s);
    if (m) prNumbers.add(Number(m[2]));
    const b = /(?:^|[-_])(?:build|conveyor|prepare|item)-(\d{3,5}|x[a-z0-9]{5,7})(?:$|[-_])/i.exec(s);
    if (b) cardIds.add(b[1]);
  }
  for (const br of branches.filter(Boolean)) {
    const m = /^(?:lane\/)?(\d{3,5}|x[a-z0-9]{5,7})-/i.exec(br) || /^worktree-(?:fix|ci-heal|review)-(\d{3,5})$/.exec(br);
    if (m && /^worktree-/.test(br)) prNumbers.add(Number(m[1]));
    else if (m) cardIds.add(m[1]);
  }
  return { cards: [...cardIds], prs: [...prNumbers] };
}

/** PURE: the index row. `landed:false` until {@link refreshSalvageIndex} proves the content is on main. */
export function buildSalvageRecord({ now, pool, lane, dir, stamp, outDir, bundle, reason = '', branch = null, meta = {}, refs, localRefs = refs, snapshots, changedFiles = [], patches = [] }) {
  const lh = meta.lastHolder || {};
  const targets = deriveSalvageTargets({
    purpose: lh.purpose, holder: lh.holder, session: lh.session,
    branches: [branch, ...(meta.worktreeBranches || [])], cards: meta.cards || [], prs: meta.prs || [],
  });
  return {
    ts: now.toISOString(), pool, lane, dir, stamp, outDir, bundle, patches, reason,
    lastHolder: { purpose: lh.purpose ?? null, holder: lh.holder ?? null, session: lh.session ?? null },
    branch, head: snapshots[0]?.headSha ?? null, cards: targets.cards, prs: targets.prs,
    changedFiles, refs, localRefs, snapshots, landed: false,
    recover: bundle ? `git fetch ${bundle} 'refs/salvage/*:refs/salvage/*'` : null,
  };
}

export function salvageIndexPath(salvageRoot = resolveSalvageRoot()) { return join(salvageRoot, 'index.jsonl'); }

export function appendSalvageIndex(salvageRoot, record) {
  mkdirSync(salvageRoot, { recursive: true });
  appendFileSync(salvageIndexPath(salvageRoot), `${JSON.stringify(record)}\n`);
}

/** Remove the (already-salvaged) litter worktrees properly, then prune stale worktree metadata. */
export function removeLitterWorktrees(dir, worktrees) {
  const removed = [];
  for (const w of worktrees) {
    try { git(dir, ['worktree', 'remove', '--force', '--force', w.path]); removed.push(w.name); } catch { /* prune below; clean handles dirs */ }
  }
  try { git(dir, ['worktree', 'prune']); } catch { /* best-effort */ }
  const litterRoot = join(dir, '.claude', 'worktrees');
  if (existsSync(litterRoot)) { try { rmSync(litterRoot, { recursive: false }); } catch { /* not empty — left for the report */ } }
  return removed;
}
