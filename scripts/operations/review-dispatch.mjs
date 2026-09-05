#!/usr/bin/env node
/**
 * @file scripts/operations/review-dispatch.mjs
 * @description `#3279` — DISPATCH AN INDEPENDENT REVIEW OF A PR TO A FRESH SESSION.
 *
 *   node scripts/operations/review-dispatch.mjs --pr=1234 --repo=chalbert/web-everything
 *
 * THE GAP THIS CLOSES, PRECISELY. `review-pr` (via `we:scripts/operations/review-loop-cli.mjs`, #3072) already
 * runs a review UNATTENDED end to end — spawn two independent jurors, reduce their verdicts, bounce a `changes`
 * automatically, and QUEUE (never auto-record) an `accept`. But `we:scripts/lib/review-independence.mjs`'s
 * self-clear refusal keys on `CLAUDE_CODE_SESSION_ID`, and A SUBAGENT INHERITS ITS PARENT'S VALUE — so running
 * `review-loop-cli.mjs` as a subagent of the very session that opened the PR is still, as far as that refusal
 * is concerned, the SAME actor reviewing its own diff. `review-pr`'s own `read` step refuses that outright, for
 * ANY eventual verdict, not only an accept (see `shapeReadFinding`'s self-clear throw in `review-pr.mjs`) — so
 * the review cannot even BOUNCE from inside the authoring session, let alone accept. Something has to start a
 * session that is not that one. `we:scripts/operations/dispatch-lane.mjs` is the existing precedent for "start a
 * genuinely independent session" but is shaped for the conveyor's OWN tick core (`--num` resolves an item out
 * of `planTick`'s launch lists; it has no notion of "review this PR" and never takes a lane directly) — so it
 * cannot serve this, and nothing else declares the review-side equivalent. This file is that equivalent.
 *
 * WHY A PLAIN MODULE, NOT THE DECLARATIVE `op()` ENGINE (`we:scripts/operations/dispatch-lane.mjs`'s shape).
 * `dispatch-lane.mjs` earns its three declared steps (`read` / `plan` / `dispatch`) and its own effect type
 * because it is consumed BY the tick core's own bookkeeping loop: its `dispatch: true` effect rides the
 * `effect-executor.mjs` in-flight ledger the conveyor's waker (`wake.mjs`) polls, its guard reads the CALLER'S
 * OWN in-flight dispatch records to prevent a double-dispatch onto one lane, and its run record is what the
 * tick's own health-stall scan reverse-derives lane→item from. NONE of that applies here: this operation is not
 * part of the tick loop (this task's own instructions are explicit that wiring it into `we:skills-src/conveyor/
 * runner.mjs` / `we:scripts/conveyor/reconcile-pass.mjs` is separate, later work), it dispatches at most once
 * per invocation with no bookkeeping to guard against a sibling call, and its own session acquires its OWN lane
 * rather than being handed one by a tick plan. Declaring three steps and a run record for that would be
 * machinery with nothing to consume it — the same call `we:scripts/operations/dispatch-abort.mjs` already made
 * for a comparably-scoped, standalone dispatch action, and the one this file follows.
 *
 * WHAT ACTUALLY MAKES THE SPAWNED SESSION INDEPENDENT. Not a derived id, not an env-var override on this
 * process — a BRAND NEW random UUID, minted here and handed to `claude --bg --session-id=<uuid>`
 * (`we:scripts/operations/dispatch-lane-io.mjs#defaultSpawnAgent` / `#buildAgentArgv`, reused verbatim rather
 * than re-implemented). `claude -p`/`--bg` does NOT adopt an inherited `CLAUDE_CODE_SESSION_ID` — supplying
 * `--session-id` makes the spawned session's identity exactly that value, deterministically, which is the same
 * mechanism `we:scripts/lib/judge-spawn.mjs` already relies on for a juror's independence (that file derives its
 * seed from the run; this one has no run to derive from, so a fresh random UUID is the honest equivalent — the
 * property needed is "not the author's", and a random 122-bit value is that with overwhelming probability).
 *
 * WHAT THIS FILE DOES NOT DO. It does not run the review itself (that is `review-loop-cli.mjs`, which the
 * dispatched session runs FOR ITSELF, inside its own freshly-minted session — see the brief). It does not
 * acquire a lane (the dispatched session acquires its own, per the brief's own first step — this operation
 * would otherwise be leasing a resource whose release it cannot guarantee, the same reasoning
 * `dispatch-lane.mjs`'s own header gives for never acquiring on a delivery agent's behalf). It does not decide
 * WHETHER a review is owed for a PR — that is `we:scripts/conveyor/reconcile-core.mjs`'s `DISPATCH_KINDS`
 * decision (#3296, already landed); this file is what that decision calls, once something wires the two
 * together — which, per this item's own scope, is separate, later work.
 *
 * A CALLER STILL HOLDING ITS OWN BUILD LANE FOR THE SAME PR SHOULD RELEASE IT FIRST (#x3jmao3, soft doctrine,
 * not enforced here). Live-caught 2026-09-04: an ad hoc session dispatched a review for the PR it had just
 * landed WITHOUT releasing the lane it built that PR in — the dispatched session's own `lane-pool.mjs acquire`
 * (brief step 1) read the pool as fully held/dirty and gave up, because the caller's still-leased lane was one
 * unit of that pressure. `lane-pool.mjs acquire --wait-ms=<N>` (the brief's step 1 now passes it) is the
 * PRIMARY fix — it makes that acquire tolerant of a momentary full pool regardless of what any one caller
 * does — but releasing an unrelated lane before dispatching a review still costs the caller nothing and
 * removes one more unit of pool pressure at exactly the moment a fresh lane is needed.
 *
 * IMPURE: reads the brief template off disk, mints a UUID, and spawns one `claude --bg` process — through
 * INJECTED handles (mirroring `we:scripts/operations/dispatch-abort.mjs` and `dispatch-lane-io.mjs`), so the
 * whole thing is testable with no real subprocess and no real session.
 *
 * WHAT THIS FILE DOES NOT CLOSE, STATED PLAINLY (an independent review of PR #1756, security lens, CONFIRMED
 * this — the #2895 discipline: a residual left silent is worse than one left open). CORRECTED 2026-09-01
 * (`#3434`): `review-loop-policy.mjs#reviewLoopAutoConfirm` no longer refuses `accept` for the agent-addressed
 * (`review:pending`) tier — a genuinely independent clean verdict clears mechanically now, by design, THROUGH
 * `review-loop-cli.mjs`. The residual risk this paragraph names is narrower than it used to read: not "bypass
 * the never-self-accept refusal" (there is no such refusal left to bypass on `review:pending`), but "skip the
 * judging entirely" — nothing in `dispatchReview` technically restricts its tools, so a prompt-injection
 * payload embedded in the very PR it is reviewing could in principle talk it into running
 * `review-pr --answer=accept` directly WITHOUT the two independent jurors ever running, forging the SAME
 * outcome the mechanical path produces honestly. `review:human`'s own refusal is UNCHANGED by `#3434` and
 * still fully real — this residual is `review:pending`-only. `caller` here means a Bash-capable session
 * persuaded to run a different command instead — the same trust boundary
 * `we:scripts/lib/review-independence.mjs`'s own header names for `CLAUDE_CODE_SESSION_ID` ("not an unforgeable
 * actor signal … #2895 ruled that deferred"). Filed as its own item rather than solved here or left unfiled:
 * `we:backlog/xf38r2m-technically-enforce-review-dispatch-s-never-self-accept-neve.md`.
 *
 * NARROWED AND TECHNICALLY BACKED, 2026-09-02 (`#3433`, re-scoped by `#3434` to `review:human`'s never-
 * self-accept and never-merge — `review:pending`'s auto-clear is the ratified mechanism working as intended,
 * not a bypass to harden against). `dispatchReview` now bakes a `--disallowedTools` deny list
 * ({@link REVIEW_DISPATCH_DISALLOWED_TOOLS}) into EVERY spawned review session's own `claude` argv — a
 * harness-enforced refusal the model's own judgment is never consulted on, closer to what "restricted
 * tool/permission default" (this item's own words) means than prose alone. It denies `gh` OUTRIGHT (the r1
 * self-review below is why: an earlier draft denied only `gh pr merge`, and `gh pr edit --add-label
 * review:accepted --remove-label review:human` turned out to be the same self-clear one un-denied `gh` call
 * away), plus every script that can reach the `--to=clear-human` ceremony (`review-set-label.mjs` directly,
 * `apply-review-request.mjs`'s cloud-VM path, `run.mjs record-verdict`'s staging path) — none of which
 * `review-agent-brief.md`'s own sanctioned arc (lane-pool acquire → `review-loop-cli.mjs` → lane-pool release)
 * ever calls, so nothing legitimate is lost. STILL NOT A SANDBOX: a `Bash(<prefix>:*)` rule matches the
 * LITERAL command string the harness sees, so a sufficiently adversarial rewrite (`bash -c '...'`, a
 * relative-path indirection) is not caught by this alone — see {@link REVIEW_DISPATCH_DISALLOWED_TOOLS}'s own
 * header for what this narrows the residual to.
 *
 * R1 SELF-REVIEW (#3433, this item's own step-6 adversarial pass, CONFIRMED then fixed before the PR opened):
 * the first draft's deny list read `Bash(gh pr merge:*)` — literal-prefix-correct, but far too narrow. The
 * reviewer found `gh pr edit --add-label review:accepted --remove-label review:human` (a label flip, no merge
 * verb at all) reaches the exact same outcome as the `--to=clear-human` ceremony this file already denies three
 * scripts over, and `gh api`'s raw PUT-a-pull-request-merge-endpoint form reaches the same outcome as
 * `gh pr merge` under a different verb. Both are closed now by denying `gh` wholesale rather than by naming
 * merge/label/api shapes
 * one at a time — see {@link REVIEW_DISPATCH_DISALLOWED_TOOLS}'s own header for why enumerating GitHub-mutation
 * shapes individually is the game this file was already losing.
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  agentArgsFromEnv, assertNotALaneCheckout, buildAgentArgv, defaultSpawnAgent, REPO_ROOT,
} from './dispatch-lane-io.mjs';
import { checkMainStaleness, gitRun } from '../lib/main-staleness.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
import { reviewSessionSlug } from '../conveyor/review-session-slug.mjs';

// re-exported so nothing that already imports `reviewSessionSlug` from this file has to change (#3437) — the
// slug itself now lives in `we:scripts/conveyor/review-session-slug.mjs`, a PURE module both this file and
// `we:scripts/conveyor/reconcile-core.mjs` import, so the pure reconciler never pulls in this file's impure
// transitive imports (`node:child_process`/`node:crypto`/`node:fs`, via `dispatch-lane-io.mjs`).
export { reviewSessionSlug };

/** The template `we:skills-src/review/review-agent-brief.md` — read once per dispatch, never cached across
 *  calls, so an edited brief takes effect on the very next dispatch with no process restart. */
export function reviewBriefPath(root = REPO_ROOT) {
  return join(root, 'skills-src', 'review', 'review-agent-brief.md');
}

/** The three `{{PLACEHOLDER}}` tokens the review brief declares. Mirrors `we:scripts/operations/
 *  dispatch-lane.mjs#BRIEF_PLACEHOLDERS`'s NAMING convention (a small, closed, named list) without importing
 *  that file's machinery — see the file header for why this operation owns its own, smaller copy. */
export const REVIEW_BRIEF_PLACEHOLDERS = Object.freeze(['PR', 'REPO', 'SESSION_SLUG']);

/** Any run of separators a placeholder name might be typo'd with, canonicalized — same shape as `dispatch-
 *  lane.mjs#canonicalPlaceholder`, scoped to this brief's own three names. */
export function canonicalReviewPlaceholder(name) {
  const norm = String(name ?? '').trim().replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  return REVIEW_BRIEF_PLACEHOLDERS.includes(norm) ? norm : null;
}

/** A placeholder token, in ANY spelling (whitespace/case/separator variants) — the same detection width
 *  `dispatch-lane.mjs#BRIEF_TOKEN_RE` uses, and for the identical reason: a near-miss spelling must be
 *  CAUGHT, not silently invisible to the scan that looks for it. */
const REVIEW_BRIEF_TOKEN_RE = /\{\{\s*([^{}\n]*?)\s*\}\}/g;

/**
 * BASH DENY LIST baked into every dispatched review session's own `claude` invocation (#3433). Prefix-match
 * rules, in this repo's own `Bash(<prefix>:*)` convention (`we:.claude/settings.json`'s
 * `Bash(node scripts/backlog.mjs:*)` is the same shape) — the harness refuses a matching command BEFORE the
 * model's own judgment is consulted, so a prompt-injection payload in the reviewed diff cannot talk the session
 * into it merely by asking.
 *
 * THE FOUR, AND WHY EXACTLY THESE FOUR. `review-agent-brief.md`'s own sanctioned arc never calls any of them —
 * one `lane-pool.mjs acquire`, one `review-loop-cli.mjs`, one `lane-pool.mjs release` — so denying all four
 * costs a well-behaved dispatch nothing:
 *   • `gh` — THE WHOLE CLI, not just `gh pr merge`. An adversarial review (`#3433` r1) found that denying only
 *     `gh pr merge` still left `gh pr edit --add-label review:accepted --remove-label review:human` reachable —
 *     the exact same self-clear the `review-set-label.mjs` deny below exists to stop, just one `gh` call away
 *     with no script involved at all — and `gh api`'s raw PUT-a-pull-request-merge-endpoint form reachable as
 *     an un-prefixed merge. The sanctioned arc never calls `gh` directly (whatever it needs from GitHub happens INSIDE
 *     `review-loop-cli.mjs`'s own subprocess, never as a fresh top-level Bash-tool command), so there is no
 *     narrower `gh ...` prefix worth carving out — the whole CLI is denied.
 *   • `review-set-label.mjs` — the #2895 SINGLE HOME the `--to=clear-human` ceremony actually writes through.
 *     `review-loop-cli.mjs` never shells this directly for a dispatched review (its own auto-clear path for
 *     `review:pending` is a DIFFERENT, already-independence-checked route) — a dispatched session invoking it
 *     by hand has no legitimate reason to.
 *   • `apply-review-request.mjs` — the cloud-VM applier. Its `clear-human` guard is a NAMED field
 *     (`operatorInstruction`), not a verified one — any Bash-capable actor can populate it with a fabricated
 *     "operator instruction" and a self-authored request.json. Denied outright.
 *   • `run.mjs` (the whole operations CLI, not just `record-verdict`) — `record-verdict --to=clear-human`
 *     stages exactly the same ceremony for `apply-review-request.mjs` to later apply, and the dispatched
 *     session's brief never calls `run.mjs` for anything at all, so the broader deny costs nothing and closes
 *     the door on whatever OTHER operation might reach the ceremony later.
 *
 * NOT A SANDBOX — see the file header's own note on what a literal-prefix rule does and does not catch. This is
 * why `gh` is denied WHOLESALE rather than pattern-by-pattern against every mutation it can perform (a label
 * edit, a merge, a review submission) — enumerating GitHub-mutation shapes one at a time is exactly the game
 * the r1 finding proved this file was already losing.
 */
export const REVIEW_DISPATCH_DISALLOWED_TOOLS = Object.freeze([
  'Bash(gh:*)',
  'Bash(node scripts/review-set-label.mjs:*)',
  'Bash(node scripts/apply-review-request.mjs:*)',
  'Bash(node scripts/operations/run.mjs:*)',
]);

/**
 * The `--disallowedTools=<patterns>` argv element for {@link REVIEW_DISPATCH_DISALLOWED_TOOLS} — ONE `=`-joined
 * string, never `['--disallowedTools', '<value>']` as two separate elements. `--disallowedTools` is documented
 * (`claude --help`) as `<tools...>`, a VARIADIC option: `claude`'s commander-style parser keeps consuming
 * subsequent non-flag argv tokens as MORE tool patterns, not just the one immediately after the flag — so a
 * two-element `['--disallowedTools', joined]` form still swallows the prompt that `buildAgentArgv` appends
 * right after it (its own header already warns the prompt's position guarantees nothing; this is that hazard,
 * hit for real).
 *
 * R2 SELF-REVIEW (#3433, CONFIRMED then fixed before the PR opened): an earlier draft of THIS function shipped
 * the two-element form on the theory that "one flag, one already-joined value" was safe from variadic
 * swallowing. It was not — the parser does not care how many logical values are packed into the token after
 * the flag, only how many SEPARATE argv elements follow it, and two elements is still two. Verified empirically
 * against the real `claude` binary (local-only, no PR, no `gh`, cleaned up after): the two-element form started
 * a session with the prompt silently swallowed as bogus deny patterns ("Permission deny rule 'hello' matches no
 * known tool") and NOTHING to review; the single `=`-joined element correctly preserved the prompt. A regression
 * back to the two-element form does not fail loud — it silently no-ops every dispatched review — so the r2 test
 * below asserts the argv shape directly, not just its stringified contents.
 */
export function reviewDispatchDisallowedToolsArgs() {
  return [`--disallowedTools=${REVIEW_DISPATCH_DISALLOWED_TOOLS.join(',')}`];
}

/** What a placeholder VALUE may safely contain — an id, a repo-qualified path, an `owner/repo` slug, a lane
 *  session slug. Deliberately the same narrow allowlist `dispatch-lane.mjs#BRIEF_VALUE_RE` uses: these values
 *  are pasted UNQUOTED into shell commands the dispatched agent is told to run. */
export const REVIEW_BRIEF_VALUE_RE = /^[A-Za-z0-9_.,:/@#-]+$/;

/**
 * FILL the review brief. PURE. Same three refusals as `dispatch-lane.mjs#fillBrief`, scoped to this brief's own
 * placeholders — see that function's own header for the full reasoning (a missing/blank/unsafe value refuses;
 * a MISSPELLED placeholder refuses, because nothing would substitute it and the dispatched agent would run the
 * literal token; an UNKNOWN token — one that names none of the three — is reported, never fatal, because this
 * brief's own prose legitimately contains bracketed examples that are not meant to be filled).
 *
 * @param {string} template
 * @param {{PR: string|number, REPO: string, SESSION_SLUG: string}} values
 * @returns {{prompt: string, unknownTokens: string[]}}
 */
export function fillReviewBrief(template, values = {}) {
  const text = String(template ?? '');
  if (!text.trim()) {
    throw new Error('review-dispatch: the review-agent brief template is empty — refusing to dispatch an agent with no instructions');
  }
  for (const name of REVIEW_BRIEF_PLACEHOLDERS) {
    const value = values[name];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`review-dispatch: no value for the brief placeholder {{${name}}} — refusing to fill it with nothing`);
    }
    if (!REVIEW_BRIEF_VALUE_RE.test(String(value))) {
      throw new Error(
        `review-dispatch: the value for {{${name}}} (${JSON.stringify(String(value))}) has characters the brief `
        + 'cannot carry safely — it is pasted UNQUOTED into a shell command the agent is told to run. Refusing.',
      );
    }
  }
  const unknown = new Set();
  const misspelled = new Set();
  const prompt = text.replace(REVIEW_BRIEF_TOKEN_RE, (whole, name) => {
    if (whole === `{{${name}}}` && REVIEW_BRIEF_PLACEHOLDERS.includes(name)) return String(values[name]);
    const canonical = canonicalReviewPlaceholder(name);
    if (canonical) { misspelled.add(`${whole} (meaning {{${canonical}}})`); return whole; }
    unknown.add(whole);
    return whole;
  });
  if (misspelled.size) {
    throw new Error(
      `review-dispatch: the brief carries a MISSPELLED placeholder — ${[...misspelled].sort().join(', ')}. No `
      + 'substitution reaches it, so the dispatched agent would run the token verbatim. Refusing to dispatch. '
      + `Spell it exactly as one of ${REVIEW_BRIEF_PLACEHOLDERS.map((n) => `{{${n}}}`).join(', ')}.`,
    );
  }
  return { prompt, unknownTokens: [...unknown].sort() };
}

/**
 * ASSERT the dispatching checkout is not behind `origin/main` — #3439: a stale dispatching checkout spawns the
 * review agent with THIS checkout's own stale `we:scripts/lib/review-loop-policy.mjs` on its `cwd`-relative
 * import path, silently re-running pre-fix behavior with no error. THE CHOICE THIS RECORDS (item #3439's #2):
 * the dispatched review's code keeps coming from the DISPATCHING checkout at spawn time — today's actual
 * behavior — rather than the lane it later acquires (that would need the agent to re-invoke itself from
 * inside its own freshly-acquired lane, a bigger change this item does not make). Made LOUD instead: refuse
 * outright whenever `origin/main` is ahead, diverged or not — no auto fast-forward here (unlike `we:scripts/
 * check-readiness.mjs`'s read-only ranker, this checkout may carry uncommitted work a caller does not expect
 * mutated) — so a stale checkout never silently dispatches. A fetch failure (offline) is fail-soft, matching
 * `we:scripts/lib/main-staleness.mjs`'s own philosophy: we cannot tell if it's stale, so we do not block on it.
 *
 * @param {string} root
 * @param {(root: string) => ReturnType<typeof checkMainStaleness>} [checkStaleness] - injectable, defaults to
 *   a real `checkMainStaleness` scoped (via `run`'s `cwd`) to `root`.
 */
export function assertMainNotStale(root, checkStaleness = (r) => checkMainStaleness({
  autoFf: false, run: (args) => gitRun(args, { cwd: r }),
})) {
  const st = checkStaleness(root);
  if (st && st.action === 'warn') {
    throw new Error(
      `review-dispatch: the dispatching checkout is ${st.behind} commit(s) behind origin/main — refusing to `
      + 'dispatch a review that would run STALE code from this checkout\'s own import path (#3439). Sync '
      + '(git pull --ff-only) or dispatch from a fresh clone of origin/main and retry.',
    );
  }
  return st;
}

/**
 * SHAPE one dispatch request. PURE — separated from the actual fill/spawn so a caller (and a test) can see
 * exactly what would be sent before anything is filled or spawned.
 *
 * @param {{pr: number|string, repo: string}} o
 * @returns {{pr: number, repo: string, sessionSlug: string}}
 */
export function planReviewDispatch({ pr, repo } = {}) {
  const prNum = Number(pr);
  if (!Number.isInteger(prNum) || prNum <= 0) {
    throw new Error(`review-dispatch: --pr must be a positive integer, got ${JSON.stringify(pr)}`);
  }
  const repoStr = String(repo ?? '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoStr)) {
    throw new Error(`review-dispatch: --repo must be an \`owner/repo\` slug, got ${JSON.stringify(repo)}`);
  }
  return { pr: prNum, repo: repoStr, sessionSlug: reviewSessionSlug(prNum) };
}

/**
 * DISPATCH ONE INDEPENDENT REVIEW SESSION. The composition: plan → fill the brief → mint a fresh session id →
 * spawn. Mirrors `we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks`'s own composition closely —
 * same `assertNotALaneCheckout` guard (a dispatcher run FROM a lane clone would hand the dispatched agent a
 * confusing root, and could not itself be released the way a lane can), same "the handle is minted, not
 * discovered" reasoning for why `sessionId` is chosen here rather than read back from a listing afterward.
 *
 * @param {object} o
 * @param {number|string} o.pr
 * @param {string} o.repo
 * @param {string} [o.root] - the cwd the dispatched session starts in (never a lane — it acquires its own).
 * @param {(root?: string) => string} [o.readBrief] - injectable brief-template reader.
 * @param {() => string} [o.mintSessionId] - injectable UUID minter.
 * @param {Function} [o.spawnAgent] - injectable `(argv, opts) => stdout`; the default shells `claude`.
 * @param {string[]} [o.extraArgs] - forwarded to `buildAgentArgv`, exactly like `dispatch-lane-io.mjs`'s own.
 * @param {(root: string) => ReturnType<typeof checkMainStaleness>} [o.checkStaleness] - injectable staleness
 *   check (#3439) — see `assertMainNotStale`.
 * @returns {{sessionId: string, sessionSlug: string, pr: number, repo: string, prompt: string, unknownTokens: string[]}}
 */
export function dispatchReview({
  pr, repo, root = REPO_ROOT,
  readBrief = (r) => readFileSync(reviewBriefPath(r), 'utf8'),
  mintSessionId = () => randomUUID(),
  spawnAgent = defaultSpawnAgent,
  extraArgs = [],
  checkStaleness,
} = {}) {
  assertNotALaneCheckout(root);
  // #3439 — refuse (not silently spawn) when this checkout is behind origin/main: see `assertMainNotStale`.
  // `checkStaleness` undefined here falls straight through to that function's own default — no need to
  // duplicate it.
  assertMainNotStale(root, checkStaleness);
  const planned = planReviewDispatch({ pr, repo });
  const { prompt, unknownTokens } = fillReviewBrief(readBrief(root), {
    PR: planned.pr, REPO: planned.repo, SESSION_SLUG: planned.sessionSlug,
  });
  const sessionId = String(mintSessionId());
  // #xw3k2v9 — REVIEW FINDING (PR #1756 r1): `extraArgs` was destructured and documented as "forwarded to
  // buildAgentArgv, exactly like dispatch-lane-io.mjs's own" but the call below never referenced it — every
  // caller-supplied flag (a `--permission-mode`, a `--model` override) was silently dropped. Fixed by actually
  // passing it through, matching `we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks`'s own call.
  // #3433 — the mandatory deny list comes FIRST, ahead of any caller-supplied `extraArgs`: it is baked into
  // every dispatch regardless of what an operator's WE_DISPATCH_AGENT_ARGS sets, not something a caller opts
  // into. See `REVIEW_DISPATCH_DISALLOWED_TOOLS`'s own header for what it denies and why.
  const argv = buildAgentArgv({
    sessionId,
    payload: { prompt, sessionSlug: planned.sessionSlug },
    extraArgs: [...reviewDispatchDisallowedToolsArgs(), ...extraArgs],
  });
  spawnAgent(argv, { cwd: root });
  return { sessionId, sessionSlug: planned.sessionSlug, pr: planned.pr, repo: planned.repo, prompt, unknownTokens };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  try {
    // #xw3k2v9 — REVIEW FINDING (PR #1756 r1): with `extraArgs` now actually forwarded (see `dispatchReview`),
    // the CLI still had no way to SUPPLY any — `dispatch-lane.mjs`'s own CLI wiring reads `WE_DISPATCH_AGENT_ARGS`
    // (`agentArgsFromEnv`) so an operator can pass a restrictive `--permission-mode` to a dispatched agent; this
    // one silently could not. Reused verbatim, not re-derived, for the same reason every other primitive here is.
    const result = dispatchReview({ pr: flag('pr'), repo: flag('repo'), extraArgs: agentArgsFromEnv() });
    writeAllSync(
      1,
      `dispatch-review: started session ${result.sessionId} (slug ${result.sessionSlug}) reviewing `
      + `${result.repo}#${result.pr}\n`
      + `watch it: claude agents --json | grep ${result.sessionId}\n`
      + (result.unknownTokens.length ? `note: unrecognized brief tokens (reported, not fatal): ${result.unknownTokens.join(', ')}\n` : ''),
    );
  } catch (e) {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  }
}
