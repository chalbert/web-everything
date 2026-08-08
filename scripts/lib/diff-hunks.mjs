/**
 * diff-hunks.mjs — #2890 the WRITE-TIME half of the base-vs-head diff-CONTENT plumbing: a single-file diff
 * computed with NO git ref on either side. At `PreToolUse(Edit|Write)` time the proposed edit has not been
 * written to disk yet and carries no commit, so there is no `<base>…<head>` ref pair to hand `git diff` the
 * way `merge-ai-prs.mjs#computeNetDiffText` does for a whole PR — "base" is the file as it sits on disk right
 * now, "head" is the content the pending tool call would write.
 *
 * Same unified-diff SHAPE as `computeNetDiffText`'s `.text` (both are `git diff` output), so a future
 * content-reading detector (#2839's `assertNotPrincipleAndImpl`, #2840's `isPrincipleSurface` —
 * `isStatuteAnchorEdit` / `isMarkedInvariantEdit`) reads identical hunk content whether it runs at write-time
 * (this module) or at PR-time (`computeNetDiffText`) — memory rule #43's "shift-left gate and whole-tree run
 * read the same content."
 *
 * PURE PLUMBING (#2890) — no detector lives here, and nothing in `.claude/settings.json` calls this today.
 * This module answers ONLY "what would this proposed edit change, as diff text?"; whether that text trips a
 * principle-surface rule is #2839/#2840's follow-on work (`we:scripts/check-standards-rules.mjs`,
 * `we:scripts/lib/gate-config.mjs`), which is `blockedBy: 2890` and does not exist yet. Wiring THIS module
 * into an actual `PreToolUse(Edit|Write)` hook entry has no gate to feed until that lands — see the backlog
 * item's "write path" note.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { basenameOf } from './gate-config.mjs';

/**
 * Compute the unified diff TEXT between `baseText` (the file as it sits on disk today) and `headText` (a
 * proposed edit not yet written), via `git diff --no-index` over two throwaway temp files this function owns
 * the full lifecycle of (create, diff, remove — always, even on error). `--no-index` is the one git subcommand
 * that diffs two arbitrary filesystem paths with no repo, ref, or index involvement — it never touches the
 * caller's working tree, staging area, or HEAD, and works identically whether or not the caller is even
 * inside a git repo.
 *
 * Identical texts short-circuit to `''` without shelling out. `git diff --no-index` EXITS 1 (not 0) when it
 * finds a difference — matching plain `diff(1)`, and that is the SUCCESS path here, not a failure: a caught
 * error with `status === 1` and real `stdout` is unwrapped and returned as the diff text. Any other outcome —
 * a missing `git` binary, a temp-dir failure, an unexpected exit code — fails SOFT to `''`, mirroring every
 * sibling diff helper's fail-open posture (`computeNetDiffText`, `computeNetDiffChangedFiles`): a diff-plumbing
 * hiccup must never wedge a write.
 *
 * NOTE ON HEADER FIDELITY: the temp paths are flat basenames under throwaway `base/`/`head/` subdirectories,
 * not the file's real repo path, so the emitted `diff --git a/base/<name> b/head/<name>` header does not read
 * as the real path. That is a COSMETIC gap only — the `@@ …@@` hunk headers and every `+`/`-` line are
 * byte-identical to what `git diff` would produce against the real file in place, and hunk CONTENT (not the
 * header's path spelling) is what a future content-reading detector evaluates.
 *
 * @param {{filePath?:string, baseText?:string, headText?:string, exec?:Function}} o - `exec` is
 *   `(cmd, args, opts) => string`, injected for hermetic tests exactly like `computeNetDiffText`'s.
 * @returns {string} unified diff text, or `''` when identical / unusable input / the diff itself failed.
 */
export function computeProposedFileDiffText({
  filePath = 'file',
  baseText = '',
  headText = '',
  exec = (cmd, args, opts) => execFileSync(cmd, args, opts),
} = {}) {
  if (typeof baseText !== 'string' || typeof headText !== 'string') return '';
  if (baseText === headText) return '';
  if (typeof exec !== 'function') return '';
  const name = basenameOf(String(filePath || 'file')) || 'file';
  let dir;
  try {
    dir = mkdtempSync(join(tmpdir(), 'we-write-diff-'));
    const baseDir = join(dir, 'base');
    const headDir = join(dir, 'head');
    mkdirSync(baseDir);
    mkdirSync(headDir);
    const baseFile = join(baseDir, name);
    const headFile = join(headDir, name);
    writeFileSync(baseFile, baseText, 'utf8');
    writeFileSync(headFile, headText, 'utf8');
    try {
      return String(exec('git', ['diff', '--no-index', '--end-of-options', baseFile, headFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '');
    } catch (err) {
      // `--no-index` exits 1 (with the diff on stdout) precisely BECAUSE the two files differ — that is the
      // expected outcome we came here for, not an error. Anything else (git missing, a real failure) falls
      // through to the fail-soft `''` below.
      if (err && err.status === 1 && typeof err.stdout === 'string') return err.stdout;
      return '';
    }
  } catch {
    return '';
  } finally {
    if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup — a leaked temp dir is not a correctness bug */ } }
  }
}
