#!/usr/bin/env node
/**
 * @file lint-locus-prefix.mjs — write-time + pre-commit locus-prefix check (#883/#884/#885, shift-left).
 *
 * Runs the SAME pure detector the gate uses (`scanRepoLocusPrefixes`,
 * check-standards-rules.mjs) so a bare code-path token (`foo.ts`, `02-bar.html`, …)
 * in backlog/*.md or reports/*.md is caught BEFORE `check:standards` commit/close-out time.
 *
 * Four modes (#1389):
 *   • `--pre` — the PreToolUse(Edit|Write) GATE (load-bearing): scan the PROPOSED post-edit
 *     content from the hook event JSON on stdin BEFORE it is written to disk, and exit 2 (deny
 *     the tool call) if the edit would introduce a bare ref. Keeps a bare ref from EVER landing
 *     on disk, so a concurrent agent's whole-repo `check:standards` never goes red because of an
 *     in-work item mid-edit. Write → scans `tool_input.content`; Edit → applies
 *     `old_string`→`new_string` to the on-disk file and scans the result.
 *   • single-file (default) — the PostToolUse(Edit|Write) backstop: lint ONE just-edited file
 *     from disk. Target from the hook event JSON (`{ tool_input: { file_path } }`) or argv
 *     (`node scripts/lint-locus-prefix.mjs backlog/123-foo.md`).
 *   • `--staged` — the staged SWEEP: lint every git-staged backlog/reports md file. Catches refs
 *     introduced by `cat >>` / heredoc body-appends that bypass the Edit/Write hooks entirely.
 *     `npm run lint:locus`.
 *   • `--all` — lint the whole backlog/ + reports/ corpus (CI / one-shot audit).
 *
 * Path match accepts BOTH absolute (hook) and relative (manual / staged) paths (#1389 — the
 * old `/(backlog|reports)/` required a leading slash, so a relative `backlog/x.md` no-op'd).
 * Exit 2 + stderr on findings (fed back to the agent); exit 0 when clean or N/A.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepoLocusPrefixes } from './check-standards-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Absolute OR relative: anchor the corpus dir to a path start or a slash (#1389).
const CORPUS_RE = /(?:^|\/)(?:backlog|reports)\/[^/]+\.md$/;

/** Read a repo file (path relative to root); null if unreadable (deleted/renamed away). */
function readDoc(file) {
  try {
    return { file, content: readFileSync(join(ROOT, file), 'utf8') };
  } catch {
    return null;
  }
}

/** Print findings + exit: 2 if any bare ref, else 0. */
function report(findings) {
  if (!findings.length) process.exit(0);
  for (const { file, count, sample } of findings) {
    process.stderr.write(
      `locus-prefix: ${count} bare code-path ref(s) in ${file} lack a <repo>: prefix ` +
        `(#883; e.g. "${sample}" → "we:${sample}"). Prefix them now — don't leave it for the gate.\n`,
    );
  }
  process.exit(2);
}

/** Git-staged (added/copied/modified/renamed) corpus files, relative to repo root. */
function stagedCorpusFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').map((s) => s.trim()).filter((f) => f && CORPUS_RE.test(f));
}

/** Whole backlog/ + reports/ corpus, relative to repo root. */
function allCorpusFiles() {
  return ['backlog', 'reports']
    .filter((d) => existsSync(join(ROOT, d)))
    .flatMap((d) => readdirSync(join(ROOT, d)).filter((n) => n.endsWith('.md')).map((n) => `${d}/${n}`));
}

const argv = process.argv.slice(2);

// ── Pre-write GATE — the PreToolUse(Edit|Write) path: scan the PROPOSED content, deny on a bare ref ──
if (argv.includes('--pre')) {
  let ev;
  try {
    ev = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0); // unparseable event — fail open (the PostToolUse + staged layers still cover it)
  }
  const file = ev?.tool_input?.file_path;
  if (!file || !CORPUS_RE.test(file)) process.exit(0); // not a locus-governed corpus file

  // Compute the post-edit content WITHOUT writing it.
  const ti = ev.tool_input ?? {};
  const onDisk = (() => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return ''; // new file (Write, or Edit creating one)
    }
  })();
  let proposed;
  if (ev.tool_name === 'Write') {
    proposed = ti.content ?? '';
  } else if (ev.tool_name === 'Edit' && typeof ti.old_string === 'string') {
    // Apply old→new the way Edit does; if old_string isn't present, scan just the insertion.
    proposed = onDisk.includes(ti.old_string)
      ? (ti.replace_all ? onDisk.split(ti.old_string).join(ti.new_string ?? '') : onDisk.replace(ti.old_string, ti.new_string ?? ''))
      : (ti.new_string ?? '');
  } else {
    proposed = ti.content ?? ti.new_string ?? onDisk; // unknown shape — best effort, fail open if empty
  }
  report(scanRepoLocusPrefixes([{ file, content: proposed }]));
}

// ── Sweep modes — the staged / CI path (#1389) ──────────────────────────────────
if (argv.includes('--staged') || argv.includes('--all')) {
  const files = argv.includes('--staged') ? stagedCorpusFiles() : allCorpusFiles();
  report(scanRepoLocusPrefixes(files.map(readDoc).filter(Boolean)));
}

// ── Single-file mode — the PostToolUse hook + manual run ─────────────────────────
function resolveTarget() {
  const arg = argv[0];
  if (arg && !arg.startsWith('--')) return arg;
  try {
    const raw = readFileSync(0, 'utf8'); // stdin (hook event JSON)
    if (!raw.trim()) return null;
    const ev = JSON.parse(raw);
    return ev?.tool_input?.file_path ?? null;
  } catch {
    return null;
  }
}

const file = resolveTarget();
// Only the two locus-governed corpora; bail fast (and silently) on everything else.
if (!file || !CORPUS_RE.test(file)) process.exit(0);

let content;
try {
  content = readFileSync(file, 'utf8');
} catch {
  process.exit(0); // deleted/unreadable — nothing to lint
}

report(scanRepoLocusPrefixes([{ file, content }]));
