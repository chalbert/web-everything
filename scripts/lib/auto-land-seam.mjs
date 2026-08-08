/**
 * auto-land-seam.mjs — the SEAM that ACTS on a clean auto-dispose intent (#2675, under epic #2636). This closes
 * the autonomous jury→drain loop: #2674 (`disposition-land-seam.mjs` → `decideDispositionLabel`) turns a parked
 * PR's jury ledger into a LABEL INTENT (auto-clear/accept vs keep-parked/review:human) and returns it, applying
 * NOTHING; THIS module is the piece that ACTS on a clean auto-clear intent — writing `review:accepted` (via the
 * existing `decideSetLabel`-guarded `review-set-label.mjs`, so the swap INHERITS INVARIANT 2 unbypassed) so the
 * drain merges it.
 *
 * SHADOW MODE IS THE DEFAULT (ratified, operator 2026-07-26). The seam runs behind a GLOBAL `shadow | enforce`
 * knob on the #2651 disposition-config (`careJury.disposition.landMode`, read via `resolveDispositionConfig`):
 *   • `shadow` (the default): a clean auto-dispose is OBSERVED only — the seam LOGS what it WOULD dispose (a
 *     ledger line / a would-accept observation) and applies NO label and merges NOTHING; a HUMAN still clears the
 *     PR, for a confidence-building period. This is the default until a SEPARATE one-line ruling flips it.
 *   • `enforce`: a clean auto-dispose WRITES `review:accepted` and the drain lands it with no human in the loop.
 *
 * SAFETY RAILS (hold in BOTH modes, never overridable):
 *   1. NEVER auto-lands a KEEP-PARKED intent — a red-judge-refuted / contested / gate-self / judge-error PR (the
 *      #2674 intent already routed it to `review:human`) is never written to accepted here, in shadow OR enforce.
 *   2. FAIL-CLOSED — any error (a bad intent, or the label write itself throwing, e.g. the review-set-label
 *      INVARIANT-2 refusal on a `review:human` PR) yields NO auto-action here: this seam applies nothing further
 *      and reports `landed:false`. An error NEVER becomes an auto-accept, and this module NEVER throws into the
 *      caller's land loop.
 *
 *      SAY WHAT `landed:false` ACTUALLY MEANS (#2964 — the earlier wording, "the PR stays parked", over-claimed).
 *      It means THIS SEAM decided nothing and wrote nothing of its own. It does NOT mean the PR is untouched: the
 *      writer it shells (`review-set-label.mjs`) performs TWO non-atomic `gh` calls — a durable verdict comment
 *      and the label swap — so a writer that throws may have landed one of them. #2964 ordered those two so the
 *      half that can survive alone is the SAFE one: on a PR not yet accepted the comment goes first, and an
 *      orphan `reviewed-sha` marker with no `review:accepted` behind it is never read (the gate reads it lazily,
 *      only inside an accepted-label check), so `landed:false` there really is inert. On a PR that ALREADY carries
 *      `review:accepted` the swap goes first instead — a failed run can then have applied an idempotent re-add and
 *      lost only the record, or (if the comment landed) have refreshed nothing, because the marker stays on the
 *      swap side. What it can never do is freshen the #2409 coverage of an acceptance that did not land. So:
 *      fail-closed on the GATE, not atomic on the WRITE.
 *   3. A `review:human` PR is never laundered to accepted: the CLEAR intent already carries `decideSetLabel`'s
 *      allowed accept swap (its INVARIANT-2 refusal converts a would-be accept on a `review:human` PR into a
 *      keep-parked intent upstream), and the default label writer shells `review-set-label.mjs`, whose CLI
 *      re-enforces INVARIANT 2 at write time — a double lock.
 *   4. NEVER auto-lands a SELF-CLEARED verdict (#2844). The clearing actor must be PROVABLY not the PR's author
 *      — the #2439 bar, applying #2398's distinct-fresh-validator rule. Before #2844, INVARIANT 2 was the only
 *      identity-shaped guard and it only binds a `review:human` PR; a `review:pending` PR had NO reviewer-identity
 *      check at all, so this seam would have written `review:accepted` on a diff its own session authored,
 *      including a diff to this very file. The rail is STRICT FAIL-CLOSED: `decideClearerIndependence` must return
 *      `independent` — a proven self-clear AND both "cannot establish it" statuses (no author stamp on the PR, no
 *      actor id in this process) all yield observe-only, in shadow AND enforce. A machine that cannot PROVE
 *      independence does not land. See `we:scripts/lib/review-independence.mjs` for what the id rests on, and for
 *      the plainly-stated residual (it is not an unforgeable signal; #2895 deferred that, #2946 is the fix).
 *
 * TRUST-CHAIN MEMBER (POLICY tier). This file is the acting end of the auto-dispose leash — it decides whether a
 * clean intent actually LANDS or only observes. Registered in `gate-config.mjs` `TRUST_CHAIN` as `tier: 'policy'`,
 * so a change here forces `review:human` (an agent may not clear an edit to its own auto-land machinery).
 *
 * Split like `review-set-label.mjs`: a PURE decider (`decideAutoLand`) that takes the #2674 intent + the mode and
 * returns a PLAN (act vs observe-only, and the exact swap), plus a thin impure applier (`applyAutoLand`) that
 * emits the observation and — only on `apply` — invokes an injected label writer (default: shell the
 * INVARIANT-2-guarded `review-set-label.mjs`). `runAutoLandSeam` composes #2674 + this seam end-to-end (ledger →
 * resolved config → intent → action). Pure core unit-tested in `we:scripts/lib/__tests__/auto-land-seam.test.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REVIEW_LABELS } from './review-escalation.mjs';
import { LAND_ACTIONS, decideDispositionLabel } from './disposition-land-seam.mjs';
import { resolveDispositionConfig } from './review-policy.mjs';
import { currentActorId, decideClearerIndependence } from './review-independence.mjs';

/**
 * The two operating modes of the auto-land seam (#2675) — the GLOBAL `careJury.disposition.landMode` knob's values.
 * A frozen enum so every caller names them once. `SHADOW` is the ratified DEFAULT and the fail-closed fallback: any
 * mode that is not exactly `enforce` is treated as shadow (observe-only), so an unset / unknown / corrupted mode can
 * never accidentally enable auto-landing.
 */
export const LAND_MODES = Object.freeze({
  SHADOW: 'shadow',   // observe-only — log what it WOULD dispose, write no label, merge nothing; a human still clears
  ENFORCE: 'enforce', // a clean auto-dispose writes review:accepted; the drain lands it with no human in the loop
});

/**
 * @typedef {Object} AutoLandPlan
 * @property {'shadow'|'enforce'} mode - the NORMALIZED effective mode (anything not `enforce` normalizes to `shadow`).
 * @property {'clear'|'keep-parked'} action - the #2674 intent's land action this plan acted on.
 * @property {boolean} apply - whether the seam will actually WRITE review:accepted (true ONLY on a clean CLEAR in enforce).
 * @property {import('./disposition-land-seam.mjs').SetLabelDecision|null} setLabel - the accept swap to apply (only when `apply`), else null.
 * @property {string} observation - a human/ledger line: what happened, or what it WOULD do in shadow.
 * @property {string} reason - the #2674 intent's machine reason token (or a seam-level `bad-intent` / `refused-accept`).
 */

/** Fail-closed observe-only plan — apply nothing, keep the PR parked. Pure. */
function observeOnly({ mode, action, reason, observation }) {
  return { mode, action, apply: false, setLabel: null, observation, reason };
}

/**
 * THE PURE DECIDER (#2675) — given the #2674 disposition-label INTENT and the resolved land MODE, decide whether to
 * actually WRITE review:accepted (enforce + a clean auto-clear) or merely OBSERVE (shadow, or any non-clear intent).
 * PURE: no I/O, deterministic — the same intent + mode always yield the same plan. It RETURNS the plan; it does NOT
 * apply it (that is `applyAutoLand`).
 *
 * @param {{ intent: import('./disposition-land-seam.mjs').DispositionLabelIntent, mode?: string,
 *           authorId?: string, clearerId?: string }} o
 *   `intent` is the #2674 intent; `mode` is the resolved `landMode` (`shadow` | `enforce`; anything else → shadow).
 *   #2844 — `authorId` is the actor that OPENED the PR (the `authored-by-actor` stamp `pr-land.mjs` writes into
 *   the PR body) and `clearerId` is the actor running THIS seam; both are required for a clear (SAFETY RAIL 4).
 * @returns {AutoLandPlan}
 */
export function decideAutoLand({ intent, mode, authorId, clearerId } = {}) {
  // Normalize the mode FIRST — fail-closed: only the exact `enforce` string enables acting; everything else
  // (undefined, null, a typo, a future/unknown mode) is treated as SHADOW, the safe observe-only default.
  const effectiveMode = mode === LAND_MODES.ENFORCE ? LAND_MODES.ENFORCE : LAND_MODES.SHADOW;

  // A malformed / absent intent is fail-closed to observe-only — never guess an auto-action from a bad input.
  if (!intent || typeof intent !== 'object' || typeof intent.action !== 'string') {
    return observeOnly({
      mode: effectiveMode,
      action: 'keep-parked',
      reason: 'bad-intent',
      observation: 'auto-land: no usable disposition intent — no auto-action (fail-closed; PR stays parked).',
    });
  }

  const reason = typeof intent.reason === 'string' ? intent.reason : '';

  // SAFETY RAIL 1 — a KEEP-PARKED intent is NEVER auto-landed, in shadow OR enforce. The #2674 intent already
  // routed a red-refuted / contested / gate-self / judge-error PR to review:human; this seam must not override that
  // park. Observe-only: record that it was kept parked, write no accept.
  if (intent.action !== LAND_ACTIONS.CLEAR) {
    return observeOnly({
      mode: effectiveMode,
      action: intent.action,
      reason,
      observation: `auto-land: keep-parked (not a clean auto-dispose${reason ? `: ${reason}` : ''}) — no accept written; the PR is routed to a human.`,
    });
  }

  // A CLEAR intent MUST carry decideSetLabel's allowed accept swap (INVARIANT 2 inherited unbypassed upstream). If
  // it somehow does not (a would-be accept the invariant refused, or a malformed swap), fail closed — never write.
  const swap = intent.setLabel;
  if (!swap || swap.allowed !== true || swap.addLabel !== REVIEW_LABELS.accepted) {
    return observeOnly({
      mode: effectiveMode,
      action: intent.action,
      reason: 'refused-accept',
      observation: 'auto-land: a clear intent lacked an allowed review:accepted swap — no auto-action (fail-closed).',
    });
  }

  // SAFETY RAIL 4 (#2844) — the SELF-CLEAR refusal. The clearing actor must be PROVABLY distinct from the PR's
  // author (#2439). Evaluated BEFORE the shadow branch on purpose: shadow is the DRY RUN of enforce, so a plan
  // that would be refused in enforce must be recorded as refused in shadow too — a shadow line reading
  // "WOULD write review:accepted" for a verdict enforce would never write is exactly the false confidence the
  // observation period exists to avoid. Strict fail-closed: `unknown-author` and `unknown-clearer` refuse just
  // like a proven `self-clear` — a machine that cannot PROVE independence does not land.
  const independence = decideClearerIndependence({ authorId, clearerId });
  if (!independence.independent) {
    return observeOnly({
      mode: effectiveMode,
      action: intent.action,
      reason: `self-clear-refused: ${independence.status}`,
      observation: `auto-land: REFUSED to auto-clear — ${independence.reason}. No accept written (fail-closed; `
        + 'the PR stays parked for an independent clearer or a human).',
    });
  }

  // SHADOW (the default) — OBSERVE only: log what it WOULD dispose, apply no label, merge nothing. A human clears.
  if (effectiveMode === LAND_MODES.SHADOW) {
    return observeOnly({
      mode: LAND_MODES.SHADOW,
      action: LAND_ACTIONS.CLEAR,
      reason,
      observation: `auto-land [SHADOW]: WOULD write ${REVIEW_LABELS.accepted} (clean auto-dispose${reason ? `: ${reason}` : ''}) — no label applied; a human still clears.`,
    });
  }

  // ENFORCE — a clean auto-dispose WRITES review:accepted; the drain lands it with no human in the loop.
  return {
    mode: LAND_MODES.ENFORCE,
    action: LAND_ACTIONS.CLEAR,
    apply: true,
    setLabel: swap,
    observation: `auto-land [ENFORCE]: writing ${REVIEW_LABELS.accepted} (clean auto-dispose${reason ? `: ${reason}` : ''}) — the drain may merge.`,
    reason,
  };
}

/** PURE — build the argv for the `review-set-label.mjs` accept write. Its CLI parses ONLY the `=`-joined flag form
 *  (`--repo=…` / `--to=…` / `--actor=…`, see review-set-label.mjs#runCli); a space-separated `--repo <v>` would
 *  leave the value unparsed and fail the CLI's input validation. Extracted + exported so the exact flag form is
 *  unit-tested without shelling. The PR is a positional (the CLI matches the first bare integer arg). */
export function buildSetLabelArgs({ pr, repo }) {
  return [String(pr), `--repo=${repo}`, '--to=accepted', '--actor=auto-land seam (enforce)'];
}

/** The default impure label writer — shell the existing INVARIANT-2-guarded `review-set-label.mjs` CLI to swap the
 *  parked review to `review:accepted` (it observes the PR's fresh labels, re-enforces INVARIANT 2, edits the labels,
 *  and posts a durable verdict comment). Single-sources the accept WRITE rather than re-implementing the `gh` calls.
 *  Throws on a non-zero exit (e.g. an INVARIANT-2 refusal) — `applyAutoLand` catches it and fails closed.
 *  #2844 — SAFETY RAIL 4 is double-locked the same way INVARIANT 2 is: the child inherits this process's
 *  environment, so its own `currentActorId()` IS this seam's actor, and it re-reads the PR's `authored-by-actor`
 *  stamp from `gh pr view` at write time. A self-clear that somehow got past the decider (a caller supplying a
 *  bogus `authorId`) is refused again at the CLI, and that non-zero exit arrives here as a fail-closed error. */
function defaultWriteAccept({ pr, repo }) {
  const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'review-set-label.mjs');
  execFileSync('node', [cli, ...buildSetLabelArgs({ pr, repo })], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * THE THIN IMPURE APPLIER (#2675) — run `decideAutoLand`, ALWAYS emit the plan's observation (the shadow ledger
 * line / the enforce log), and — ONLY on `apply` (a clean CLEAR in enforce) — invoke the label writer. FAIL-CLOSED:
 * any writer error is caught and returned as `{ landed:false, error }` and this never throws. `landed:false` means
 * this seam took no auto-action — NOT that the writer left the PR byte-for-byte untouched; see SAFETY RAIL 2 in
 * the file header for what a partially-applied writer can and cannot leave behind (#2964).
 *
 * #2844 — the CLEARER's id is resolved HERE, from the harness session (`currentActorId()`), not taken from a
 * caller-supplied flag: the whole point is an id the acting process cannot simply assert about itself in argv.
 * A caller may still pass `clearerId` explicitly (the tests do, and a future host that runs the seam out of
 * process needs to), which is a deliberate seam, not a bypass — supplying a WRONG id can only ever cause a
 * refusal or a false self-clear match, never launder one; the value that would let a write through is the one
 * the environment already holds. `authorId` comes from the PR's `authored-by-actor` body stamp; when the caller
 * cannot supply it, SAFETY RAIL 4 refuses (fail-closed), which is the intended behaviour, not a gap.
 *
 * @param {{ intent: object, mode?: string, pr: (number|string), repo: string,
 *           authorId?: string, clearerId?: string }} o
 * @param {{ writeAccept?: (o:{pr:(number|string),repo:string,setLabel:object})=>void, log?: (msg:string)=>void }} [deps]
 *   `writeAccept` is the injected label writer (default: shell review-set-label.mjs); `log` sinks the observation
 *   (default: stderr — the shadow ledger stream, kept off stdout so a JSON result stays clean).
 * @returns {{ landed: boolean, plan: AutoLandPlan, error?: string }}
 */
export function applyAutoLand({ intent, mode, pr, repo, authorId, clearerId } = {}, deps = {}) {
  const writeAccept = typeof deps.writeAccept === 'function' ? deps.writeAccept : defaultWriteAccept;
  const log = typeof deps.log === 'function' ? deps.log : (msg) => process.stderr.write(`${msg}\n`);

  const actor = typeof clearerId === 'string' ? clearerId : currentActorId();
  const plan = decideAutoLand({ intent, mode, authorId, clearerId: actor });
  log(plan.observation);

  if (!plan.apply) return { landed: false, plan };

  try {
    writeAccept({ pr, repo, setLabel: plan.setLabel });
    return { landed: true, plan };
  } catch (e) {
    // FAIL-CLOSED — the accept write threw (an INVARIANT-2 refusal, a gh error, …). No auto-action from HERE; the
    // writer's own two calls are not atomic, so read `landed:false` as "this seam applied nothing", not as "the PR
    // is untouched" (#2964, SAFETY RAIL 2 in the header).
    const error = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'write failed';
    log(`auto-land: the review:accepted write FAILED — keeping the PR parked (fail-closed): ${error}`);
    return { landed: false, plan, error };
  }
}

/**
 * The end-to-end seam (#2674 + #2675) — from a parked PR's jury LEDGER to a landed-or-observed action. Resolves the
 * #2651 disposition config (which carries the global `landMode`), runs the #2674 decider to a label INTENT, then
 * ACTS on it via `applyAutoLand` behind the resolved mode. One call closes the loop for one PR. Fail-closed
 * throughout (the decider is fail-closed by construction; the applier catches every write error).
 *
 * @param {{
 *   ledger?: Array<object>, signals?: object, mandatoryLenses?: string[], currentLabels?: Array,
 *   band?: string, override?: object, pr: (number|string), repo: string,
 *   authorId?: string, clearerId?: string
 * }} o - `ledger`/`signals`/`mandatoryLenses`/`currentLabels` feed #2674; `band`/`override` feed the config resolver
 *   (landMode is global-only, so neither changes it); `pr`/`repo` name the PR to act on. #2844 —
 *   `authorId`/`clearerId` feed SAFETY RAIL 4; omitting `authorId` refuses the clear (fail-closed).
 * @param {object} [deps] - forwarded to `applyAutoLand` (`writeAccept`, `log`).
 * @returns {{ landed: boolean, plan: AutoLandPlan, intent: object, error?: string }}
 */
export function runAutoLandSeam({
  ledger, signals, mandatoryLenses, currentLabels, band, override, pr, repo, authorId, clearerId,
} = {}, deps = {}) {
  // FAIL-CLOSED at the OUTER boundary too — decideDispositionLabel is fail-closed by construction, but
  // resolveDispositionConfig CAN throw on a bad band/override. A throw here must NEVER escape into the caller's
  // land loop (INVARIANT 4): catch it, act on nothing, keep the PR parked.
  let config;
  try {
    config = resolveDispositionConfig({ band, override });
  } catch (e) {
    const error = String((e && e.message) || e);
    const log = typeof deps.log === 'function' ? deps.log : (msg) => process.stderr.write(`${msg}\n`);
    log(`auto-land: could not resolve the disposition config — no auto-action (fail-closed): ${error}`);
    return { landed: false, plan: null, intent: null, error };
  }
  const intent = decideDispositionLabel({ ledger, config, signals, mandatoryLenses, currentLabels });
  const res = applyAutoLand({ intent, mode: config.landMode, pr, repo, authorId, clearerId }, deps);
  return { ...res, intent };
}
