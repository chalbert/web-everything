/**
 * nnn-collision-heal.mjs — the shared merge-TIME NNN-collision self-heal (#2222), the pre-check analogue of
 * the drain's auto-rebase-drop (#2198). Single source of truth reused by every land route: the label lander
 * (`scripts/merge-ai-prs.mjs`, the `/drain`), the self-approved producer (`scripts/pr-land.mjs`), and — folded
 * into the same rebuilt tip — the serial-land rebase-drop route (`scripts/lib/rebase-drop-manifest.mjs`, #2276).
 *
 * WHY (the storm this heals): two parallel lane sessions can allocate the SAME backlog `NNN` for a NEW item —
 * each computes `max(existing)+1` from its own base view and neither can see the other's not-yet-existing file.
 * A PR that adds `backlog/NNN-a.md` goes GREEN in isolation but turns the required `test` check RED the moment
 * it rebases onto a `main` that already carries a DIFFERENT `backlog/NNN-b.md`: two files share the num, so
 * `loadBacklog()`/`buildGraph()` disagree on `tier` and the `ids must be unique` gate (and `backlogGraph.test`)
 * fail. The existing self-heal (#2071) only runs AFTER a clean merge — but under branch protection the merge is
 * BLOCKED on that very red check, so the post-merge heal never runs (the serial-route deadlock, #2276). This
 * heals the tip BEFORE the check: it renumbers the incoming lane's colliding new item to a free GAP id (below
 * the `max+1` frontier so a concurrent scaffold can't re-collide, #2222), rewrites every intra-repo `#NNN` /
 * `blockedBy` reference in the lane corpus, commits the rename onto the `lane/*` ref, and lets CI re-run green.
 *
 * The pure PLAN (`planBaseCollisionHeal`) decides — given the lane's backlog files + the base's ids/names — what
 * to renumber and the reference-rewritten contents; it is unit-tested against in-memory fixtures. The imperative
 * `healNnnCollision` is the git boundary: it detects the collision cheaply (two `ls-tree`s, no content read on
 * the common no-collision path), and only on an actual collision reads the lane corpus and rebuilds a
 * renumbered tip via pure plumbing (hash-object → temp-index → commit-tree → push, NO checkout — so it stays
 * inside the `guard-git-branch` single-branch rule, exactly like rebase-drop). The runner is injectable for tests.
 */

import { spawnSync } from 'node:child_process';
import { parseBacklogFilename, rewriteRefs, allocateGapId } from '../backlog/renumber-collisions.mjs';

/**
 * Build the renumber PLAN for an incoming lane whose NEW backlog item reuses an id already on the merge base.
 * Pure — no fs, no git. Unlike `planRenumber` (which detects INTRA-corpus duplicates), this detects a lane file
 * whose num is present on the BASE under a different file: the base file is the immutable keeper, the lane's new
 * file yields to a free GAP id (below `max+1`, #2222). Every inbound reference to the yielded id is rewritten
 * across the NON-base-owned files in the lane corpus only (only lane-authored refs — a base-owned file's `#NNN`
 * points at the keeper and is left alone by construction, #2316: see the EDGE-CLOBBER GUARD note below).
 *
 * @param {{ name: string, text: string }[]} laneFiles  every `backlog/*.md` on the lane tip (basename + content)
 * @param {{ baseNums?: string[], baseNames?: string[] }} [opts]
 *   baseNums  — every NNN present on the merge base (a lane file reusing one is a collision).
 *   baseNames — every `NNN-slug.md` basename on the merge base (a lane file that IS one is the base file itself,
 *               unchanged — never yielded; only a lane file NOT among these that reuses a base num yields).
 *
 * EDGE-CLOBBER GUARD (#2316). `laneFiles` is the FULL lane-tip corpus, not just the lane's own new/edited
 * files — it includes every BASE file the lane inherited unmodified (main's surviving items). Those files'
 * `#NNN`/`blockedBy` edges predate the collision entirely: they were authored against whatever already held
 * `oldNum` on the base (the KEEPER), never against the incoming yielder (which didn't exist yet when they were
 * written). So the reference sweep below only rewrites files NOT named in `baseNames` — a base-owned file's
 * ambiguous refs are left alone by construction, even though its num-bearing text may still say `oldNum`.
 * Without this, a same-named base file with an unrelated legitimate edge to `oldNum` (e.g. some OTHER item's
 * `blockedBy: [oldNum]` pointing at the real base keeper) gets its edge silently retargeted at the yielder's
 * new id — corrupting a real dependency graph edge that has nothing to do with this collision.
 * @returns {{
 *   collisions: { oldNum, newNum, oldName, newName, slug }[],
 *   writes: { name: string, text: string }[],   // the yielded file (new name) + every ref-rewritten file
 *   deletes: string[],                            // the old yielded filenames (the refile's remove half)
 *   summary: string,
 * }}
 */
export function planBaseCollisionHeal(laneFiles, { baseNums = [], baseNames = [] } = {}) {
  const files = Array.isArray(laneFiles) ? laneFiles : [];
  const baseNumSet = new Set(baseNums.map(String));
  const baseNameSet = new Set(baseNames.map(String));
  const usedNums = new Set();
  for (const f of files) { const p = parseBacklogFilename(f.name); if (p) usedNums.add(p.num); }
  for (const n of baseNumSet) usedNums.add(String(n));

  // Deterministic order (by num) so the plan + allocations are stable across runs.
  const parsed = files
    .map((f) => ({ file: f, p: parseBacklogFilename(f.name) }))
    .filter((x) => x.p)
    .sort((a, b) => Number(a.p.num) - Number(b.p.num) || (a.p.slug < b.p.slug ? -1 : 1));

  const allocated = new Set();
  const moves = []; // { oldNum, newNum, oldName, newName, slug }
  for (const { file, p } of parsed) {
    // A NEW lane item collides iff its num already lives on the base AND this exact file is not the base's own
    // file (i.e. the lane authored a different item under the same number). The base file is the keeper.
    if (!baseNumSet.has(p.num) || baseNameSet.has(file.name)) continue;
    const newNum = allocateGapId(usedNums, allocated, baseNumSet);
    allocated.add(newNum);
    usedNums.add(newNum);
    moves.push({ oldNum: p.num, newNum, oldName: file.name, newName: `${newNum}-${p.slug}.md`, slug: p.slug });
  }

  // Rewrite every inbound reference to each yielded id across the lane corpus, then re-file the yielded files.
  // #2316 — NEVER rewrite inside a base-owned file (`baseNameSet`): its refs predate the collision and can
  // only mean the base's own real item (the keeper), never the incoming yielder.
  const contentByName = new Map(files.map((f) => [f.name, f.text]));
  const renamed = new Map(moves.map((m) => [m.oldName, m.newName]));
  const touched = new Set();
  for (const mv of moves) {
    for (const [name, text] of contentByName) {
      if (baseNameSet.has(name)) continue;
      const next = rewriteRefs(text, mv.oldNum, mv.newNum, mv.slug);
      if (next !== text) { contentByName.set(name, next); touched.add(name); }
    }
  }
  const writes = [];
  for (const name of touched) writes.push({ name: renamed.get(name) || name, text: contentByName.get(name) });
  for (const mv of moves) {
    if (!touched.has(mv.oldName)) writes.push({ name: mv.newName, text: contentByName.get(mv.oldName) });
  }
  const deletes = moves.map((m) => m.oldName);

  const summary = moves.length === 0
    ? 'No lane item reuses a base id — nothing to renumber (no-op).'
    : moves.map((m) => `#${m.oldNum} → #${m.newNum} (${m.slug}): re-filed ${m.oldName} → ${m.newName}`).join('\n');

  return { collisions: moves, writes, deletes, summary };
}

/** Parse `git ls-tree -r --name-only <ref> -- backlog/` output into the `NNN-slug.md` basenames. Pure. */
export function backlogBasenames(lsTreeStdout) {
  const out = [];
  for (const line of String(lsTreeStdout || '').split('\n')) {
    const m = line.match(/(?:^|\/)?backlog\/(\d+-.+\.md)$/);
    if (m) out.push(m[1]);
    else { const b = line.match(/^(\d+-.+\.md)$/); if (b) out.push(b[1]); }
  }
  return out;
}

/** The default git runner — `spawnSync` so a non-zero exit is RETURNED (not thrown), and `opts.input` feeds
 *  stdin (needed by `git hash-object --stdin`) and `opts.env` is merged over `process.env`. Mirrors
 *  rebase-drop-manifest's `gitRunner`, extended with stdin. */
export function gitRunner(cmd, args, { env, input } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', input, env: env ? { ...process.env, ...env } : process.env });
  return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const firstLine = (s) => String(s || '').split('\n')[0];

/**
 * Apply a renumber PLAN's writes/deletes to a git index (via `GIT_INDEX_FILE=<env.GIT_INDEX_FILE>`), by
 * hashing each new/rewritten file into the object store and staging it, then removing each yielded old file.
 * Shared by the standalone rebuild (`healNnnCollision`) and the folded-into-rebase-drop apply
 * (`applyCollisionHealToIndex`). Returns null on success, or an error string. Never touches the working tree.
 * @param {(cmd,args,opts?)=>{status,stdout,stderr}} run  injected git runner
 * @param {{GIT_INDEX_FILE:string}} env
 * @param {{writes:{name,text}[], deletes:string[]}} plan
 */
export function writePlanToIndex(run, env, plan) {
  for (const w of plan.writes) {
    const ho = run('git', ['hash-object', '-w', '--stdin'], { input: w.text });
    const oid = String(ho.stdout || '').trim();
    if (ho.status !== 0 || !oid) return `hash-object ${w.name} failed (${firstLine(ho.stderr)})`;
    const up = run('git', ['update-index', '--add', '--cacheinfo', `100644,${oid},backlog/${w.name}`], { env });
    if (up.status !== 0) return `update-index ${w.name} failed (${firstLine(up.stderr)})`;
  }
  for (const d of plan.deletes) run('git', ['rm', '--cached', '--ignore-unmatch', `backlog/${d}`], { env });
  return null;
}

/**
 * Compute + apply the NNN-collision renumber against an already-seeded git index whose contents are `<tree>`
 * (a tree-ish — a merged tree OID or a ref). Reused by the drain's rebase-drop rebuild (#2276) so a SINGLE
 * rebuilt tip both drops the transient manifest AND renumbers a colliding new item — instead of the rebuild
 * shedding the manifest but leaving the id dup, so the rebuilt tip stays red on `ids must be unique`. Reads
 * the base ids/names + the tree's backlog contents, detects a lane new-item reusing a base id, and stages the
 * renumber into the caller's `env` index. Returns { ok, healed:[{oldNum,newNum,...}] } or { ok:false, reason }.
 * @param {object} o
 * @param {(cmd,args,opts?)=>{status,stdout,stderr}} o.run
 * @param {{GIT_INDEX_FILE:string}} o.env      the temp index the caller already `read-tree <tree>`'d.
 * @param {string} o.tree                      the tree-ish whose backlog to heal (the merged tree OID).
 * @param {string} [o.base='origin/main']      the merge base whose ids are immutable keepers.
 */
export function applyCollisionHealToIndex({ run, env, tree, base = 'origin/main' }) {
  const baseLs = run('git', ['ls-tree', '-r', '--name-only', base, '--', 'backlog/']);
  if (baseLs.status !== 0) return { ok: false, reason: `ls-tree ${base} failed (${firstLine(baseLs.stderr)})` };
  const treeLs = run('git', ['ls-tree', '-r', '--name-only', tree, '--', 'backlog/']);
  if (treeLs.status !== 0) return { ok: false, reason: `ls-tree ${tree} failed (${firstLine(treeLs.stderr)})` };
  const baseNames = backlogBasenames(baseLs.stdout);
  const names = backlogBasenames(treeLs.stdout);
  const baseNumSet = new Set(baseNames.map((n) => parseBacklogFilename(n)?.num).filter(Boolean));
  const baseNameSet = new Set(baseNames);
  const collides = names.some((n) => { const p = parseBacklogFilename(n); return p && baseNumSet.has(p.num) && !baseNameSet.has(n); });
  if (!collides) return { ok: true, healed: [] };
  const files = [];
  for (const name of names) {
    const cat = run('git', ['cat-file', '-p', `${tree}:backlog/${name}`]);
    if (cat.status !== 0) return { ok: false, reason: `cat-file backlog/${name} failed (${firstLine(cat.stderr)})` };
    files.push({ name, text: cat.stdout });
  }
  const plan = planBaseCollisionHeal(files, { baseNums: [...baseNumSet], baseNames });
  if (plan.collisions.length === 0) return { ok: true, healed: [] };
  const err = writePlanToIndex(run, env, plan);
  if (err) return { ok: false, reason: err };
  return { ok: true, healed: plan.collisions.map((c) => ({ oldNum: c.oldNum, newNum: c.newNum, oldName: c.oldName, newName: c.newName })) };
}

/**
 * Detect + heal an incoming lane's NEW-item id collision with the merge base, BEFORE the required check (#2222).
 * Rebuilds the `lane/*` tip with the colliding new item renumbered to a free GAP id, via pure plumbing (no
 * checkout). Returns one of:
 *   { action: 'none' }                              — no lane item reuses a base id (the common path; cheap).
 *   { action: 'rebased', newCommit, renumbered }    — pushed a renumbered tip; CI will re-run green.
 *   { action: 'error', reason }                     — a git/plumbing step failed (caller treats as non-fatal).
 *
 * @param {object} o
 * @param {string}  o.laneRef              the lane ref (e.g. `lane/batch-…-2222`) — read as `<remote>/<laneRef>`, pushed back to `refs/heads/<laneRef>`.
 * @param {string} [o.base='origin/main']  the merge base whose backlog ids are the immutable keepers.
 * @param {string} [o.remote='origin']
 * @param {boolean}[o.fetch=true]          fetch `<laneRef>` first so `<remote>/<laneRef>` is current (fresh clone, #2231).
 * @param {string} [o.tmpIndex]            temp index for GIT_INDEX_FILE (default `.git/nnn-heal-index`).
 * @param {string} [o.message]             commit-tree message (default: a "heal new-item id collision" line).
 * @param {(cmd:string,args:string[],opts?:object)=>{status:number,stdout:string,stderr:string}} [o.run] injected runner.
 */
export function healNnnCollision({
  laneRef,
  base = 'origin/main',
  remote = 'origin',
  fetch = true,
  tmpIndex = '.git/nnn-heal-index',
  message,
  run = gitRunner,
} = {}) {
  if (!laneRef) return { action: 'error', reason: 'no laneRef given' };
  const mergeRef = `${remote}/${laneRef}`;

  if (fetch) {
    const f = run('git', ['fetch', remote, laneRef]);
    if (f.status !== 0) return { action: 'error', reason: `fetch ${laneRef} failed (${firstLine(f.stderr)})` };
  }

  // CHEAP detection first: compare base vs lane backlog basenames (names only, no content read). Only on a real
  // collision do we pay to read the lane corpus for the reference sweep.
  const baseLs = run('git', ['ls-tree', '-r', '--name-only', base, '--', 'backlog/']);
  if (baseLs.status !== 0) return { action: 'error', reason: `ls-tree ${base} failed (${firstLine(baseLs.stderr)})` };
  const laneLs = run('git', ['ls-tree', '-r', '--name-only', mergeRef, '--', 'backlog/']);
  if (laneLs.status !== 0) return { action: 'error', reason: `ls-tree ${mergeRef} failed (${firstLine(laneLs.stderr)})` };

  const baseNames = backlogBasenames(baseLs.stdout);
  const laneNames = backlogBasenames(laneLs.stdout);
  const baseNumSet = new Set(baseNames.map((n) => parseBacklogFilename(n)?.num).filter(Boolean));
  const baseNameSet = new Set(baseNames);
  const collides = laneNames.some((n) => {
    const p = parseBacklogFilename(n);
    return p && baseNumSet.has(p.num) && !baseNameSet.has(n);
  });
  if (!collides) return { action: 'none' };

  // A collision exists — read the lane corpus and compute the full ref-rewriting plan.
  const laneFiles = [];
  for (const name of laneNames) {
    const cat = run('git', ['cat-file', '-p', `${mergeRef}:backlog/${name}`]);
    if (cat.status !== 0) return { action: 'error', reason: `cat-file backlog/${name} failed (${firstLine(cat.stderr)})` };
    laneFiles.push({ name, text: cat.stdout });
  }
  const plan = planBaseCollisionHeal(laneFiles, { baseNums: [...baseNumSet], baseNames });
  if (plan.collisions.length === 0) return { action: 'none' };

  // Apply the plan to a TEMP index seeded from the lane tree — never touches HEAD or the working tree.
  const env = { GIT_INDEX_FILE: tmpIndex };
  const seed = run('git', ['read-tree', mergeRef], { env });
  if (seed.status !== 0) return { action: 'error', reason: `read-tree failed (${firstLine(seed.stderr)})` };
  const applyErr = writePlanToIndex(run, env, plan);
  if (applyErr) return { action: 'error', reason: applyErr };
  const wt = run('git', ['write-tree'], { env });
  const tree = String(wt.stdout || '').trim();
  if (wt.status !== 0 || !tree) return { action: 'error', reason: `write-tree failed (${firstLine(wt.stderr)})` };

  const tag = plan.collisions.map((c) => `#${c.oldNum}→#${c.newNum}`).join(', ');
  const msg = message || `backlog: heal new-item id collision(s) pre-check (${tag}) (#2222)`;
  // Single parent = the lane tip, so the push is a fast-forward; the renumbered tree fixes the merge-check.
  const ct = run('git', ['commit-tree', tree, '-p', mergeRef, '-m', msg]);
  const newCommit = String(ct.stdout || '').trim();
  if (ct.status !== 0 || !newCommit) return { action: 'error', reason: `commit-tree failed (${firstLine(ct.stderr)})` };

  const push = run('git', ['push', remote, `${newCommit}:refs/heads/${laneRef}`]);
  if (push.status !== 0) return { action: 'error', reason: `push to ${laneRef} failed (${firstLine(push.stderr)})` };

  return { action: 'rebased', newCommit, renumbered: plan.collisions.map((c) => ({ oldNum: c.oldNum, newNum: c.newNum, oldName: c.oldName, newName: c.newName })) };
}
