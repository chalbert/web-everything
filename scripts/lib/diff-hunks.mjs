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
 * #2890-review-fix finding 2 — the EXPLICIT stdout cap. Node's `execFileSync` defaults `maxBuffer` to 1 MiB;
 * over that it SIGTERMs the child and throws `ENOBUFS` with a TRUNCATED `stdout`. Left at the default, this
 * function returned `''` for any diff above ~1 MB (reproduced: a 2 MB single-line edit yielded 0 bytes) — the
 * SAME value it returns for "the two texts are identical". For a write-time gate that is backwards: a large
 * edit is precisely the shape most likely to mix a principle surface with impl, and it got a free pass. 16 MiB
 * is far above any realistic single-file edit while still bounding the memory a write-time hook can be made to
 * allocate; over it, the result is `scored:false, reason:'diff-too-large'` — never a silent `''`.
 */
export const DEFAULT_DIFF_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Compute the unified diff TEXT between `baseText` (the file as it sits on disk today) and `headText` (a
 * proposed edit not yet written), via `git diff --no-index` over two throwaway temp files this function owns
 * the full lifecycle of (create, diff, remove — always, even on error). `--no-index` is the one git subcommand
 * that diffs two arbitrary filesystem paths with no repo, ref, or index involvement — it never touches the
 * caller's working tree, staging area, or HEAD, and works identically whether or not the caller is even
 * inside a git repo.
 *
 * RETURN SHAPE — `{text, scored, reason?}`, deliberately the SAME shape as `computeNetDiffText`, so both halves
 * of #2890's plumbing (write-time here, PR-time there) feed `diffHunksFrom()` and land on the same
 * `null`-means-NOT-COMPUTED contract in `scoreEscalation`. #2890-review-fix finding 2: the old bare-string
 * return made EVERY outcome — identical texts, a missing `git`, an over-cap diff — indistinguishable from one
 * another, all `''`. Now:
 *   • `{text:'',  scored:true}`                         — computed: the two texts are IDENTICAL (no content).
 *   • `{text:<diff>, scored:true}`                      — computed: real unified-diff text.
 *   • `{text:'', scored:false, reason:'bad-input'}`     — `baseText`/`headText` were not strings.
 *   • `{text:'', scored:false, reason:'exec-contract'}` — the injected `exec` is not a function (caller bug).
 *   • `{text:'', scored:false, reason:'diff-too-large'}`— the diff exceeded `maxBuffer` (see above).
 *   • `{text:'', scored:false, reason:'diff-failed'}`   — git missing, temp-dir failure, unexpected exit code.
 * Every `scored:false` outcome still FAILS SOFT — this never throws and never wedges a write — but the caller
 * can now tell "there is nothing to inspect" from "I could not look", which is the whole point of finding 1.
 *
 * Identical texts short-circuit without shelling out. `git diff --no-index` EXITS 1 (not 0) when it finds a
 * difference — matching plain `diff(1)`, and that is the SUCCESS path here, not a failure: a caught error with
 * `status === 1` and real `stdout` is unwrapped and returned as the diff text.
 *
 * NOTE ON HEADER FIDELITY: the temp paths are flat basenames under throwaway `base/`/`head/` subdirectories,
 * not the file's real repo path, so the emitted `diff --git a/base/<name> b/head/<name>` header does not read
 * as the real path. That is a COSMETIC gap only — the `@@ …@@` hunk headers and every `+`/`-` line are
 * byte-identical to what `git diff` would produce against the real file in place, and hunk CONTENT (not the
 * header's path spelling) is what a future content-reading detector evaluates.
 *
 * @param {{filePath?:string, baseText?:string, headText?:string, exec?:Function, maxBuffer?:number}} o - `exec`
 *   is `(cmd, args, opts) => string`, injected for hermetic tests exactly like `computeNetDiffText`'s.
 * @returns {{text:string, scored:boolean, reason?:'bad-input'|'exec-contract'|'diff-too-large'|'diff-failed'}}
 */
export function computeProposedFileDiffText({
  filePath = 'file',
  baseText = '',
  headText = '',
  maxBuffer = DEFAULT_DIFF_MAX_BUFFER,
  exec = (cmd, args, opts) => execFileSync(cmd, args, opts),
} = {}) {
  const unscored = (reason) => ({ text: '', scored: false, reason });
  if (typeof baseText !== 'string' || typeof headText !== 'string') return unscored('bad-input');
  if (typeof exec !== 'function') return unscored('exec-contract');
  // COMPUTED and genuinely empty — `scored:true`, which is what separates it from every branch below.
  if (baseText === headText) return { text: '', scored: true };
  const cap = Number.isFinite(maxBuffer) && maxBuffer > 0 ? Math.floor(maxBuffer) : DEFAULT_DIFF_MAX_BUFFER;
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
      const out = String(exec('git', ['diff', '--no-index', '--end-of-options', baseFile, headFile], { encoding: 'utf8', maxBuffer: cap, stdio: ['ignore', 'pipe', 'pipe'] }) || '');
      return overCap(out, cap) ? unscored('diff-too-large') : { text: out, scored: true };
    } catch (err) {
      // Over `maxBuffer`, Node SIGTERMs git and throws `ENOBUFS` (status `null`) carrying a TRUNCATED stdout —
      // returning that would hand a detector a diff missing its tail and call it complete. Checked FIRST,
      // before the exit-1 unwrap, because a truncated run can surface either way.
      if (err && (err.code === 'ENOBUFS' || err.errno === -55)) return unscored('diff-too-large');
      // `--no-index` exits 1 (with the diff on stdout) precisely BECAUSE the two files differ — that is the
      // expected outcome we came here for, not an error. Anything else (git missing, a real failure) falls
      // through to the fail-soft branch below.
      if (err && err.status === 1 && typeof err.stdout === 'string') {
        return overCap(err.stdout, cap) ? unscored('diff-too-large') : { text: err.stdout, scored: true };
      }
      return unscored('diff-failed');
    }
  } catch {
    return unscored('diff-failed');
  } finally {
    if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup — a leaked temp dir is not a correctness bug */ } }
  }
}

/**
 * Belt-and-braces truncation probe. `ENOBUFS` is the normal over-cap signal, but a child that exits on its own
 * as the pipe fills can instead surface as a plain non-zero exit with a short stdout, so any payload that
 * REACHES the cap is treated as truncated rather than trusted as complete. `Buffer.byteLength` because
 * `maxBuffer` counts BYTES while a JS string counts UTF-16 code units.
 */
function overCap(text, cap) {
  return typeof text === 'string' && Buffer.byteLength(text, 'utf8') >= cap;
}
