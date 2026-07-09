/**
 * open-pr-items.mjs — the active-PR exclusion source (companion to main-staleness.mjs) for the readiness
 * ranker. An item that already has an OPEN pull request is producer-complete: its lane resolved it and is
 * waiting on the drain to land, so re-offering it (this session's mis-pack, 2026-07-08) hands a batch work
 * that's already done — often already merged+closed by the time the human looks. This module lists the open
 * PRs and maps each back to the backlog item number(s) it lands, so the CLI boundary can drop them from the
 * selection surfaces (exactly like the prepare-hold `dropHeld`).
 *
 * Fail-soft by construction: no `gh`, no auth, or offline → `{ nums:[], unavailable:true }`, never a throw and
 * never a hard fail (the ranker still runs, just without this extra exclusion). The pure extractor
 * (`extractItemNums`) is unit-tested separately from the `gh` IO (`openPrItemNums` takes an injected `run`).
 */

import { spawnSync } from 'node:child_process';

/** Default gh runner — spawnSync (returns non-zero without throwing). */
export function ghRun(args, opts = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf8', ...opts });
  return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Extract the backlog item number(s) a PR lands from its head branch and title. Pure.
 * The lane transport names its ref `lane/<slug>-<NNN>` (batch) or `lane/<NNN>-<slug>` / `lane/<NNN>-…`, and a
 * `/pr` title carries the `#NNN`. We take any 3-4 digit run that looks like an item number from either. A hash
 * id (born-active, pre-number) never matches — it lands as a number, so a pre-number PR simply isn't excluded
 * (correct: the item isn't in the numbered selection surface yet either).
 * @param {string} headRefName
 * @param {string} title
 * @returns {string[]} zero or more zero-padded item numbers
 */
export function itemNumsFromPr(headRefName = '', title = '') {
  const nums = new Set();
  const ref = String(headRefName);
  const laneMatch = ref.match(/(?:^|\/)lane\/(.+)$/);
  if (laneMatch) {
    // Strip a `batch-YYYY-MM-DD` date prefix FIRST — a batch slug is `batch-<date>-<NNN>-<NNN>…`, so the year
    // (2026) and month/day would otherwise read as item numbers. The remaining `-<NNN>` segments are the items
    // (batch chain) or the single leading/trailing NNN (a /pr ref). The date is `YYYY-MM-DD` only — there is
    // no HHMM segment (a batch slug is `batch-<date>-<NNN>…`, the first post-date group is already an item, so
    // do NOT strip one). Single digits (`\d{2,5}` needs ≥2) and mid-word numbers (segment-bounded) are
    // excluded; the caller intersects with the real backlog anyway.
    const slug = laneMatch[1].replace(/^batch-\d{4}-\d{2}-\d{2}/, '');
    for (const m of slug.matchAll(/(?:^|[-/])(\d{2,5})(?=$|[-/])/g)) nums.add(m[1]);
  }
  for (const m of String(title).matchAll(/#(\d{2,5})\b/g)) nums.add(m[1]);
  return [...nums].map((n) => n.padStart(3, '0'));
}

/**
 * Given an array of PR objects (`{ headRefName, title }`), return the deduped set of item numbers they land.
 * Pure.
 * @param {Array<{headRefName?:string,title?:string}>} prs
 * @returns {string[]}
 */
export function extractItemNums(prs) {
  const out = new Set();
  for (const pr of prs || []) for (const n of itemNumsFromPr(pr.headRefName, pr.title)) out.add(n);
  return [...out];
}

/**
 * List OPEN PRs via `gh` and map them to the backlog item numbers they land. Fail-soft.
 * @param {{run?:typeof ghRun}} o
 * @returns {{nums:string[]}|{nums:string[],unavailable:true,reason:string}}
 */
export function openPrItemNums({ run = ghRun } = {}) {
  const r = run(['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'headRefName,title']);
  if (r.status !== 0) return { nums: [], unavailable: true, reason: (r.stderr || 'gh unavailable').trim().split('\n')[0] };
  let prs;
  try { prs = JSON.parse(r.stdout || '[]'); } catch { return { nums: [], unavailable: true, reason: 'unparseable gh output' }; }
  return { nums: extractItemNums(prs) };
}
