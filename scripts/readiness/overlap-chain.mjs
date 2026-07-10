/**
 * @file scripts/readiness/overlap-chain.mjs
 * @description Producer overlap-stacking (#2394, under #2387 F1) — the PURE planner a serial `/batch` uses to
 *   author a SELECTIVE overlap-stacked lane chain, plus the push-time `actual ⊆ declared` safety re-check.
 *
 * WHY (#2387): a serial batch today cuts every item's lane off `origin/main`, so N serial items become N
 * siblings off one base — and the deferred drain re-discovers, blind, every conflict between overlapping
 * items that the authoring session already understood and threw away. The fix is SELECTIVE stacking: only
 * items whose DECLARED file-sets actually overlap stack (each based on its predecessor's pushed tip, via
 * `lane-pool acquire --base`, #2386); provably-disjoint items stay plain siblings off `origin/main`. A landed
 * parent is then an ancestor of main, so the child's drain merge is three-way clean — the conflict was
 * resolved ONCE, at authoring time, with the context hot.
 *
 * THE CHAIN MODEL (union-find flavored, incremental). Items arrive in the batch's serial work order, each
 * with its DECLARED repo-qualified file-set (`"<repo>:<path>"` — the same qualification as
 * `lane-partition.mjs`'s `filesOf`, so the same path in two repos never collides and a genuine same-repo
 * overlap always does). Per item:
 *   • overlaps NO open chain  → a SIBLING off `origin/main`; opens its own chain (a chain of depth 1).
 *   • overlaps ONE chain      → STACKS on that chain's frontier tip (the last pushed item) and extends it.
 *   • overlaps ≥2 chains      → a BRIDGE: bases on the deepest chain's frontier, merges the other chains'
 *     tips in-session, records ALL frontier tips as `stackParents`; the chains fuse into one.
 *   • the extension would exceed the DEPTH CAP → fall back to a SIBLING (today's behavior — the drain may
 *     pay a rebase) and RE-ROOT the chain at this item, so later overlapping items stack on the new shallow
 *     root instead of the over-deep chain. The cap bounds cumulative stacked-CI cost (#2387 open risk).
 *
 * THE PUSH-TIME RE-CHECK (#2387 F1, the critical half). The base is chosen PRE-work but files are known
 * POST-work, so a declared-disjoint sibling can turn out to overlap after all. At push the producer
 * recomputes the ACTUAL touched set (`git diff --name-only <base>...HEAD` — the CLI owns git) and asserts
 * `actual ⊆ declared`. On a violation that overlaps another chain, the verdict is `rebase-required`: the
 * producer rebases onto that chain's frontier IN-SESSION (context hot), re-resolves, records the new
 * `stackParents`, and only then pushes. A post-hoc overlap can therefore NEVER reach the deferred drain as a
 * mislabelled certified-disjoint sibling — the exact blind-conflict reproduction predicted-set stacking
 * without the re-check would have (#2387 F1's rejected alternative).
 *
 * CAPABILITY GATE (#2387 F4 / #2393): stacking is only SAFE once the drain's proof-of-land gate is live on
 * main (a stacked child landing before its parent drags the parent's unreviewed code onto main under the
 * child's number). `createStackPlan` therefore takes the `stackingSupported` verdict read off
 * `origin/main`'s durable capability marker (`drain-capability.mjs`) and, when unsupported, plans EVERY item
 * a plain sibling and disarms the re-check's rebase directive (a rebase-onto-frontier would CREATE a stacked
 * PR the drain can't gate) — defaulting hard to today's behavior, the conservative direction.
 *
 * PURE — no fs, no child_process, no `Date`. The plan is a plain JSON-serializable object: the CLI
 * (`we:scripts/lane-stack.mjs`) persists it to a scratch file between the batch's seams and owns all git.
 * SERIAL contract: items are planned one at a time, each AFTER its predecessor pushed (`recordPushed`) — the
 * frontier a stacked item bases on is always an already-pushed tip.
 */

/**
 * The default chain-depth cap (#2387: "cap chain depth — fall back to siblings past the cap"). Each stacked
 * child runs CI over the cumulative stack and a parent repush re-triggers every descendant's CI, so depth is
 * a real cost multiplier; 4 keeps the worst chain a small multiple of a sibling's CI while still absorbing
 * the common 2–3-item overlap runs a serial batch actually produces.
 */
export const DEFAULT_DEPTH_CAP = 4;

/** Normalize a declared/actual file list → a deduped array of repo-qualified path strings. */
function normFiles(files) {
  return [...new Set((Array.isArray(files) ? files : []).map((f) => String(f)).filter(Boolean))];
}

function intersects(listA, listB) {
  const b = new Set(listB);
  return listA.some((f) => b.has(f));
}

/**
 * Create a fresh stack plan. JSON-serializable (arrays/objects only — the CLI round-trips it to a scratch
 * file between seams).
 * @param {{supported:boolean, depthCap?:number}} opts  `supported` = the capability-marker verdict read off
 *   `origin/main` ({@link ../readiness/drain-capability.mjs} `stackingSupported`) — false ⇒ every item plans
 *   as a plain sibling (the hard conservative default).
 */
export function createStackPlan({ supported, depthCap = DEFAULT_DEPTH_CAP } = {}) {
  return {
    supported: !!supported,
    depthCap: Number.isInteger(depthCap) && depthCap >= 1 ? depthCap : DEFAULT_DEPTH_CAP,
    // id → { id, declared:[…], chain, stackParents:[…], sibling:bool, pushed:bool, actual:[…]|null,
    //        tips:{ [repo]: {sha, ref} } } — `tips` are the item's pushed per-repo lane tips (recordPushed).
    items: {},
    // chainId → { files:[…], frontier: itemId|null (last PUSHED member), depth } — `frontier:null` only
    // before the chain's root pushes. A chain absorbed by a bridge gets `mergedInto: <chainId>` instead.
    chains: {},
    nextChain: 1,
  };
}

/** Follow a chain's `mergedInto` pointers (bridge fusions) to its live root. */
function liveChain(plan, chainId) {
  let c = plan.chains[chainId];
  while (c && c.mergedInto != null) c = plan.chains[c.mergedInto];
  return c;
}

/** The distinct LIVE chains whose cumulative file-sets intersect `files`. */
function overlappingChains(plan, files, excludeItemId = null) {
  const seen = new Set();
  const out = [];
  for (const [cid, raw] of Object.entries(plan.chains)) {
    if (raw.mergedInto != null) continue;
    const c = liveChain(plan, cid);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    if (excludeItemId != null && plan.items[excludeItemId] && liveChain(plan, plan.items[excludeItemId].chain) === c) continue;
    if (intersects(files, c.files)) out.push({ chainId: cid, chain: c });
  }
  return out;
}

/**
 * Plan the NEXT item of the serial batch (call in work order, after the predecessor's `recordPushed`).
 * Returns the stacking decision; the caller maps parent item-ids to concrete refs via each parent's recorded
 * `tips` (exposed on the decision as `baseTips`).
 *
 * @param {object} plan
 * @param {{id:string|number, files:Array<string>}} item  `files` = the DECLARED repo-qualified file-set
 *   (`"<repo>:<path>"`), derived from the item's body/locus at pack time.
 * @returns {{id:string, stacked:boolean, base:string|null, mergeParents:string[], stackParents:string[],
 *   baseTips:object|null, reason:string}}
 *   `base` = the item-id whose pushed tip to `lane-pool acquire --base` on (null ⇒ `origin/main`);
 *   `mergeParents` = further frontier item-ids a BRIDGE merges in-session after acquiring at `base`;
 *   `stackParents` = every frontier item-id stacked on (goes into the manifest, #2389);
 *   `baseTips` = the base parent's recorded per-repo `{sha, ref}` tips (the concrete acquire/manifest refs).
 */
export function planNextItem(plan, { id, files }) {
  const itemId = String(id);
  if (plan.items[itemId]) throw new Error(`item ${itemId} is already planned`);
  const declared = normFiles(files);

  const sibling = (reason) => {
    const chainId = String(plan.nextChain++);
    plan.chains[chainId] = { files: [...declared], frontier: null, depth: 0 };
    plan.items[itemId] = { id: itemId, declared, chain: chainId, stackParents: [], sibling: true, pushed: false, actual: null, tips: null };
    return { id: itemId, stacked: false, base: null, mergeParents: [], stackParents: [], baseTips: null, reason };
  };

  // Capability gate (#2387 F4): no positive proof the drain's proof-of-land gate is live ⇒ plain siblings.
  if (!plan.supported) return sibling('stacking-unsupported (capability marker absent/stale — default hard to siblings)');

  // Only chains with a PUSHED frontier can be stacked on (serial contract); a frontier-less chain (its root
  // was planned but never pushed — a carried/dropped item) is overlap-visible but not stackable.
  const rawOverlaps = overlappingChains(plan, declared);
  const overlaps = rawOverlaps.filter((o) => o.chain.frontier != null);
  if (overlaps.length === 0) {
    return sibling(rawOverlaps.length
      ? 'overlapping chain(s) have no pushed frontier (carried/dropped root) — nothing to stack on'
      : 'disjoint from every open chain');
  }

  // Deepest chain first: base on it (fewest in-session merges for a bridge) and cap-check against it.
  overlaps.sort((a, b) => b.chain.depth - a.chain.depth);
  const newDepth = overlaps[0].chain.depth + 1;
  if (newDepth > plan.depthCap) {
    // Past the cap: fall back to a sibling (the drain may pay a rebase — today's cost) and RE-ROOT: the new
    // chain absorbs the over-deep chain's cumulative files so LATER overlapping items stack here, bounded.
    const d = sibling(`depth cap (${plan.depthCap}) reached — sibling fallback, chain re-rooted`);
    const rerooted = plan.chains[plan.items[itemId].chain];
    for (const o of overlaps) {
      rerooted.files = [...new Set([...rerooted.files, ...o.chain.files])];
      o.chain.mergedInto = plan.items[itemId].chain;
    }
    return d;
  }

  const parents = overlaps.map((o) => o.chain.frontier);
  const [baseParent, ...mergeParents] = parents;
  // Fuse: everything joins the deepest (base) chain; the bridged chains point at it.
  const baseChainId = overlaps[0].chainId;
  const baseChain = liveChain(plan, baseChainId);
  baseChain.files = [...new Set([...baseChain.files, ...declared, ...overlaps.slice(1).flatMap((o) => o.chain.files)])];
  for (const o of overlaps.slice(1)) o.chain.mergedInto = baseChainId; // frontier + depth advance at recordPushed
  plan.items[itemId] = { id: itemId, declared, chain: baseChainId, stackParents: parents, sibling: false, pushed: false, actual: null, tips: null };
  return {
    id: itemId,
    stacked: true,
    base: baseParent,
    mergeParents,
    stackParents: parents,
    baseTips: plan.items[baseParent] ? plan.items[baseParent].tips : null,
    reason: mergeParents.length ? `bridges ${overlaps.length} chains — merge their tips in-session` : `overlaps open chain — stacks on #${baseParent}`,
  };
}

/**
 * The push-time safety re-check (#2387 F1): assert the ACTUAL touched set (`git diff --name-only
 * <base>...HEAD`, repo-qualified by the CLI) is a subset of the DECLARED set, and classify any excess.
 * Read-only — records nothing; act on the verdict, then `applyRebase`/`recordPushed`.
 *
 * Verdicts:
 *   • `clean`               — `actual ⊆ declared`; push as planned.
 *   • `undeclared-disjoint` — excess files, but they overlap NO other chain: no mislabelling hazard, push
 *     (the excess is absorbed into the item's chain at `recordPushed` so later planning sees reality).
 *   • `rebase-required`     — excess overlaps other chain(s): do NOT push. `ok:false`; `onto` names the
 *     frontier item-ids to rebase onto in-session (then `applyRebase`, re-gate, re-run this check).
 *   • `stacking-unsupported`— capability off: the rebase directive is disarmed (it would CREATE a stacked
 *     PR the drain can't gate); excess is reported for the ledger but the item ships as the sibling it is.
 *
 * @param {object} plan
 * @param {{id:string|number, actualFiles:Array<string>}} input
 * @returns {{ok:boolean, verdict:string, undeclared:string[], onto:string[], ontoTips:object}}
 */
export function recheckAtPush(plan, { id, actualFiles }) {
  const itemId = String(id);
  const item = plan.items[itemId];
  if (!item) throw new Error(`item ${itemId} is not in the plan`);
  const actual = normFiles(actualFiles);
  const declared = new Set(item.declared);
  const undeclared = actual.filter((f) => !declared.has(f));
  if (undeclared.length === 0) return { ok: true, verdict: 'clean', undeclared: [], onto: [], ontoTips: {} };
  if (!plan.supported) return { ok: true, verdict: 'stacking-unsupported', undeclared, onto: [], ontoTips: {} };
  const clashes = overlappingChains(plan, undeclared, itemId).filter((o) => o.chain.frontier != null);
  if (clashes.length === 0) return { ok: true, verdict: 'undeclared-disjoint', undeclared, onto: [], ontoTips: {} };
  const onto = clashes.map((o) => o.chain.frontier);
  const ontoTips = Object.fromEntries(onto.map((p) => [p, plan.items[p] ? plan.items[p].tips : null]));
  return { ok: false, verdict: 'rebase-required', undeclared, onto, ontoTips };
}

/**
 * Record an IN-SESSION rebase performed on a `rebase-required` verdict: the item now sits on the named
 * frontier tips, so they join its `stackParents`, its declared set absorbs the actual files (the overlap is
 * now resolved history, not an undeclared surprise), and the chains fuse. Re-run {@link recheckAtPush}
 * after — it must come back `ok` before the push.
 * @param {object} plan
 * @param {{id:string|number, onto:string[], actualFiles?:Array<string>}} input  `onto` = the verdict's
 *   frontier item-ids the lane was rebased onto.
 */
export function applyRebase(plan, { id, onto, actualFiles = [] }) {
  const itemId = String(id);
  const item = plan.items[itemId];
  if (!item) throw new Error(`item ${itemId} is not in the plan`);
  const ownChainId = item.chain;
  const ownChain = liveChain(plan, ownChainId);
  for (const parentId of (onto || []).map(String)) {
    const parent = plan.items[parentId];
    if (!parent) throw new Error(`rebase parent ${parentId} is not in the plan`);
    if (!item.stackParents.includes(parentId)) item.stackParents.push(parentId);
    const parentChain = liveChain(plan, parent.chain);
    if (parentChain !== ownChain) {
      // Fuse into the parent's chain (it has the pushed frontier); the item's own chain points at it.
      parentChain.files = [...new Set([...parentChain.files, ...ownChain.files])];
      parentChain.depth = Math.max(parentChain.depth, ownChain.depth);
      ownChain.mergedInto = parent.chain;
      item.chain = parent.chain;
    }
  }
  item.sibling = false;
  item.declared = [...new Set([...item.declared, ...normFiles(actualFiles)])];
  const c = liveChain(plan, item.chain);
  c.files = [...new Set([...c.files, ...item.declared])];
}

/**
 * Record a successful push: the item becomes its chain's FRONTIER (depth +1), its actual files are absorbed
 * into the chain's cumulative set (later planning sees reality, not just declarations), and its per-repo
 * tips (`{ [repo]: {sha, ref} }`) are stored — the concrete refs a successor's acquire/manifest will use.
 * @param {object} plan
 * @param {{id:string|number, actualFiles?:Array<string>, tips?:object}} input
 */
export function recordPushed(plan, { id, actualFiles = [], tips = null }) {
  const itemId = String(id);
  const item = plan.items[itemId];
  if (!item) throw new Error(`item ${itemId} is not in the plan`);
  item.pushed = true;
  item.actual = normFiles(actualFiles);
  item.tips = tips || item.tips;
  const c = liveChain(plan, item.chain);
  c.files = [...new Set([...c.files, ...item.actual])];
  c.frontier = itemId;
  c.depth += 1;
}

/**
 * Drop a planned-but-never-pushed item (carried / gate-red — no PR). Its declared files STAY in the chain's
 * cumulative set (conservative: a later item overlapping them still stacks rather than risk a blind
 * conflict), but since the item never pushed it was never a frontier, so nothing else changes.
 */
export function dropItem(plan, { id }) {
  const itemId = String(id);
  const item = plan.items[itemId];
  if (!item) throw new Error(`item ${itemId} is not in the plan`);
  if (item.pushed) throw new Error(`item ${itemId} already pushed — cannot drop`);
  item.dropped = true;
}
