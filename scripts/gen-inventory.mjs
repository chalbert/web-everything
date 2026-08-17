#!/usr/bin/env node
/**
 * gen-inventory.mjs — regenerates the repo summary inside AGENTS.md.
 *
 * The summary is DERIVED data (counts by status), not prose, so it's generated rather than
 * hand-written: deterministic in, deterministic out. `check:standards` imports renderInventory()
 * and fails if AGENTS.md is stale — so the summary can't drift, and no agent ever freehand-edits
 * its own instructions. Keep it compact (counts only); full lists live in src/_data/*.json.
 *
 * Run: `npm run gen:inventory`  (writes AGENTS.md)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBlocks } from './lib/blocks-loader.cjs';
import { loadIntents } from './lib/intents-loader.cjs';
import { loadResearch } from './lib/research-loader.cjs';
import { loadSemantics } from './lib/semantics-loader.cjs';
import { loadDataRegistry } from './lib/registry-loader.cjs';

export const START = '<!-- AUTO-GENERATED:inventory — run `npm run gen:inventory`; do not edit by hand -->';
export const END = '<!-- /AUTO-GENERATED:inventory -->';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const AGENTS = join(ROOT, 'AGENTS.md');

const readJson = (name) => {
  const p = join(DATA, `${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
};
const arr = (d) => (Array.isArray(d) ? d : []);
const byStatus = (list) => {
  const m = {};
  for (const x of list) if (x && x.status) m[x.status] = (m[x.status] || 0) + 1;
  return Object.keys(m).sort().map((k) => `${m[k]} ${k}`).join(' · ');
};

/**
 * Render the inventory body (between markers). Pure function of its six registry arrays, which
 * default to the real working-tree data files. `regenerateStaged()` overrides all six with
 * git-INDEX-sourced arrays (see `loadIndexRegistries()` below) so a commit-time regen counts only
 * what will actually land in the commit — never an untracked sibling file sitting in the same
 * registry dir (#1414 review, round 2). The counting/formatting logic below stays the single
 * source of truth either way; only where the six arrays come FROM differs.
 */
export function renderInventory({
  blocks = loadBlocks(), // per-block specs src/_data/blocks/<id>.json, assembled (#882)
  plugs = arr(loadDataRegistry('plugs')), // per-plug specs src/_data/plugs/<id>.json, assembled (#1157)
  intents = arr(loadIntents()), // per-intent specs src/_data/intents/<id>.json, assembled (#1145)
  semantics = arr(loadSemantics()), // per-term specs src/_data/semantics/<slug>.json, assembled (#1146)
  research = arr(loadResearch()), // per-topic specs src/_data/researchTopics/<id>.json, assembled (#1145)
  projects = arr(loadDataRegistry('projects')), // per-project specs src/_data/projects/<id>.json (#1157)
} = {}) {
  const openResearch = research.filter((r) => r.status === 'open').length;
  const projectIds = projects.map((p) => p.id).filter(Boolean).sort().join(', ');

  return [
    `- **Plugs** ${plugs.length} — ${byStatus(plugs)}`,
    `- **Blocks** ${blocks.length} — ${byStatus(blocks)}`,
    `- **Intents** ${intents.length} — ${byStatus(intents)}`,
    `- **Glossary terms** ${semantics.length} · **Research topics** ${research.length} (${openResearch} open)`,
    `- **Projects** ${projects.length}: ${projectIds}`,
  ].join('\n');
}

/** Splice fresh inventory into a file's marked region. Returns the new file contents. */
export function spliceInventory(fileContents, body) {
  const block = `${START}\n${body}\n${END}`;
  if (!fileContents.includes(START) || !fileContents.includes(END))
    throw new Error(`AGENTS.md is missing the inventory markers. Add:\n${START}\n${END}`);
  return fileContents.replace(new RegExp(`${esc(START)}[\\s\\S]*?${esc(END)}`), block);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Files whose staged presence can move a count `renderInventory()` reports (the six per-entry
// registries it assembles, one dir per kind — #882/#1145/#1146/#1157) or the marked block itself.
// Mirrors CORPUS_RE in lint-locus-prefix.mjs: a scoping regex kept next to the check it scopes,
// not centralised, so each write-time gate stays independently auditable.
const INVENTORY_AFFECTING_RE = /^src\/_data\/(blocks|plugs|intents|semantics|researchTopics|projects)\/[^/]+\.json$|^AGENTS\.md$/;

/** Git-staged (added/copied/modified/renamed/deleted) files, relative to repo root. */
function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Regenerate AGENTS.md's inventory block from disk and write it if changed. Returns true if written. */
function regenerate() {
  const before = readFileSync(AGENTS, 'utf8');
  const after = spliceInventory(before, renderInventory());
  if (after === before) return false;
  writeFileSync(AGENTS, after);
  return true;
}

/** A path's currently-STAGED (git index) content, or null if the path isn't in the index at all. */
function stagedContent(root, relPath) {
  try {
    return execFileSync('git', ['show', `:${relPath}`], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
}

/** True if `relPath` has an UNSTAGED (working-tree vs index) diff right now, in `root`. */
function hasUnstagedEdit(root, relPath) {
  const out = execFileSync('git', ['diff', '--name-only', '--', relPath], { cwd: root, encoding: 'utf8' });
  return out.trim().length > 0;
}

// The same six per-entry registry dirs INVENTORY_AFFECTING_RE scopes, keyed to the arg name
// renderInventory() expects for each — one source of truth for "which dir feeds which count".
const REGISTRY_DIRS = {
  blocks: 'src/_data/blocks',
  plugs: 'src/_data/plugs',
  intents: 'src/_data/intents',
  semantics: 'src/_data/semantics',
  research: 'src/_data/researchTopics',
  projects: 'src/_data/projects',
};

/**
 * Load one registry dir's entries from the git INDEX (staged/tracked), not the working tree —
 * `git ls-files --cached -s` lists only what's actually tracked or staged, with each entry's blob
 * SHA (an untracked sibling file dropped in the same dir never appears here, unlike
 * `readdirSync`). Reads every blob in ONE batched `git cat-file --batch` call rather than one
 * `git show` subprocess per file — the six registries hold ~900 files combined (this hook runs on
 * EVERY commit, so one-subprocess-per-file would be a real per-commit cost, not just a style
 * nit). `--batch` writes raw object bytes, so this stays on Buffers (byte offsets from the
 * `<sha> <type> <size>` header) until the final per-blob `toString('utf8')` — slicing by that byte
 * size on a decoded JS string would misalign on any multi-byte UTF-8 content (this repo's JSON
 * prose uses em dashes/smart quotes).
 */
function loadIndexRegistry(root, relDir) {
  const listed = execFileSync('git', ['ls-files', '--cached', '-s', '--', relDir], { cwd: root, encoding: 'utf8' });
  const entries = listed
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      const sha = line.slice(0, tab).split(' ')[1]; // "<mode> <sha> <stage>\t<path>"
      const path = line.slice(tab + 1);
      return { sha, path };
    })
    .filter((e) => e.path.endsWith('.json'));
  if (entries.length === 0) return [];

  const batchInput = entries.map((e) => e.sha).join('\n') + '\n';
  const batchOut = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: batchInput,
    maxBuffer: 64 * 1024 * 1024,
  }); // Buffer (no `encoding` option) — see byte-offset note above

  const out = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const nl = batchOut.indexOf(0x0a, offset); // '\n' ends the "<sha> <type> <size>" header
    const size = Number(batchOut.slice(offset, nl).toString('utf8').split(' ')[2]);
    const contentStart = nl + 1;
    out.push(JSON.parse(batchOut.slice(contentStart, contentStart + size).toString('utf8')));
    offset = contentStart + size + 1; // +1 skips the trailing '\n' after each blob's content
  }
  return out;
}

/**
 * Assemble renderInventory()'s six inputs from the git INDEX under `root`, for
 * regenerateStaged()'s real default body — so the commit-time count matches what `git ls-tree
 * HEAD` will show after the commit, not whatever happens to be sitting on disk (#1414 review,
 * round 2: the old default called renderInventory() with no args, which reads the six registry
 * dirs via readdirSync over the working tree — an untracked sibling JSON file in one of them
 * inflated the committed count even though the file itself never landed in the commit).
 */
function loadIndexRegistries(root) {
  const out = {};
  for (const [key, dir] of Object.entries(REGISTRY_DIRS)) out[key] = loadIndexRegistry(root, dir);
  return out;
}

/**
 * Regenerate AGENTS.md's inventory block against the STAGED baseline (the git index) and write the
 * result directly into the INDEX — never by reading the whole working-tree file and blindly
 * `git add`ing it back (the bug PR #1414's review caught: a developer's unrelated UNSTAGED edit
 * sitting in AGENTS.md — mid-edit, or left over from a partial `git add -p` — got silently swept
 * into an unrelated commit, breaking git's "only staged content lands in the commit" guarantee).
 *
 * This is the standard git-safe "partial staging" pattern pre-commit formatters use (same approach
 * as git-format-staged / lint-staged's index-only mode): read what will ACTUALLY be committed
 * (`git show :path`, the index blob) as the splice baseline, write the transformed result as a new
 * blob (`git hash-object -w`), and point the index entry at it (`git update-index --cacheinfo`) —
 * the working-tree file is never read as the baseline and never blindly overwritten. An unstaged
 * edit to AGENTS.md can therefore never enter the commit: it isn't part of the index, so it never
 * reaches `git show :AGENTS.md`, and the fixed-up index blob doesn't come from (or get written
 * back over) the working-tree copy.
 *
 * The working tree is synced to match ONLY when it currently has no unstaged edit (i.e. it equals
 * the pre-splice staged content already) — pure convenience so a normal commit doesn't leave a
 * spurious post-commit diff. If AGENTS.md DOES have an unstaged edit, the working tree is left
 * untouched: the developer's edit stays exactly where they left it, uncommitted, and a `git diff`
 * after the commit will show it against the new inventory block — expected, correct behavior under
 * partial staging, not a bug.
 *
 * Params default to this repo's real root/path/computed body for the CLI; tests override `root`
 * (a scratch git repo) and `body` (a fixed string) to stay hermetic and never touch the real
 * src/_data registries. The computed `body` default is sourced from the git INDEX under `root`
 * (`loadIndexRegistries()`), NOT the working tree — see that function's comment for why
 * (#1414 review, round 2).
 * Returns true if the index (and possibly the working tree) was updated.
 */
export function regenerateStaged({ root = ROOT, agentsPath = 'AGENTS.md', body = renderInventory(loadIndexRegistries(root)) } = {}) {
  const before = stagedContent(root, agentsPath);
  if (before === null) return false; // AGENTS.md isn't tracked in the index — nothing to splice onto
  const after = spliceInventory(before, body);
  if (after === before) return false;

  const hadUnstagedEdit = hasUnstagedEdit(root, agentsPath); // captured BEFORE the index write below —
  // afterward the working tree would almost always differ from the NEW index, which is not the question.

  const hash = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: after, encoding: 'utf8' }).trim();
  execFileSync('git', ['update-index', '--cacheinfo', `100644,${hash},${agentsPath}`], { cwd: root });

  if (!hadUnstagedEdit) {
    writeFileSync(join(root, agentsPath), after);
  }
  return true;
}

// ── Run as a script ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--staged')) {
    // Pre-commit write-time regen (#1404 incident — a PR added a research topic without regenerating
    // AGENTS.md, and CI didn't catch it until an already-`review:accepted` PR, costing a round-trip).
    // Scoped to when the commit actually touches inventory-affecting content, so an unrelated commit
    // never touches AGENTS.md's index entry at all. `npm run gen:inventory` (no flag) stays available
    // for a manual/full working-tree regen. `regenerateStaged()` (above) operates on the git INDEX, not
    // the working tree, so it never sweeps an unrelated unstaged AGENTS.md edit into the commit (#1414
    // review finding) — it stages the fix directly, so no follow-up `git add` here (that would
    // re-introduce the exact bug by re-adding the working-tree copy, unstaged edit and all).
    // `check:standards`'s inventory check (kind:'inventory') remains as a CI backstop for any commit
    // path that bypasses this hook (e.g. `--no-verify`).
    if (!stagedFiles().some((f) => INVENTORY_AFFECTING_RE.test(f))) {
      process.exit(0); // nothing staged could move the counts — no-op, don't touch AGENTS.md
    }
    if (regenerateStaged()) {
      console.log('AGENTS.md inventory regenerated and staged (pre-commit).');
    }
    // else: already up to date — silent, matches lint:locus's quiet-pass convention
  } else {
    if (regenerate()) {
      console.log('AGENTS.md inventory regenerated.');
    } else {
      console.log('AGENTS.md inventory already up to date.');
    }
  }
}
