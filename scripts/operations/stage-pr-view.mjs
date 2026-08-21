/**
 * @file scripts/operations/stage-pr-view.mjs
 * @description THE `stage-pr-view` DECLARATION (under epic #3029) — put a PR view on disk for the file
 *   transport, and REFUSE an incomplete one.
 *
 * WHY IT EXISTS. `we:scripts/operations/review-pr-io.mjs` can read a PR view from disk instead of calling
 * `gh`, because on a cloud VM `gh` cannot authenticate and that single JSON blob is the review path's only
 * reach for the network. Its header says the transport is FAIL-CLOSED: "a missing or unparseable file throws
 * and names the path; it never silently degrades to an empty view, which would review a PR as if it had no
 * body, no labels and no comments."
 *
 * THAT CLAIM IS TRUE OF A MISSING FILE AND FALSE OF A PRESENT ONE. `assembleReviewDetail`
 * (`we:scripts/review-detail.mjs`) defaults every field it consumes: `labelNames(v.labels)` on an absent
 * `labels` yields `[]`, so `humanRequired` is `false` and the review does not know it is looking at a
 * `review:human` PR; an absent `comments` yields `[]`, so no advisory or human verdict comment is found; an
 * absent `files` yields an empty diffstat. A view assembled BY HAND from another API's response — which is
 * the only way to get one on a host with no `gh` — drops a field by omission, not by malice, and every one
 * of those defaults is silent. The #1466 fix made the transport check the view's `number`; nothing checks
 * that the view is COMPLETE.
 *
 * SO THE DECISION THIS DECLARES IS ONE THING: a field that is ABSENT is refused, and a field that is
 * PRESENT AND EMPTY is believed. `"labels": []` is a claim by whoever staged it that the PR carries none;
 * `labels` missing entirely is no claim at all, and no claim must never read as "none". That is the same
 * line `verify` draws between a failing check and one that never ran — absence of evidence is not evidence
 * of absence, and the whole value of this operation is that it will not let it become one.
 *
 * IT RESTATES NOTHING. The field list is `review-pr-io.mjs`'s own `PR_VIEW_FIELDS` and the filename is its
 * own `prViewFileName` — both INJECTED at the single call site in `./run.mjs`, never re-typed here. The
 * name matters as much as the content: `prViewFileName` is injective over the repo slug precisely because a
 * `-`-flattened one was not, and two repos collided onto one file (#1466 again). A second namer here would
 * be a second answer to "where does this view live", and the reader would find the wrong PR's view under
 * the right PR's name.
 */
import { op } from './registry.mjs';
import { compute, effect } from './step-kinds.mjs';

export const STAGE_PR_VIEW_OP = 'stage-pr-view';

/** The one effect: write the checked view where the file transport will look for it. */
export const WRITE_VIEW_EFFECT = 'stage-pr-view.write';

/**
 * What each declared field must BE, not merely that it is there.
 *
 * A TYPE AND NOT JUST PRESENCE, because the failure being closed is a hand-assembled view: mapping another
 * API's response puts `labels` as an object under a different key, or `files` as a count, far more often
 * than it puts them as the wrong kind of array. `typeof [] === 'object'` would wave both through.
 *
 * The key set is asserted against `PR_VIEW_FIELDS` in the suite rather than derived from it, so adding a
 * field there without deciding its type here is a test failure instead of a field this operation silently
 * stops checking.
 */
export const VIEW_FIELD_TYPES = Object.freeze({
  number: 'number',
  title: 'string',
  url: 'string',
  body: 'string',
  labels: 'array',
  comments: 'array',
  files: 'array',
  headRefName: 'string',
  // #xwp8ioh — `state` decides whether the PR is a thing a review can act on at all. An absent one is the
  // sharpest case this table exists for: `review-pr.read` classifies a missing state as `unknown` and
  // REFUSES, so a staged view without it cannot be reviewed on this host at all. Refusing here names the
  // field while it can still be re-staged, instead of surfacing three steps later as a liveness error about
  // a PR that is in fact perfectly open.
  state: 'string',
});

const kindOf = (v) => (Array.isArray(v) ? 'array' : typeof v);

/**
 * Check one staged view against the declared shape. PURE.
 *
 * REFUSES ABSENCE, BELIEVES EMPTINESS — the whole decision, in one function. Every refusal names the field
 * and says what the review would have concluded from its absence, because "invalid view" tells the operator
 * nothing about which silent default they were about to ship.
 *
 * @param {{view: unknown, pr: number, repo: string, fields: readonly string[]}} o
 * @returns {{view: object, empty: string[]}} the view, plus the fields it explicitly claims are empty
 */
export function checkStagedView({ view, pr, repo, fields } = {}) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    throw new Error(`stage-pr-view: the staged view for ${repo}#${pr} is not a JSON object (got ${kindOf(view)})`);
  }
  const missing = [];
  const mistyped = [];
  for (const field of fields) {
    const want = VIEW_FIELD_TYPES[field];
    if (!want) {
      // A field the reader consumes and this operation has no opinion about is worse than useless — it is a
      // completeness check that quietly does not cover everything the review will read.
      throw new Error(
        `stage-pr-view: \`${field}\` is in the reader's PR_VIEW_FIELDS but has no declared type here, so `
        + 'staging cannot check it. Add it to VIEW_FIELD_TYPES rather than leaving a field unchecked.',
      );
    }
    if (!(field in view) || view[field] === null || view[field] === undefined) missing.push(field);
    else if (kindOf(view[field]) !== want) mistyped.push(`${field} (want ${want}, got ${kindOf(view[field])})`);
  }
  if (missing.length) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — the view is missing ${missing.join(', ')}. `
      + 'The reader DEFAULTS every one of these to empty rather than failing: an absent `labels` makes a '
      + '`review:human` PR look unlabelled and clearable, an absent `comments` hides the escalation and the '
      + 'last verdict, an absent `files` empties the diffstat. If the PR genuinely has none, stage the '
      + 'field explicitly as `[]` — that is a claim, and it will be believed. Omission is not a claim.',
    );
  }
  if (mistyped.length) {
    throw new Error(`stage-pr-view: refusing to stage ${repo}#${pr} — wrong types: ${mistyped.join('; ')}`);
  }
  // The #1466 check, applied at STAGING rather than only at reading. The reader already refuses a mismatched
  // view; catching it here names the file that is wrong while the operator still has both in front of them,
  // instead of surfacing as a refusal on a review they start hours later.
  if (view.number !== pr) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — the view says it is #${view.number}. A view carries `
      + 'the labels and the head ref that decide which diff is judged, so staging it under the wrong PR\'s '
      + 'name silently reviews a different PR.',
    );
  }
  return { view, empty: fields.filter((f) => Array.isArray(view[f]) && view[f].length === 0) };
}

export function stagePrViewOperation({ readPayload } = {}, { fields, viewFileName, defaultDir } = {}) {
  if (typeof readPayload !== 'function') {
    throw new TypeError('stage-pr-view: needs a `readPayload()` reader — the io is injected so the declaration stays testable without a filesystem');
  }
  if (!Array.isArray(fields) || typeof viewFileName !== 'function') {
    throw new TypeError(
      'stage-pr-view: needs the reader\'s own `PR_VIEW_FIELDS` and `prViewFileName` — this file restates '
      + 'neither the field list nor the filename, because a second answer to either sends the review to the '
      + 'wrong view (#1466).',
    );
  }

  return op(STAGE_PR_VIEW_OP, {
    input: {
      pr: { type: 'number', required: true },
      repo: { type: 'string', required: true },
      // The bytes to stage, as a path rather than inline: a PR view is large, it is fetched by whatever on
      // this host CAN authenticate, and a shell-quoted JSON blob on an argv is its own class of corruption.
      from: { type: 'string', required: true },
      // Where the transport reads from. Defaults to the same `WE_PR_VIEW_DIR` the reader resolves, so the
      // two cannot be pointed at different directories by forgetting a flag.
      dir: { type: 'string', required: false, ...(defaultDir ? { default: defaultDir } : {}) },
    },
    verdictFrom: 'check',

    read: compute({
      reads: ['input.from'],
      fn: (view) => readPayload({ from: view.input.from }),
    }),

    check: compute({
      reads: ['input.pr', 'input.repo', 'input.dir', 'findings.read'],
      fn: (view) => {
        if (!view.input.dir) {
          throw new Error(
            'stage-pr-view: no directory to stage into — pass `--dir=` or set WE_PR_VIEW_DIR. Staging '
            + 'somewhere the reader does not look produces a file nobody reads and a review that still '
            + 'cannot run.',
          );
        }
        const checked = checkStagedView({ view: view.findings.read, pr: view.input.pr, repo: view.input.repo, fields });
        return { ...checked, path: `${view.input.dir}/${viewFileName(view.input.repo, view.input.pr)}` };
      },
    }),

    write: effect({
      reads: ['verdict'],
      // IDEMPOTENT: staging the same checked view twice writes identical bytes to the same path. The view is
      // input to a review, never a record OF one, so a re-stage supersedes rather than accumulating.
      effects: (view) => [{
        type: WRITE_VIEW_EFFECT,
        idempotent: true,
        payload: { path: view.verdict.path, content: `${JSON.stringify(view.verdict.view, null, 2)}\n` },
      }],
    }),
  });
}
