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
 *   node scripts/lane-resume.mjs rebuild-plan [--spec=<file>|-]     # plan a repaired link's descendant-tail rebuild (#2396); `landed` derives from positive on-main proof (bornAs / status:resolved) when not supplied
 *   node scripts/lane-resume.mjs rebuild <laneRef> --onto=<sha>     # rebuild ONE descendant tip onto the repaired parent tip (#2396)
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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';
// #2396 — resolve a stackParent's landed status via the durable bornAs-on-main proof (#2392): `landedNumberFor`
// greps origin/main's backlog for the birth-hash record, `isHash`/`asItemId` are the shared id semantics the
// drain's own proof-of-land gate uses (numeric NNN = post-land by JIT numbering, #2288). All import-safe
// (CLI-guarded modules already in this file's import graph via merge-ai-prs).
import { landedNumberFor } from './lane-drain.mjs';
import { isHash } from './backlog/id.mjs';
import { asItemId } from './readiness/lane-manifest.mjs';
// #2396 — a broken stacked LINK is a lane the finisher must repair before its overlap-descendants can be
// rebuilt onto the repaired tip. "Broken" = a red required `test` (a real bug) OR a `review:changes` label
// (a human bounced the diff). Reuse the ratified verdict-label set + its tolerant reader, never re-parse names.
import { REVIEW_LABELS, hasReviewLabel } from './lib/review-escalation.mjs';
// #2383 — reuse the SAME constellation repo-resolution as `/drain` (`merge-ai-prs.mjs`), so `/finish` sweeps
// all 3 repos (WE + frontierui + plateau-app) by default instead of only the cwd repo. `merge-ai-prs.mjs` is
// CLI-guarded (runs nothing on import), so this is a pure function import.
import { resolveRepos } from './merge-ai-prs.mjs';
// #2399 — the ONE remote-manifest `gh api` argv, shared with the drain so the two readers never drift.
// Re-exported to keep this file's public surface (and its tests' import site) stable.
import { remoteManifestApiArgs } from './lib/remote-manifest.mjs';
export { remoteManifestApiArgs };
// #2396 — `resolvedOnMain` must read `status:` INSIDE the frontmatter block, never anywhere in the file:
// a body can carry a column-0 `status: resolved` (e.g. a fenced frontmatter example). `readField` parses
// only the first `---`…`---` block — the same splice-scoped reader the backlog status verbs use.
import { readField } from './backlog/frontmatter.mjs';

/**
 * The ONE frontmatter-strict "is this backlog doc `status: resolved` on main?" predicate (#2455). BOTH
 * on-main resolved readers route through it — the discover blocker-gate (`resolvedItemSet`) and the
 * rebuild proof-of-land (`resolvedOnMain`) — so a body-text `status: resolved` (a fenced frontmatter
 * example in prose) can never be read as landed by one path while the other correctly refuses, and a future
 * proof-format change lands here once instead of drifting. `readField` parses only inside the first
 * `---`…`---` block, so body content never counts.
 * @param {string} doc  the backlog file's full text
 * @returns {boolean}
 */
function docIsResolved(doc) {
  return readField(doc, 'status') === 'resolved';
}

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
 * @returns {{num, item, repos, blockedBy, stackParents, reviewChanges, testRed, crossRepo, disposition, reason}}
 *   disposition ∈ 'ready' | 'conflict' | 'test-red' | 'review-changes' | 'blocked' | 'unknown'
 */
export function classifyLane(pr, resolvedItems) {
  const blockedBy = pr.blockedBy || [];
  const unlanded = blockedBy.filter((b) => !resolvedItems.has(b));
  const crossRepo = (pr.repos || []).some((r) => r.repo && r.repo !== 'we');
  // #2396 — carry the stacked-chain signals through so `markStackDescendantsBlocked` can re-bucket a broken
  // link's overlap-descendants. `reviewChanges` (a human bounced the diff) is, like a red `test`, a broken link.
  // `testRed` is carried as a RAW flag (not just the disposition) so a lane whose disposition is overwritten by
  // the 'BLOCKED wins' rule below still reads as a broken link — otherwise a blockedBy+red-test lane would mask
  // its breakage and its stacked descendants would stay 'ready' and land past the unrepaired parent.
  const stackParents = pr.stackParents || [];
  const reviewChanges = pr.reviewChanges === true;
  const testRed = Boolean(pr.testConclusion) && String(pr.testConclusion).toUpperCase() === 'FAILURE';
  const base = { num: pr.num, item: pr.item ?? null, repos: pr.repos || [], blockedBy, stackParents, reviewChanges, testRed, crossRepo };

  // BLOCKED wins: a finisher cannot land a lane whose blocker isn't on main yet (impl-first / dep-first).
  if (unlanded.length) return { ...base, disposition: 'blocked', reason: `blockedBy not landed: ${unlanded.join(',')}` };

  // A red required check means the lane shipped a real bug — the finisher must FIX code, not just rebase.
  if (testRed)
    return { ...base, disposition: 'test-red', reason: 'required `test` check is red (lane bug to fix)' };

  // #2396 — a `review:changes` bounce means a human rejected the diff: like a red test, the finisher must
  // REPAIR the code first. It must NEVER bucket 'ready' (green CI + mergeable is irrelevant — the drain's
  // #2366 hard refusal would park it anyway; here we keep it out of the auto-land list at the source).
  if (reviewChanges)
    return { ...base, disposition: 'review-changes', reason: 'review:changes — a human bounced the diff (repair before any land)' };

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
  // Broken = the RAW breakage signals (`testRed` / `reviewChanges`), not just the disposition: classifyLane's
  // 'BLOCKED wins' rule overwrites a blockedBy+red-test lane's disposition to 'blocked', and a bounced lane now
  // buckets 'review-changes' — either way the link is still broken and its descendants must be re-bucketed.
  const isBroken = (l) => l.disposition === 'test-red' || l.disposition === 'review-changes'
    || l.testRed === true || l.reviewChanges === true;
  // Normalize EVERY id through `asItemId` before any Set/Map lookup — manifests spell the same item as a JSON
  // number (2396) and a quoted frontmatter string ("2396") interchangeably, and a raw-keyed match across that
  // spelling mismatch silently skips the poisoning (fails OPEN: the bounced parent's descendant stays `ready`
  // and lands). One normalizer on BOTH sides (broken items, adjacency keys, BFS lookups) makes it spelling-immune.
  const nid = (v) => (v == null ? null : asItemId(v));
  const brokenItems = new Set(lanes.filter(isBroken).map((l) => nid(l.item)).filter((i) => i != null));
  if (!brokenItems.size) return lanes.map((l) => ({ ...l }));
  // adjacency: a stackParent item → the child lanes stacked on it.
  const childrenOf = new Map();
  for (const l of lanes) for (const sp of l.stackParents || []) {
    const key = nid(sp);
    if (key == null) continue;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(l);
  }
  // BFS from every broken item over the stackParent edges → each reachable descendant is poisoned by it.
  // The poison record carries the broken ROOT (the nearest broken ANCESTOR), never the BFS predecessor — a
  // depth-≥2 descendant's reason must name the lane that actually needs the repair, not its (merely poisoned)
  // immediate parent.
  const poisonedBy = new Map(); // childItem (normalized) → the nearest broken ancestor item that poisons it
  const queue = [...brokenItems].map((b) => ({ item: b, root: b }));
  while (queue.length) {
    const { item: parent, root } = queue.shift();
    for (const child of childrenOf.get(parent) || []) {
      const c = nid(child.item);
      if (c == null || brokenItems.has(c) || poisonedBy.has(c)) continue;
      poisonedBy.set(c, root);
      queue.push({ item: c, root }); // transitively poison this descendant's own children too
    }
  }
  return lanes.map((l) => {
    const c = nid(l.item);
    return c != null && poisonedBy.has(c) && !brokenItems.has(c)
      ? { ...l, disposition: 'blocked', reason: `stacked ancestor #${poisonedBy.get(c)} is a broken link — repair it, then rebuild this onto the repaired tip (#2396)` }
      : { ...l };
  });
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
  // Normalize every id ONCE at entry (`asItemId`) — manifests and caller-supplied `spec.landed` spell the same
  // item as a JSON number (300) or a quoted string ("300") interchangeably, and the `placed`/`landedSet` Set
  // lookups below use SameValueZero equality (300 ≠ "300"). Normalizing here makes every lookup spelling-immune
  // and lets `deriveLandedFromMain` return one canonical form instead of dual-adding raw + normalized.
  const repairedId = asItemId(repaired);
  const landedSet = new Set([...(landed instanceof Set ? landed : new Set(landed))].map((v) => asItemId(v)));
  const placed = new Set([repairedId]); // the repaired tip is available as a base from the start
  const order = [];
  const pending = descendants
    .filter((d) => d && d.item != null)
    .map((d) => ({ ...d, item: asItemId(d.item), stackParents: (d.stackParents || []).map((p) => asItemId(p)) }));
  // Fixed-point sweeps: place any descendant all of whose stackParents are available; repeat until no progress.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const d of pending) {
      if (placed.has(d.item)) continue;
      const parents = d.stackParents;
      const available = parents.every((p) => placed.has(p) || landedSet.has(p));
      if (!available) continue; // a parent isn't ready yet — a later sweep may place it, else it defers
      const files = new Set(d.fileset || []);
      const overlaps = [...fix].some((f) => files.has(f));
      const onto = parents.find((p) => placed.has(p)) ?? repairedId; // rebuild onto the (repaired) chain member
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
 * Positive proof-of-land for a NUMERIC item id (#2396) — the numeric analogue of `landedNumberFor`'s
 * bornAs-on-main proof: the item's `backlog/NNN-*.md` on origin/main carries `status: resolved` in its
 * FRONTMATTER (body text never counts — a fenced example in prose must not spoof the proof). A bare
 * number is NEVER trusted as landed-by-construction: numbered-yet-unlanded items exist (pre-#2288 legacy
 * numbering, and an in-flight batch's own numbered siblings whose lanes are still queued), so only this
 * positive on-main record proves the land. Fails CLOSED — a missing file, an open/active status, or any
 * git error all read NOT landed.
 * @param {number|string} num  the numeric NNN
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function resolvedOnMain(num, cwd = process.cwd()) {
  if (!/^\d{1,5}$/.test(String(num))) return false; // the numeric NNN id form only (ID_TOKEN_RE's numeric arm) — never a rev/pathspec injection surface
  const n = Number(num);
  try {
    // One scoped whole-line grep on origin/main (mirrors landedNumberFor's shape) LOCATES the candidate
    // file(s): the `NNN-*.md` pathspec pins the exact leading id (the `-` stops a longer number from
    // partial-hitting). The grep hit alone is NOT proof — it matches anywhere in the file, and an OPEN
    // item's body can carry a column-0 `status: resolved` (a fenced frontmatter example) — so each hit is
    // re-read and the status verified INSIDE the frontmatter block (`readField` parses only the first
    // `---`…`---`). `git grep` exits 1 on no match → the catch reads it as NOT landed.
    const out = execFileSync('git', ['grep', '-l', '-E', '^status:[ \t]*resolved', 'origin/main', '--', `backlog/${n}-*.md`],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    for (const hit of out.split('\n')) {
      const path = hit.replace(/^origin\/main:/, '');
      if (!path) continue;
      const doc = execFileSync('git', ['show', `origin/main:${path}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (docIsResolved(doc)) return true;
    }
    return false;
  } catch { return false; }
}

/**
 * Derive `planStackRebuild`'s `landed` set from the durable proof-of-land on origin/main (#2396/#2392) — the
 * "resolving each stackParent landed status via bornAs-on-main" half of the item, wired as the CLI
 * `rebuild-plan` default so a caller never has to hand-assemble the proof. For every stackParent any
 * descendant references (excluding items IN the descendant set — those are rebuilt this pass, not "landed"),
 * landed requires POSITIVE proof on origin/main — absence or id-format is NEVER read as landed (the F5
 * stowaway guard), for BOTH id forms:
 *   - a NUMERIC NNN is proven landed only by its backlog file on origin/main carrying `status: resolved`
 *     (`resolvedOnMain`) — a number alone proves nothing (numbered-yet-unlanded items exist: legacy ids and
 *     an in-flight batch's own numbered siblings).
 *   - a provisional HASH is proven landed only by a positive `bornAs:<hash>` record on origin/main
 *     (`landedNumberFor`, #2392).
 * Every returned id is in canonical `asItemId` form — `planStackRebuild` normalizes at entry, so one form
 * suffices. `lookup`/`resolvedLookup` are injectable (unit-testable without a repo).
 * @param {Array<{item, stackParents?:Array}>} descendants  the poisoned tail about to be planned
 * @param {{lookup?:(hash:string, cwd?:string)=>string|null, resolvedLookup?:(num:number, cwd?:string)=>boolean, cwd?:string}} [o]
 * @returns {Set} items proven landed on main
 */
export function deriveLandedFromMain(descendants = [], { lookup = landedNumberFor, resolvedLookup = resolvedOnMain, cwd = process.cwd() } = {}) {
  const inSet = new Set(descendants.filter((d) => d && d.item != null).map((d) => asItemId(d.item)));
  const landed = new Set();
  const checked = new Set();
  for (const d of descendants) for (const sp of (d && d.stackParents) || []) {
    const id = asItemId(sp);
    if (inSet.has(id) || checked.has(id)) continue; // rebuilt this pass (or already checked) — not re-proven
    checked.add(id);
    const proven = (typeof id === 'number' && Number.isFinite(id))
      ? resolvedLookup(id, cwd) === true                          // numeric → positive resolved-on-main proof
      : (isHash(String(id)) && lookup(String(id), cwd) != null);  // hash → positive bornAs-on-main proof (#2392)
    if (proven) landed.add(id);
  }
  return landed;
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
  // SECURITY — `ontoSha` can originate from branch-controlled manifest content (`repos[].base`); it is fed to
  // git plumbing as an argv token, so a crafted value starting with `-` (e.g. `--upload-pack=<cmd>`) would be
  // parsed as a git OPTION, not a revision. Accept ONLY a plain abbreviated-or-full commit SHA — never a ref
  // name, never anything that could carry an option or a rev-expression.
  if (!/^[0-9a-f]{7,40}$/i.test(String(ontoSha)))
    return { action: 'error', laneRef, reason: `ontoSha ${JSON.stringify(String(ontoSha))} is not a commit SHA (7-40 hex) — refusing to pass non-SHA (possibly branch-controlled) content to git (#2396)` };
  // SECURITY — `laneRef` rides the SAME branch-controlled path (manifest `repos[].ref` → discover →
  // rebuild-plan → `rebuild <laneRef>`) and is fed to `git fetch` argv AND the push refspec. A crafted value
  // could name a PROTECTED branch (`main` — the rebuilt merge commit would fast-forward straight onto main,
  // bypassing the PR transport and the required `test` check) or smuggle an option/refspec token
  // (`--upload-pack=…`, `x:refs/heads/main`, `+refs/…`). Accept ONLY the vocabulary the lane transport mints:
  // a `lane/…` ref in the plain ref charset (no `-` lead, no `:`/`+`/whitespace, no `..`) — every legitimate
  // caller satisfies this, and `main` never does.
  if (!/^lane\/[\w.-]+(?:\/[\w.-]+)*$/.test(String(laneRef)) || String(laneRef).includes('..'))
    return { action: 'error', laneRef, reason: `laneRef ${JSON.stringify(String(laneRef))} is not a lane/* ref — refusing to pass non-lane (possibly branch-controlled) content to git (#2396)` };
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
    const v = run('gh', ['pr', 'view', String(prNum), ...repoFlag, '--json', 'number,headRefName,mergeable,mergeStateStatus,statusCheckRollup,labels']);
    try { prInfo = JSON.parse(v.stdout || '{}'); } catch { prInfo = {}; }
  }
  // #2396 — a `review:changes` bounce is a broken link: NEVER enqueue it (green CI + mergeable is irrelevant —
  // a human rejected the diff; the finisher repairs and the reviewer re-verdicts before any land). Mirrors the
  // drain's #2366 hard refusal at this earlier layer so `land <pr>` can't push a bounced diff into the queue.
  if (hasReviewLabel(prInfo.labels, REVIEW_LABELS.changes))
    return { action: 'review-changes', pr: prNum, merged: false, reason: 'review:changes — a human bounced this diff; repair + re-review before any land (#2396)' };
  const laneRef = prInfo.headRefName;
  const testCheck = (prInfo.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
  const decision = landDecision({ mergeable: prInfo.mergeable, mergeState: prInfo.mergeStateStatus, testConclusion: testCheck ? (testCheck.conclusion || testCheck.state || null) : null });

  if (decision.action === 'red') return { action: 'red', pr: prNum, merged: false, reason: decision.reason };
  if (decision.action === 'not-green') return { action: 'not-green', pr: prNum, merged: false, reason: decision.reason };
  if (!laneRef) return { action: 'error', pr: prNum, merged: false, reason: 'the PR has no head ref (gh pr view returned none)' };
  if (dryRun) return { action: decision.action, pr: prNum, merged: false, laneRef, reason: `dry-run: would ${decision.action === 'rebuild' ? (repo ? 'defer the rebase-drop to the drain then ' : 'rebase-drop the manifest then ') : ''}enqueue #${prNum} (${laneRef}) — label ${label} + trigger a single-couple drain${repo ? ` in ${repo}` : ''}` };

  let rebased = false;
  let alreadyCurrent = false;
  if (decision.action === 'rebuild') {
    if (repo) {
      // #2383 — a REMOTE repo tip can't be rebuilt by the LOCAL rebase-drop plumbing; enqueue and let the drain
      // rebuild it through that repo's sibling clone (#2263). If no sibling clone is provisioned the drain leaves
      // it for its author — the same graceful degradation `/drain` already has, not an error here.
    } else {
      const r = rebaseDropManifest({ laneRef, base, run });
      if (r.action === 'skip') return { action: 'skip', pr: prNum, merged: false, reason: r.reason, conflictPaths: r.conflictPaths };
      if (r.action === 'error') return { action: 'error', pr: prNum, merged: false, reason: r.reason };
      // `current` = the idempotency short-circuit ran: the tip is ALREADY on base and manifest-free, so NOTHING
      // was minted or pushed. Still landable (enqueue below), but it is NOT a rebuild — don't set `rebased` or
      // claim a manifest was dropped in the reason.
      if (r.action === 'current') alreadyCurrent = true;
      else rebased = true;
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
  const reason = rebased
    ? 'rebased onto main (manifest dropped), labelled + single-couple drain triggered'
    : alreadyCurrent
      ? `already current on main (manifest-free) — labelled + single-couple drain triggered${repo ? ` (${repo})` : ''}`
      : `labelled ready-to-merge + single-couple drain triggered${repo ? ` (${repo})` : ''}`;
  return { action: rebased ? 'rebuilt-enqueued' : 'enqueued', pr: prNum, merged: false, rebased, reason };
}

// ─────────────────────────────────── IO helpers ───────────────────────────────────

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const shJSON = (cmd, args, dflt) => { try { return JSON.parse(sh(cmd, args) || 'null') ?? dflt; } catch { return dflt; } };

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

/**
 * Item numbers whose backlog file is `status: resolved` on origin/main (a blocker counts as landed) —
 * discover's blocker-gate. Reads each candidate's status FRONTMATTER-strict via {@link docIsResolved}, the
 * same reader `resolvedOnMain` uses (#2455): a body-text `status: resolved` (a fenced frontmatter example)
 * never spoofs a discover blocker. Keeps discover's one-sweep read (`ls-tree` + per-file `git show`) rather
 * than resolvedOnMain's per-num grep — this fans out over the whole backlog in one pass.
 * @param {string} [cwd]
 * @returns {Set<number>}
 */
export function resolvedItemSet(cwd = process.cwd()) {
  const set = new Set();
  let files = [];
  try { files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter((f) => /^backlog\/\d+-/.test(f)); } catch { return set; }
  for (const f of files) {
    const n = Number((f.match(/^backlog\/(\d+)-/) || [])[1]);
    try {
      const doc = execFileSync('git', ['show', `origin/main:${f}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (docIsResolved(doc)) set.add(n);
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
    counts: { ready: bucket('ready').length, conflict: bucket('conflict').length, testRed: bucket('test-red').length, reviewChanges: bucket('review-changes').length, blocked: bucket('blocked').length, unknown: bucket('unknown').length },
    ready: bucket('ready'), conflict: bucket('conflict'), testRed: bucket('test-red'), reviewChanges: bucket('review-changes'), blocked: bucket('blocked'), unknown: bucket('unknown'),
    order: ordered.map((l) => ({ pr: l.num, repo: l.repo, item: l.item, disposition: l.disposition, crossRepo: l.crossRepo, blockedBy: l.blockedBy, stackParents: l.stackParents || [], reviewChanges: l.reviewChanges === true, reason: l.reason })),
  };
  if (asJson) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); return; }
  const repoTag = (l) => (l.repo && l.repo !== self ? `${l.repo.split('/').pop()}#` : '#'); // short prefix per repo
  const line = (l) => `  ${l.disposition === 'ready' ? '✓' : l.disposition === 'blocked' ? '⊘' : '→'} ${repoTag(l)}${l.num}${l.item ? ` (#${l.item})` : ''}${l.crossRepo ? ' [cross-repo]' : ''} — ${l.reason}`;
  process.stderr.write(`lane-resume · ${lanes.length} labelled PR(s) across ${REPOS.length} repo(s): ${JSON.stringify(result.counts)}\n`);
  for (const d of ['ready', 'conflict', 'test-red', 'review-changes', 'blocked', 'unknown']) {
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
  // #2396 — the repair-then-rebuild entry points `/finish` drives after fixing a broken stacked link:
  //   rebuild-plan  — plan the salvageable descendant tail (`planStackRebuild`), reading the spec JSON from
  //                   `--spec=<file>` or stdin: {repaired, descendants:[{item,ref,stackParents,fileset}],
  //                   fixTouched?, landed?}. When `landed` is omitted it is DERIVED from the durable
  //                   bornAs-on-main proof (`deriveLandedFromMain`) — never from ref-absence.
  //   rebuild       — execute ONE planned step (`rebuildDescendant`): rebuild <laneRef> onto the repaired
  //                   parent tip SHA. Exit 0 = rebased (ff); exit 2 = guided-conflict (the finisher resolves
  //                   it WITH the manifest topology) or error.
  else if (cmd === 'rebuild-plan') {
    const specPath = flagVal('spec');
    let spec;
    try {
      spec = JSON.parse(readFileSync(specPath && specPath !== '-' ? specPath : 0, 'utf8'));
    } catch (e) {
      process.stderr.write(`rebuild-plan: cannot read spec (${e.message})\nusage: lane-resume.mjs rebuild-plan [--spec=<file>|-] [--json]  # spec = {repaired, descendants:[{item,ref,stackParents,fileset}], fixTouched?, landed?}\n`);
      process.exit(2);
    }
    try { execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' }); } catch { /* bornAs proof degrades to the local origin/main */ }
    const landed = Array.isArray(spec.landed) ? new Set(spec.landed) : deriveLandedFromMain(spec.descendants || []);
    const plan = planStackRebuild({ repaired: spec.repaired, descendants: spec.descendants || [], fixTouched: spec.fixTouched || [], landed });
    process.stdout.write(JSON.stringify({ ok: true, repaired: spec.repaired ?? null, landed: [...landed], ...plan }, null, 2) + '\n');
  }
  else if (cmd === 'rebuild') {
    const laneRef = positional[1];
    const ontoSha = flagVal('onto');
    if (!laneRef || !ontoSha) { process.stderr.write('usage: lane-resume.mjs rebuild <laneRef> --onto=<repaired-tip-sha> [--json]\n'); process.exit(2); }
    const verdict = rebuildDescendant({ laneRef, ontoSha });
    if (asJson) process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    else process.stderr.write(`lane-resume rebuild ${laneRef} onto ${ontoSha}: ${verdict.action}${verdict.reason ? ` — ${verdict.reason}` : ''}\n`);
    // `current` (idempotency short-circuit) is SUCCESS, not a guided-conflict/error: a re-run of `rebuild` on an
    // already-rebuilt-but-unlanded descendant (tip already on ontoSha, manifest-free) returns `current` with
    // nothing to do — `/finish` must read exit 0, not 2 (2 reads as a guided conflict and derails the finisher).
    process.exit(['rebased', 'current'].includes(verdict.action) ? 0 : 2);
  }
  else { process.stderr.write(`unknown subcommand: ${cmd}\nusage: lane-resume.mjs discover [--json] [--this-repo|--repos=a,b] | land <pr> [--repo=<owner/name>] [--dry-run] [--json] | rebuild-plan [--spec=<file>|-] [--json] | rebuild <laneRef> --onto=<sha> [--json]\n`); process.exit(2); }
}
