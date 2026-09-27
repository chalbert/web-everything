/**
 * @file soak-gate-merge-base-diff.mjs — computes the soak-replay gate's changed-file list from the PR's
 * MERGE-BASE to its head, never a plain two-endpoint `base..head` diff (backlog/4264, cross-ref backlog/4292).
 *
 * THE BUG THIS CLOSES: `.github/workflows/soak-replay-gate.yml` used to run
 * `git diff --name-status -M "$BASE_SHA" "$HEAD_SHA"` — a plain two-TREE diff. In the ordinary PR shape,
 * `HEAD_SHA` descends from an earlier commit on `main` (the fork point), while `BASE_SHA` is `main`'s tip as
 * of the workflow's last trigger (`opened`/`synchronize`/`reopened`/`edited`) — which is often LATER than the
 * fork point, because `main` keeps moving while a PR sits open. Any file `main` changed between the fork
 * point and `BASE_SHA` that the PR itself never touched still shows up in that two-tree diff: the PR's head
 * tree still carries the OLD content, so it reads as "changed" relative to `BASE_SHA`'s NEW content —
 * misattributing `main`'s own since-diverged edits to the PR.
 *
 * LIVE MISFIRE: PR #2822 (backlog-only, four new `we:backlog/*.md` cards, no daemon code touched) went red on
 * this required check because `main` had concurrently landed daemon-soak-scope changes under
 * `scripts/conveyor/` while the PR sat open — replayed and reproduced in
 * `scripts/__tests__/soak-replay-gate-cli.test.mjs` (the real base/head shas from that PR's own failed run).
 *
 * THE FIX: diff from `git merge-base BASE_SHA HEAD_SHA` (the true fork point) to `HEAD_SHA` instead. That
 * basis only shows files the PR's OWN commits touched. `we:scripts/merge-ai-prs.mjs`'s
 * `computeNetDiffChangedFiles` established this exact merge-base-vs-base-tip distinction for the drain's own
 * blast-radius scoring (#2404) — this module is the soak-replay-gate's own narrow copy of that ONE idea, not
 * a reuse of that heavier machinery (which resolves tracking refs/remotes this workflow's checkout does not
 * have, and returns a much larger payload than a bare name-status list).
 *
 * FALLBACK: if the merge-base cannot be resolved at all (history not fetched deep enough, or a genuinely
 * unrelated head), this degrades to the PRIOR base-tip diff — the same safe over-scoring direction
 * `computeNetDiffChangedFiles` falls back to. A false POSITIVE here costs a PR one `soak-waiver:` line;
 * silently reporting NO files touched on an unresolved merge-base would be the unsafe direction (a real
 * daemon fix could then slip past with no break scenario AND no waiver).
 *
 * `exec` is injected — `(cmd, args, opts) => string`, matching `computeNetDiffChangedFiles`'s own convention —
 * so this stays unit-testable against REAL throwaway git fixtures without touching this repo's own git state.
 * See `scripts/lib/__tests__/soak-gate-merge-base-diff.test.mjs`.
 */
import { execFileSync } from 'node:child_process';

const SHA_RE = /^[0-9a-f]{7,64}$/i;

/** True for a full or abbreviated (7+ hex chars) git sha — the same shape `computeNetDiffChangedFiles` checks. */
export function isShaLike(value) {
  return typeof value === 'string' && SHA_RE.test(value);
}

/** The real `execFileSync`, wrapped to the `(cmd, args, opts) => string` shape this module calls. Never called
 * directly by anything else in this module — always through the injected `exec` param, so a caller (tests,
 * CI) can substitute its own. */
export function defaultExec(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
}

/**
 * Resolves the diff basis: `git merge-base baseSha headSha` when it exists, else `baseSha` itself
 * (`basisKind: 'base-tip'`) — the prior behaviour, kept as the safe fallback. Never throws: an unresolvable
 * merge-base (or a non-sha-shaped input) degrades to base-tip rather than failing the caller.
 * @param {{exec: Function, baseSha: string, headSha: string}} opts
 * @returns {{diffBase: string, basisKind: 'merge-base'|'base-tip'}}
 */
export function resolveMergeBaseDiffBasis({ exec, baseSha, headSha } = {}) {
  if (typeof exec !== 'function') throw new TypeError('resolveMergeBaseDiffBasis: `exec` must be a function');
  if (!isShaLike(baseSha) || !isShaLike(headSha)) return { diffBase: baseSha, basisKind: 'base-tip' };
  try {
    // `--end-of-options` guards against a sha-shaped-but-malicious value being read as a git option — the same
    // hardening `computeNetDiffChangedFiles` applies to every caller-supplied ref position.
    const out = exec('git', ['merge-base', '--end-of-options', baseSha, headSha], { stdio: ['ignore', 'pipe', 'ignore'] });
    // A criss-cross-merge history can print MULTIPLE candidate best-common-ancestors, one per line (#2404 hit
    // this same shape in `computeNetDiffChangedFiles`) — take only the first; the rest are never a valid
    // single `git diff` revision argument.
    const mb = String(out || '').split('\n')[0].trim();
    if (mb) return { diffBase: mb, basisKind: 'merge-base' };
  } catch {
    /* no common history — fall through to base-tip below */
  }
  return { diffBase: baseSha, basisKind: 'base-tip' };
}

/**
 * The soak-replay gate's changed-file list, as `git diff --name-status -M` TEXT (the exact shape
 * `scripts/soak-replay-gate-cli.mjs`'s `parseNameStatus` already parses) — computed from the resolved diff
 * basis to `headSha`, not from `baseSha` directly.
 * @param {{exec: Function, baseSha: string, headSha: string}} opts
 * @returns {{nameStatus: string, diffBase: string, basisKind: 'merge-base'|'base-tip'}}
 */
export function computeSoakGateNameStatus({ exec, baseSha, headSha } = {}) {
  const basis = resolveMergeBaseDiffBasis({ exec, baseSha, headSha });
  const nameStatus = String(exec('git', ['diff', '--name-status', '-M', '--end-of-options', basis.diffBase, headSha], { stdio: ['ignore', 'pipe', 'pipe'] }) || '');
  return { nameStatus, diffBase: basis.diffBase, basisKind: basis.basisKind };
}
