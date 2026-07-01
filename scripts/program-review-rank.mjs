#!/usr/bin/env node
/**
 * @file scripts/program-review-rank.mjs
 * @description Rank standing programs by how much a review is *worth running now* — the deterministic
 *   half of bare `/review-program` (the judgment half — landscape velocity + code-drift risk — stays in
 *   the skill, per the hookable-vs-judgment rule #51). Emits a ranked shortlist so the skill picks the
 *   highest-value program to review instead of blindly taking the stalest.
 *
 *   A program (per the Program Test, #1249) is a backlog item with `ongoing: true` or
 *   `childlessReason: program`. For each, this computes the OBJECTIVE signals a value-of-review estimate
 *   rests on:
 *     - staleDays        — days since the newest `## Review log` entry (or dateOpened if never reviewed);
 *                          a stale watch has accumulated the most un-swept external delta.
 *     - neverReviewed    — no review log yet → the first run always catches an accumulated backlog.
 *     - openChildren     — a DRY pool (few open items) means the program is starved for work → a review
 *                          that files fresh items is high-yield; a full pool is already fed.
 *     - resolvedChildren — established programs (many resolved) are live and worth keeping fed.
 *
 *   The composite `score` ranks these; it is deliberately transparent and NOT the final word — the skill
 *   re-ranks the shortlist with domain velocity (a fast-moving watch like framework-churn generates more
 *   than a slow one) and code-drift risk (a program whose "resolved" items may not actually be in code —
 *   this session's #1243/#777 lesson — is where a review yields the most).
 *
 *   Usage:
 *     node scripts/program-review-rank.mjs           # human table, ranked
 *     node scripts/program-review-rank.mjs --json     # machine shortlist
 *     node scripts/program-review-rank.mjs --top=5     # limit rows
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKLOG = join(ROOT, 'backlog');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const topArg = argv.find((a) => a.startsWith('--top='));
const TOP = topArg ? Math.max(1, parseInt(topArg.split('=')[1], 10) || 0) : Infinity;

/** Parse the leading `--- … ---` YAML-ish frontmatter into a flat map (strings/booleans only — enough
 *  for the fields we read; no nested structures live in program frontmatter). */
function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else v = v.replace(/^["']|["']$/g, '');
    fm[kv[1]] = v;
  }
  return fm;
}

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

/** Newest ISO date inside the `## Review log` section, or null if none. */
function newestReviewDate(text) {
  const sec = /##\s*Review log([\s\S]*?)(?:\n##\s|\n*$)/i.exec(text);
  if (!sec) return null;
  const dates = [...sec[1].matchAll(/\d{4}-\d{2}-\d{2}/g)].map((d) => d[0]).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function daysBetween(aIso, bDate) {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  return Math.round((bDate.getTime() - a) / 86_400_000);
}

// --- Load every backlog item once ---------------------------------------------------------------
const files = readdirSync(BACKLOG).filter((f) => /^\d+.*\.md$/.test(f));
const items = files.map((f) => {
  const text = readFileSync(join(BACKLOG, f), 'utf8');
  const num = f.match(/^(\d+)/)[1];
  const title = (text.match(/^#\s+(.+)$/m) || [, ''])[1].trim();
  return { num, file: f, title, text, fm: parseFrontmatter(text) };
});
const byNum = new Map(items.map((it) => [it.num, it]));

// Child counts by parent (parent: "NNN")
const childCounts = new Map(); // parentNum -> { open, resolved, total }
for (const it of items) {
  const p = it.fm.parent;
  if (!p) continue;
  const c = childCounts.get(p) || { open: 0, resolved: 0, total: 0 };
  c.total += 1;
  if (it.fm.status === 'resolved') c.resolved += 1;
  else if (it.fm.status === 'open' || it.fm.status === 'active' || it.fm.status === 'preparing') c.open += 1;
  childCounts.set(p, c);
}

const TODAY = new Date();

const programs = items
  .filter((it) => it.fm.ongoing === true || it.fm.childlessReason === 'program')
  .map((it) => {
    const lastReview = newestReviewDate(it.text);
    const anchorDate = lastReview || (it.fm.dateOpened || null);
    const staleDays = anchorDate ? daysBetween(anchorDate, TODAY) : 9999;
    const kids = childCounts.get(it.num) || { open: 0, resolved: 0, total: 0 };
    const neverReviewed = !lastReview;
    // Transparent composite: staleness is the base; a never-reviewed program gets a first-run bonus;
    // a dry pool (few open children) is starved for items → the review is high-yield.
    const drynessBonus = kids.open === 0 ? 25 : kids.open <= 2 ? 12 : 0;
    const firstRunBonus = neverReviewed ? 30 : 0;
    const score = staleDays + firstRunBonus + drynessBonus;
    return {
      num: it.num,
      title: it.title,
      status: it.fm.status,
      lastReview,
      staleDays,
      neverReviewed,
      openChildren: kids.open,
      resolvedChildren: kids.resolved,
      relatedReport: it.fm.relatedReport || null,
      score,
    };
  })
  .sort((a, b) => b.score - a.score);

const shortlist = programs.slice(0, TOP);

if (asJson) {
  process.stdout.write(JSON.stringify({ generatedFor: TODAY.toISOString().slice(0, 10), programs: shortlist }, null, 2));
  process.stdout.write('\n');
} else {
  console.log(`Program review value-rank — ${TODAY.toISOString().slice(0, 10)} (deterministic signals; skill adds velocity + drift-risk)\n`);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`  ${pad('score', 6)} ${pad('#', 6)} ${pad('stale', 7)} ${pad('open', 5)} ${pad('done', 5)}  program`);
  for (const p of shortlist) {
    const stale = p.neverReviewed ? 'never' : `${p.staleDays}d`;
    console.log(`  ${pad(p.score, 6)} ${pad('#' + p.num, 6)} ${pad(stale, 7)} ${pad(p.openChildren, 5)} ${pad(p.resolvedChildren, 5)}  ${p.title.slice(0, 60)}`);
  }
  console.log(`\n  ${programs.length} program(s). Higher score = more worth reviewing now (stale × dry-pool × first-run).`);
  console.log('  Next: the skill re-ranks the top few by domain velocity + code-drift risk, then focuses #1.');
}
