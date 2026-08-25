#!/usr/bin/env node
/**
 * @file scripts/produce-pr-view.mjs
 * @description Produce ONE PR view from a staged request, on a host that can actually authenticate to GitHub
 *   (#xaoja7a). The READ half of the transport `we:scripts/apply-review-request.mjs` is the write half of.
 *
 * WHY THIS EXISTS. `we:scripts/operations/stage-pr-view.mjs` used to take the PR's body, comments and file list
 * from a file the REVIEWING session wrote, because this host has no mechanical read path — `gh api` answers
 * `403 GitHub access is not enabled` and GraphQL serves only the pinned review-operation set. So the session
 * transcribed the PR into the evidence its own juror would read, and nothing checked the transcription. On
 * PR #1542 the staged view carried a paraphrase of the body in the session's voice AND a comment the session
 * had written itself, stamped `authorAssociation: OWNER`, that is not on the PR at all. A juror weights an
 * owner's word above a drive-by by design; synthesizing one inverts that deliberately-asymmetric signal.
 *
 * The session's one outbound channel is `git push`. So it pushes a REQUEST — `{repo, pr}` — and this script,
 * running in a workflow that holds a token, does the fetching. The session never authors the material.
 *
 * IT ADDS NOTHING TO WHAT `gh` RETURNS. The output is the `--json` response verbatim, under the reader's own
 * file name. No summary, no normalisation, no field this file invented: anything added here would be a second
 * author of the evidence, which is the defect being closed rather than a nicety being skipped.
 *
 * Usage:
 *   node scripts/produce-pr-view.mjs <request.json> --out=<dir>   # write <dir>/<prViewFileName(repo,pr)>
 *   node scripts/produce-pr-view.mjs <request.json> --check       # validate only, fetch nothing
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PR_STATE_FIELDS } from './lib/review-label-provider.mjs';
import { transportViewFields, validateViewRequest } from './lib/pr-view-transport.mjs';
import { PR_VIEW_FIELDS, prViewFileName } from './operations/review-pr-io.mjs';
import { writeLineSync } from './lib/write-all-sync.mjs';

/**
 * The fields ONE `gh pr view` is asked for: the UNION of the reader's own list and the label arc's, computed
 * from both homes rather than typed here. `transportViewFields` states why at length — the short version is
 * that `PR_VIEW_FIELDS` is what the review CONSUMES and `PR_STATE_FIELDS` carries `headRefOid`, the field that
 * lets a staged view be caught as stale instead of silently describing a tree that has moved.
 */
export const TRANSPORT_VIEW_FIELDS = transportViewFields(PR_VIEW_FIELDS, PR_STATE_FIELDS);

/**
 * The `gh` argv. PURE, and exported so a test can assert the exact command with no `gh` on PATH — the same
 * discipline `we:scripts/lib/review-label-provider.mjs` and `we:scripts/collect-review-requests.mjs` apply to
 * theirs. It matters more here than usual: this command runs inside a job holding `contents: write`, and the
 * only defence against it being pointed somewhere else is that every argument is derived from a validated
 * request and a frozen field list.
 */
export function viewArgv({ repo, pr }) {
  return ['pr', 'view', String(pr), '--repo', repo, '--json', TRANSPORT_VIEW_FIELDS.join(',')];
}

/**
 * Fetch one PR view and check it is the PR that was asked for.
 *
 * THE SUBJECT IS VERIFIED EVEN THOUGH `gh` COULD ONLY RETURN WHAT IT WAS ASKED FOR, because the value that
 * lands on the branch is trusted downstream by a reader that has no other way to tell. `readPr`
 * (`we:scripts/operations/review-pr-io.mjs`) refuses a view whose `number` is not the PR under review for
 * exactly this reason, after a mispasted view reviewed a different PR with the diff still correctly taken from
 * local git, so nothing could notice (#1466). Checking here means the bad view never reaches the branch at all.
 *
 * @param {{request: object, exec?: Function}} o
 * @returns {{view: object, fileName: string}}
 */
export function producePrView({ request, exec = defaultGh } = {}) {
  const checked = validateViewRequest(request);
  if (!checked.ok) throw new Error(checked.error);
  const { repo, pr } = checked.request;

  let view;
  const raw = exec(viewArgv({ repo, pr }));
  try {
    view = JSON.parse(raw);
  } catch (e) {
    throw new Error(`gh pr view returned bytes that are not JSON for ${repo}#${pr} (${e.message})`);
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    throw new Error(`gh pr view returned no object for ${repo}#${pr}`);
  }
  // `gh pr view --json` does NOT echo `number` unless it is asked for; it is in `PR_VIEW_FIELDS`, so it is.
  if (Number(view.number) !== pr) {
    const got = view.number === undefined ? 'no `number` field at all' : `#${view.number}`;
    throw new Error(
      `refusing to publish a view for ${repo}#${pr} — the response has ${got}. A view carries the labels and `
      + 'the head ref that decide which diff is judged, so publishing it under the wrong PR\'s name would '
      + 'silently review a different PR (#1466).',
    );
  }
  // `repo` is carried on the view because `gh` does not echo it back and the reader wants it — `readPr` sets the
  // same field from its own argument. Setting it HERE too means the committed file is self-describing in a diff.
  view.repo = repo;
  return { view, fileName: prViewFileName(repo, pr) };
}

/**
 * The bytes committed to the branch. Stable formatting, and DELIBERATELY no timestamp: a produce that finds the
 * PR unchanged must yield byte-identical output, so `git diff --cached` reports nothing and the workflow commits
 * nothing. A `producedAt` stamp would make every scheduled run a new commit on the transport branch forever.
 */
export function serializeView(view) {
  return `${JSON.stringify(view, null, 2)}\n`;
}

function defaultGh(argv) {
  return execFileSync('gh', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function flag(argv, name) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
}

function main(argv) {
  const path = argv.find((a) => !a.startsWith('-'));
  if (!path) throw new Error('usage: produce-pr-view.mjs <request.json> --out=<dir>');

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`could not read ${path} — ${e.message}`);
  }

  if (argv.includes('--check')) {
    const checked = validateViewRequest(parsed);
    if (!checked.ok) throw new Error(`${path}: ${checked.error}`);
    writeLineSync(1, `ok — ${checked.request.repo}#${checked.request.pr} (validated, nothing fetched)`);
    return 0;
  }

  const out = flag(argv, 'out');
  if (!out) throw new Error('`--out=<dir>` is required — there is no default place to put a view');

  const { view, fileName } = producePrView({ request: parsed });
  const target = join(out, fileName);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, serializeView(view), 'utf8');
  writeLineSync(1, target);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    writeLineSync(2, `produce-pr-view: ${e.message}`);
    process.exitCode = 2;
  }
}
