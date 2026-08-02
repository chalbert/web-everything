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
 * THE ELLIPSIS CARVE-OUT. A doc that EXPLAINS this rule has to name the pattern it forbids — the guarded skill
 * itself does, in its "why not `gh pr edit` directly" paragraph. Writing the pattern with a `…` elision
 * (`gh pr edit … --add-label review:*`) marks it as a description rather than a command: `…` is not valid
 * shell, so no runnable instruction contains one. Found the honest way — the first run of this gate flagged the
 * very paragraph documenting it.
 *
 * Pure — the caller supplies `{ file, content }` docs; the fs walk stays in `check-standards.mjs` (mirrors the
 * verdict-totality gate above it).
 */

/**
 * Docs whose review-label instructions must go through the single home. Prefix-matched, repo-relative.
 *
 * WHY NOT ALL OF `skills-src/` YET. It should be, and the first repo-wide run of this gate proved the point by
 * flagging a REAL second instance: `we:skills-src/drain/SKILL.md` tells the auto-review convergence path to
 * apply `redteam:accepted` + `review:accepted` with a raw `gh pr edit` — the same lost marker and the same
 * unenforced INVARIANT 2, on the path that then LANDS the PR automatically. Fixing it is not a doc edit: the
 * CLI has no `redteam:accepted` target, and routing the accept through it adds a second comment to a flow that
 * already posts its own panel table. That is a change to the auto-land path and belongs in its own item with
 * its own review, not smuggled into this one. Widen this list to `skills-src/` once that lands — the guarded
 * set is deliberately narrow-and-honest rather than broad-and-waived.
 */
export const GUARDED_DOC_PREFIXES = Object.freeze(['skills-src/review/', 'docs/agent/']);

/** The single home every guarded doc must route the swap through. */
export const SINGLE_HOME = 'scripts/review-set-label.mjs';

/** A `gh pr edit …` invocation carrying an `--add-label`/`--remove-label` of a `review:*` label, on one line. */
const RAW_SWAP_RE = /gh\s+pr\s+edit\b[^\n`]*--(?:add|remove)-label[=\s]+["']?review:/;

/** An elided pattern (`gh pr edit … --add-label review:*`) is a DESCRIPTION of the forbidden shape, not an
 *  instruction — `…` is not valid shell. See the carve-out note in this file's header. */
const ELIDED = '…';

/** Is this doc in scope for the rule? Pure. */
export function isGuardedDoc(file) {
  const f = String(file || '');
  return GUARDED_DOC_PREFIXES.some((p) => f.startsWith(p)) && f.endsWith('.md');
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
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = RAW_SWAP_RE.exec(lines[i]);
      if (!m) continue;
      if (m[0].includes(ELIDED)) continue; // a described pattern, not a runnable instruction
      errors.push(
        `${file}:${i + 1}: instructs a raw \`gh pr edit … --add-label review:*\` swap — route it through the single home \`we:${SINGLE_HOME}\` `
        + `(\`<pr> --repo=<owner/name> --to=accepted|changes [--actor=<name>] [--body-file=<path>]\`). The raw path skips the `
        + `\`reviewed-sha\` stamp the drain's staleness gate reads (#2409) and bypasses INVARIANT 2, which only binds callers that come through `
        + `\`decideSetLabel\` (#2644/#2882).`,
      );
    }
  }
  return { errors };
}
