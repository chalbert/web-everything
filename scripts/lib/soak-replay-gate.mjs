/**
 * @file soak-replay-gate.mjs — mechanical enforcement of "every PR that fixes a live daemon break adds a soak
 * break scenario, or waives it" (operator-approved: today only 2 of ~12 daemon fixes added one — #4075's own
 * standing rule, `we:skills-src/conveyor/SKILL.md#daemon-soak-harness` / `we:skills-src/conveyor/fix-agent-brief.md`,
 * was prose-only and evidently not reliably followed by hand).
 *
 * THE RULE, made script-decidable rather than left in prose (#51 hookable-vs-judgment: a script-decidable rule
 * belongs in a gate):
 *
 *   IF   this PR touches daemon-soak scope (`daemon-soak-scope.mjs`'s exact path regex — the same one CI's
 *        `daemon-soak` job already uses to decide whether to run the soak at all)
 *   AND  this PR reads as a bug fix (see `isLikelyDaemonBugFix` below for the exact signal and its rationale)
 *   THEN it must add or change at least one file under `scripts/conveyor/soak/breaks/` (a new/updated break
 *        scenario, registered in that directory's `index.mjs` the way existing ones are — see that file's own
 *        header), UNLESS its PR body carries a `soak-waiver: <non-empty reason>` line.
 *
 * "IS A BUG FIX" HAS NO CLEAN STRUCTURED SIGNAL IN THIS REPO TODAY (surveyed live against PRs #2740-#2771,
 * 2026-09-26): backlog cards have no `bug` kind (`BACKLOG_KINDS` is story/epic/task/decision/feature/
 * investigation) and card `tags:` rarely if ever say "bug" (2296 of ~4220 cards ship `tags: []`); PR titles are
 * NOT reliably conventional-commit (`daemon-overlay.mjs: register-only add/remove…` #2765 and `daemon-rebuild:
 * never throw away a passing candidate…` #2768 — the two cited examples that DID add a break scenario — carry
 * no `fix` in their title at all); and the bare word "fix" appears in nearly every daemon PR body regardless of
 * whether it fixes anything (daemon vocabulary: "fix session", "fix-dispatch", "fix agent" name a ROLE, not a
 * verdict). So `isLikelyDaemonBugFix` ORs three independent, deliberately-scoped signals instead of trusting
 * any one:
 *   1. a conventional-commit-shaped `fix` token in the TITLE (`fix(...)`, `fix:`, `fix-...`, "fix red main");
 *   2. an explicit "Fix" / "Root cause" / "What broke" / "Problem" / "Incident" section HEADER in the body —
 *      this repo's live-incident PRs consistently write these up as their own heading (verified against
 *      #2743/#2757/#2758/#2759/#2763/#2764/#2765/#2768/#2771 — every one of the sampled fixes carries at least
 *      one), and — unlike the bare word "fix" — a heading is a deliberate authoring choice, not incidental
 *      vocabulary, so it does not over-fire on feature PRs (checked against #2744-#2756, #2766, #2767, #2769,
 *      #2770 — none carry one);
 *   3. the word bug/broke/broken/regression/incident anywhere in the body (catches the residual case that
 *      matches neither — #2762 "review-daemon: print why each held PR got no review…" has no `fix`-shaped title
 *      and no matching header, but its body says "…made that look like a discovery **bug**").
 * This is a RECALL-FAVORING heuristic, not a precise one, by design: a false POSITIVE (a feature PR
 * misclassified as a fix) costs the author one `soak-waiver: not a bug fix` line; a false NEGATIVE (a real
 * daemon fix that slips past undetected) is exactly the failure this gate exists to close. When in doubt, this
 * gate leans toward asking for the waiver.
 *
 * Consumers: `scripts/soak-replay-gate-cli.mjs` (the CI-wired executable) and its own unit tests
 * (`scripts/lib/__tests__/soak-replay-gate.test.mjs`), which include frozen real-PR fixtures proving this
 * module's verdict against #2762/#2763/#2765/#2768/#2771.
 */
import { touchesDaemonSoakScope } from './daemon-soak-scope.mjs';

export const SOAK_BREAKS_DIR_PREFIX = 'scripts/conveyor/soak/breaks/';

const FIX_TITLE_RE = /\bfix(e[sd])?\b/i;
const FIX_HEADER_RE = /^#{1,6}\s*(fix|root cause|what broke|problem|incident)\b/im;
const FIX_WORD_RE = /\b(bug|broke|broken|regression|incident)\b/i;

// `soak-waiver: <reason>` — anywhere in the PR body, one per line, reason required non-empty (after trim).
// Same-line whitespace only ([ \t], never \s) around the captured reason: \s also matches the newline that
// ends the line, and a greedy `\s*` right before the capture group would swallow it and let the (lazy) group
// spill onto the NEXT line looking for trailing whitespace to stop at — silently "waiving" off body text that
// was never meant as the reason.
//
// Tolerant of common markdown decoration around the KEY (case-insensitive already, via the `i` flag), since
// real PR bodies write this as a markdown list item with the key bolded rather than as bare text — verified
// against #2783's actual body (`- **Soak-waiver**: change is confined to a pure decision function …`), which
// the earlier bare `soak-waiver:` form did not match at all:
//   - an optional leading list-bullet marker (`-`, `*`, `+`, or `1.`/`1)`) before the key;
//   - optional `*`/`_` emphasis markers (bold/italic, `*`/`**`/`_`/`__`) directly around the key; and
//   - the `:` allowed either inside or outside the closing emphasis (`**Soak-waiver**:` and `**Soak-waiver:**`
//     both read as the same key:reason pair to a human, so both must parse the same way here).
// A bare `soak-waiver: <reason>` line (no decoration at all) still matches unchanged — decoration is optional,
// never required.
const WAIVER_RE = /^[ \t]*(?:[-*+]|\d+[.)])?[ \t]*[*_]{0,3}soak-waiver[*_]{0,3}[ \t]*:[ \t]*[*_]{0,3}[ \t]*(.*?)[ \t]*\r?$/im;

/**
 * Heuristic "does this PR read as a bug fix" signal — see this module's header comment for the full
 * rationale and the live PRs each branch was checked against. Pure, no I/O.
 * @param {{title?: string, body?: string}} pr
 * @returns {boolean}
 */
export function isLikelyDaemonBugFix({ title = '', body = '' } = {}) {
  const t = String(title || '');
  const b = String(body || '');
  return FIX_TITLE_RE.test(t) || FIX_HEADER_RE.test(b) || FIX_WORD_RE.test(b);
}

/**
 * Normalizes a PR's file list (either plain path strings, or `{path, changeType}` objects as GitHub's API /
 * `gh pr view --json files` shape them) to a flat array of repo-relative path strings.
 * @param {Array<string|{path?: string}>} files
 * @returns {string[]}
 */
export function filePaths(files) {
  return (Array.isArray(files) ? files : [])
    .map((f) => (typeof f === 'string' ? f : f && f.path))
    .filter((p) => typeof p === 'string' && p.length > 0);
}

/**
 * True if `files` contains an ADDED/MODIFIED/RENAMED (never a bare DELETE) entry under
 * `scripts/conveyor/soak/breaks/` — a new or changed break scenario. When callers pass plain path strings
 * (no changeType — e.g. a bare `git diff --name-only` list), presence under the prefix is treated as
 * sufficient, since a path-only diff already implies SOME change.
 * @param {Array<string|{path?: string, changeType?: string}>} files
 * @returns {boolean}
 */
export function addsOrChangesSoakBreak(files) {
  return (Array.isArray(files) ? files : []).some((f) => {
    const path = typeof f === 'string' ? f : f && f.path;
    if (typeof path !== 'string' || !path.startsWith(SOAK_BREAKS_DIR_PREFIX)) return false;
    const changeType = typeof f === 'string' ? undefined : f && f.changeType;
    if (changeType == null) return true;
    return !/^DELETED$/i.test(String(changeType));
  });
}

/**
 * Extracts a non-empty `soak-waiver: <reason>` line from a PR body, or null if absent/empty.
 * @param {string} body
 * @returns {string|null}
 */
export function extractSoakWaiver(body) {
  const m = WAIVER_RE.exec(String(body || ''));
  if (!m) return null;
  const reason = m[1].trim();
  return reason.length > 0 ? reason : null;
}

/**
 * The gate's full verdict for one PR. Pure — no I/O, no `gh` calls; callers (the CLI) fetch `title`/`body`/
 * `files` and pass them in.
 * @param {{title?: string, body?: string, files?: Array<string|{path?:string, changeType?:string}>}} pr
 * @returns {{applicable: boolean, ok: boolean, reason: string, waiver?: string}}
 */
export function evaluateSoakReplayGate({ title = '', body = '', files = [] } = {}) {
  const paths = filePaths(files);
  if (!touchesDaemonSoakScope(paths)) {
    return { applicable: false, ok: true, reason: 'no daemon-soak-scope file touched — rule does not apply' };
  }
  if (!isLikelyDaemonBugFix({ title, body })) {
    return {
      applicable: false,
      ok: true,
      reason: 'touches daemon-soak scope, but no fix-shaped title/body signal detected — treated as not a bug fix',
    };
  }
  if (addsOrChangesSoakBreak(files)) {
    return { applicable: true, ok: true, reason: `adds/changes a file under ${SOAK_BREAKS_DIR_PREFIX}` };
  }
  const waiver = extractSoakWaiver(body);
  if (waiver) {
    return { applicable: true, ok: true, reason: `waived: ${waiver}`, waiver };
  }
  return {
    applicable: true,
    ok: false,
    reason:
      `this PR touches daemon-soak scope and reads as a bug fix, but adds/changes no file under ` +
      `${SOAK_BREAKS_DIR_PREFIX} and carries no \`soak-waiver: <reason>\` line in its body — add a break ` +
      `scenario (one module + its .soak.test.mjs, registered in breaks/index.mjs, e.g. daemon-overlay-lock-wait, ` +
      `rebuild-finalize-starved) or add \`soak-waiver: <why this doesn't need one>\` to the PR body`,
  };
}
