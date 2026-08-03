#!/usr/bin/env node
/**
 * #2899 A4 — STRANDED-ITEM SWEEP: find delivered work still sitting `open`/`active`.
 *
 * WHY. When a land assigns an item's `<NNN>` but never flips its `status:` (the #2899 defect), the card stays
 * permanently eligible: every future batch that packs by leverage re-selects it, and whoever draws it pays a
 * full claim + lane + investigate cycle to discover the work is already on main. #2880 and #2450 each cost
 * exactly that. This sweep finds the ones already stranded, so they are closed rather than re-packed.
 *
 * THE SIGNAL, AND WHY IT IS NOT FRONTMATTER. The tempting offline inference — "numerically named + still
 * carries a `bornAs` hash ⇒ its lane landed" — is WRONG, and wrong in the noisy direction. `numberPendingHashes`
 * numbers every pending hash file present on main at land, including items that some OTHER lane merely FILED in
 * passing (a prevention item, a spin-off). Run against this corpus that rule flags 218 of 2874 cards, almost all
 * of them correctly-open items that were never delivered at all. A report that cannot be trusted is not a heal.
 *
 * So the sweep uses the signal the acceptance criterion names: **a MERGED PR that actually delivered this
 * item**, matched on the lane ref / title / manifest the drain itself writes. One `gh pr list` for the whole
 * corpus, then pure matching — no per-item network call.
 *
 * REPORT, NEVER BULK-FLIP. A genuinely broader-scoped item may legitimately outlive its first PR: it landed a
 * slice and has more to do. That is indistinguishable from a stranding without reading the item, so this writes
 * nothing and hands the triage to a human — exactly as A4 requires.
 *
 * The core (`prDeliveredItem` / `sweepStrandings`) is PURE; the CLI is the only thing that touches fs/network.
 *
 * Usage:
 *   node scripts/backlog-stranded-sweep.mjs [--json] [--limit=N]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Frontmatter-strict single-field read (#2603) — only the leading `---` block, never a body line. Pure. */
export function readFrontmatterField(body, field) {
  const text = String(body || '');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const m = text.slice(3, end).match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

/** The id token of a `backlog/<id>-<slug>.md` stem — `2899-jit-…` → `2899`. Pure. */
export function idTokenOf(stem) {
  const s = String(stem || '');
  const cut = s.indexOf('-');
  return cut === -1 ? s : s.slice(0, cut);
}

/**
 * Is this PR an ANNOTATION pass rather than a delivery? Pure.
 *
 * Several sanctioned flows edit an item's card and land, and CORRECTLY leave it open for someone to actually
 * build it: `/prepare` (decision research), the dispatcher's `scope:` touch-set probe, and plain filing. They
 * name the item in their ref and title exactly as a delivery does, so without this carve-out they dominate the
 * report — 30+ of the first 71 hits on this corpus were `author scope: for #NNNN`. A heal that reports those is
 * noise again, which is the failure mode this whole sweep exists to avoid.
 */
export function isAnnotationPr({ headRefName = '', title = '' } = {}) {
  const t = String(title || '');
  if (/\b(author|prepare|prepared|preparing)\s+scope\b/i.test(t)) return true;
  if (/\bscope:\s*for\b/i.test(t)) return true;
  if (/\bprepare\b.*\b(decision|fork|forks|placement|research)\b/i.test(t)) return true;
  if (/:\s*(file|files|filing)\b/i.test(t)) return true;
  if (/^\s*(?:WE\s+)?file[sd]?\b/i.test(t)) return true;   // "File #xhash: …" — the filing convention, id first
  const segs = String(headRefName || '').split(/[/\-_]/).filter(Boolean);
  if (segs.some((s, i) => /^(scope|prep|prepare|preparing|research)$/.test(s) && i > 0)) return true;
  // A MULTI-ITEM housekeeping lane names several items in one ref and delivers none of them: `slice-…` splits an
  // epic into children, `scaffold`/`file-…`/`capture-…` mint new cards. All land, all leave their subjects open.
  // Scan the segments BEFORE the first id-looking one, so `lane/backlog-scaffold-2555-2505` is caught as well as
  // `lane/slice-epics-2551-…` — the housekeeping verb is not always in a fixed position.
  const firstId = segs.findIndex((s) => /^(\d+|x[0-9a-z]{6})$/.test(s));
  const lead = firstId === -1 ? segs.slice(1) : segs.slice(1, firstId);
  return lead.some((s) => /^(slice|slices|scaffold|file|files|capture)$/.test(s));
}

/**
 * Did this merged PR DELIVER this item (as opposed to merely mentioning, filing or annotating it)? Pure.
 *
 * Matches the three places the drain and the lane transport write an item's identity, in descending strength:
 *   1. `headRefName` — a lane ref is `lane/<slug>-<id>` or `lane/<id>-<slug>`, so the id/hash appears as a
 *      whole dash-delimited segment. This is the strongest signal: a lane ref names the item it was cut FOR.
 *   2. `title` — the commit convention is `<id>: <subject>` / `Resolve #<NNN>`.
 *   3. the lane manifest in the body — `"item": <id>` / `"item": "<hash>"` (#2411, the manifest rides the body).
 * A bare `#NNN` anywhere in the body is deliberately NOT a match: that is a citation, which is exactly how a
 * filed-in-passing item looks, and admitting it reintroduces the noise this function exists to avoid.
 *
 * @param {{headRefName?:string, title?:string, body?:string}} pr
 * @param {{id:string, bornAs?:(string|null)}} item
 * @returns {{matched:boolean, via:(string|null)}}
 */
export function prDeliveredItem(pr = {}, item = {}) {
  const tokens = [String(item.id || ''), String(item.bornAs || '')].filter((t) => t && t !== 'null');
  if (!tokens.length) return { matched: false, via: null };
  if (isAnnotationPr(pr)) return { matched: false, via: null };
  const ref = String(pr.headRefName || '');
  const refSegments = ref.split(/[/\-_]/).filter(Boolean);
  // A BATCH lane ref (`lane/batch-<date>-<id>-<id>-<id>-<theOneItem>`) lists every item in the batch slug, so a
  // bare segment hit would credit the batch's delivery of item A to items B and C as well. Only the FINAL
  // segment names the item the lane actually built.
  const isBatchRef = /(^|[/\-_])batch([/\-_]|$)/.test(ref);
  const refCandidates = isBatchRef ? refSegments.slice(-1) : refSegments;
  const refSet = new Set(refCandidates);
  for (const t of tokens) {
    if (refSet.has(t)) return { matched: true, via: `lane-ref ${ref}` };
  }
  const title = String(pr.title || '');
  for (const t of tokens) {
    if (new RegExp(`(^|\\s)#?${t}\\s*:`).test(title)) return { matched: true, via: `title "${title.slice(0, 60)}"` };
    if (new RegExp(`\\bresolve[sd]?\\s+#${t}\\b`, 'i').test(title)) return { matched: true, via: `title "${title.slice(0, 60)}"` };
  }
  const body = String(pr.body || '');
  for (const t of tokens) {
    if (new RegExp(`"item"\\s*:\\s*"?${t}"?`).test(body)) return { matched: true, via: 'lane manifest in PR body' };
  }
  return { matched: false, via: null };
}

/**
 * Cross the open/active cards against the merged-PR list → the stranding candidates. Pure.
 * Only `open`/`active` cards are considered; `resolved`/`parked`/`preparing` have nothing to heal.
 */
export function sweepStrandings(cards = [], mergedPrs = [], { limitPerItem = 3 } = {}) {
  const prs = Array.isArray(mergedPrs) ? mergedPrs : [];
  const out = [];
  for (const c of (Array.isArray(cards) ? cards : [])) {
    if (!c) continue;
    const id = idTokenOf(c.stem);
    const status = readFrontmatterField(c.body, 'status');
    if (status !== 'open' && status !== 'active') continue;
    // An EPIC legitimately outlives every PR that lands one of its slices — it stays open until the last child
    // resolves (the no-open-slice guard). That is the designed lifecycle, never a stranding.
    if (readFrontmatterField(c.body, 'kind') === 'epic') continue;
    const bornAs = readFrontmatterField(c.body, 'bornAs');
    const hits = [];
    for (const pr of prs) {
      const m = prDeliveredItem(pr, { id, bornAs });
      if (m.matched) hits.push({ pr: pr.number, via: m.via });
      if (hits.length >= limitPerItem) break;
    }
    if (hits.length) out.push({ id, status, bornAs: bornAs || null, dateStarted: readFrontmatterField(c.body, 'dateStarted') || null, mergedPrs: hits });
  }
  return out.sort((a, b) => Number(a.id) - Number(b.id) || String(a.id).localeCompare(String(b.id)));
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const limitArg = (argv.find((a) => a.startsWith('--limit=')) || '').slice('--limit='.length);
  const limit = Number(limitArg) > 0 ? Number(limitArg) : 400;
  const dir = join(process.cwd(), 'backlog');
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith('.md')); }
  catch { process.stderr.write('stranded-sweep ✗ cannot read backlog/ — run from the repo root\n'); process.exit(2); return; }
  const cards = files.map((f) => {
    try { return { stem: f.replace(/\.md$/, ''), body: readFileSync(join(dir, f), 'utf8') }; } catch { return null; }
  }).filter(Boolean);
  let prs = [];
  try {
    prs = JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'merged', '--limit', String(limit), '--json', 'number,title,headRefName,body'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim() || '[]');
  } catch (e) {
    process.stderr.write(`stranded-sweep ✗ \`gh pr list\` failed (${String(e.message || e).split('\n')[0]}) — the merged-PR signal is the whole sweep; not falling back to a frontmatter guess\n`);
    process.exit(2); return;
  }
  const hits = sweepStrandings(cards, prs);
  if (asJson) { process.stdout.write(`${JSON.stringify({ scannedCards: cards.length, scannedPrs: prs.length, candidates: hits }, null, 2)}\n`); return; }
  if (!hits.length) { process.stdout.write(`stranded-sweep ✓ no candidates (${cards.length} cards × ${prs.length} merged PRs)\n`); return; }
  process.stdout.write(`stranded-sweep — ${hits.length} candidate(s) (${cards.length} cards × ${prs.length} merged PRs, #2899 A4). REPORT ONLY; nothing was written.\n\n`);
  for (const h of hits) {
    process.stdout.write(`  #${h.id}  status:${h.status}${h.dateStarted ? `  started:${h.dateStarted}` : ''}${h.bornAs ? `  bornAs:${h.bornAs}` : ''}\n`);
    for (const p of h.mergedPrs) process.stdout.write(`        ← merged PR #${p.pr} via ${p.via}\n`);
  }
  process.stdout.write(`\n  Triage each by hand. Work IS on main → \`node scripts/backlog.mjs resolve <NNN>\` in a lane.\n  Item legitimately outlives its first PR (landed a slice, more to do) → leave it; that is not a stranding.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
