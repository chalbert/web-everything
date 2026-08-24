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
 *
 * ── #xaoja7a: WHERE THE VIEW COMES FROM IS NOW PART OF THE DECISION ──────────────────────────────────────────
 *
 * Everything above is about a view being COMPLETE. It says nothing about the view being TRUE, and it could not:
 * `--from=<path>` accepts any bytes an operator hands over, and on a host with no mechanical read path the
 * operator handing them over is the REVIEWING SESSION ITSELF. Observed live on PR #1542: the staged view
 * carried a paraphrase of the body in the session's voice plus a comment the session had authored, stamped
 * `authorAssociation: OWNER`, that is not on the PR at all. Every field this file checked was present, correctly
 * typed and about the right PR. The check passed. The evidence was fabricated.
 *
 * So a second transport now exists (`we:.github/workflows/stage-pr-view.yml` + `we:scripts/produce-pr-view.mjs`):
 * the session pushes a REQUEST, CI runs `gh pr view --json` and commits the answer to `ops/pr-views`, and
 * `--fromTransport` reads it back out of the fetched remote ref. Three refusals below are what make that worth
 * having rather than decorative, and each one is here — in the declaration — because each is a DECISION:
 *
 *   1. {@link chooseViewSource} — exactly one source, named explicitly. Defaulting either way would make the
 *      weaker path reachable by omission.
 *   2. {@link checkViewProvenance} — a file-supplied view is REFUSED on a repo whose transport branch exists.
 *      This is the structural half. If `--from=` stayed reachable wherever CI can serve, a session could fetch
 *      the CI-produced view, edit it, and stage that: the hole moves one step back and nothing has changed.
 *      It also pins the REF a transport view may come from, so no input can point the read somewhere writable.
 *   3. {@link checkViewFreshness} — a view whose `headRefOid` is not the head the diff will be taken from is
 *      REFUSED. A stale view describes a body, a comment set and a file list for a tree that is no longer under
 *      review, and `review-pr` takes its diff from local git — so nothing downstream can notice.
 */
import { op } from './registry.mjs';
import { compute, effect } from './step-kinds.mjs';
import { TRANSPORT_BRANCH, TRANSPORT_REF } from '../lib/pr-view-transport.mjs';

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

/** The two ways a view can reach this operation. A closed set, so nothing can invent a third. */
export const VIEW_SOURCES = Object.freeze(['transport', 'file']);

/**
 * WHICH SOURCE, decided from the flags alone. PURE.
 *
 * NEITHER IS THE DEFAULT, and that is the point. Defaulting to `file` keeps the #1542 hole reachable by simply
 * omitting a flag; defaulting to `transport` would silently start a CI round trip for an operator who meant to
 * hand over bytes they already had. Both are refusals that name the other option, so the caller chooses in
 * writing either way.
 *
 * BOTH IS ALSO A REFUSAL, never a precedence rule. A precedence rule is a thing to remember, and "the local
 * file quietly won" is the exact failure mode this card exists to close.
 *
 * @param {{from?: string, fromTransport?: boolean}} o
 * @returns {{source: 'transport'} | {source: 'file', from: string}}
 */
export function chooseViewSource({ from = '', fromTransport = false } = {}) {
  const path = String(from ?? '').trim();
  if (fromTransport && path) {
    throw new Error(
      'stage-pr-view: `--fromTransport` and `--from=` name two different views — pass one. `--fromTransport` '
      + `reads the view CI produced, out of \`${TRANSPORT_REF}\`; \`--from=\` reads bytes off this host, which `
      + 'nothing verifies.',
    );
  }
  if (fromTransport) return { source: 'transport' };
  if (path) return { source: 'file', from: path };
  throw new Error(
    'stage-pr-view: no view source — pass `--fromTransport` (the view CI produced, which the reviewing session '
    + 'cannot have authored) or `--from=<path>` (bytes off this host, which nothing verifies). There is no '
    + 'default, because a default would make one of the two reachable by omission.',
  );
}

/**
 * WHERE THE BYTES CAME FROM, checked. PURE. The structural half of #xaoja7a.
 *
 * ── `file` ON AN ONBOARDED REPO IS REFUSED ───────────────────────────────────────────────────────────────────
 *
 * This is the refusal that turns "CI produced it" into "the session could not have authored it". Without it,
 * CI producing the view is not sufficient on its own: the session fetches the CI-produced view, edits it, and
 * stages the edit through `--from=`. Same fabrication, one step further back, and every check above still
 * passes. So once a repo HAS the transport — its `ops/pr-views` branch exists on the remote, which is the
 * mechanical fact the io shell probes with `git ls-remote` — the local-file path is closed. Not discouraged;
 * closed. A repo that has NOT onboarded keeps `--from=` and is told, in the staged bytes, that it did.
 *
 * ── THE REF IS PINNED ────────────────────────────────────────────────────────────────────────────────────────
 *
 * A transport view must come from `origin/ops/pr-views` and nothing else. `git show ops/pr-views:…` would read
 * a LOCAL branch a session can commit to with no credential and no network; a caller-supplied ref would be a
 * session-writable path in the middle of the one read that is supposed to have none. No input field reaches
 * this value — it is a constant in `we:scripts/lib/pr-view-transport.mjs` — and this assertion is what makes
 * that a checked property rather than a comment.
 *
 * ── A TRANSPORT VIEW MUST CARRY `headRefOid` ─────────────────────────────────────────────────────────────────
 *
 * CI always asks for it (it is in the union `transportViewFields` builds). A transport view without it was not
 * produced the declared way, so the freshness check below would have nothing to compare and would pass
 * vacuously — which is worse than no check at all, because the operator believes one ran.
 *
 * @param {{provenance: object, repo: string, pr: number, view: object}} o
 * @returns {object} the provenance, unchanged
 */
export function checkViewProvenance({ provenance, repo, pr, view } = {}) {
  if (!provenance || typeof provenance !== 'object' || !VIEW_SOURCES.includes(provenance.source)) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — the reader reported no source for these bytes `
      + `(want one of ${VIEW_SOURCES.join('|')}). A view with no stated provenance cannot be told apart from `
      + 'one the reviewing session wrote itself, which is the whole defect (#xaoja7a).',
    );
  }
  if (provenance.source === 'file') {
    if (provenance.transportAvailable) {
      throw new Error(
        `stage-pr-view: refusing a hand-supplied view for ${repo}#${pr} — this repo HAS the CI transport `
        + `(\`${TRANSPORT_BRANCH}\` exists on origin), so use \`--fromTransport\`. On PR #1542 a reviewing `
        + 'session staged a paraphrased body and a comment it had written itself, stamped '
        + '`authorAssociation: OWNER`, that was not on the PR at all — and every completeness check passed. '
        + 'Leaving `--from=` open where CI can serve would just move that one step back: fetch the real view, '
        + 'edit it, stage the edit.',
      );
    }
    return provenance;
  }
  if (provenance.ref !== TRANSPORT_REF) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — a transport view must be read from \`${TRANSPORT_REF}\`, `
      + `and this one claims \`${provenance.ref}\`. A local branch of that name is writable by this session `
      + 'with no credential and no network, so reading one would be the same trust as reading a local file.',
    );
  }
  if (typeof view?.headRefOid !== 'string' || !view.headRefOid.trim()) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — the transport view carries no \`headRefOid\`. CI always `
      + 'asks for it, so a view without one was not produced the declared way; and without it the staleness '
      + 'check has nothing to compare and would pass vacuously.',
    );
  }
  return provenance;
}

/**
 * IS THIS VIEW ABOUT THE TREE THAT WILL BE JUDGED? PURE.
 *
 * WHY IT MATTERS MORE THAN IT SOUNDS. `review-pr` takes the DIFF from local git at the PR's head ref, and takes
 * the body, the labels and the comments from the staged view. Those are two independent reads of two moments.
 * Push a commit between them and the juror reads yesterday's description, yesterday's review comments and
 * yesterday's file list against today's diff — and every one of them is internally consistent, so nothing
 * downstream can notice. That is the same class of silent mismatch #1466 found when a view sat under the wrong
 * PR's filename with the diff still correctly taken from local git.
 *
 * `headOid` IS THE HEAD THE DIFF WILL ACTUALLY COME FROM — the local `origin/<headRefName>`, probed by the io
 * shell — not a second opinion from GitHub. Comparing against anything else would check the wrong thing.
 *
 * AN UNRESOLVABLE HEAD FAILS CLOSED. If the probe came back empty the comparison cannot be made, and "could
 * not check" must not read as "checked and fine" — that is the absent-versus-empty line this whole file draws,
 * one field over.
 *
 * A NON-`OPEN` PR IS EXEMPT, and that is not a loophole. A merged or closed PR has no live head to move; its
 * branch is routinely deleted, so the probe would fail for every one of them. `review-pr`'s own liveness
 * refusal (`shapeReadFinding`, #xwp8ioh) is what handles that case, and it does it with a message about the PR
 * rather than about a ref.
 *
 * @param {{view: object, headOid: string, repo: string, pr: number}} o
 * @returns {{checked: boolean, head: string, reason?: string}}
 */
export function checkViewFreshness({ view, headOid = '', repo, pr } = {}) {
  const claimed = typeof view?.headRefOid === 'string' ? view.headRefOid.trim() : '';
  if (!claimed) return { checked: false, head: '', reason: 'the view claims no headRefOid' };
  if (String(view?.state ?? '').toUpperCase() !== 'OPEN') {
    return { checked: false, head: claimed, reason: `the PR is ${view?.state ?? 'in an unknown state'}, so its head cannot move` };
  }
  const live = String(headOid ?? '').trim();
  if (!live) {
    throw new Error(
      `stage-pr-view: refusing to stage ${repo}#${pr} — could not resolve \`origin/${view?.headRefName ?? '?'}\` `
      + `to compare against the view's headRefOid (${claimed.slice(0, 12)}). The diff a juror reads comes from `
      + 'that ref; if it cannot be resolved, nothing here can tell whether the view describes the tree that '
      + 'will be judged. Fetch the head ref and re-stage.',
    );
  }
  if (live !== claimed) {
    throw new Error(
      `stage-pr-view: refusing to stage a STALE view of ${repo}#${pr} — it describes head `
      + `${claimed.slice(0, 12)} and \`origin/${view?.headRefName ?? '?'}\` is now ${live.slice(0, 12)}. `
      + 'The body, the comments and the file list would be read against a diff taken from the NEW head, and '
      + 'each half is internally consistent, so nothing downstream would notice. Re-run with `--refresh` to '
      + 'ask CI for a view of the current head.',
    );
  }
  return { checked: true, head: live };
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
      // THE CI TRANSPORT (#xaoja7a) — the honest path. Push a request, let the workflow run `gh pr view`, read
      // the answer out of the fetched remote ref. NOT the default: see `chooseViewSource` for why neither is.
      fromTransport: { type: 'boolean', required: false, default: false },
      // Ask CI for a NEW view even though one is already on the branch. The escape from a refused STALE view,
      // and the only thing that makes that refusal actionable rather than terminal.
      refresh: { type: 'boolean', required: false, default: false },
      // The bytes to stage, as a path rather than inline: a PR view is large, it is fetched by whatever on
      // this host CAN authenticate, and a shell-quoted JSON blob on an argv is its own class of corruption.
      //
      // NO LONGER `required`, and no longer sufficient. It survives ONLY for a repo that has not onboarded the
      // transport; `checkViewProvenance` refuses it everywhere `ops/pr-views` exists on origin.
      from: { type: 'string', required: false, default: '' },
      // Where the transport reads from. Defaults to the same `WE_PR_VIEW_DIR` the reader resolves, so the
      // two cannot be pointed at different directories by forgetting a flag.
      dir: { type: 'string', required: false, ...(defaultDir ? { default: defaultDir } : {}) },
    },
    verdictFrom: 'check',

    // THE SOURCE IS DECIDED BEFORE ANYTHING IS READ, in a pure step of its own, so "exactly one source, named
    // explicitly" is assertable without a filesystem, a git or a network.
    select: compute({
      reads: ['input.from', 'input.fromTransport'],
      fn: (view) => chooseViewSource({ from: view.input.from, fromTransport: view.input.fromTransport }),
    }),

    read: compute({
      reads: ['input.pr', 'input.repo', 'input.refresh', 'findings.select'],
      fn: (view) => readPayload({
        ...view.findings.select,
        repo: view.input.repo,
        pr: view.input.pr,
        refresh: view.input.refresh,
      }),
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
        const { view: staged, provenance } = view.findings.read ?? {};
        const { pr, repo } = view.input;
        // ORDER IS DELIBERATE. Completeness first, because every later refusal reads fields off the view and a
        // missing one would otherwise surface as a confusing message about staleness. Then provenance — WHERE
        // the bytes came from is more fundamental than what they say. Then freshness, which is the only one
        // that needs both.
        const checked = checkStagedView({ view: staged, pr, repo, fields });
        checkViewProvenance({ provenance, repo, pr, view: staged });
        const freshness = checkViewFreshness({ view: staged, headOid: provenance?.headOid, repo, pr });
        return {
          ...checked,
          provenance,
          freshness,
          path: `${view.input.dir}/${viewFileName(repo, pr)}`,
        };
      },
    }),

    write: effect({
      reads: ['verdict'],
      // IDEMPOTENT: staging the same checked view twice writes identical bytes to the same path. The view is
      // input to a review, never a record OF one, so a re-stage supersedes rather than accumulating.
      effects: (view) => [{
        type: WRITE_VIEW_EFFECT,
        idempotent: true,
        payload: {
          path: view.verdict.path,
          // THE PROVENANCE IS STAMPED INTO THE STAGED BYTES, and it is not decoration. `assembleReviewDetail`
          // ignores keys it does not consume, so this costs the reader nothing — and it is the only record, in
          // the artefact itself, of whether a juror's evidence came off this session's disk or out of CI. It is
          // also what the item's option (a) — recompute a digest against the live PR — would check against if
          // a local path is ever re-introduced. `_`-prefixed because it is not a `gh` field and must never be
          // mistaken for one.
          content: `${JSON.stringify({ ...view.verdict.view, _stagedFrom: view.verdict.provenance }, null, 2)}\n`,
        },
      }],
    }),
  });
}
