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
import { isAnnotationPr } from '../backlog-stranded-sweep.mjs'; // #3441 round 2 — reused (identical shape, not mirrored) to exclude a scope-authoring/prepare-decision PR from crediting a delivery

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
/**
 * #3441 — extract the item id(s) a merged PR's branch/title actually DELIVERS. STRICTER than
 * `itemNumsFromPr` above, which this module's own docstring scopes to a LOW-STAKES use (excluding an item
 * from the readiness-ranking selection surface — a false positive there just means an already-covered item
 * isn't re-offered). This extractor instead feeds an AUTO-COMMITTED `status: resolved` flip on `main`
 * (the resolve-on-land path in `../merge-ai-prs.mjs`), so a false positive here wrongly resolves a real,
 * unrelated, possibly still-in-progress item — a much higher stake that needs a much stricter match.
 *
 * Mirrors (does not import — the shapes differ: this EXTRACTS candidate ids with no known target, while
 * `prDeliveredItem` in `../backlog-stranded-sweep.mjs` TESTS one already-known id against a PR) the two rules
 * that sibling tool's own docstring already learned the hard way:
 *   1. A BATCH lane ref (`lane/batch-<date>-<id>-<id>-…-<id>`) names EVERY item in the batch in its slug —
 *      only the TRAILING segment is the id THIS PR actually built; crediting an earlier segment would resolve
 *      a sibling item this PR never touched, often while that sibling's own lane is still mid-flight.
 *   2. A bare `#NNN` anywhere in the title is a CITATION ("see #2330 for background"), not a delivery claim —
 *      only an explicit `<id>:` / `#<id>:` subject-line marker or `resolve[sd]? #<id>` counts.
 * Plus one ref-only guard `itemNumsFromPr` also lacks: a `YYYY-MM-DD` run in the ref (`lane/calibrate-2026-08-02`)
 * is a date, never an id.
 *   4. (round 2) An ANNOTATION pass — `/prepare` scope-authoring or decision-prep — lands a real, merged, 
 *      non-manifest WE PR that names the item in both ref and title without ever building it (the dominant 
 *      real false-positive class per `isAnnotationPr`'s own docstring: "30+ of the first 71 hits … were 
 *      'author scope: for #NNNN'"). Excluded via `isAnnotationPr`, reused directly (identical input shape) 
 *      rather than re-mirrored.
 *   5. (round 2) The delivery-agent-brief's own retry-letter ref shape 
 *      (`lane/<NNN><letter>-<slug>`, e.g. `lane/3441b-…` — #3110) still names item `<NNN>`; a segment may 
 *      carry one trailing lowercase letter and still count.
 * @param {string} headRefName
 * @param {string} title
 * @returns {string[]} zero-padded item ids this PR's ref/title claims to DELIVER (not merely mention)
 */
export function deliveredItemNumsFromPr(headRefName = '', title = '') {
  const ref = String(headRefName || '');
  if (isAnnotationPr({ headRefName: ref, title })) return []; // scope-authoring / prepare-decision — not a build
  // Only a `lane/<slug>` ref is ever a delivery vehicle (matches itemNumsFromPr's own gate above) — a random
  // branch name with an embedded number (`release-2026`) must never be read as an id.
  const laneMatch = ref.match(/(?:^|\/)lane\/(.+)$/);
  const slug = laneMatch ? laneMatch[1] : '';
  const segs = slug.split(/[-_]/).filter(Boolean);
  // #3441 round 3 — the id-bearing position is a GRAMMAR, not "any digit-looking segment" (the lesson
  // `scripts/conveyor/lease-reaper.mjs`'s `laneRefItemNum` already anchors to): a real delivery ref only ever
  // carries its id as the segment RIGHT AFTER `lane/`, or — for a true batch chain — as the TRAILING segment.
  // Scanning every segment (round 2's shape) misread an ordinary tech-slug fragment ("…-80s-…", "…-10x-…",
  // "…-50k-…") as a second, unrelated delivered id. `isBatchRef` itself is anchored to segs[0] === 'batch' —
  // the real convention (`lane/batch-<date>-…`) — not "the word batch anywhere" (round 3: `lane/2415-batch-
  // job-scheduler` is an ordinary single-item ref, not a batch chain, and must still resolve #2415).
  const isBatchRef = segs[0] === 'batch';
  // A YYYY-MM-DD run ANYWHERE in the ref is a date, not an id (`lane/calibrate-2026-08-02` must not credit
  // item #2026, AND its trailing `02` must not credit item #2 either — round 4 caught the second half of
  // this after the trailing fallback below was added). Scan every consecutive triple, not just the lead.
  const dateSpanSegs = new Set();
  for (let i = 0; i + 2 < segs.length; i++) {
    const [y, m, d] = segs.slice(i, i + 3);
    if (/^(19|20)\d{2}$/.test(y) && /^(0[1-9]|1[0-2])$/.test(m) && /^(0[1-9]|[12]\d|3[01])$/.test(d)) {
      dateSpanSegs.add(y); dateSpanSegs.add(m); dateSpanSegs.add(d);
    }
  }
  // #3441 round 4/5 — verb-led, id-LAST refs are a REAL convention this repo's own maintenance tooling
  // mints (`lane/build-3067`, `lane/resolve-2712`, `lane/heal-stranded-2319`, `lane/fix-stranded-backlog-id-
  // 3392`), but "id-last" is NOT the only verb-led shape in use — `scripts/pr-land.mjs`'s own docstring cites
  // a real merged PR at `lane/fix-2165-ci-fui-checkout` (id right after the verb, MORE words after it). Both
  // start with "fix"; position alone cannot tell them apart, and guessing wrong means crediting a
  // coincidental trailing number (a slug word that happens to end in digits) as a real id — a false POSITIVE,
  // exactly the class every round exists to prevent. So this is a CLOSED allowlist of the exact verb phrases
  // actually verified as real id-last conventions, not an open "any verb, trailing segment" heuristic — a
  // verb-led shape outside this list is a false NEGATIVE (safe: re-strands the item) rather than a guess.
  const ID_LAST_VERB_PHRASES = new Set(['build', 'resolve', 'heal-stranded', 'number-stranded', 'fix-stranded-backlog-id', 'reconcile']);
  const nums = new Set();
  if (isBatchRef) {
    const trailingBatch = segs[segs.length - 1] || '';
    // Same date-span exclusion as the non-batch trailing fallback below (round 5 — this branch was missed
    // when round 4 added it there, leaving a date-only batch ref, e.g. `lane/batch-2026-08-02`, able to
    // credit its day-of-month).
    if (!dateSpanSegs.has(trailingBatch)) {
      // A retry ref carries one trailing letter after the number (`lane/3441b-…`, #3110) — still names item 3441.
      const m = /^(\d{2,5})[a-z]?$/i.exec(trailingBatch);
      if (m) nums.add(m[1]);
    }
  } else {
    const lead = segs[0];
    const leadMatch = lead && !dateSpanSegs.has(lead) ? /^(\d{2,5})[a-z]?$/i.exec(lead) : null;
    // #3441 round 6/7 — a lead-digit segment and the verb-id-last shape can COLLIDE: `lane/3383-resolve-3412`
    // is real (this very item's own parent epic's git history), and reads as EITHER "item 3383" (the lead)
    // OR "item 3412, via a 'resolve' lane grouped under 3383" — two different, equally plausible targets,
    // with no way to prefer one from the ref alone. Round 6 first caught this but matched only the EXACT
    // 3-segment shape (`<id>-<verb>-<id>`, nothing else) — round 7 found that one extra word ANYWHERE
    // (`lane/3383-resolve-3412-cleanup`, `-please-resolve-3412`, `-resolve-cleanup-3412`, even a retry letter
    // on the trailing id) defeated the exact match and silently restored the pre-round-6 bug. Detect the
    // SHAPE instead of an exact segment count: does an allowlisted verb phrase occur ANYWHERE after the lead
    // (as a contiguous word run, wherever it starts), with ANY id-shaped token anywhere after THAT? If so,
    // ambiguous — emit NEITHER id (this extractor's asymmetry: a false negative re-strands the item for the
    // stranded sweep; a false positive silently corrupts an unrelated item on main).
    let leadVerbCollision = false;
    if (leadMatch) {
      for (const phrase of ID_LAST_VERB_PHRASES) {
        const words = phrase.split('-');
        for (let i = 1; i + words.length <= segs.length && !leadVerbCollision; i++) {
          if (words.every((w, j) => segs[i + j].toLowerCase() === w)) {
            const after = segs.slice(i + words.length);
            if (after.some((s) => !dateSpanSegs.has(s) && /^\d{2,5}[a-z]?$/i.test(s))) leadVerbCollision = true;
          }
        }
        if (leadVerbCollision) break;
      }
    }
    const trailing = segs[segs.length - 1];
    const trailingIsCleanId = segs.length > 1 && !dateSpanSegs.has(trailing) && /^\d{2,5}$/.test(trailing);
    if (leadMatch && !leadVerbCollision) {
      nums.add(leadMatch[1]);
    } else if (!leadMatch && trailingIsCleanId) {
      // #3441 review round 1 (human) — a real, merged multi-id verb-led ref (`lane/reconcile-3147-3096-3239`,
      // PR #1599) chains several sibling ids ahead of the one this PR actually delivers, the same shape
      // `isBatchRef` already credits only-the-trailing-segment for. So the verb phrase need not consume EVERY
      // segment before the trailing id — zero or more plain (non-date) numeric segments may sit between the
      // verb and the trailing id and are treated as batch-chain siblings, not a second delivered id.
      for (const phrase of ID_LAST_VERB_PHRASES) {
        const words = phrase.split('-');
        if (words.length >= segs.length) continue;
        if (!words.every((w, j) => segs[j].toLowerCase() === w)) continue;
        const middle = segs.slice(words.length, -1);
        if (middle.every((s) => !dateSpanSegs.has(s) && /^\d{2,5}$/.test(s))) {
          nums.add(trailing);
          break;
        }
      }
    }
  }
  const t = String(title || '');
  // #3441 review round 1 (human) — anchored to the SUBJECT position (start of title, optional "WE "
  // prefix), not "any whitespace-preceded digits-colon": the prior unanchored form credited an
  // unrelated mid-title "NNN:" (an HTTP code, a port, a rate limit — "cap at 500: avoid OOM") as a
  // second delivered id, feeding the auto-committed resolve on main.
  const leadTitleMatch = /^\s*(?:WE\s+)?#?(\d{2,5})\s*:/.exec(t);
  if (leadTitleMatch) nums.add(leadTitleMatch[1]);
  // #3441 round 4 — "resolve: #NNN — subject" (colon right after "resolve", not before "#NNN") is a real,
  // repeated commit-title convention in this repo's history; the optional `:?` covers it alongside the
  // colon-less "resolve #NNN" shape already handled.
  for (const m of t.matchAll(/\bresolve[sd]?:?\s+#(\d{2,5})\b/gi)) nums.add(m[1]);
  return [...nums].map((n) => n.padStart(3, '0'));
}

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
