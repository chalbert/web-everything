#!/usr/bin/env node
/**
 * lane-resume.mjs — discover STUCK ready-to-merge lanes and plan their takeover (#2200).
 *
 * The consumer side of a recurring situation: a producer (`/workflow`, `/batch`) opens a
 * `ready-to-merge` PR per item, but some never land — a conflict with a peer that landed first, a red
 * required `test` (the lane shipped a real bug), or a `blockedBy` item that isn't landed yet. `/drain`
 * only lands couples that are ALREADY ready; it skips these. This engine finds them, says WHY each is
 * stuck, and orders them so the `/resume` skill can hand each to a finisher subagent (seeded with the
 * EXISTING lane ref — reuse the ~done work, repair only the broken part) and then land it via the
 * normal drain transport.
 *
 * Subcommands:
 *   node scripts/lane-resume.mjs discover [--json]     # classify + blockedBy-order every stuck lane
 *   node scripts/lane-resume.mjs discover --this-repo  # scope to the cwd repo only (default = all 3 repos)
 *   node scripts/lane-resume.mjs discover --repos=owner/a,owner/b   # an explicit repo set
 *   node scripts/lane-resume.mjs land <pr> [--repo=owner/name] [--dry-run] [--json]   # land ONE stuck lane PR (#2202)
 *
 * MULTI-REPO (#2383 — parity with `/drain`'s #2287 constellation-default): `discover` sweeps ALL 3
 * constellation repos BY DEFAULT (WE + frontierui + plateau-app, self first), reusing the SAME `resolveRepos`
 * from `merge-ai-prs.mjs`. Every gh call is `--repo`-scoped; a remote lane reads its manifest via the GitHub
 * API and lands through that repo's sibling clone (deferred to the drain, #2263). The backlog is WE-global, so
 * a remote lane's `blockedBy` still resolves against the one WE backlog. Opt out with `--this-repo`.
 *
 * LAND (#2202, #2290) — the durable, tested version of the 2026-07-03 scratchpad plumbing. Reuses the ONE #2198
 * rebase-drop-manifest helper (`scripts/lib/rebase-drop-manifest.mjs`, shared with the label lander): for a PR
 * whose required `test` is green but which is only CONFLICTING/BEHIND, it rebuilds the tip onto main (manifest
 * dropped) via pure plumbing — no branch checkout. #2290: lane-resume NO LONGER merges directly — the drain is
 * the sole writer to main. Instead it ENQUEUES (ensures the `ready-to-merge` label) and TRIGGERS a single-couple
 * drain pass (`merge-ai-prs.mjs --only=<pr>`) that lands the recovered lane through the shared gate. A red `test`
 * (a real bug) or a real (non-manifest) conflict is NOT enqueued — the finisher repairs code first. `UNSTABLE` +
 * `test=pass` IS mergeable (only `test` is required; `cla`/Workers-Builds are non-required). So `/finish` =
 * discover-then-repair-then-`land` (enqueue + trigger the drain, which shares the same helper).
 *
 * Guard-safe: read-only `discover` (git show / gh list); `land` only pushes to a `lane/*` ref (the #1934
 * carve-out) + labels/triggers the drain — never a branch checkout, never a direct `gh pr merge` (any such
 * merge would be rejected by `scripts/lib/pr-merge-gate.mjs`). Fails soft — a PR whose manifest can't be read is
 * reported as `unknown`, never crashes the plan.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';
// #2396 — a broken stacked LINK is a lane the finisher must repair before its overlap-descendants can be
// rebuilt onto the repaired tip. "Broken" = a red required `test` (a real bug) OR a `review:changes` label
// (a human bounced the diff). Reuse the ratified verdict-label set + its tolerant reader, never re-parse names.
import { REVIEW_LABELS, hasReviewLabel } from './lib/review-escalation.mjs';
// #2383 — reuse the SAME constellation repo-resolution as `/drain` (`merge-ai-prs.mjs`), so `/finish` sweeps
// all 3 repos (WE + frontierui + plateau-app) by default instead of only the cwd repo. `merge-ai-prs.mjs` is
// CLI-guarded (runs nothing on import), so this is a pure function import.
import { resolveRepos } from './merge-ai-prs.mjs';

const READY_LABEL = 'ready-to-merge';

/** The cwd repo's "owner/name" slug (from origin), or null if underivable. Same derivation as merge-ai-prs. */
export function localSlug() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}

// ─────────────────────────── pure logic (exported, unit-tested) ───────────────────────────

/**
 * Classify ONE lane's takeover disposition from its already-collected signals.
 * @param {{num:number, mergeable:string, mergeState:string, testConclusion:string|null,
 *          item:number|null, repos:Array<{repo:string,ref:string,carriesResolve?:boolean}>,
 *          blockedBy:number[], stackParents?:Array<number|string>, reviewChanges?:boolean}} pr
 * @param {Set<number>} resolvedItems — items whose backlog file is status:resolved on main (blocker landed)
 * @returns {{num, item, repos, blockedBy, stackParents, reviewChanges, crossRepo, disposition, reason}}
 *   disposition ∈ 'ready' | 'conflict' | 'test-red' | 'blocked' | 'unknown'
 */
export function classifyLane(pr, resolvedItems) {
  const blockedBy = pr.blockedBy || [];
  const unlanded = blockedBy.filter((b) => !resolvedItems.has(b));
  const crossRepo = (pr.repos || []).some((r) => r.repo && r.repo !== 'we');
  // #2396 — carry the stacked-chain signals through so `markStackDescendantsBlocked` can re-bucket a broken
  // link's overlap-descendants. `reviewChanges` (a human bounced the diff) is, like a red `test`, a broken link.
  const stackParents = pr.stackParents || [];
  const reviewChanges = pr.reviewChanges === true;
  const base = { num: pr.num, item: pr.item ?? null, repos: pr.repos || [], blockedBy, stackParents, reviewChanges, crossRepo };

  // BLOCKED wins: a finisher cannot land a lane whose blocker isn't on main yet (impl-first / dep-first).
  if (unlanded.length) return { ...base, disposition: 'blocked', reason: `blockedBy not landed: ${unlanded.join(',')}` };

  // A red required check means the lane shipped a real bug — the finisher must FIX code, not just rebase.
  if (pr.testConclusion && String(pr.testConclusion).toUpperCase() === 'FAILURE')
    return { ...base, disposition: 'test-red', reason: 'required `test` check is red (lane bug to fix)' };

  // A conflict is repairable by rebase-onto-main + resolve (+ regen derived artifacts) — mechanical.
  if (pr.mergeable === 'CONFLICTING' || pr.mergeState === 'DIRTY')
    return { ...base, disposition: 'conflict', reason: 'conflicts with main (rebase + resolve)' };

  // Clean + green ⇒ not stuck at all; `/drain` will take it. Surfaced so the plan is complete.
  if (pr.mergeable === 'MERGEABLE' && (!pr.testConclusion || String(pr.testConclusion).toUpperCase() === 'SUCCESS'))
    return { ...base, disposition: 'ready', reason: 'clean + green — `/drain` lands it' };

  return { ...base, disposition: 'unknown', reason: `mergeable=${pr.mergeable} state=${pr.mergeState} test=${pr.testConclusion ?? '—'}` };
}

/**
 * Order lanes so a lane never precedes a lane it is blockedBy (topological within the stuck set).
 * `blocked` lanes (blocker not landed at all) sort last — they can't run this pass. Ties keep PR order.
 * @param {ReturnType<typeof classifyLane>[]} lanes
 */
export function orderByBlockedBy(lanes) {
  const byItem = new Map(lanes.filter((l) => l.item != null).map((l) => [l.item, l]));
  const seen = new Set();
  const out = [];
  const visit = (l, stack) => {
    if (seen.has(l.num) || stack.has(l.num)) return; // cycle-safe: a back-edge is just skipped
    stack.add(l.num);
    for (const b of l.blockedBy) { const dep = byItem.get(b); if (dep) visit(dep, stack); }
    stack.delete(l.num);
    if (!seen.has(l.num)) { seen.add(l.num); out.push(l); }
  };
  for (const l of lanes) visit(l, new Set());
  // stable partition: attemptable (ready/conflict/test-red/unknown) before blocked
  return [...out.filter((l) => l.disposition !== 'blocked'), ...out.filter((l) => l.disposition === 'blocked')];
}

/**
 * Re-bucket a stacked chain's descendants behind a BROKEN link (#2396 / #2387 F5). A broken link is a lane the
 * finisher must REPAIR before anything stacked below it can rebuild: its required `test` is red (disposition
 * `test-red` — a real bug) OR it carries `review:changes` (a human bounced the diff). Any lane whose
 * `stackParents` chain reaches a broken link is re-bucketed to `blocked` (blocked-on-broken-link) — it must NOT
 * be attempted this pass: its tip literally contains the broken parent's code (CI red-poisons it anyway), and it
 * will be rebuilt onto the REPAIRED tip once the link is fixed, NEVER blind-rebased as part of the whole batch.
 * The broken link KEEPS its own disposition (the finisher fixes it in place). Transitive over the chain and
 * stowaway-proof: a descendant is deferred behind its parent's ABSENCE, so the tail can never land past the
 * unrepaired parent. Pure — no IO; returns a NEW array (inputs untouched).
 * @param {Array<{num, item, stackParents?:Array, disposition, reviewChanges?:boolean, reason}>} lanes
 * @returns {Array} the same lanes with poisoned descendants re-bucketed to `blocked`
 */
export function markStackDescendantsBlocked(lanes) {
  const isBroken = (l) => l.disposition === 'test-red' || l.reviewChanges === true;
  const brokenItems = new Set(lanes.filter(isBroken).map((l) => l.item).filter((i) => i != null));
  if (!brokenItems.size) return lanes.map((l) => ({ ...l }));
  // adjacency: a stackParent item → the child lanes stacked on it.
  const childrenOf = new Map();
  for (const l of lanes) for (const sp of l.stackParents || []) {
    if (!childrenOf.has(sp)) childrenOf.set(sp, []);
    childrenOf.get(sp).push(l);
  }
  // BFS from every broken item over the stackParent edges → each reachable descendant is poisoned by it.
  const poisonedBy = new Map(); // childItem → the nearest broken ancestor item that poisons it
  const queue = [...brokenItems];
  while (queue.length) {
    const parent = queue.shift();
    for (const child of childrenOf.get(parent) || []) {
      if (child.item == null || brokenItems.has(child.item) || poisonedBy.has(child.item)) continue;
      poisonedBy.set(child.item, parent);
      queue.push(child.item); // transitively poison this descendant's own children too
    }
  }
  return lanes.map((l) => (l.item != null && poisonedBy.has(l.item) && !brokenItems.has(l.item)
    ? { ...l, disposition: 'blocked', reason: `stackParent #${poisonedBy.get(l.item)} is a broken link — repair it, then rebuild this onto the repaired tip (#2396)` }
    : { ...l }));
}

/**
 * Plan rebuilding a broken link's descendant TAIL onto the REPAIRED tip (#2396 / #2387 F5) — after the finisher
 * fixes the link, re-stack only the salvageable descendants, in `stackParents` topological order, NEVER past an
 * unlanded parent. A descendant is placed only once every `stackParent` it stacks on is AVAILABLE — the repaired
 * item itself, a descendant already placed earlier this pass, or an item proven `landed` (landedThisPass ∪
 * `bornAs`-on-main). A descendant whose parent is none of those is DEFERRED (its base doesn't exist yet — the
 * positive proof-of-land invariant: absence is never read as landed). Per placed descendant the action is:
 *   `ff`              — the repair touched NONE of this descendant's files → a clean fast-forward rebuild.
 *   `guided-conflict` — the repair touched a file this descendant also touches → exactly ONE guided conflict
 *                       (resolved WITH the manifest topology), never a blind whole-batch rebase.
 * Pure. Returns `{ order:[{item, ref, onto, action, reason}], deferred:[{item, reason}] }`.
 * @param {object} o
 * @param {number|string} o.repaired            the repaired link's item id (its tip is the new base)
 * @param {Array<{item, ref, stackParents?:Array, fileset?:Iterable}>} o.descendants  the poisoned tail
 * @param {Iterable} [o.fixTouched=[]]           repo-qualified files the repair changed (ff vs conflict)
 * @param {Set} [o.landed=new Set()]             items proven landed (landedThisPass ∪ provenOnMain)
 */
export function planStackRebuild({ repaired, descendants = [], fixTouched = [], landed = new Set() } = {}) {
  const fix = new Set(fixTouched);
  const landedSet = landed instanceof Set ? landed : new Set(landed);
  const placed = new Set([repaired]); // the repaired tip is available as a base from the start
  const order = [];
  const pending = descendants.filter((d) => d && d.item != null);
  // Fixed-point sweeps: place any descendant all of whose stackParents are available; repeat until no progress.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const d of pending) {
      if (placed.has(d.item)) continue;
      const parents = d.stackParents || [];
      const available = parents.every((p) => placed.has(p) || landedSet.has(p));
      if (!available) continue; // a parent isn't ready yet — a later sweep may place it, else it defers
      const files = new Set(d.fileset || []);
      const overlaps = [...fix].some((f) => files.has(f));
      const onto = parents.find((p) => placed.has(p)) ?? repaired; // rebuild onto the (repaired) chain member
      order.push({
        item: d.item, ref: d.ref, onto, action: overlaps ? 'guided-conflict' : 'ff',
        reason: overlaps
          ? 'repair touched a shared file — one guided conflict, resolved with the manifest topology (#2396)'
          : 'repair touched no shared file — fast-forward rebuild onto the repaired tip (#2396)',
      });
      placed.add(d.item);
      progressed = true;
    }
  }
  const deferred = pending
    .filter((d) => !placed.has(d.item))
    .map((d) => ({ item: d.item, reason: 'a stackParent is neither landed nor rebuilt this pass — never rebuilt past an unlanded parent (#2396)' }));
  return { order, deferred };
}

/**
 * Rebuild ONE descendant lane tip onto the REPAIRED parent tip (#2396). Reuses the proven #2198
 * `rebaseDropManifest` plumbing UNCHANGED — but with `base` = the repaired parent SHA instead of `origin/main`,
 * so the child's ancestry now contains the repaired code (the drain then lands the couple with the parent as an
 * ancestor, impl-first/parent-first). A clean / manifest-only merge is the fast-forward rebuild; a REAL
 * (non-manifest) conflict is the ONE guided conflict this descendant directly overlapping the fix must resolve —
 * surfaced as `guided-conflict` (the finisher resolves it WITH the topology), never force-resolved here.
 * @param {object} o
 * @param {string} o.laneRef        the descendant lane ref
 * @param {string} o.ontoSha        the repaired parent tip SHA to rebuild onto
 * @param {(cmd,args,opts?)=>{status,stdout,stderr}} [o.run]  injected runner (unit-testable)
 * @returns {{action:'rebased'|'guided-conflict'|'error', laneRef, ...}} `rebased` = ff; `guided-conflict` = one conflict
 */
export function rebuildDescendant({ laneRef, ontoSha, run = gitRunner, ...rest } = {}) {
  if (!laneRef || !ontoSha) return { action: 'error', laneRef: laneRef ?? null, reason: 'rebuildDescendant needs both laneRef and ontoSha (the repaired parent tip)' };
  const r = rebaseDropManifest({ laneRef, base: ontoSha, run, ...rest });
  if (r.action === 'skip') return { action: 'guided-conflict', laneRef, ontoSha, conflictPaths: r.conflictPaths || [], reason: `${r.reason} — one guided conflict to resolve with the manifest topology (#2396)` };
  return { ...r, ontoSha };
}

/**
 * Decide how to land ONE lane PR from its GitHub signals (#2202). Pure. Only the required `test` check gates —
 * `UNSTABLE` (a non-required check like `cla`/Workers-Builds red) is still mergeable.
 *   'red'       — required `test` failed → NEVER land (a real bug; the finisher fixes code first).
 *   'not-green' — required `test` not reported / still pending → wait (no land yet).
 *   'clean'     — test green + mergeable → `gh pr merge` directly.
 *   'rebuild'   — test green but CONFLICTING/DIRTY/BEHIND → rebase-drop the manifest, then merge.
 * @param {{mergeable:string, mergeState:string, testConclusion:string|null}} sig
 */
export function landDecision({ mergeable, mergeState, testConclusion } = {}) {
  const test = String(testConclusion || '').toUpperCase();
  const FAIL = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
  if (FAIL.includes(test)) return { action: 'red', reason: `required \`test\` check is ${test.toLowerCase()}` };
  if (test !== 'SUCCESS') return { action: 'not-green', reason: `required \`test\` check not green (${test.toLowerCase() || 'none'})` };
  const m = String(mergeable || '').toUpperCase();
  const s = String(mergeState || '').toUpperCase();
  if (m === 'CONFLICTING' || s === 'DIRTY' || s === 'BEHIND') return { action: 'rebuild', reason: `test green but not up-to-date (mergeable=${m || '?'} state=${s || '?'}) — rebase-drop the manifest` };
  return { action: 'clean', reason: 'required check green + mergeable' };
}

/**
 * Land ONE stuck lane PR (#2202, #2290): repair-then-ENQUEUE. Reuses the #2198 `rebaseDropManifest` helper.
 * #2290 — lane-resume no longer merges directly (the drain is the sole writer to main): after any needed
 * rebase-drop rebuild, it ensures the `ready-to-merge` label and triggers a single-couple drain pass
 * (`node <drainScript> --only=<pr>`) that lands the couple through the shared merge gate. Best-effort trigger —
 * a park/failure just leaves the PR labelled for the standalone drain. `run(cmd,args,opts)->{status,stdout,stderr}`,
 * `prInfo`, and `drainScript` are injectable so this is unit-testable without a live repo/GitHub. Returns a
 * verdict object (never throws on a git/gh non-zero).
 * @returns {{action:string, pr:(number|string), merged:boolean, reason:string, rebased?:boolean}}
 */
export function land({ prNum, run = gitRunner, prInfo = null, base = 'origin/main', dryRun = false, label = READY_LABEL, triggerDrain = true, drainScript = 'scripts/merge-ai-prs.mjs', repo = null } = {}) {
  if (prNum == null) return { action: 'error', merged: false, reason: 'no PR number (usage: lane-resume.mjs land <pr>)' };
  // #2383 — a `repo` slug scopes every gh call to that constellation repo (frontierui/plateau-app); null = the
  // cwd repo (the established local-git path). The LOCAL rebase-drop plumbing only touches the cwd clone, so for
  // a remote repo the rebuild is deferred to the drain (which is sibling-clone-aware, #2263).
  const repoFlag = repo ? ['--repo', repo] : [];
  if (!prInfo) {
    const v = run('gh', ['pr', 'view', String(prNum), ...repoFlag, '--json', 'number,headRefName,mergeable,mergeStateStatus,statusCheckRollup']);
    try { prInfo = JSON.parse(v.stdout || '{}'); } catch { prInfo = {}; }
  }
  const laneRef = prInfo.headRefName;
  const testCheck = (prInfo.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
  const decision = landDecision({ mergeable: prInfo.mergeable, mergeState: prInfo.mergeStateStatus, testConclusion: testCheck ? (testCheck.conclusion || testCheck.state || null) : null });

  if (decision.action === 'red') return { action: 'red', pr: prNum, merged: false, reason: decision.reason };
  if (decision.action === 'not-green') return { action: 'not-green', pr: prNum, merged: false, reason: decision.reason };
  if (!laneRef) return { action: 'error', pr: prNum, merged: false, reason: 'the PR has no head ref (gh pr view returned none)' };
  if (dryRun) return { action: decision.action, pr: prNum, merged: false, laneRef, reason: `dry-run: would ${decision.action === 'rebuild' ? (repo ? 'defer the rebase-drop to the drain then ' : 'rebase-drop the manifest then ') : ''}enqueue #${prNum} (${laneRef}) — label ${label} + trigger a single-couple drain${repo ? ` in ${repo}` : ''}` };

  let rebased = false;
  if (decision.action === 'rebuild') {
    if (repo) {
      // #2383 — a REMOTE repo tip can't be rebuilt by the LOCAL rebase-drop plumbing; enqueue and let the drain
      // rebuild it through that repo's sibling clone (#2263). If no sibling clone is provisioned the drain leaves
      // it for its author — the same graceful degradation `/drain` already has, not an error here.
    } else {
      const r = rebaseDropManifest({ laneRef, base, run });
      if (r.action === 'skip') return { action: 'skip', pr: prNum, merged: false, reason: r.reason, conflictPaths: r.conflictPaths };
      if (r.action === 'error') return { action: 'error', pr: prNum, merged: false, reason: r.reason };
      rebased = true;
    }
  }
  // #2290 — ENQUEUE instead of merging: ensure the ready-to-merge label, then trigger a single-couple drain (the
  // sole writer to main lands it via the shared gate). Both are best-effort — a label race or a park/failure just
  // leaves the PR labelled for the standalone drain; lane-resume never itself calls `gh pr merge`.
  // #2383 — scope the trigger to the PR's repo: `--repos=<slug>` for a remote constellation repo, `--this-repo`
  // for the cwd repo (the drain is constellation-default, so an unscoped trigger could sweep the wrong repo).
  const drainScope = repo ? [`--repos=${repo}`] : ['--this-repo'];
  run('gh', ['pr', 'edit', String(prNum), ...repoFlag, '--add-label', label]);
  if (triggerDrain) run('node', [drainScript, `--only=${prNum}`, '--label', label, ...drainScope]);
  return { action: rebased ? 'rebuilt-enqueued' : 'enqueued', pr: prNum, merged: false, rebased, reason: rebased ? 'rebased onto main (manifest dropped), labelled + single-couple drain triggered' : `labelled ready-to-merge + single-couple drain triggered${repo ? ` (${repo})` : ''}` };
}

// ─────────────────────────────────── IO helpers ───────────────────────────────────

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const shJSON = (cmd, args, dflt) => { try { return JSON.parse(sh(cmd, args) || 'null') ?? dflt; } catch { return dflt; } };

/**
 * Build the `gh api` argv that reads a remote repo's `.lane-manifest.json` off a head ref. Pure/exported so
 * the `--method GET` is regression-guarded. `--method GET` is REQUIRED: `gh api` silently switches to POST the
 * moment an `-f`/`--field` param is present with no explicit method, and a POST to the read-only contents
 * endpoint 404s — which `readManifest`'s catch would swallow to null, so every remote lane would drop its
 * item/blockedBy (the very ordering this constellation sweep exists for). GET keeps `-f ref=` as a query param.
 * @param {string} repo — "owner/name"
 * @param {string} ref  — the PR head ref
 */
export function remoteManifestApiArgs(repo, ref) {
  return ['api', '--method', 'GET', `repos/${repo}/contents/.lane-manifest.json`, '-f', `ref=${ref}`, '-q', '.content'];
}

/**
 * Read a lane's `.lane-manifest.json` off its head ref. Returns {item, repos, blockedBy, stackParents} or null.
 * #2383 — repo-aware, mirroring `/drain`: for the LOCAL repo (`repo` null/self) read it from local git; for a
 * REMOTE constellation repo read it via the GitHub API (`gh api …/contents/.lane-manifest.json?ref=<headRef>`
 * → base64 `.content`) — never a local clone. Fail-soft to null: a manifest-less lane (e.g. plateau-app's own
 * batch branches carry none) degrades to item null / blockedBy [] — unordered within its repo, exactly like the
 * drain's orphan-PR handling, never a crash.
 * #2396 — also surfaces `stackParents` (the frontier-tip item(s) this lane was cut from / merged onto, #2387 F3)
 * and keeps each `repos[].base` intact, so `/finish` can bucket a stacked chain's descendants behind a broken
 * link and rebuild the salvageable tail onto the repaired tip. Absent ⇒ `stackParents: []` (sibling behaviour).
 */
function readManifest(ref, { repo = null } = {}) {
  const shape = (m) => ({ item: m.item ?? null, repos: m.repos || [], blockedBy: m.blockedBy || [], stackParents: Array.isArray(m.stackParents) ? m.stackParents : [] });
  if (repo) {
    try {
      const b64 = execFileSync('gh', remoteManifestApiArgs(repo, ref), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (!b64) return null;
      return shape(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')));
    } catch { return null; }
  }
  for (const rev of [`origin/${ref}`, ref]) {
    try {
      return shape(JSON.parse(execFileSync('git', ['show', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })));
    } catch { /* try next rev */ }
  }
  return null;
}

/** Item numbers whose backlog file is status:resolved on origin/main (a blocker counts as landed). */
function resolvedItemSet() {
  const set = new Set();
  let files = [];
  try { files = sh('git', ['ls-tree', '-r', '--name-only', 'origin/main']).split('\n').filter((f) => /^backlog\/\d+-/.test(f)); } catch { return set; }
  for (const f of files) {
    const n = Number((f.match(/^backlog\/(\d+)-/) || [])[1]);
    try {
      const head = execFileSync('git', ['show', `origin/main:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).slice(0, 400);
      if (/^status:\s*resolved/m.test(head)) set.add(n);
    } catch { /* skip */ }
  }
  return set;
}

function discover(asJson, { repos = null, singleRepo = false } = {}) {
  execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' }); // local repo's refs (backlog + local lanes)
  // #2383 — sweep the constellation by DEFAULT, exactly like `/drain` (#2287): self's owner × {web-everything,
  // frontierui, plateau-app}, self first. `--this-repo` scopes to the cwd repo; `--repos=a,b` is an explicit set.
  // A null entry = the cwd repo (local git); a slug entry routes every gh call through `--repo` + the manifest
  // read through the GitHub API. resolvedItemSet stays WE-local — the backlog is WE-global, so a cross-repo
  // lane's WE `blockedBy` resolves against the one backlog regardless of which repo the lane lives in.
  const self = localSlug();
  const REPOS = resolveRepos({ repos, singleRepo, self });
  const resolved = resolvedItemSet();
  const lanes = [];
  for (const repo of REPOS) {
    const isLocal = repo == null || repo === self;
    const repoFlag = repo ? ['--repo', repo] : [];
    // #2396 — `labels` too: a `review:changes` bounce is a broken stacked LINK (like a red `test`), so its
    // overlap-descendants must be re-bucketed behind it, not attempted this pass.
    const prs = shJSON('gh', ['pr', 'list', ...repoFlag, '--label', READY_LABEL, '--state', 'open', '--json', 'number,mergeable,mergeStateStatus,headRefName,statusCheckRollup,labels', '--limit', '200'], []);
    for (const p of prs) {
      const man = readManifest(p.headRefName, { repo: isLocal ? null : repo }) || { item: null, repos: [], blockedBy: [], stackParents: [] };
      const test = (p.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
      const lane = classifyLane({
        num: p.number, mergeable: p.mergeable, mergeState: p.mergeStateStatus,
        testConclusion: test ? (test.conclusion || test.state || null) : null,
        item: man.item, repos: man.repos, blockedBy: man.blockedBy,
        stackParents: man.stackParents, reviewChanges: hasReviewLabel(p.labels, REVIEW_LABELS.changes),
      }, resolved);
      lane.repo = repo || self || null; // tag the owning repo so the skill lands each in the right place
      lanes.push(lane);
    }
  }
  // #2396 — re-bucket every overlap-descendant of a broken link (red `test` OR `review:changes`) to `blocked`
  // BEFORE ordering, so the salvageable tail waits for the repaired tip instead of a blind whole-batch rebase.
  const ordered = orderByBlockedBy(markStackDescendantsBlocked(lanes));
  const bucket = (d) => ordered.filter((l) => l.disposition === d);
  const result = {
    ok: true,
    counts: { ready: bucket('ready').length, conflict: bucket('conflict').length, testRed: bucket('test-red').length, blocked: bucket('blocked').length, unknown: bucket('unknown').length },
    ready: bucket('ready'), conflict: bucket('conflict'), testRed: bucket('test-red'), blocked: bucket('blocked'), unknown: bucket('unknown'),
    order: ordered.map((l) => ({ pr: l.num, repo: l.repo, item: l.item, disposition: l.disposition, crossRepo: l.crossRepo, blockedBy: l.blockedBy, stackParents: l.stackParents || [], reviewChanges: l.reviewChanges === true, reason: l.reason })),
  };
  if (asJson) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); return; }
  const repoTag = (l) => (l.repo && l.repo !== self ? `${l.repo.split('/').pop()}#` : '#'); // short prefix per repo
  const line = (l) => `  ${l.disposition === 'ready' ? '✓' : l.disposition === 'blocked' ? '⊘' : '→'} ${repoTag(l)}${l.num}${l.item ? ` (#${l.item})` : ''}${l.crossRepo ? ' [cross-repo]' : ''} — ${l.reason}`;
  process.stderr.write(`lane-resume · ${lanes.length} labelled PR(s) across ${REPOS.length} repo(s): ${JSON.stringify(result.counts)}\n`);
  for (const d of ['ready', 'conflict', 'test-red', 'blocked', 'unknown']) {
    const b = bucket(d); if (!b.length) continue;
    process.stderr.write(`\n${d.toUpperCase()} (${b.length}):\n${b.map(line).join('\n')}\n`);
  }
}

const IS_CLI = process.argv[1] && process.argv[1].endsWith('lane-resume.mjs');
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const cmd = positional[0] || 'discover';
  const asJson = argv.includes('--json');
  // #2383 — repo scoping shared with `/drain`: `--this-repo` = cwd repo only; `--repos=a,b` = an explicit set;
  // neither = the constellation (default). `--repo=<slug>` scopes a single `land` to the PR's repo.
  const flagVal = (name) => { const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`)); return hit == null ? null : (hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : ''); };
  const singleRepo = argv.includes('--this-repo');
  const repos = flagVal('repos');
  if (cmd === 'discover') discover(asJson, { repos, singleRepo });
  else if (cmd === 'land') {
    const prNum = positional[1];
    if (prNum == null) { process.stderr.write('usage: lane-resume.mjs land <pr> [--repo=<owner/name>] [--dry-run] [--json]\n'); process.exit(2); }
    execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' });
    // #2290 — resolve the drain script off this module's dir so `--only` works from any cwd.
    const drainScript = fileURLToPath(new URL('./merge-ai-prs.mjs', import.meta.url));
    // #2383 — `--repo=<slug>` lands a remote constellation-repo PR (from `discover`'s `repo` tag); omit for the cwd repo.
    const self = localSlug();
    const repo = repos ? null : (flagVal('repo') || null); // a bare non-self slug → route through --repo
    const verdict = land({ prNum, dryRun: argv.includes('--dry-run'), drainScript, repo: repo && repo !== self ? repo : null });
    if (asJson) process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    else process.stderr.write(`lane-resume land #${verdict.pr}${repo ? ` (${repo})` : ''}: ${verdict.merged ? '✓ merged' : verdict.action} — ${verdict.reason}\n`);
    // 0 = enqueued / dry-run / clean / not-green (soft — the drain lands later); red/skip/error = 2.
    const soft = ['enqueued', 'rebuilt-enqueued', 'clean', 'rebuild', 'rebuilt-awaiting-ci', 'not-green'];
    process.exit(verdict.merged || soft.includes(verdict.action) ? 0 : 2);
  }
  else { process.stderr.write(`unknown subcommand: ${cmd}\nusage: lane-resume.mjs discover [--json] [--this-repo|--repos=a,b] | land <pr> [--repo=<owner/name>] [--dry-run] [--json]\n`); process.exit(2); }
}
