/**
 * review-skill-guard.mjs — the pure `check:standards` rule that keeps the review-verdict label swap inside its
 * SINGLE HOME (#2882).
 *
 * WHAT WENT WRONG. `we:scripts/review-set-label.mjs` is the documented single home of the review-label swap
 * (#2644): a PURE `decideSetLabel` owns every invariant, and the thin CLI around it stamps the `reviewed-sha`
 * marker (#2409) into the durable verdict comment. The `/review` skill never called it — it instructed a raw
 * `gh pr edit --add-label review:accepted`. Two things broke, and both were invisible until a human accept
 * actually reached the drain (PR #983, five re-parks):
 *   • the accept carried no `reviewed-sha` marker, so the drain read an older marker from another comment and
 *     judged the acceptance stale;
 *   • INVARIANT 2 — "a `review:human` PR is NEVER cleared to `review:accepted` by anything but a human's
 *     /review ceremony" — is enforced in `decideSetLabel`'s pure core and described as unbypassable. That holds
 *     for the CLI, but a doc that tells its reader to shell `gh` directly routes around the MODULE. Nothing
 *     else catches it: no workflow under `we:.github/workflows/` references the review labels.
 *
 * WHY A GATE AND NOT A COMMENT. The defect is script-decidable — it is literally the presence of a
 * `gh pr edit … --add-label review:*` instruction in prose — and the failure mode is silent, so a review lens
 * would have to notice an ABSENCE. Cheapest durable guard wins (the house preference: deterministic gate over
 * review lens over doc note).
 *
 * SCOPE. Only prose that INSTRUCTS the swap is an error. A doc may still mention the labels, quote the drain's
 * behaviour, or show `gh pr edit --add-label ready-to-merge` (not a review label). The rule fires on a single
 * command that both edits a PR and adds/removes a `review:` label.
 *
 * NO CARVE-OUT FOR "I AM ONLY DESCRIBING IT". The first cut of this rule exempted a match containing a `…`
 * elision, so a doc could name the pattern it forbids. That exemption was broken three ways (PR #1005 review):
 * the greedy match spans the whole command, so ANY elision anywhere exempted a fully runnable template; the
 * skip was per-LINE, so an elided mention laundered a real command later on the same line; and only the
 * Unicode `…` counted, leaving an ASCII `...` red with no documented fix. It is gone. A doc that needs to talk
 * about the forbidden shape says so in words instead — cheaper than a carve-out with three holes, and the
 * self-check test at the bottom of the suite keeps the guarded docs honest either way.
 *
 * MATCHING SPANS WRAPPED LINES. The rule reads the whole document, not line by line. A markdown doc wraps a
 * long command across lines, and the first cut was line-anchored — so it MISSED the real auto-land swap in
 * `we:skills-src/drain/SKILL.md` (where `gh pr edit … --add-label` ends one line and `review:accepted` opens
 * the next) while flagging a benign "the label must exist" note elsewhere in the same file. It reported a
 * false positive and called it the true one. The window stops at a blank line so a match cannot run across
 * paragraphs, and the reported line number is derived from the match offset.
 *
 * Pure — the caller supplies `{ file, content }` docs; the fs walk stays in `check-standards.mjs` (mirrors the
 * verdict-totality gate above it).
 */

/**
 * Docs whose review-label instructions must go through the single home. Prefix-matched, repo-relative.
 * `check-standards.mjs` DERIVES its fs walk from this list — never hardcode the roots twice (that is the same
 * two-readers-of-one-contract defect this whole item is about; a widening here must not silently no-op).
 *
 * WHY NOT ALL OF `skills-src/` YET. `we:skills-src/drain/SKILL.md` tells the auto-review convergence path to
 * apply `redteam:accepted` + `review:accepted` with a raw `gh pr edit` — the same lost marker and the same
 * unenforced INVARIANT 2, on the path that then LANDS the PR automatically. The rule below DOES match it (see
 * the wrapped-line fixture in the test suite); the file is held out of SCOPE because fixing it is not a doc
 * edit: the CLI has no `redteam:accepted` target, and routing the accept through it adds a second comment to a
 * flow that already posts its own panel table. That is a change to the auto-land path and belongs in its own
 * item (#2896) with its own review. Widen this list to `skills-src/` once that lands — narrow-and-honest,
 * not broad-and-waived.
 */
export const GUARDED_DOC_PREFIXES = Object.freeze(['skills-src/review/', 'docs/agent/']);

/** The single home every guarded doc must route the swap through. */
export const SINGLE_HOME = 'scripts/review-set-label.mjs';

/**
 * A `gh pr edit` invocation carrying an `--add-label`/`--remove-label` of a `review:*` label. Spans newlines
 * (markdown wraps commands) but never a backtick fence or a blank line, so a match stays inside one command in
 * one paragraph. Bounded at 400 chars so a runaway match can't pair an unrelated `gh pr edit` with a `review:`
 * mention far below it. Global — every occurrence is reported, not just the first.
 */
const RAW_SWAP_RE = /gh\s+pr\s+edit\b(?:(?!\n[ \t]*\n)[^`]){0,400}?--(?:add|remove)-label[=\s]+["']?review:/g;

/** Is this doc in scope for the rule? Pure. */
export function isGuardedDoc(file) {
  const f = String(file || '');
  return GUARDED_DOC_PREFIXES.some((p) => f.startsWith(p)) && f.endsWith('.md');
}

/** 1-indexed line of a character offset in `content`. Pure. */
function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === '\n') line++;
  return line;
}

/**
 * Find every line in `docs` that instructs a raw review-label swap. Pure — returns error strings, never throws.
 * A doc that also names the single home is STILL an error on the raw line: the point is that the raw path must
 * not be offered at all, not that it be offered alongside the right one (offering both is how #1001's
 * hand-stamping fix entrenched the wrong path).
 * @param {Array<{file:string, content:string}>} docs
 * @returns {{errors:string[]}}
 */
export function checkReviewLabelSingleHome(docs = []) {
  const errors = [];
  for (const d of Array.isArray(docs) ? docs : []) {
    const file = d && typeof d.file === 'string' ? d.file : '';
    const content = d && typeof d.content === 'string' ? d.content : '';
    if (!isGuardedDoc(file) || !content) continue;
    for (const m of content.matchAll(RAW_SWAP_RE)) {
      errors.push(
        `${file}:${lineOf(content, m.index)}: instructs a raw review-label swap with \`gh pr edit\` — route it through the single home \`we:${SINGLE_HOME}\` `
        + `(\`<pr> --repo=<owner/name> --to=accepted|changes [--actor=<name>] [--body-file=<path>]\`). The raw path skips the `
        + `\`reviewed-sha\` stamp the drain's staleness gate reads (#2409) and bypasses INVARIANT 2, which only binds callers that come through `
        + `\`decideSetLabel\` (#2644/#2882).`,
      );
    }
  }
  return { errors };
}
