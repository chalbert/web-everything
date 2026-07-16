#!/usr/bin/env node
/**
 * check-backlog-item.mjs — the SCOPED per-item backlog lint (#845). Runs just the cheap structural /
 * rendering checks on ONE `backlog/<id>.md` (link syntax, raw HTML, frontmatter YAML, digest length,
 * blocker-DAG references) — cheap enough to run on every edit, or to wire as a PostToolUse hook on
 * `backlog/*.md` so the render-on-/backlog/ footguns (a `[[wiki-link]]` printing literally, raw
 * interactive HTML swallowing the page) are caught the moment they're written, not at the next full gate.
 *
 * The detection + messages are the SAME as the whole-repo gate — both call `lintBacklogItemRendering`
 * (the frontmatter colon, raw HTML, bad links, buried fork, mis-flagged-batchable checks) — so a green
 * scoped run can't disagree with `check:standards`. The whole-repo gate stays the authority for the
 * cross-entity checks (graduatedTo/relatedProject resolution, the blockedBy cycle walk, dup ids) this
 * single-file pass can't see; run it before resolve as before.
 *
 * Usage:  node scripts/check-backlog-item.mjs <NNN | NNN-slug>      (or  --item <NNN>)
 *         npm run check:item -- 845
 * Exit 1 on any error finding (warnings never fail), so a hook can block a bad edit.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import {
  lintBacklogItemRendering, findUnquotedColonScalars, DIGEST_MAX_WORDS,
} from './check-standards-rules.mjs';
import { TIERS } from './lib/build-queue.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKLOG = join(ROOT, 'backlog');

// ── Resolve the target item ────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const itemFlag = argv.indexOf('--item');
const target = (itemFlag >= 0 ? argv[itemFlag + 1] : argv[0] || '').replace(/^#/, '').trim();
if (!target) {
  console.error('usage: check-backlog-item <NNN | NNN-slug>   (the backlog item to lint)');
  process.exit(2);
}
// A ref is a numeric NNN (landed) or an `xNNNNNN` hash (provisional, #2288) — accept either.
const num = target.match(/^(\d{1,4}|x[0-9a-z]{6})/)?.[1];

// The loader (#430) derives each item's record (title/summary from the body, num, batchable, …). Use it
// so the scoped lint sees exactly what the gate sees — but fall back to a raw gray-matter parse when the
// loader has SKIPPED the item (its own malformed-YAML drop), since that is precisely the case the colon
// scan must still catch.
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
const backlog = (typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog) || [];
let item = backlog.find((b) => b.num === num || b.id === target);

// Locate the file (the loader item carries its id; otherwise glob by the NNN prefix).
const fileFor = (id) => join(BACKLOG, `${id}.md`);
let id = item?.id;
if (!id) {
  const hit = readdirSync(BACKLOG).find((f) => f.endsWith('.md') && (f === `${target}.md` || (num && f.startsWith(`${num}-`))));
  if (!hit) {
    console.error(`✗ no backlog item found for "${target}" (looked for backlog/${num || target}-*.md)`);
    process.exit(2);
  }
  id = hit.replace(/\.md$/, '');
}
const path = fileFor(id);
const content = readFileSync(path, 'utf8');
const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');

// When the loader skipped the item, synthesize the minimal record the rendering lint reads from the raw
// frontmatter (so type/status/batchable-gated checks still run sensibly).
if (!item) {
  const matter = require('gray-matter');
  const fm = matter(content).data || {};
  const firstPara = body.split('\n').find((l) => l.trim() && !l.startsWith('#')) || '';
  item = { id, type: fm.type, status: fm.status, batchable: false, summary: firstPara.trim(), blockedBy: fm.blockedBy };
}

// ── Run the checks ──────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];

// Frontmatter — file-driven (an unquoted `: ` makes YAML read a nested mapping → the loader drops the
// whole item silently). ERROR.
for (const h of findUnquotedColonScalars(content)) {
  errors.push(`Backlog item "${id}" has an unquoted colon in frontmatter — \`${h.key}: ${h.value}\` (line ${h.line}). ` +
    `YAML reads the embedded \`: \` as a nested mapping and the loader silently SKIPS the whole item. ` +
    `Quote the value: \`${h.key}: "${h.value}"\`.`);
}

// Body rendering checks (raw HTML, bad links, buried fork, mis-flagged batchable) — shared with the gate.
const rendering = lintBacklogItemRendering({ item, body });
errors.push(...rendering.errors);
warnings.push(...rendering.warnings);

// Digest length — the lead paragraph is the one-glance selection text; keep it scannable. WARN.
if (typeof item.summary === 'string') {
  const words = item.summary.split(/\s+/).filter(Boolean).length;
  if (words > DIGEST_MAX_WORDS)
    warnings.push(`Backlog item "${id}" digest (lead paragraph) is ${words} words — keep it under ${DIGEST_MAX_WORDS} for one-glance selection`);
}

// Blocker-DAG (per-item) — each `blockedBy` edge must resolve to a real item and never be the item
// itself. The cycle walk is a graph-level check the whole-repo gate owns. ERROR.
if (item.blockedBy !== undefined) {
  if (!Array.isArray(item.blockedBy)) {
    errors.push(`Backlog item "${id}" blockedBy must be an array of NNN ids (e.g. ["079", "092"])`);
  } else {
    // A known id is a landed NNN or a provisional `xNNNNNN` hash (#2288) — an in-flight sibling can be a
    // valid blockedBy target while both are still hash-keyed in the lane.
    const knownNums = new Set(
      readdirSync(BACKLOG).filter((f) => f.endsWith('.md')).map((f) => f.match(/^(\d{1,4}|x[0-9a-z]{6})-/)?.[1]).filter(Boolean),
    );
    for (const raw of item.blockedBy) {
      const t = String(raw);
      if (t === num) errors.push(`Backlog item "${id}" lists itself in blockedBy — an item cannot block itself`);
      else if (!knownNums.has(t)) errors.push(`Backlog item "${id}" blockedBy "#${t}" does not resolve to an existing item`);
    }
  }
}

// Build-queue prioritization fields (#2528) — validate `tier`/`rank` shape when present. Read straight
// from the frontmatter block so a value the loader dropped is still caught. These fields only ORDER the
// queue; they never affect readiness, so a bad value is a lint error, not a blocker-DAG concern.
{
  const fm = (content.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  // Strip only a MATCHED surrounding quote pair (a half-quoted value stays as-is so it's flagged).
  const unquote = (v) => v.trim().replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1');
  const tierM = fm.match(/^tier:\s*(.+)$/m);
  if (tierM) {
    const t = unquote(tierM[1]);
    if (!TIERS.includes(t)) errors.push(`Backlog item "${id}" tier "${t}" is not one of ${TIERS.join(', ')}`);
  }
  const rankM = fm.match(/^rank:\s*(.+)$/m);
  if (rankM) {
    const r = unquote(rankM[1]);
    if (!/^[0-9a-z]+$/.test(r)) errors.push(`Backlog item "${id}" rank "${r}" must be a base-36 key ([0-9a-z]+)`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────────
for (const m of warnings) console.log(`  warn  ${m}`);
for (const m of errors) console.log(` error  ${m}`);
const tag = `backlog/${id}.md`;
if (errors.length) {
  console.log(`\n✗ ${errors.length} error(s), ${warnings.length} warning(s) — ${tag}`);
  process.exit(1);
}
console.log(`✓ ${tag} — clean${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
