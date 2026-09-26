/**
 * @file scripts/lib/couple-cascade.mjs
 * @description The couple-atomicity gate for the drain's merge cascade (fix-couple-split).
 *
 * THE RULE: a cross-repo couple lands WHOLE in one pass or not at all. An impl half (frontierui / plateau-app)
 * may merge only when its WE carrier is landing right after it in the SAME pass, and a WE carrier may merge only
 * when every sibling half its manifest names has already landed (this pass or earlier) or is landing in the same
 * group right before it.
 *
 * WHY THIS EXISTS (the 2026-09-26 split). Pass 20:32:20Z considered plateau-app#185 (impl), web-everything#2746
 * (unrelated) and web-everything#2751 (#185's carrier). The plan-time couple gate saw both halves as `merge`, so
 * it cleared the impl. `planLabelDrain` sorts hash items by PR number across repos, so the cascade ran
 * #185 → #2746 → #2751. #185 merged (20:32:57Z), #2746 merged (20:33:03Z) and moved WE `main`, and #2751's fresh
 * pre-merge re-read then saw it BEHIND and refused it. The impl half was on plateau-app `main`, its carrier was
 * not. Nothing in the cascade tied the impl's merge to its carrier actually landing.
 *
 * WHAT THIS DOES (pure, no I/O):
 *  1. `planCoupleCascadeStep` — per cascade iteration: HOLD every couple member whose partner is not landing this
 *     pass (fixpoint: a held impl holds its carrier and vice versa), and ORDER each couple contiguously
 *     (impl halves, then the carrier immediately) so no other merge can move `main` between the halves.
 *  2. `carrierPreflight` — right before an impl half merges, the carrier's FRESH re-read must still say `merge`
 *     (the caller does the read). If not, the impl is held too.
 *
 * Residual (not closable across two repos): the carrier's own `gh pr merge` can still fail AFTER its impl landed
 * (a GitHub error in the ~1s between the two writes). The caller reports that as a `coupleSplit`, loudly.
 */

/** Stable per-PR key, matching the cascade's `sameCand` (repo + number). */
export function candKey(v) {
  return `${(v && v.repo) || 'cwd'}::${v && v.num}`;
}

/** Is this verdict an impl half joined to a WE carrier by `joinImplToCouples`? */
export function isImplHalf(v) {
  return !!v && !v.hasManifest && !!v.coupleCarrier && v.coupleCarrier.num != null;
}

/** Is this verdict a cross-repo couple carrier (a WE PR whose manifest names more than one repo)? */
export function isCoupleCarrier(v) {
  return !!v && !!v.hasManifest && !!v.crossRepo;
}

function carrierKeyOfImpl(v) {
  return `${v.coupleCarrier.repo || 'cwd'}::${v.coupleCarrier.num}`;
}

/**
 * One cascade iteration's couple gate. Pure.
 *
 * @param {Array} ready  this iteration's `plan.ready` (already blockedBy-ordered by `planLabelDrain`).
 * @param {object} o
 * @param {Array}  [o.candidates]     every still-open candidate this pass (the cascade's `remaining`), so an impl
 *                                    that is a candidate but NOT ready (deferred / skip) is seen.
 * @param {Set<string>} [o.mergedKeys]  `candKey`s merged earlier in this pass.
 * @param {Set<string>} [o.openSiblingRefs]  `"<repoKey>::<ref>"` for every PR OPEN in the pass-start context and
 *                                    not merged this pass — repo-aware, so an impl whose lane ref has the SAME
 *                                    name as its carrier's is still seen (the plan-time `coupleImplOpen` skips a
 *                                    ref equal to the carrier's own, which hides exactly that common case).
 * @param {(v:object)=>string|null} [o.repoKeyOf]  a verdict's manifest repo key ('we', 'plateau-app', …).
 * @returns {{ordered:Array, held:Array<{num:number, repo:(string|null), key:string, role:'impl'|'carrier', reason:string}>}}
 */
export function planCoupleCascadeStep(ready, { candidates = [], mergedKeys = new Set(), openSiblingRefs = null, repoKeyOf = null } = {}) {
  const list = Array.isArray(ready) ? ready : [];
  const readyByKey = new Map(list.map((v) => [candKey(v), v]));
  const all = [...list, ...(Array.isArray(candidates) ? candidates : [])];

  // carrierKey → impl verdicts joined to it (any candidate, ready or not)
  const implsOf = new Map();
  for (const v of all) {
    if (!isImplHalf(v)) continue;
    const ck = carrierKeyOfImpl(v);
    if (!implsOf.has(ck)) implsOf.set(ck, new Map());
    implsOf.get(ck).set(candKey(v), v);
  }

  const held = new Map(); // key → { v, role, reason }
  const hold = (v, role, reason) => { const k = candKey(v); if (!held.has(k)) held.set(k, { v, role, reason }); };

  for (let changed = true; changed;) {
    changed = false;
    const before = held.size;
    for (const v of list) {
      const k = candKey(v);
      if (held.has(k)) continue;
      if (isImplHalf(v)) {
        const ck = carrierKeyOfImpl(v);
        if (mergedKeys.has(ck)) continue; // carrier already landed this pass — landing the impl completes the couple
        const carrier = readyByKey.get(ck);
        const cName = `${v.coupleCarrier.repo ? `${v.coupleCarrier.repo}` : ''}#${v.coupleCarrier.num}`;
        if (!carrier) hold(v, 'impl', `couple partner ${cName} (WE carrier) is not landing this pass — the impl half never lands alone`);
        else if (carrier.rebaseDrop === 'rebased') hold(v, 'impl', `couple partner ${cName} (WE carrier) was rebuilt onto main this pass and its checks are re-running — it cannot land this pass, so neither does its impl half`);
        else if (held.has(ck)) hold(v, 'impl', `couple partner ${cName} (WE carrier) is held this pass (${held.get(ck).reason})`);
      } else if (isCoupleCarrier(v)) {
        // (a) every impl CANDIDATE joined to this carrier must be ready, un-held, or already merged this pass
        for (const [ik, impl] of (implsOf.get(k) || new Map())) {
          if (mergedKeys.has(ik)) continue;
          if (!readyByKey.has(ik)) { hold(v, 'carrier', `couple partner ${impl.repo || ''}#${impl.num} (impl half) is not landing this pass — the WE carrier never lands alone`); break; }
          if (held.has(ik)) { hold(v, 'carrier', `couple partner ${impl.repo || ''}#${impl.num} (impl half) is held this pass (${held.get(ik).reason})`); break; }
        }
        if (held.has(k)) continue;
        // (b) repo-aware: a sibling named by the manifest that is still OPEN but is not a candidate at all
        if (openSiblingRefs instanceof Set && typeof repoKeyOf === 'function' && Array.isArray(v.manifestRepoRefs)) {
          const own = repoKeyOf(v);
          for (const s of v.manifestRepoRefs) {
            if (!s || !s.ref || !s.repo || s.repo === own) continue;
            if (!openSiblingRefs.has(`${s.repo}::${s.ref}`)) continue;            // landed / closed → fine
            const landingHere = [...(implsOf.get(k) || new Map()).values()].some((impl) => repoKeyOf(impl) === s.repo && impl.headRef === s.ref && readyByKey.has(candKey(impl)) && !held.has(candKey(impl)));
            if (!landingHere) { hold(v, 'carrier', `couple partner ${s.repo}:${s.ref} is still OPEN and not landing this pass — the WE carrier never lands alone`); break; }
          }
        }
      }
    }
    if (held.size !== before) changed = true;
  }

  // Contiguous order: the first time a couple member appears, emit the couple's un-held impl halves then its
  // carrier, so no other merge can move `main` between the two halves.
  const ordered = [];
  const emitted = new Set();
  const push = (v) => { const k = candKey(v); if (!emitted.has(k) && !held.has(k)) { emitted.add(k); ordered.push(v); } };
  for (const v of list) {
    const k = candKey(v);
    if (held.has(k) || emitted.has(k)) continue;
    const ck = isImplHalf(v) ? carrierKeyOfImpl(v) : (isCoupleCarrier(v) ? k : null);
    if (ck && readyByKey.has(ck)) {
      for (const impl of list) if (isImplHalf(impl) && carrierKeyOfImpl(impl) === ck) push(impl);
      push(readyByKey.get(ck));
    } else push(v);
  }
  return {
    ordered,
    held: [...held.values()].map(({ v, role, reason }) => ({ num: v.num, repo: v.repo ?? null, key: candKey(v), role, reason })),
  };
}

/**
 * Right before an impl half merges: may it go? Pure — the caller passes the carrier's FRESH re-read verdict
 * (`revalidateForMerge(...)` output) or `null` when the carrier already merged this pass.
 * @returns {{ok:boolean, reason?:string}}
 */
export function carrierPreflight({ carrierMergedThisPass = false, freshCarrierVerdict = null } = {}) {
  if (carrierMergedThisPass) return { ok: true };
  if (!freshCarrierVerdict || freshCarrierVerdict.decision !== 'merge') {
    return { ok: false, reason: `WE carrier failed its fresh pre-flight (${(freshCarrierVerdict && freshCarrierVerdict.reason) || 'no fresh read'}) — holding the impl half so the couple does not split` };
  }
  return { ok: true };
}

/**
 * `"<repoKey>::<headRef>"` for every PR open in the pass-start context and not merged this pass. Pure.
 * @param {Map<string|null, Array<{number:number, headRefName:string}>>} prsByRepo  pass-start open PRs, keyed by slug (null = local)
 * @param {Set<string>} mergedKeys  `candKey`s merged this pass
 * @param {(slug:string|null)=>string|null} repoKeyOfSlug
 */
export function openSiblingRefSet(prsByRepo, mergedKeys, repoKeyOfSlug) {
  const out = new Set();
  for (const [slug, prs] of (prsByRepo instanceof Map ? prsByRepo : new Map())) {
    const rk = repoKeyOfSlug(slug);
    for (const p of (Array.isArray(prs) ? prs : [])) {
      if (!p || !p.headRefName) continue;
      if (mergedKeys.has(`${slug || 'cwd'}::${p.number}`)) continue;
      out.add(`${rk}::${p.headRefName}`);
    }
  }
  return out;
}
