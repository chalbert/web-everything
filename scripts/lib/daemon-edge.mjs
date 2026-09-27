/**
 * @file scripts/lib/daemon-edge.mjs
 * @description Slice 1 of the `daemon-edge` integration branch (epic we:backlog/x59tqsg, parent #4075) — keeps a
 *   KEPT branch `daemon-edge` on origin that carries `main` plus every registered daemon-fix PR, merged in ONCE.
 *
 * WHY. The per-clone overlay list (`daemon-overlays.mjs` + `daemon-rebuild.mjs#planRebuild`) re-merges every
 * overlay onto `main` from scratch on every rebuild and never keeps the result. When two overlays clash with each
 * other or with main, the rebuild drops one (or, for a pinned one, freezes the clone) — and nobody ever resolves
 * the clash, so it recurs every tick. Live 2026-09-26/27 the orchestrator swapped overlays by hand four times.
 * A kept branch changes the unit of work: a clash is resolved ONCE (by a dispatched resolver — slice 2) and the
 * resolution is kept, because the next tick merges onto the resolved tip instead of starting over.
 *
 * WHAT THIS SLICE DOES (and nothing more). One "edge tick":
 *   1. merge `main` into `daemon-edge` (mechanical; a conflict is recorded as an OWED resolution);
 *   2. for each registered PR, in registration order:
 *        - OPEN (or unknown) and its head is not yet in edge → merge it in (a conflict → OWED, never dropped);
 *        - MERGED on main → `landed`; `retired` once the main merge that carries it is in edge;
 *        - CLOSED unmerged and in edge → revert it out of edge (a conflict → OWED); never in edge → `retired`;
 *   3. an OWED record clears itself the moment its step later succeeds or becomes moot (a resolver pushed a
 *      merge that makes the PR head an ancestor of edge, main moved on, the PR was closed, …).
 * The resolver dispatch (slice 2), the shadow run (slice 3) and daemons actually running edge (slice 4) are NOT
 * here. Nothing in the daemon tick calls this module yet.
 *
 * THE FLAG. `WE_DAEMON_EDGE=1` (default OFF). With it off, {@link runEdgeTick} refuses to push (a dry run still
 * computes the plan), and `daemon-overlay.mjs add` does not touch the edge ledger — overlay behavior is
 * byte-for-byte unchanged.
 *
 * PURE CORE / IO SHELL (same convention as `daemon-rebuild.mjs`): {@link planEdgeTick} and
 * {@link admissionCheck} take an injected `git(args)` runner and `prState(pr)` lookup and do no other IO; the
 * merges they compute are object-DB-only (`merge-tree --write-tree` + `commit-tree`), so a killed tick leaves no
 * half-merge anywhere. {@link runEdgeTick} is the IO shell: it fetches into a dedicated scratch bare repo (never
 * a daemon clone), plans, pushes the new tip with a lease on the old one, and writes the ledger.
 *
 * DETERMINISM. Every minted commit uses the fixed rebuild identity and the later parent's committer date
 * ({@link EDGE_IDENTITY_ENV}), so the same inputs mint the same sha on any machine.
 *
 * PUSH SAFETY. Every commit this module mints has the old edge tip as its FIRST parent, so the push is always a
 * fast-forward. It is pushed with `--force-with-lease=refs/heads/daemon-edge:<old tip>` anyway: if a resolver
 * pushed in between, the lease fails, nothing is overwritten, and the next tick re-plans on the resolver's tip.
 */

import { spawnSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { isSafeBranchName } from './daemon-self-sync.mjs';

/** Same fixed identity as `daemon-rebuild.mjs#REBUILD_IDENTITY_ENV` (copied, not imported, so the light overlay CLI
 *  that imports this module never pulls in the whole rebuild graph). A test pins the two equal. */
export const EDGE_IDENTITY_ENV = Object.freeze({
  GIT_AUTHOR_NAME: 'daemon-rebuild',
  GIT_AUTHOR_EMAIL: 'daemon-rebuild@localhost',
  GIT_COMMITTER_NAME: 'daemon-rebuild',
  GIT_COMMITTER_EMAIL: 'daemon-rebuild@localhost',
});

// ── constants ───────────────────────────────────────────────────────────────────────────────────────────────

/** The kept integration branch on origin. */
export const EDGE_BRANCH = 'daemon-edge';
/** The feature flag (default OFF). Only the literal `1`/`true`/`on` turns it on. */
export const EDGE_FLAG_ENV = 'WE_DAEMON_EDGE';
/** Pins the edge ledger + scratch repo root outside any git tree (tests point it at a temp dir). */
export const EDGE_DIR_ENV = 'WE_DAEMON_EDGE_DIR';
/** Soft cap on PRs that are in edge but not yet landed on main — above it, a warning (never a refusal). */
export const EDGE_SOFT_CAP = 4;

/** Per-PR states. `shadowed`/`adopted` are set by slices 3/4; this slice never writes them. */
export const EDGE_STATES = Object.freeze([
  'registered', 'merged', 'owed-resolution', 'shadowed', 'adopted', 'landed', 'reverted', 'retired',
]);

/** @param {NodeJS.ProcessEnv} [env] */
export function edgeEnabled(env = process.env) {
  return /^(1|true|on)$/i.test(String(env?.[EDGE_FLAG_ENV] ?? '').trim());
}

export function edgeDir(env = process.env) {
  const fromEnv = typeof env?.[EDGE_DIR_ENV] === 'string' ? env[EDGE_DIR_ENV].trim() : '';
  return fromEnv || join(homedir(), '.claude', 'daemon-edge');
}

export function edgeLedgerPath(env = process.env) { return join(edgeDir(env), 'ledger.json'); }
function edgeEventsPath(env = process.env) { return join(edgeDir(env), 'events.jsonl'); }
export function edgeWorkRepoPath(env = process.env) { return join(edgeDir(env), 'work.git'); }

// ── small git helpers (pure over the injected runner) ───────────────────────────────────────────────────────

const out = (r) => String(r?.stdout ?? '').trim();

function verifyRev(git, rev) {
  const r = git(['rev-parse', '--verify', '--end-of-options', rev]);
  return r.status === 0 && out(r) ? out(r) : null;
}

/** `true`/`false`, or `null` when git could not answer (fail closed: the caller treats null as "not known"). */
function isAncestor(git, a, b) {
  const r = git(['merge-base', '--is-ancestor', a, b]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  return null;
}

/** Conflicted paths from `merge-tree --write-tree --name-only` output (line 1 is the tree, then paths). */
function conflictPaths(stdout) {
  const lines = String(stdout ?? '').split('\n').map((l) => l.trim());
  const paths = [];
  for (const l of lines.slice(1)) {
    if (!l) break; // a blank line ends the conflicted-file list (informational messages follow)
    paths.push(l);
  }
  return [...new Set(paths)];
}

/**
 * Object-DB three-way merge. Returns `{ok:true, tree}` / `{ok:false, conflict:true, paths}` /
 * `{ok:false, conflict:false, error}`. `base` (optional) forces the merge base — used for a revert.
 */
function mergeTrees(git, ours, theirs, base = null) {
  const args = ['merge-tree', '--write-tree', '--name-only', '--no-messages'];
  if (base) args.push(`--merge-base=${base}`);
  args.push(ours, theirs);
  const r = git(args);
  if (r.status === 0) return { ok: true, tree: String(r.stdout ?? '').split('\n')[0].trim() };
  if (r.status === 1) return { ok: false, conflict: true, paths: conflictPaths(r.stdout) };
  return { ok: false, conflict: false, error: String(r.stderr ?? '').trim().slice(0, 300) || `exit ${r.status}` };
}

function committerDate(git, sha) {
  const r = git(['log', '-1', '--format=%ct', sha]);
  const n = Number(out(r));
  return r.status === 0 && Number.isFinite(n) ? n : 0;
}

/** Mint a commit deterministically (fixed identity from the runner, date = latest parent's). */
function mintCommit(git, tree, parents, message) {
  const date = `@${Math.max(...parents.map((p) => committerDate(git, p)))} +0000`;
  const args = ['commit-tree', tree];
  for (const p of parents) args.push('-p', p);
  args.push('-m', message);
  const r = git(args, { env: { ...EDGE_IDENTITY_ENV, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  return r.status === 0 && out(r) ? out(r) : null;
}

function treeOf(git, sha) { return verifyRev(git, `${sha}^{tree}`); }

/**
 * Find the commit on `edge`'s first-parent chain that brought `head` in: the first commit C (walking back from
 * `edge`) with `head` an ancestor of C but not of C^1. Works whether the merge was minted here or pushed by a
 * resolver. `null` if not found or git could not answer.
 */
function findIntroducingCommit(git, edge, head) {
  const r = git(['rev-list', '--first-parent', '--max-count=2000', edge]);
  if (r.status !== 0) return null;
  for (const c of out(r).split('\n').filter(Boolean)) {
    if (isAncestor(git, head, c) !== true) return null; // walked past it — should not happen if head ⊂ edge
    const p1 = verifyRev(git, `${c}^1`);
    if (!p1) return c; // root commit
    if (isAncestor(git, head, p1) === false) return c;
  }
  return null;
}

// ── owed-resolution records ─────────────────────────────────────────────────────────────────────────────────

/** Stable id for one clash: keyed on what is being brought IN (`theirs`), not on the edge tip, so the same debt
 *  keeps its id (and its `since`) while edge moves on for other reasons. A new PR head / new main is a new debt. */
export function owedId({ kind, pr = null, theirs }) {
  return `${kind}:${pr ?? '-'}:${String(theirs).slice(0, 12)}`;
}

// ── the pure planner ────────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE (all IO through `git` / `prState`): plan one edge tick. Never mutates `entries` or `owed`; returns the
 * new tip, the per-entry next state, the full decision log, and the owed-resolution set after this tick.
 *
 * @param {{
 *   git:(args:string[], opts?:{env?:object})=>{status:number,stdout:string,stderr:string},
 *   mainRef:string, edgeRef:string,
 *   entries?:Array<{pr:number, ref:string, state?:string, headSha?:string|null}>,
 *   owed?:Array<object>,
 *   prState?:(pr:number)=>(Promise<string|null>|string|null),
 *   refFor?:(ref:string)=>string,
 *   softCap?:number,
 * }} o
 */
export async function planEdgeTick({
  git, mainRef, edgeRef, entries = [], owed = [], prState, refFor = (ref) => `refs/remotes/origin/${ref}`,
  softCap = EDGE_SOFT_CAP,
}) {
  const mainSha = verifyRev(git, `${mainRef}^{commit}`);
  if (!mainSha) return { ok: false, reason: 'main-unresolved' };
  const startEdge = verifyRev(git, `${edgeRef}^{commit}`);

  const decisions = [];
  const warnings = [];
  const openOwed = new Map(); // id → record, rebuilt from scratch every tick (a debt not re-seen is cleared)
  const prevOwed = new Map((owed || []).map((o) => [o.id, o]));
  const addOwed = (rec) => {
    const id = owedId(rec);
    openOwed.set(id, { ...rec, id, since: prevOwed.get(id)?.since ?? null });
  };

  // 0. bootstrap — a missing edge starts at main (the IO shell only pushes it when the flag is on).
  let cur = startEdge;
  if (!cur) {
    cur = mainSha;
    decisions.push({ step: 'bootstrap', action: 'create', sha: mainSha });
  }

  // 1. main → edge.
  let mainInEdge = false;
  const mAnc = isAncestor(git, mainSha, cur);
  if (mAnc === true) {
    mainInEdge = true;
    decisions.push({ step: 'main', action: 'noop', reason: 'main-already-in-edge', sha: mainSha });
  } else {
    const m = mergeTrees(git, cur, mainSha);
    if (m.ok) {
      const sha = mintCommit(git, m.tree, [cur, mainSha], `daemon-edge: merge main ${mainSha.slice(0, 12)}`);
      if (sha) {
        cur = sha;
        mainInEdge = true;
        decisions.push({ step: 'main', action: 'merge', sha: mainSha, newTip: sha });
      } else {
        decisions.push({ step: 'main', action: 'error', reason: 'commit-tree-failed', sha: mainSha });
      }
    } else if (m.conflict) {
      addOwed({ kind: 'main-merge', pr: null, ours: cur, theirs: mainSha, paths: m.paths });
      decisions.push({ step: 'main', action: 'owed', reason: 'conflict', sha: mainSha, paths: m.paths });
    } else {
      decisions.push({ step: 'main', action: 'error', reason: 'merge-tree-failed', sha: mainSha, error: m.error });
    }
  }

  // 2. each registered PR, in order.
  const nextEntries = [];
  for (const raw of entries) {
    const entry = { ...raw };
    const { pr, ref } = entry;
    const prev = entry.state || 'registered';
    const state = pr != null && prState ? await prState(pr) : null;
    const headSha = (isSafeBranchName(ref) && verifyRev(git, `${refFor(ref)}^{commit}`)) || entry.headSha || null;
    if (headSha) entry.headSha = headSha;
    const decide = (action, reason, extra = {}) => decisions.push({
      step: 'pr', pr, ref, action, reason, from: prev, ...extra,
    });

    if (prev === 'retired') { nextEntries.push(entry); continue; }

    if (state === 'MERGED') {
      // Its commits become no-ops on the next main merge; retire once that merge is in edge.
      entry.state = mainInEdge ? 'retired' : 'landed';
      decide(entry.state === 'retired' ? 'retire' : 'mark', 'pr-merged');
      nextEntries.push(entry);
      continue;
    }

    if (state === 'CLOSED') {
      if (prev === 'reverted') { nextEntries.push(entry); continue; }
      const inEdge = headSha ? isAncestor(git, headSha, cur) : false;
      if (inEdge !== true) {
        entry.state = 'retired';
        decide('retire', 'pr-closed-never-in-edge');
        nextEntries.push(entry);
        continue;
      }
      const intro = findIntroducingCommit(git, cur, headSha);
      const introP1 = intro ? verifyRev(git, `${intro}^1`) : null;
      if (!intro || !introP1) {
        entry.state = 'owed-resolution';
        addOwed({ kind: 'revert', pr, ours: cur, theirs: headSha, paths: [], why: 'introducing-commit-not-found' });
        decide('owed', 'revert-introducer-not-found');
        nextEntries.push(entry);
        continue;
      }
      // `git revert -m 1 <intro>` in the object DB: base = intro, ours = edge, theirs = intro^1.
      const m = mergeTrees(git, cur, introP1, intro);
      if (m.ok) {
        if (m.tree === treeOf(git, cur)) {
          entry.state = 'reverted';
          decide('noop', 'revert-already-empty');
        } else {
          const sha = mintCommit(git, m.tree, [cur], `daemon-edge: revert PR #${pr} (${ref}) — closed unmerged`);
          if (sha) {
            cur = sha;
            entry.state = 'reverted';
            decide('revert', 'pr-closed', { newTip: sha, introducedBy: intro });
          } else {
            decide('error', 'commit-tree-failed');
          }
        }
      } else if (m.conflict) {
        entry.state = 'owed-resolution';
        addOwed({ kind: 'revert', pr, ours: cur, theirs: intro, paths: m.paths });
        decide('owed', 'revert-conflict', { paths: m.paths });
      } else {
        decide('error', 'merge-tree-failed', { error: m.error });
      }
      nextEntries.push(entry);
      continue;
    }

    // OPEN or unknown PR state — make sure its current head is in edge.
    if (!headSha) {
      decide('noop', 'ref-unresolved');
      nextEntries.push(entry);
      continue;
    }
    const anc = isAncestor(git, headSha, cur);
    if (anc === true) {
      entry.state = prev === 'shadowed' || prev === 'adopted' ? prev : 'merged';
      decide('noop', 'head-already-in-edge');
      nextEntries.push(entry);
      continue;
    }
    const m = mergeTrees(git, cur, headSha);
    if (m.ok) {
      if (m.tree === treeOf(git, cur)) {
        // content already in edge (e.g. squash-landed on main) — nothing to mint.
        entry.state = 'merged';
        decide('noop', 'content-already-in-edge');
      } else {
        const sha = mintCommit(git, m.tree, [cur, headSha], `daemon-edge: merge PR #${pr} (${ref}) ${headSha.slice(0, 12)}`);
        if (sha) {
          cur = sha;
          entry.state = 'merged';
          decide('merge', prev === 'registered' ? 'registered' : 'head-moved', { newTip: sha, head: headSha });
        } else {
          decide('error', 'commit-tree-failed');
        }
      }
    } else if (m.conflict) {
      entry.state = 'owed-resolution';
      addOwed({ kind: 'pr-merge', pr, ours: cur, theirs: headSha, paths: m.paths });
      decide('owed', 'conflict', { paths: m.paths, head: headSha });
    } else {
      decide('error', 'merge-tree-failed', { error: m.error });
    }
    nextEntries.push(entry);
  }

  // 3. bounds.
  const unlanded = nextEntries.filter((e) => ['merged', 'owed-resolution', 'shadowed', 'adopted', 'registered'].includes(e.state || 'registered'));
  if (unlanded.length > softCap) {
    warnings.push({ kind: 'edge-soft-cap', count: unlanded.length, cap: softCap, prs: unlanded.map((e) => e.pr) });
  }

  const cleared = [...prevOwed.keys()].filter((id) => !openOwed.has(id));
  return {
    ok: true,
    mainSha,
    startEdge,
    finalSha: cur,
    moved: cur !== startEdge,
    decisions,
    entries: nextEntries,
    owed: [...openOwed.values()],
    clearedOwed: cleared,
    warnings,
  };
}

/**
 * PURE: the admission check run when a PR is registered — does its head merge cleanly onto main, and onto the
 * current edge? A clash with MAIN means the fix itself must be rebased before it can land anywhere, so the CLI
 * refuses it (unless forced). A clash with EDGE only means another fix touches the same lines: it is admitted,
 * and the next tick records it as an owed resolution.
 */
export function admissionCheck({ git, headSha, mainRef, edgeRef }) {
  const mainSha = verifyRev(git, `${mainRef}^{commit}`);
  const edgeSha = verifyRev(git, `${edgeRef}^{commit}`);
  const probe = (target) => {
    if (!target) return { status: 'absent' };
    if (isAncestor(git, headSha, target) === true) return { status: 'contained' };
    const m = mergeTrees(git, target, headSha);
    if (m.ok) return { status: 'clean' };
    return m.conflict ? { status: 'conflict', paths: m.paths } : { status: 'error', error: m.error };
  };
  const main = probe(mainSha);
  const edge = probe(edgeSha);
  const admit = main.status !== 'conflict' && main.status !== 'error';
  return { admit, main, edge, mainSha, edgeSha };
}

// ── ledger (repo-wide: there is ONE daemon-edge, not one per clone) ─────────────────────────────────────────

const EMPTY_LEDGER = Object.freeze({ entries: [], owed: [], lastTick: null });

/** Never throws. A corrupt file is `{...EMPTY, corrupt:true}` — callers must refuse to write over it. */
export function readEdgeLedger(env = process.env) {
  let raw;
  try { raw = readFileSync(edgeLedgerPath(env), 'utf8'); } catch (e) {
    return { ...EMPTY_LEDGER, entries: [], owed: [], corrupt: !(e && e.code === 'ENOENT') };
  }
  try {
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.entries) || !Array.isArray(p.owed)) throw new Error('shape');
    return { entries: p.entries, owed: p.owed, lastTick: p.lastTick ?? null, corrupt: false };
  } catch {
    return { ...EMPTY_LEDGER, entries: [], owed: [], corrupt: true };
  }
}

export function writeEdgeLedger(ledger, env = process.env) {
  const file = edgeLedgerPath(env);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ entries: ledger.entries, owed: ledger.owed, lastTick: ledger.lastTick ?? null }, null, 2), 'utf8');
  renameSync(tmp, file);
}

export function appendEdgeEvent(event, env = process.env) {
  const file = edgeEventsPath(env);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, 'utf8');
}

/** Add (or refresh) a PR in the ledger. Re-registering keeps position and state. Throws on a corrupt ledger. */
export function registerEdgeEntry({ pr, ref, by = null, reason = null, admission = null, now }, env = process.env) {
  if (!Number.isInteger(pr)) throw new TypeError(`daemon-edge: --pr must be an integer, got ${JSON.stringify(pr)}`);
  if (!isSafeBranchName(ref)) throw new TypeError(`daemon-edge: ref ${JSON.stringify(ref)} is not a safe branch name`);
  const ledger = readEdgeLedger(env);
  if (ledger.corrupt) throw new Error(`daemon-edge: ledger ${edgeLedgerPath(env)} is corrupt — refusing to overwrite it`);
  const entries = ledger.entries.slice();
  const idx = entries.findIndex((e) => e.pr === pr);
  if (idx === -1) {
    entries.push({ pr, ref, state: 'registered', headSha: null, addedAt: now || new Date().toISOString(), addedBy: by, reason, admission });
  } else {
    const prevState = entries[idx].state;
    // A retired/reverted PR re-registered (reopened) goes back through the pipeline.
    const state = prevState === 'retired' || prevState === 'reverted' ? 'registered' : prevState;
    entries[idx] = { ...entries[idx], ref, reason: reason ?? entries[idx].reason, admission, state };
  }
  writeEdgeLedger({ ...ledger, entries }, env);
  return entries;
}

// ── IO shell ────────────────────────────────────────────────────────────────────────────────────────────────

/** Default runner: spawnSync git, bounded, SIGKILL on timeout. */
export function defaultGitRunner(cwd, env = process.env) {
  return (args, opts = {}) => {
    const r = spawnSync('git', args, {
      cwd, encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL',
      env: { ...env, GIT_TERMINAL_PROMPT: '0', ...(opts.env || {}) },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error) : '') };
  };
}

/** Create (once) the dedicated scratch bare repo the edge tick works in — never a daemon clone. */
export function ensureEdgeWorkRepo({ remoteUrl, env = process.env, run = null }) {
  const dir = edgeWorkRepoPath(env);
  if (!existsSync(join(dir, 'HEAD'))) {
    mkdirSync(dir, { recursive: true });
    const r = spawnSync('git', ['init', '--quiet', '--bare', dir], { encoding: 'utf8', timeout: 30_000 });
    if (r.status !== 0) throw new Error(`daemon-edge: git init --bare ${dir} failed: ${r.stderr}`);
  }
  const git = run || defaultGitRunner(dir, env);
  const cur = git(['remote', 'get-url', 'origin']);
  if (cur.status !== 0) git(['remote', 'add', 'origin', remoteUrl]);
  else if (out(cur) !== remoteUrl) git(['remote', 'set-url', 'origin', remoteUrl]);
  return dir;
}

/** Fetch main, edge (may be absent) and every registered ref into refs/remotes/origin/*. */
function fetchAll(git, refs) {
  const specs = [
    `+refs/heads/main:refs/remotes/origin/main`,
    ...refs.filter(isSafeBranchName).map((r) => `+refs/heads/${r}:refs/remotes/origin/${r}`),
  ];
  const main = git(['fetch', '--quiet', 'origin', ...specs]);
  if (main.status !== 0) {
    // one bad ref must not blind the whole tick — fall back to one-by-one
    const m = git(['fetch', '--quiet', 'origin', specs[0]]);
    if (m.status !== 0) return { ok: false, reason: 'fetch-failed', stderr: out({ stdout: m.stderr }) };
    for (const s of specs.slice(1)) git(['fetch', '--quiet', 'origin', s]);
  }
  const e = git(['fetch', '--quiet', 'origin', `+refs/heads/${EDGE_BRANCH}:refs/remotes/origin/${EDGE_BRANCH}`]);
  if (e.status !== 0) git(['update-ref', '-d', `refs/remotes/origin/${EDGE_BRANCH}`]);
  return { ok: true };
}

/**
 * One edge tick. `dryRun` computes and reports without pushing or writing the ledger. A real (non-dry) tick
 * requires the flag ({@link edgeEnabled}) — flag off ⇒ `{ok:false, reason:'flag-off'}` and nothing happens.
 * @param {{remoteUrl:string, env?:NodeJS.ProcessEnv, dryRun?:boolean, prState?:Function, log?:Function}} o
 */
export async function runEdgeTick({
  remoteUrl, env = process.env, dryRun = false, prState = null, log = () => {},
}) {
  if (!dryRun && !edgeEnabled(env)) return { ok: false, reason: 'flag-off' };
  const ledger = readEdgeLedger(env);
  if (ledger.corrupt) return { ok: false, reason: 'ledger-corrupt' };
  const dir = ensureEdgeWorkRepo({ remoteUrl, env });
  const git = defaultGitRunner(dir, env);
  const f = fetchAll(git, ledger.entries.filter((e) => e.state !== 'retired').map((e) => e.ref));
  if (!f.ok) return f;

  const plan = await planEdgeTick({
    git,
    mainRef: 'refs/remotes/origin/main',
    edgeRef: `refs/remotes/origin/${EDGE_BRANCH}`,
    entries: ledger.entries,
    owed: ledger.owed,
    prState: prState || ((pr) => defaultPrStateForRemote({ pr, remoteUrl })),
  });
  if (!plan.ok) return plan;
  const nowIso = new Date().toISOString();
  for (const o of plan.owed) if (!o.since) o.since = nowIso;
  if (dryRun) return { ...plan, dryRun: true };

  let pushed = false;
  if (plan.moved) {
    const lease = `--force-with-lease=refs/heads/${EDGE_BRANCH}:${plan.startEdge || ''}`;
    const p = git(['push', '--quiet', lease, 'origin', `${plan.finalSha}:refs/heads/${EDGE_BRANCH}`]);
    if (p.status !== 0) {
      // Someone (a resolver) moved edge under us. Nothing overwritten; the next tick re-plans on their tip.
      appendEdgeEvent({ kind: 'push-lease-lost', from: plan.startEdge, to: plan.finalSha }, env);
      log(`daemon-edge: push lost the lease (edge moved) — will re-plan next tick`);
      return { ...plan, ok: false, reason: 'lease-lost' };
    }
    pushed = true;
  }
  writeEdgeLedger({ entries: plan.entries, owed: plan.owed, lastTick: { at: nowIso, edge: plan.finalSha, main: plan.mainSha } }, env);
  for (const d of plan.decisions) if (d.action !== 'noop') appendEdgeEvent({ kind: `decision:${d.action}`, ...d }, env);
  for (const id of plan.clearedOwed) appendEdgeEvent({ kind: 'owed-cleared', id }, env);
  for (const w of plan.warnings) { appendEdgeEvent(w, env); log(`daemon-edge: warning ${w.kind} (${w.count} > ${w.cap})`); }
  return { ...plan, pushed };
}

/**
 * Register a PR for the edge: fetch, run the {@link admissionCheck} against main + edge, and (unless it clashes
 * with main and `force` is not set, or this is a dry run) write it to the ledger. The merge itself happens on
 * the next {@link runEdgeTick} — registration never moves the branch. Requires the flag unless `dryRun`.
 */
export function registerPr({
  pr, ref, remoteUrl, env = process.env, force = false, dryRun = false, by = null, reason = null,
}) {
  if (!dryRun && !edgeEnabled(env)) return { ok: false, reason: 'flag-off' };
  if (!isSafeBranchName(ref)) return { ok: false, reason: 'unsafe-ref' };
  const dir = ensureEdgeWorkRepo({ remoteUrl, env });
  const git = defaultGitRunner(dir, env);
  const f = fetchAll(git, [ref]);
  if (!f.ok) return f;
  const headSha = verifyRev(git, `refs/remotes/origin/${ref}^{commit}`);
  if (!headSha) return { ok: false, reason: 'ref-unresolved' };
  const admission = admissionCheck({
    git, headSha, mainRef: 'refs/remotes/origin/main', edgeRef: `refs/remotes/origin/${EDGE_BRANCH}`,
  });
  const record = { main: admission.main.status, edge: admission.edge.status, headSha };
  if (!admission.admit && !force) return { ok: false, reason: 'admission-refused', admission };
  if (dryRun) return { ok: true, dryRun: true, admission };
  const entries = registerEdgeEntry({ pr, ref, by, reason, admission: record }, env);
  appendEdgeEvent({ kind: 'registered', pr, ref, by, admission: record, forced: !admission.admit }, env);
  const unlanded = entries.filter((e) => !['landed', 'reverted', 'retired'].includes(e.state)).length;
  const warnings = unlanded > EDGE_SOFT_CAP ? [{ kind: 'edge-soft-cap', count: unlanded, cap: EDGE_SOFT_CAP }] : [];
  return { ok: true, admission, entries, warnings };
}

function slugFromUrl(url) {
  const m = String(url || '').trim().match(/github\.com[:/]+([^/]+)\/([^/.]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** `gh pr view` → OPEN/MERGED/CLOSED, or null on any failure (never acted on: unknown ≠ closed). */
export function defaultPrStateForRemote({ pr, remoteUrl }) {
  const slug = slugFromUrl(remoteUrl);
  if (!slug || pr == null) return null;
  const r = spawnSync('gh', ['pr', 'view', String(pr), '--repo', slug, '--json', 'state', '-q', '.state'], {
    encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
  return r.status === 0 && out(r) ? out(r) : null;
}
