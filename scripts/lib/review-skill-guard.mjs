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
        + `(\`<pr> --repo=<owner/name> --to=accepted|changes|clear-human [--actor=<name>] [--body-file=<path>]\`; \`clear-human\` `
        + `is the #2895 gate-self clearance and additionally requires \`--actor\` and \`--reason=<stated reason>\`). The raw path skips the `
        + `\`reviewed-sha\` stamp the drain's staleness gate reads (#2409) and bypasses INVARIANT 2, which only binds callers that come through `
        + `\`decideSetLabel\` (#2644/#2882).`,
      );
    }
  }
  return { errors };
}

/**
 * SINGLE_HOME_CODE_FILES — the only files ALLOWED to perform the review-label write mutation: the single-home
 * CLI (#2644) and the provider port it shells (#x8xf5rl). `checkReviewLabelSingleHome` above stops a MARKDOWN
 * doc from INSTRUCTING the raw swap (#2882); it never looked at `.mjs` source, so nothing stopped a SCRIPT from
 * minting the same raw path in code — the residual #2416 gap: "a `review:human` gate-self PR is never
 * agent-cleared" is enforced in `decideSetLabel`'s pure core, but only for callers that actually reach it. A
 * second script that calls `gh pr edit --add-label review:accepted` directly, or drives the provider's
 * `setLabels` with an `add: review:accepted` of its own, never reaches `decideSetLabel` at all and so never
 * pays INVARIANT 2 or the #2409 `reviewed-sha` stamp.
 */
export const SINGLE_HOME_CODE_FILES = Object.freeze([
  'scripts/review-set-label.mjs',
  'scripts/lib/review-label-provider.mjs',
]);

/**
 * A `gh`-shelling call (`execFileSync`/`spawnSync`/`spawn`/`execSync`/`exec`) carrying the accept flag and the
 * accepted label together, OR a `setLabels(...)` write whose `add` resolves to the accepted label — either shape
 * re-implements the single home's write instead of calling it. Co-occurrence-based on purpose, like `RAW_SWAP_RE`
 * above: it does not care whether the gh args are array-form or ONE command string built with a template
 * literal or plain concatenation, whether the flag and the label are space-joined or `=`-joined, whether the
 * label is wrapped in an array, or whether it names the shared constant or the bare label string — a round-1
 * panel review of this rule (five findings, #2416) traced all four of those past the first cut, which only
 * matched the one call SHAPE visible in the single home's own existing caller. Bounded + newline-tolerant like
 * `RAW_SWAP_RE`, so a multi-line literal still matches; stops at a `)` so it cannot pair an unrelated call with
 * a mention of the label far below it.
 *
 * (This docblock deliberately never TYPES a live example of the shape it forbids — the rule would flag its own
 * source file otherwise, the same self-reference `RAW_SWAP_RE`'s doc-guard sibling has to avoid. See this
 * file's own test suite for the fixture shapes it actually asserts against.)
 *
 * WHAT THIS STILL CANNOT CATCH, on purpose, same posture as `RAW_SWAP_RE`'s own bounds above and #2895's
 * documented actor-provenance residual: a script that assigns the `gh` args array, the label string, or the
 * `setLabels` options object to a variable BEFORE the call defeats textual co-occurrence — no bounded regex can
 * trace data flow, and reaching for one here would be the "carve-out with holes" `RAW_SWAP_RE`'s own header
 * already rejected once. This rule's job is to catch the ORDINARY re-implementation an engineer (or agent) who
 * doesn't know the single home exists would naturally write — exactly how the #2882 doc instance shipped — not
 * to defeat someone deliberately obfuscating a call to route around a lint they know is watching.
 */
const ACCEPTED_TOKEN = String.raw`\[?['"\`]?(?:review:accepted|REVIEW_LABELS\.accepted)`;
const CODE_SWAP_RE = new RegExp(
  String.raw`\b(?:execFileSync|spawnSync|spawn|execSync|exec)\s*\(\s*['"\`]?gh['"\`]?[^)]{0,400}?--add-label['"\`]?[=\s,]+${ACCEPTED_TOKEN}`
  + '|'
  + String.raw`\.setLabels\s*\([^)]{0,400}?\badd\s*:\s*${ACCEPTED_TOKEN}`,
  'g',
);

/**
 * Find every SCRIPT (not doc) file that mints its own `review:accepted` write outside the single home. Pure —
 * the caller supplies `{file, content}` for every non-test `.mjs` under `scripts/`; the fs walk stays in
 * `check-standards.mjs` (mirrors `checkReviewLabelSingleHome`'s split).
 * @param {Array<{file:string, content:string}>} files
 * @returns {{errors:string[]}}
 */
export function checkReviewLabelSingleHomeCode(files = []) {
  const errors = [];
  for (const f of Array.isArray(files) ? files : []) {
    const file = f && typeof f.file === 'string' ? f.file : '';
    const content = f && typeof f.content === 'string' ? f.content : '';
    if (!file || !content || SINGLE_HOME_CODE_FILES.includes(file)) continue;
    for (const m of content.matchAll(CODE_SWAP_RE)) {
      errors.push(
        `${file}:${lineOf(content, m.index)}: mints its own \`review:accepted\` write outside the single home — `
        + `route it through \`we:${SINGLE_HOME}\` (or the provider it shells, \`we:scripts/lib/review-label-provider.mjs\`) `
        + `instead of calling \`gh pr edit --add-label\` / \`setLabels\` directly. A script that mints this mutation `
        + `bypasses INVARIANT 2 and the \`reviewed-sha\` stamp exactly like the raw doc instruction \`checkReviewLabelSingleHome\` `
        + `above forbids (#2416) — this is that same guarantee, for code instead of prose.`,
      );
    }
  }
  return { errors };
}
