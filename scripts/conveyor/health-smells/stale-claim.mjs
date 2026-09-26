/**
 * @file scripts/conveyor/health-smells/stale-claim.mjs
 * @description #4077 extension (x4axhga) — operator 2026-09-25 21:45 ET: the Plateau WIP page shows old claimed
 *   items and merged-but-unresolved cards. Two independent conditions, SHADOW ONLY (proposes, never un-claims or
 *   resolves a real card — the operator's own rule: "Don't un-claim or resolve real cards yourself"):
 *
 *   CLASS A — ABANDONED CLAIM. `status: active`/`preparing`, no open PR names it (the SAME loose exclusion
 *   `../../lib/open-pr-items.mjs`'s `itemNumsFromPr` already uses for the identical low-stakes purpose — a false
 *   positive here just re-flags a card that is, in fact, covered), no live same-host claim pid (the claim reader
 *   behind `../../operations/stale-state.mjs`, #911), and older than `staleAfterDays` (default 3).
 *
 *   CLASS B — LANDED, NOT RESOLVED. A merged PR already delivers the active card. Two confidence tiers, so the
 *   report never conflates a strict match with a guess:
 *     - `matched`    — `../../backlog-stranded-sweep.mjs`'s own pure `sweepStrandings` (lane-ref / title /
 *       manifest match). This is the SAME matcher the Plateau WIP page's own "stranded" row uses
 *       (`plateau-app/src/wip/stranded-read.ts` loads this exact module from the WE checkout it reads — never a
 *       second copy), so a `matched` episode here is exactly a WIP-page-flagged card.
 *     - `mentioned`  — a merged PR's own BODY cites this card's number or `bornAs` hash in a bulleted/subject-
 *       line position (`- **#4127 (xn6n5gp)** — …`) without the ref or title carrying it — the exact shape a
 *       COORDINATED multi-card PR uses (one lane ref/title names only its LEAD card; siblings landed by the same
 *       PR are named only in prose). `sweepStrandings`'s own body check is the lane-manifest JSON only, so it
 *       cannot see this — confirmed live against PR #2668 (delivered #4127/#4134/#4121, ref only names #4127's
 *       `bornAs`) and PR #2689 (delivered #4169/#4172, ref only names #4169's `bornAs`). Lower confidence:
 *       report says "verify by hand," never "resolve."
 *
 *   WHY RESOLVE-ON-LAND MISSED ALL SIX NAMED CARDS (traced, not guessed — see the item's own digest and the PR
 *   this ships in for the full trace): `../../merge-ai-prs.mjs`'s `landedIdsForCandidate` extracts delivered ids
 *   from a merged PR's ref/title ONLY, via `../../lib/open-pr-items.mjs`'s `deliveredItemNumsFromPr` /
 *   `deliveredHashFromPr`. #4169/#4175/#4127 (PRs #2689/#2691/#2668) all cut their lane from the card's
 *   PRE-NUMBERING `bornAs` hash even though each card had ALREADY been JIT-numbered before the PR merged —
 *   `deliveredHashFromPr`'s own #3914 guard requires the PR's changed-file list include the card's scaffold at
 *   `backlog/<hash>-*.md`, true only when the SAME PR both files and lands the card, so it correctly (by its own
 *   logic) refuses to credit an already-numbered card still hash-named in its ref. #4172/#4134/#4121 are the
 *   sharper, second gap this smell's `mentioned` tier exists for: siblings delivered by a coordinated PR whose
 *   ref/title name only the OTHER, lead card — invisible to BOTH the strict extractor and `sweepStrandings`'s
 *   ref/title/manifest match. NOT fixed here: `../../merge-ai-prs.mjs` is concurrently edited by open PRs
 *   #2708/#2709 — report only.
 */
import { itemNumsFromPr } from '../../lib/open-pr-items.mjs';
import { sweepStrandings, readFrontmatterField, idTokenOf } from '../../backlog-stranded-sweep.mjs';
import { HOUR } from '../health-watch-core.mjs';

const DAY = 24 * HOUR;

/** Normalize a numeric id string (drop leading zeros) so probe-sourced and card-sourced ids compare equal; a
 *  non-numeric token (a `bornAs` hash) passes through unchanged. Pure. */
export function normId(id) {
  const s = String(id ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

function ageDaysOf(rec) {
  return rec && rec.ageMs != null ? rec.ageMs / DAY : null;
}

/** Escape a token for interpolation into `new RegExp` — both ids and `bornAs` hashes are untrusted card content. */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does a merged PR's own BODY cite `token` (a numeric id or a `bornAs` hash) in a bulleted/subject-line
 * position — `**#4127 (xn6n5gp)**`, `**xn6n5gp**:` — never a bare mid-sentence mention (that would be the
 * citation noise `sweepStrandings`'s own docstring already warns is exactly how a filed-in-passing item looks).
 * Pure.
 * @param {string} body
 * @param {string} token
 * @returns {boolean}
 */
export function bodyMentionsToken(body, token) {
  const t = String(token || '').trim();
  if (!t) return false;
  const esc = escapeRegExp(t);
  const wordRe = new RegExp(`(^|[^0-9a-zA-Z])#?${esc}([^0-9a-zA-Z]|$)`);
  for (const m of String(body || '').matchAll(/\*\*([^*\n]*)\*\*/g)) {
    if (wordRe.test(m[1])) return true;
  }
  return false;
}

export default {
  id: 'stale-claim',
  scope: 'repo',
  cadence: 'gh',
  probes: ['staleState', 'prs', 'mergedPrs'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'medium',
  action: 'file',
  staleAfterDays: 3,
  diagnose: { command: 'node', args: ['scripts/backlog-stranded-sweep.mjs', '--json', '--limit=800'], timeoutMs: 45_000 },
  recommendationHint: 'A backlog claim looks abandoned, or its PR already merged — shadow mode only: this proposes, it never un-claims or resolves anything.',
  evaluate({ staleState, prs, mergedPrs }, { now }) {
    const out = [];
    const openIds = new Set();
    for (const pr of prs || []) for (const n of itemNumsFromPr(pr.headRefName, pr.title)) openIds.add(normId(n));

    const claims = (staleState?.records || []).filter((r) => r && r.kind === 'claim' && !r.error);
    const activeClaims = claims.filter((r) => ['active', 'preparing'].includes(r.status));

    // Class A — abandoned: no open PR names it, no live same-host claim pid, older than the threshold.
    for (const rec of activeClaims) {
      const id = normId(rec.id);
      if (openIds.has(id)) continue; // an open PR already names it — producer-complete, not abandoned
      if (rec.ownerPidAlive === true) continue; // a live same-host pid holds the claim
      const ageDays = ageDaysOf(rec);
      const breach = ageDays != null && ageDays >= this.staleAfterDays;
      out.push({
        subject: `abandoned:${id}`,
        breach,
        measure: {
          id, status: rec.status, ageDays: ageDays != null ? Math.round(ageDays * 10) / 10 : null,
          ownerPidAlive: rec.ownerPidAlive, path: rec.path ?? null,
        },
        summary: `#${id} (${rec.status}) claimed ${ageDays != null ? `${Math.round(ageDays)}d ago` : 'at an unknown time'}, no open PR names it, no live same-host claim pid.`,
        recommendation: `Looks abandoned — verify first (\`node scripts/operations/run.mjs stale-state --json\`), then un-claim to open: \`node scripts/backlog.mjs retype ${id} --status=open\`.`,
      });
    }

    // Class B — landed but not resolved.
    const cards = mergedPrs?.cards || [];
    const mergedPrList = mergedPrs?.prs || [];
    const cardById = new Map();
    for (const c of cards) {
      const tok = normId(idTokenOf(c.stem));
      if (tok) cardById.set(tok, c);
    }
    const activeIds = new Set(activeClaims.map((r) => normId(r.id)));

    const matched = sweepStrandings(cards, mergedPrList);
    const matchedIds = new Set();
    for (const m of matched) {
      const id = normId(m.id);
      if (!activeIds.has(id)) continue; // this smell is scoped to status:active claims, per the operator's ask
      matchedIds.add(id);
      out.push({
        subject: `landed:${id}`,
        breach: true,
        measure: { id, status: m.status, bornAs: m.bornAs ?? null, mergedPrs: m.mergedPrs, confidence: 'matched' },
        summary: `#${id} (${m.status}) — merged ${m.mergedPrs.map((p) => `#${p.pr}`).join(', ')} delivers it (${m.mergedPrs[0]?.via ?? '?'}).`,
        recommendation: `Resolve on land: \`node scripts/backlog.mjs resolve ${id}\` (in a lane) — unless that PR was only a slice or a note; then leave it open.`,
      });
    }

    // Lower confidence: a merged PR's own body cites an active card (number or bornAs) that sweepStrandings's
    // ref/title/manifest match cannot see — the coordinated-PR sibling gap (see file header).
    for (const rec of activeClaims) {
      const id = normId(rec.id);
      if (matchedIds.has(id)) continue;
      const card = cardById.get(id);
      const bornAs = card ? readFrontmatterField(card.body, 'bornAs') : null;
      const hits = [];
      for (const pr of mergedPrList) {
        if (bodyMentionsToken(pr.body, id) || (bornAs && bodyMentionsToken(pr.body, bornAs))) {
          hits.push(pr.number);
          if (hits.length >= 3) break;
        }
      }
      if (!hits.length) continue;
      out.push({
        subject: `landed:${id}`,
        breach: true,
        measure: { id, status: rec.status, bornAs: bornAs ?? null, mergedPrs: hits.map((n) => ({ pr: n })), confidence: 'mentioned' },
        summary: `#${id} (${rec.status}) — merged PR(s) ${hits.map((n) => `#${n}`).join(', ')} name it in a bulleted line, but neither the ref nor the title does (sweepStrandings's ref/title/manifest match can't see this).`,
        recommendation: `Verify by hand: does PR ${hits.map((n) => `#${n}`).join(', ')} actually deliver #${id}? If so, \`node scripts/backlog.mjs resolve ${id}\`; if it's only a slice or a note, leave it open.`,
      });
    }

    return out;
  },
};
