/**
 * @file scripts/operations/record-verdict.mjs
 * @description THE `record-verdict` DECLARATION (#xrk6hmj, under epic #3029) — carry a review verdict from a
 *   host that cannot authenticate to GitHub to the CI job that can.
 *
 * WHY IT EXISTS. `review-pr`'s own `record` effect shells `we:scripts/review-set-label.mjs`, which needs `gh`.
 * On a cloud VM no local process holds a GitHub credential and none can be given one, so that step fails and
 * the verdict has to travel another way: as a FILE pushed to `ops/review-requests`, which
 * `we:.github/workflows/apply-review-request.yml` applies by running the real label CLI. That transport works.
 * What it did not have was a caller — it was hand-assembled from a shell one-liner every time, eight times in
 * one session.
 *
 * THE DEFECT THAT MAKES IT WORTH DECLARING is not tedium, it is the retyping. Each hand-rolled request restated
 * the PR number, the repo, the actor and the session id in a fresh `JSON.stringify`, next to a body path copied
 * from a directory listing. A wrong number there records a verdict on the WRONG PR — the same class #1466 fixed
 * on the reading side, where a mis-staged view silently reviewed a different PR than the one named.
 *
 * SO THE INPUT IS A RUN ID, NOT A VERDICT. Everything factual is read back out of the run record the review
 * itself wrote: `input.pr`, `input.repo`, the juror's `sessionId` from telemetry, and the staged write-up on
 * disk. The operator supplies only what is genuinely a decision — which verdict, and (for `clear-human`) the
 * instruction authorising it. There is no `--pr` flag to get wrong.
 *
 * IT DOES NOT RE-DECIDE ANYTHING. The request's shape and every refusal on it live in
 * `we:scripts/apply-review-request.mjs` (`validateRequest`, `APPLIABLE_TARGETS`, `CLEARANCE_FIELD`) and are
 * IMPORTED here, never restated. A second validator would be a second answer to "is this request legal", and
 * the two would drift — the mistake `verify` made against `verify-lane.mjs` before it was corrected.
 */
import { op } from './registry.mjs';
import { compute, effect } from './step-kinds.mjs';

export const RECORD_VERDICT_OP = 'record-verdict';

/** The one effect this declares: stage the request file and push it to the transport branch. */
export const STAGE_REQUEST_EFFECT = 'record-verdict.stage';

/**
 * Pull the facts out of the run record. PURE.
 *
 * REFUSES A RUN THAT IS NOT A REVIEW, and refuses one whose verdict step never ran. Recording a verdict for a
 * run that never produced one is not a partial success — it is a fabricated review, and the request file would
 * look exactly like a real one on the transport branch.
 */
export function factsFromRun(record, { runId } = {}) {
  if (!record || typeof record !== 'object') {
    throw new Error(`record-verdict: no run record for ${JSON.stringify(runId)} — the verdict is read from the run the review wrote, never retyped`);
  }
  if (record.op !== 'review-pr') {
    throw new Error(`record-verdict: run ${record.id ?? runId} is a \`${record.op}\` run, not a review — there is no verdict on it to record`);
  }
  const pr = Number(record?.input?.pr);
  const repo = String(record?.input?.repo ?? '');
  if (!Number.isInteger(pr) || pr <= 0 || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`record-verdict: run ${record.id ?? runId} names no usable subject (pr=${JSON.stringify(record?.input?.pr)}, repo=${JSON.stringify(repo)})`);
  }
  if (!record?.verdict) {
    throw new Error(
      `record-verdict: run ${record.id ?? runId} has no verdict — the judge step has not produced one. `
      + 'Recording here would publish a review that was never reached.',
    );
  }
  // OPTIONAL, and its absence is honest rather than fatal: without it the durable comment records independence
  // as UNPROVEN, which is the truth. Fabricating one would be worse.
  const sessionId = (record.telemetry ?? []).map((t) => t?.sessionId).find((s) => typeof s === 'string' && s.trim()) || undefined;
  return { pr, repo, sessionId, lens: record?.input?.lens ?? '', reduced: record.verdict.verdict ?? '' };
}

/**
 * The request the transport will carry. PURE — the caller's `validate` is
 * `we:scripts/apply-review-request.mjs`'s own, injected so this file states no rule of its own.
 *
 * THE REDUCED VERDICT IS REPORTED, NOT ENFORCED. A juror that reduced to `accept` and an operator who records
 * `changes` is a legitimate disagreement — the operator is the decider, and #2409's arc has always allowed
 * overriding a panel. It IS surfaced (`disagreesWithPanel`) so the record shows the override happened rather
 * than hiding it.
 */
export function buildRequest({ facts, to, body, operatorInstruction, actor }, validate) {
  const request = {
    repo: facts.repo,
    pr: facts.pr,
    to,
    actor,
    body,
    ...(facts.sessionId ? { sessionId: facts.sessionId } : {}),
    ...(operatorInstruction ? { operatorInstruction } : {}),
  };
  const checked = validate(request);
  if (!checked.ok) throw new Error(`record-verdict: ${checked.error}`);
  return {
    request,
    // `ops/review-requests/<pr>-<to>.json`. The name carries the subject so a directory listing is readable,
    // and a re-record of the same verdict overwrites rather than accumulating — the transport applies only
    // what a push ADDED, so an overwrite is one delivery, not two.
    path: `ops/review-requests/${facts.pr}-${to}.json`,
    disagreesWithPanel: Boolean(facts.reduced) && facts.reduced !== to && !(facts.reduced === 'accept' && to === 'accepted'),
  };
}

export function recordVerdictOperation({ readRun } = {}, { validateRequest, appliableTargets } = {}) {
  if (typeof readRun !== 'function') {
    throw new TypeError('record-verdict: needs a `readRun()` reader — the io is injected so the declaration stays testable without a run store');
  }
  if (typeof validateRequest !== 'function' || !Array.isArray(appliableTargets)) {
    throw new TypeError('record-verdict: needs the applier\'s own `validateRequest` and `APPLIABLE_TARGETS` — this file states no request rule of its own');
  }

  return op(RECORD_VERDICT_OP, {
    input: {
      // THE ONLY SUBJECT INPUT. There is deliberately no `--pr`: the PR is read from the run record, so it
      // cannot be mistyped onto another PR's transport file.
      runId: { type: 'string', required: true },
      to: { type: 'string', required: true, enum: [...appliableTargets] },
      actor: { type: 'string', required: false, default: 'claude-review-pr' },
      // Required by the applier for `clear-human` and refused on anything else — its rule, enforced there.
      operatorInstruction: { type: 'string', required: false },
      // #3261 — WHICH CHECKOUT carries the target repo's transport branch. Each repo owns its own notes, so a
      // verdict for a sibling repo must be staged on THAT repo's board; this names the checkout to push from.
      // Optional: omitted means the driver's own checkout, which is right for the common same-repo case. The
      // sink REFUSES a mismatch either way, so a wrong or absent value fails loudly rather than landing a
      // verdict where no applier with the right token will ever see it.
      repoRoot: { type: 'string', required: false, default: '' },
    },
    verdictFrom: 'plan',

    read: compute({
      reads: ['input.runId'],
      fn: (view) => {
        const { record, body } = readRun({ runId: view.input.runId });
        const facts = factsFromRun(record, { runId: view.input.runId });
        if (typeof body !== 'string' || !body.trim()) {
          throw new Error(
            `record-verdict: run ${view.input.runId} staged no write-up to carry. The durable comment IS the `
            + 'review; a verdict with an empty body lands a label and tells the author nothing.',
          );
        }
        return { ...facts, body };
      },
    }),

    plan: compute({
      reads: ['input.to', 'input.actor', 'input.operatorInstruction', 'findings.read'],
      fn: (view) => buildRequest({
        facts: view.findings.read,
        to: view.input.to,
        body: view.findings.read.body,
        operatorInstruction: view.input.operatorInstruction,
        actor: view.input.actor,
      }, validateRequest),
    }),

    stage: effect({
      reads: ['verdict', 'input.repoRoot'],
      // ONE effect carrying bytes `plan` already computed. IDEMPOTENT: re-writing the identical request on a
      // replay is safe — the transport applies what a push added, and an identical overwrite is one delivery.
      effects: (view) => [{
        type: STAGE_REQUEST_EFFECT,
        idempotent: true,
        // `repo` rides the payload (#3261) so the SINK can decide which board this belongs on — each repo
        // owns its own notes, and staging a verdict on the wrong repo's branch strands it where no applier
        // with the right token will ever see it. The sink REFUSES a mismatch rather than defaulting.
        payload: {
          path: view.verdict.path,
          content: `${JSON.stringify(view.verdict.request, null, 2)}\n`,
          pr: view.verdict.request.pr,
          to: view.verdict.request.to,
          repo: view.verdict.request.repo,
          repoRoot: view.input?.repoRoot ?? '',
        },
      }],
    }),
  });
}
