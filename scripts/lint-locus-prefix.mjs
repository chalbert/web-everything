#!/usr/bin/env node
/**
 * @file lint-locus-prefix.mjs — write-time + pre-commit locus-prefix check (#883/#884/#885, shift-left).
 *
 * Runs the SAME pure detector the gate uses (`scanRepoLocusPrefixes`,
 * check-standards-rules.mjs) so a bare code-path token (`foo.ts`, `02-bar.html`, …)
 * in backlog/*.md or reports/*.md is caught BEFORE `check:standards` commit/close-out time.
 *
 * Three modes (#1389):
 *   • single-file (default) — the PostToolUse(Edit|Write) hook path: lint ONE just-edited
 *     file. Target from the hook event JSON on stdin (`{ tool_input: { file_path } }`) or
 *     argv (`node scripts/lint-locus-prefix.mjs backlog/123-foo.md`).
 *   • `--staged` — the PRE-COMMIT SWEEP: lint every git-staged backlog/reports md file.
 *     Catches refs introduced by `cat >>` / heredoc body-appends that bypass the per-edit
 *     hook (which only fires on the Edit/Write tools). `npm run lint:locus`.
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

// ── Sweep modes — the pre-commit / CI path (#1389) ──────────────────────────────
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
