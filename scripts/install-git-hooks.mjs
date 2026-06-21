#!/usr/bin/env node
/**
 * @file install-git-hooks.mjs — install the repo's git pre-commit gate (idempotent).
 *
 * Wires `lint:locus --staged` (scripts/lint-locus-prefix.mjs) into `.git/hooks/pre-commit`
 * so a bare code-path ref (`foo.ts` without a `we:`/`fui:`/`plateau:` prefix, #883/#884/#885)
 * in any STAGED backlog/*.md or reports/*.md HARD-BLOCKS the commit — the deterministic backstop
 * the PostToolUse(Edit|Write) per-edit hook can't provide (it fires after the write and can't
 * stop a commit, and heredoc/`cat >>` body-appends bypass it entirely; the staged sweep catches
 * both). Session-, tool-, and append-agnostic: it runs inside `git commit` however the commit is
 * made. Escape hatch for a deliberate exception: `git commit --no-verify`.
 *
 * Auto-runs on `npm install` via the package.json `prepare` script; safe to run by hand.
 * `.git/hooks/` is not version-controlled, so this script is how the gate travels with the repo.
 */
import { writeFileSync, readFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_DIR = join(ROOT, '.git', 'hooks');
const HOOK = join(HOOK_DIR, 'pre-commit');
const MARKER = '# webeverything-locus-gate (managed by scripts/install-git-hooks.mjs)';

const BODY = `#!/bin/sh
${MARKER}
# Block a commit whose staged backlog/reports md has a bare code-path ref (#883/#884/#885).
# Bypass a deliberate exception with: git commit --no-verify
exec node scripts/lint-locus-prefix.mjs --staged
`;

// No .git/hooks (e.g. a tarball checkout, not a clone) → nothing to install, succeed quietly.
if (!existsSync(join(ROOT, '.git'))) {
  console.log('install-git-hooks: no .git directory — skipped (not a git checkout)');
  process.exit(0);
}
mkdirSync(HOOK_DIR, { recursive: true });

// Refuse to clobber a foreign pre-commit hook; overwrite our own (idempotent re-install).
if (existsSync(HOOK)) {
  const cur = readFileSync(HOOK, 'utf8');
  if (!cur.includes(MARKER)) {
    console.error(
      'install-git-hooks: .git/hooks/pre-commit exists and is NOT ours — leaving it untouched.\n' +
        '  Add this line to it manually to enable the locus gate:\n' +
        '    node scripts/lint-locus-prefix.mjs --staged || exit 1',
    );
    process.exit(0); // not a failure — don't break `npm install`
  }
}

writeFileSync(HOOK, BODY);
chmodSync(HOOK, 0o755);
console.log('install-git-hooks: locus pre-commit gate installed → .git/hooks/pre-commit');
