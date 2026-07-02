#!/usr/bin/env node
/**
 * lane-review.mjs — the pre-PR independent-review seam (#2170, first layer of the lane review design).
 *
 * WHY (#2170 / follow-on to the #2153 PR substrate): before a lane opens its self-approved PR
 * (`scripts/pr-land.mjs`), the lane session spawns an **independent subagent review over its diff** — the
 * /code-review model, given the diff and nothing else (no author framing). Findings are fixed **in the
 * lane, pre-PR**, while the author context is loaded (the cheapest place to act). Findings the lane
 * **dismisses** are **recorded in the PR body** (never silently dropped) — both an audit trail and a
 * first-class input to the drain's escalation rubric (#2171). This applies to BOTH parallel `/workflow`
 * lanes and solo `#2123` lanes, wired at the SAME seam where the lane calls pr-land.
 *
 * This module owns the two mechanical halves of that seam so the seam is identical everywhere:
 *   1. `diff`  — produce the exact review diff (base…HEAD) the session hands its review subagent.
 *   2. `body`  — render the dismissed findings into the PR body block pr-land publishes (`--body-file`).
 * The JUDGEMENT half — spawning the reviewer, deciding accept-vs-dismiss, fixing accepted findings — is the
 * SESSION's action (an agent can't run itself); this script never calls a model. It only makes the diff
 * reproducible and the dismissal record canonical, so "record dismissals in the PR body" is a fixed format
 * rather than freehand prose that the #2171 rubric would have to parse loosely.
 *
 * The pure helpers (`diffRange`, `renderDismissalsBlock`, `composeBody`, `parseDismissals`) are unit-tested
 * in scripts/__tests__/lane-review.test.mjs; the CLI owns git + fs at its boundary (mirrors pr-land.mjs).
 *
 * Usage:
 *   node scripts/lane-review.mjs diff --base=origin/main                 # print the review diff (base…HEAD) to stdout
 *   node scripts/lane-review.mjs diff --base=origin/lane/_base-<slug>    # a /workflow lane reviews vs its central base
 *   node scripts/lane-review.mjs diff --base=main --stat                 # just the --stat summary (scope glance)
 *   node scripts/lane-review.mjs body --dismissals=d.json                # render ONLY the dismissed-findings block
 *   node scripts/lane-review.mjs body --dismissals=d.json --base-body=b.md   # base body + the block (→ pr-land --body-file)
 *   node scripts/lane-review.mjs body --dismissals=d.json --out=/tmp/pr-body.md  # write the composed body to a file
 *
 * A dismissals file is a JSON array of `{ finding, reason, severity?, location? }` — the findings the lane
 * reviewed and chose NOT to fix, each with the one-line WHY. An empty array (no dismissals) renders nothing,
 * so a clean review leaves the PR body untouched.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// ── flag parsing (mirrors pr-land.mjs / push-if-green.mjs) ─────────────────────────────────────────────
const argv = process.argv.slice(2);
const sub = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const flags = {};
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const expandHome = (p) => (p && p.startsWith('~') ? p.replace(/^~/, homedir()) : p);

// ── PURE helpers (unit-tested in scripts/__tests__/lane-review.test.mjs) ───────────────────────────────

/**
 * The git diff range for a lane review: three-dot `base...HEAD` — the changes on HEAD since it diverged
 * from `base` (the merge-base), which is exactly what a PR review sees, independent of intervening commits
 * on `base`. Pure — returns the range string. Defaults to `origin/main` (the solo-lane base).
 */
export function diffRange(base) {
  const b = base && String(base).trim() ? String(base).trim() : 'origin/main';
  return `${b}...HEAD`;
}

/** Build the `git diff` argv for the review diff. `stat` → the `--stat` summary only. Pure. */
export function diffArgs({ base, stat = false } = {}) {
  const args = ['diff', diffRange(base)];
  if (stat) args.push('--stat');
  return args;
}

/**
 * Render dismissed review findings into the canonical PR-body block. Pure. Returns '' for an empty/absent
 * list (a clean review adds nothing to the body). The block is stable/parseable (#2171 consumes it):
 * a fixed H2 heading + one bullet per finding, `severity` and `location` inlined when present.
 */
export function renderDismissalsBlock(dismissals) {
  const list = Array.isArray(dismissals) ? dismissals.filter((d) => d && (d.finding || d.reason)) : [];
  if (list.length === 0) return '';
  const lines = [
    '## Dismissed review findings',
    '',
    '_Independent pre-PR review (#2170) surfaced these; the lane reviewed and chose not to fix them, with the reason. Recorded here as the audit trail + an input to the drain escalation rubric (#2171)._',
    '',
  ];
  for (const d of list) {
    const sev = d.severity ? `**[${String(d.severity)}]** ` : '';
    const loc = d.location ? ` _(${String(d.location)})_` : '';
    const finding = String(d.finding ?? '(unspecified finding)').trim();
    const reason = String(d.reason ?? '(no reason given)').trim();
    lines.push(`- ${sev}${finding}${loc} — **dismissed:** ${reason}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Compose the full PR body: an optional base body followed by the dismissals block. Pure. When there are
 * no dismissals the base body passes through unchanged; when there's no base body the block stands alone.
 */
export function composeBody({ baseBody = '', dismissals = [] } = {}) {
  const block = renderDismissalsBlock(dismissals);
  if (!block) return baseBody ?? '';               // no dismissals → base body passes through UNTOUCHED
  const base = (baseBody ?? '').replace(/\s+$/, ''); // trim only when appending, so the separator is exact
  if (!base) return block;
  return `${base}\n\n${block}`;
}

/**
 * Tolerant parse of a dismissals file's text → an array of `{ finding, reason, severity?, location? }`.
 * NEVER throws: bad JSON or a non-array degrades to `[]` (a broken record must not block a landing — worst
 * case the PR body just carries no dismissals block). Accepts either a bare array or `{ dismissed: [...] }`.
 */
export function parseDismissals(text) {
  if (!text || !text.trim()) return [];
  let raw;
  try { raw = JSON.parse(text); } catch { return []; }
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.dismissed) ? raw.dismissed : [];
  return arr
    .filter((d) => d && (d.finding || d.reason))
    .map((d) => ({
      finding: d.finding ? String(d.finding) : '',
      reason: d.reason ? String(d.reason) : '',
      ...(d.severity ? { severity: String(d.severity) } : {}),
      ...(d.location ? { location: String(d.location) } : {}),
    }));
}

// Allow importing the pure helpers without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const REPO = resolve(expandHome(flags.repo) || process.cwd());
  const gitC = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (sub === 'diff') {
    let out;
    try { out = gitC(diffArgs({ base: flags.base, stat: !!flags.stat })); }
    catch (e) { process.stderr.write(`lane-review diff failed: ${String(e.message || e).split('\n')[0]}\n`); process.exit(3); }
    process.stdout.write(out);
    process.exit(0);
  }

  if (sub === 'body') {
    const dismissals = typeof flags.dismissals === 'string'
      ? parseDismissals(safeRead(flags.dismissals))
      : [];
    const baseBody = typeof flags['base-body'] === 'string' ? safeRead(flags['base-body']) : ''; // safeRead expands ~
    const body = composeBody({ baseBody, dismissals });
    if (typeof flags.out === 'string') {
      writeFileSync(expandHome(flags.out), body.endsWith('\n') ? body : body + '\n');
      process.stderr.write(`lane-review: wrote PR body (${dismissals.length} dismissal(s)) → ${flags.out}\n`);
    } else {
      process.stdout.write(body.endsWith('\n') ? body : body + '\n');
    }
    process.exit(0);
  }

  process.stderr.write('lane-review: expected a subcommand — `diff` (print base…HEAD review diff) or `body` (render dismissals → PR body).\n');
  process.exit(3);

  function safeRead(p) {
    try { return readFileSync(expandHome(p), 'utf8'); } catch { return ''; }
  }
}
