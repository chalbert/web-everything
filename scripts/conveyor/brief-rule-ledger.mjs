#!/usr/bin/env node
/**
 * Brief-rule ledger (#4070): every imperative line in a DISPATCHED agent brief, mapped to the code that
 * enforces it — a hook, a wrapper step, a gate — or explicitly marked `judgment` (no script can decide it) or
 * `prose-only` (a script could decide it, nothing does yet; the entry names the proposed enforcer so it can be
 * filed as its own card). Root cause behind the ledger: dispatched agents skip prose rules (2026-09-24: no
 * completion record, a card rewritten through Bash, a turn ended on a background wait). A rule that is only
 * prose is a rule an agent will eventually skip, so the useful number is how many are still prose-only.
 *
 * The data lives in `skills-src/conveyor/brief-rule-ledger.json`. Each line is keyed by its brief path plus a
 * short hash of its whitespace-normalised text, so editing an imperative line makes it `unlisted` until someone
 * re-classifies it — that is the point: a changed rule is a rule whose enforcer needs re-checking.
 *
 *   node scripts/conveyor/brief-rule-ledger.mjs           # summary: counts by status, unlisted/stale lines
 *   node scripts/conveyor/brief-rule-ledger.mjs --json    # every imperative line with its rule + status
 *   node scripts/conveyor/brief-rule-ledger.mjs --check   # exit 1 on an unlisted or stale line
 *
 * Report-only by default. The CI wiring (inline tags, `check:standards`) is #4055's; this module is the
 * inventory it can consume.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const LEDGER_PATH = 'skills-src/conveyor/brief-rule-ledger.json';

/** The directories whose brief/system-prompt files are handed to a dispatched agent. SKILL.md is the
 *  operator's playbook, not a dispatched brief, so it is out. */
export const BRIEF_DIRS = Object.freeze(['skills-src/conveyor', 'skills-src/review']);
const BRIEF_FILE = /-(?:brief(?:-v\d+)?|system-prompt)\.md$/;

/** A line is imperative when it carries one of the rule words #4055 names (must, never, always, before you)
 *  or a direct prohibition (do not / don't). Case-insensitive; curly apostrophes count. */
export const IMPERATIVE = /\b(?:must|never|always|do\s+not|don['’]t|before\s+you)\b/i;

/** Rule statuses, WEAKEST first. One line can state several rules ("do not merge, do not release"); it counts
 *  under the weakest of them, so a line is `enforced` only when every rule it states is. `descriptive` marks a
 *  line that uses a rule word to describe system behaviour rather than instruct the agent. */
export const STATUSES = Object.freeze(['prose-only', 'judgment', 'enforced', 'descriptive']);

/** Whitespace-collapsed text of one line. Pure. */
export function normalizeLine(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/** Stable 10-hex key for one line's normalised text. Pure. */
export function lineKey(text) {
  return createHash('sha1').update(normalizeLine(text)).digest('hex').slice(0, 10);
}

/** Every imperative line of one brief's text, 1-based line numbers. Pure. */
export function extractImperatives(text) {
  const out = [];
  String(text).split('\n').forEach((raw, i) => {
    const line = normalizeLine(raw);
    if (line && IMPERATIVE.test(line)) out.push({ line: i + 1, text: line, key: lineKey(line) });
  });
  return out;
}

/** Repo-relative paths of every dispatched brief under {@link BRIEF_DIRS}. */
export function listBriefs(root = REPO_ROOT) {
  return BRIEF_DIRS.flatMap((dir) => {
    const abs = join(root, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs).filter((f) => BRIEF_FILE.test(f)).sort().map((f) => relative(root, join(abs, f)));
  });
}

/** Structural problems in a parsed ledger (unknown enforcer ids, bad statuses, duplicate keys). Pure. */
export function validateLedger(ledger) {
  const errors = [];
  const enforcers = ledger?.enforcers ?? {};
  const ids = new Set();
  for (const rule of ledger?.rules ?? []) {
    if (!rule.id) errors.push('rule without an id');
    if (ids.has(rule.id)) errors.push(`${rule.id}: duplicate rule id`);
    ids.add(rule.id);
    if (!STATUSES.includes(rule.status)) errors.push(`${rule.id}: status must be one of ${STATUSES.join('|')}`);
    if (rule.status === 'enforced' && !(rule.enforcers?.length)) errors.push(`${rule.id}: enforced but names no enforcer`);
    if (rule.status === 'prose-only' && !rule.proposed) errors.push(`${rule.id}: prose-only but names no proposed enforcer`);
    for (const id of rule.enforcers ?? []) if (!enforcers[id]) errors.push(`${rule.id}: unknown enforcer ${id}`);
    const seen = new Set();
    for (const l of rule.lines ?? []) {
      const k = `${l.brief}#${l.key}`;
      if (seen.has(k)) errors.push(`${rule.id}: line ${k} is listed twice`);
      seen.add(k);
    }
  }
  return errors;
}

/** The weakest of `statuses` per {@link STATUSES}' order. Pure. */
export function weakestStatus(statuses) {
  return STATUSES.find((s) => statuses.includes(s)) ?? 'unlisted';
}

/**
 * Join the imperative lines actually present in the briefs against the ledger. Pure.
 * @param {{brief:string, text:string}[]} briefs
 * @param {object} ledger
 * @returns {{lines: object[], unlisted: object[], stale: object[], counts: Record<string, number>}}
 */
export function auditLedger(briefs, ledger) {
  const byKey = new Map();
  for (const rule of ledger?.rules ?? []) {
    for (const l of rule.lines ?? []) {
      const k = `${l.brief}#${l.key}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(rule);
    }
  }
  const present = new Set();
  const lines = [];
  const unlisted = [];
  for (const { brief, text } of briefs) {
    for (const imp of extractImperatives(text)) {
      const k = `${brief}#${imp.key}`;
      present.add(k);
      const rules = byKey.get(k) ?? [];
      const row = { brief, ...imp, rules: rules.map((r) => r.id), status: weakestStatus(rules.map((r) => r.status)) };
      lines.push(row);
      if (!rules.length) unlisted.push(row);
    }
  }
  const stale = [];
  for (const rule of ledger?.rules ?? []) {
    for (const l of rule.lines ?? []) if (!present.has(`${l.brief}#${l.key}`)) stale.push({ rule: rule.id, ...l });
  }
  const counts = { enforced: 0, judgment: 0, 'prose-only': 0, descriptive: 0, unlisted: 0 };
  for (const row of lines) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { lines, unlisted, stale, counts };
}

/** Enforcer ids whose `ref`/`test` file does not exist under `root`. */
export function missingEnforcerFiles(ledger, root = REPO_ROOT) {
  const missing = [];
  for (const [id, e] of Object.entries(ledger?.enforcers ?? {})) {
    for (const field of ['ref', 'test']) {
      const file = String(e[field] ?? '').split('#')[0];
      if (file && !existsSync(join(root, file))) missing.push(`${id}.${field}: ${file}`);
    }
  }
  return missing;
}

export function loadLedger(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8'));
}

export function readBriefs(root = REPO_ROOT) {
  return listBriefs(root).map((brief) => ({ brief, text: readFileSync(join(root, brief), 'utf8') }));
}

function main(argv) {
  const ledger = loadLedger();
  const result = auditLedger(readBriefs(), ledger);
  const errors = [...validateLedger(ledger), ...missingEnforcerFiles(ledger)];
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...result, errors }, null, 2));
  } else {
    const c = result.counts;
    console.log(`brief-rule ledger: ${result.lines.length} imperative lines — ${c.enforced} enforced, ${c.judgment} judgment, ${c['prose-only']} prose-only, ${c.descriptive} descriptive, ${c.unlisted} unlisted, ${result.stale.length} stale`);
    for (const rule of ledger.rules.filter((r) => r.status === 'prose-only')) {
      console.log(`  prose-only rule ${rule.id} (${rule.lines.length} lines) — proposed: ${rule.proposed}`);
    }
    for (const r of result.unlisted) console.log(`  unlisted  ${r.brief}:${r.line} [${r.key}] ${r.text.slice(0, 120)}`);
    for (const r of result.stale) console.log(`  stale     ${r.brief} [${r.key}] (rule ${r.rule}) — line no longer present`);
    for (const e of errors) console.log(`  error     ${e}`);
  }
  if (argv.includes('--check') && (result.unlisted.length || result.stale.length || errors.length)) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
