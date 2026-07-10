#!/usr/bin/env node
/**
 * lane-manifest-write.mjs — write a lane's manifest to a SCRATCH file the producer hands to `pr-land` (#2174,
 * under #2162; carrier moved off the tree into the PR body in xnsk54v).
 *
 * WHY (#2174 producer stop-at-push): under the deferred merge queue (#2138) a producing lane STOPS at "lane
 * pushed + `backlog.mjs queue` + manifest written" instead of integrating inline — the deferred drain (#2173)
 * owns all landing. The manifest is the per-item source of truth the drain reads (in a LATER session) to land
 * the couple: its cross-repo `repos` in impl-first/WE-last order, cross-item `blockedBy`, and `mergeRiskFiles`.
 *
 * WHERE IT LIVES (xnsk54v): the manifest is drain-ONLY orchestration metadata, so it rides the PR BODY, NOT a
 * tracked file. It used to be committed as `we:.lane-manifest.json` at the repo root — but every lane wrote the
 * SAME path, so every open lane PR conflicted with `main` there (#2198), forcing the `rebase-drop-manifest`
 * merge-fabrication step and its per-pass merge-commit bloat. Now: this script writes the manifest to a SCRATCH
 * path (default under the OS temp dir; override with `--out`), the producer passes that path to
 * `pr-land --manifest-file=…`, and pr-land embeds it in the PR body. NOTHING is `git add`ed; no manifest file
 * lands in the tree. This is the mechanical writer; it builds/validates via the pure `lane-manifest.mjs`
 * primitive (#2163) so the payload always conforms to the schema the drain's `planDrain` expects.
 *
 * The lane agent runs this in its WE clone AFTER the resolve commit (writing to scratch — NEVER committed),
 * then opens the PR via `pr-land --manifest-file=<scratch>`. The drain reads the manifest off the PR body
 * (`gh pr view --json body`), with a legacy fallback to a tree-committed `.lane-manifest.json` for lanes queued
 * before the cutover.
 *
 * Usage:
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[{"repo":"we","ref":"lane/slug-2174"}]'   # → scratch temp file
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[…]' --blocked-by=2173,2170 --merge-risk='["src/_data/traits.json"]'
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[…]' --batch-slug=slug --out=/tmp/lane-manifest-<key>.json
 *   node scripts/lane-manifest-write.mjs --item=2174 --repos='[…]' --stack-parent=2151 --stack-parent=x7k2q9a --base=abc123f
 *     # #2387 F3 — overlap-stacked batching: `--stack-parent` (repeatable) records the frontier-tip item(s)
 *     # this lane was cut from / merged onto; `--base` records the commit SHA the lane was reset to, applied
 *     # to every repo entry that doesn't already carry its own `base` in `--repos`. Both optional — omit
 *     # either (or both) for a plain sibling lane, today's unchanged behavior.
 *   node scripts/lane-manifest-write.mjs … --json          # machine-readable result (its `path` is the scratch file for --manifest-file)
 *
 * Exit codes: 0 = written; 3 = bad input (no/invalid --item or --repos, or the built manifest fails validation
 * — nothing is written, so a malformed manifest never reaches the queue).
 */
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { buildManifest, validateManifest, serializeManifest } from './readiness/lane-manifest.mjs';

const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
// #2387 F3 — `--stack-parent` is REPEATABLE (one flag per parent), unlike every other flag above (last-wins);
// collect every occurrence separately instead of letting the last one clobber the rest.
const stackParents = argv
  .map((a) => a.match(/^--stack-parent=(.*)$/))
  .filter(Boolean)
  .map((m) => m[1]);
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

// #2387 F3 — `--base` is a convenience default applied to every repo entry that doesn't already carry its
// OWN `base` in `--repos` JSON (a per-entry `base` there always wins). Optional; absent ⇒ no repo gets a
// `base` field (today's plain-sibling behavior, unchanged).
if (typeof flags.base === 'string' && Array.isArray(repos)) {
  repos = repos.map((r) => (r && r.base != null && r.base !== '' ? r : { ...r, base: flags.base }));
}

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
  stackParents,
  blockedBy,
  mergeRiskFiles,
  // #2171 — count of pre-PR review findings the lane dismissed (the drain escalation rubric's strongest signal).
  ...(flags.dismissed != null ? { dismissedFindings: Number(flags.dismissed) } : {}),
});
const v = validateManifest(manifest);
if (!v.ok) emit({ ok: false, item, detail: `refusing to write an invalid manifest: ${v.errors.join('; ')}` }, 3);

// xnsk54v — default to a SCRATCH temp path (never the tracked repo-root file): the manifest rides the PR body
// via `pr-land --manifest-file`, it is not committed. An explicit `--out` still wins (the producer names a
// per-lane scratch path). MANIFEST_FILENAME is retained only as the drain's legacy tree-fallback lookup.
const out = typeof flags.out === 'string' ? resolve(expandHome(flags.out)) : join(tmpdir(), `lane-manifest-${item}.json`);
try { writeFileSync(out, serializeManifest(manifest)); }
catch (e) { emit({ ok: false, item, detail: `write failed: ${String(e.message || e).split('\n')[0]}` }, 3); }

emit({ ok: true, item, path: out, repos: manifest.repos.map((r) => `${r.repo}:${r.ref}`), stackParents: manifest.stackParents, blockedBy: manifest.blockedBy, detail: `wrote lane manifest for #${item} to ${out} (${manifest.repos.map((r) => r.repo).join(' → ')}, impl-first/WE-last) — pass it to \`pr-land --manifest-file\`, do NOT commit it` }, 0);
