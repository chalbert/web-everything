#!/usr/bin/env node
/**
 * lane-manifest-write.mjs — write a lane's `.lane-manifest.json` into its WE lane commit (#2174, under #2162).
 *
 * WHY (#2174 producer stop-at-push): under the deferred merge queue (#2138) a producing lane STOPS at "lane
 * pushed + `backlog.mjs queue` + `.lane-manifest.json` written" instead of integrating inline — the deferred
 * drain (#2173) owns all landing. The manifest is the per-item source of truth the drain reads (in a LATER
 * session) to land the couple: its cross-repo `repos` in impl-first/WE-last order, cross-item `blockedBy`, and
 * `mergeRiskFiles`. It must be a NEW file IN the WE lane commit (a one-sided add — preserves the #1869
 * conflict-free WE-lane merge, stays out of the resolve diff), so the WRITE call-site is here, in the producer,
 * before the push. This is the mechanical writer; it builds/validates via the pure `lane-manifest.mjs`
 * primitive (#2163) so the on-disk file always conforms to the schema the drain's `planDrain` expects.
 *
 * The lane agent runs this in its WE clone AFTER the resolve commit, then `git add .lane-manifest.json` and
 * amends it onto that commit (co-located with the resolve — one commit), then pushes the lane ref. The
 * orchestrator (Phase 4, deferred mode) then `backlog.mjs queue`s the item; the drain reads THIS file off the
 * pushed ref.
 *
 * Usage:
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[{"repo":"we","ref":"lane/slug-2174"}]'
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[…]' --blocked-by=2173,2170 --merge-risk='["src/_data/traits.json"]'
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[…]' --batch-slug=slug --out=/path/.lane-manifest.json
 *   node scripts/lane-manifest-write.mjs … --json          # machine-readable result
 *
 * Exit codes: 0 = written; 3 = bad input (no/invalid --item or --repos, or the built manifest fails validation
 * — nothing is written, so a malformed manifest never reaches the queue).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { buildManifest, validateManifest, serializeManifest, MANIFEST_FILENAME } from './readiness/lane-manifest.mjs';

const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const expandHome = (p) => (p && p.startsWith('~') ? p.replace(/^~/, homedir()) : p);
const AS_JSON = !!flags.json;

function emit(result, code) {
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stderr.write(`lane-manifest-write ${result.ok ? '✓' : '✗'} ${result.detail}\n`);
  process.exit(code);
}

const item = Number(flags.item);
if (!Number.isFinite(item)) emit({ ok: false, detail: 'pass --item=<NNN> (a finite item number)' }, 3);

let repos;
try { repos = JSON.parse(flags.repos); } catch { repos = null; }
if (!Array.isArray(repos) || repos.length === 0) emit({ ok: false, detail: "pass --repos='[{\"repo\":\"we\",\"ref\":\"lane/<slug>-<num>\"}, …]' (a non-empty JSON array)" }, 3);

const blockedBy = typeof flags['blocked-by'] === 'string'
  ? flags['blocked-by'].split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite)
  : [];
let mergeRiskFiles = [];
if (typeof flags['merge-risk'] === 'string') {
  try { const p = JSON.parse(flags['merge-risk']); if (Array.isArray(p)) mergeRiskFiles = p.map(String); }
  catch { mergeRiskFiles = flags['merge-risk'].split(',').map((s) => s.trim()).filter(Boolean); }
}

// Build via the canonical primitive so the file conforms to the drain's expected schema (WE carries the
// resolve, impl-first/WE-last order, exactly one carrier) — then validate BEFORE writing.
const manifest = buildManifest({
  item,
  ...(typeof flags['batch-slug'] === 'string' ? { batchSlug: flags['batch-slug'] } : {}),
  repos,
  blockedBy,
  mergeRiskFiles,
});
const v = validateManifest(manifest);
if (!v.ok) emit({ ok: false, item, detail: `refusing to write an invalid manifest: ${v.errors.join('; ')}` }, 3);

const out = typeof flags.out === 'string' ? resolve(expandHome(flags.out)) : resolve(process.cwd(), MANIFEST_FILENAME);
try { writeFileSync(out, serializeManifest(manifest)); }
catch (e) { emit({ ok: false, item, detail: `write failed: ${String(e.message || e).split('\n')[0]}` }, 3); }

emit({ ok: true, item, path: out, repos: manifest.repos.map((r) => `${r.repo}:${r.ref}`), blockedBy: manifest.blockedBy, detail: `wrote ${MANIFEST_FILENAME} for #${item} (${manifest.repos.map((r) => r.repo).join(' → ')}, impl-first/WE-last)` }, 0);
