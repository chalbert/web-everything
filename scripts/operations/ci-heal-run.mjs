#!/usr/bin/env node
/**
 * @file scripts/operations/ci-heal-run.mjs
 * @description `#3642` — ONE CI-HEAL DISPATCH, IN ITS OWN PROCESS. The restartable per-dispatch entry point
 * that `we:scripts/operations/dispatch-providers/ci-heal.mjs` spawns DETACHED, and the only production caller
 * of `we:scripts/operations/ci-heal-dispatch-wrapper.mjs#dispatchCiHeal`.
 *
 *   node scripts/operations/ci-heal-run.mjs --pr=743 --num=2638 --session=ci-heal-743 --reason=red-ci
 *
 * Shaped deliberately like its two siblings `we:scripts/operations/deliver-item-run.mjs` (#3645) and
 * `we:scripts/operations/fix-run.mjs` (#3640) — the reason all three exist is identical, so it is stated once
 * in `deliver-item-run.mjs`'s header and again in `fix-run.mjs`'s, and only summarised here:
 *
 *   * `dispatchCiHeal` IS a blocking arc and stays one — a `gh` read, a rebase, an `execFileSync` agent spawn
 *     budgeted at `FIX_AGENT_SPAWN_TIMEOUT_MS` (60 minutes), a 150-350s gate, and a converge pass.
 *   * The DISPATCH PATH it sits on is `we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass`, a
 *     SYNCHRONOUS `execFileSync` of `run.mjs dispatch-lane --num=<N>` inside the resident runner's own tick.
 *
 * Blocking there starves the tick, stops the singleton lease being heartbeated, and lets `run.mjs
 * restart-runner` (which SIGTERMs the supervisor and takes the runner's process tree with it) kill a
 * half-finished heal: a held lane, a rebase applied but not pushed, no CI-heal comment, no stand-down marker
 * — and, because the attempt count is recovered by COUNTING those comments, a heal that really happened
 * reading afterwards as an attempt that never did. That is the parent epic's cross-cutting acceptance
 * criterion, and this item's "Done when" clause 2, failing.
 *
 * So the block moves OUT of the runner: this script is the separate process, the provider spawns it
 * `detached: true` (`setsid` — a new session leader, outside the runner's process group, so a group signal
 * never reaches it) and `.unref()`s it, the dispatch sink returns in milliseconds, and the handle recorded is
 * `pid:<n>`, whose liveness the KERNEL answers (`detached-dispatch.mjs#defaultIsPidAlive`) rather than a
 * `claude agents` listing this wrapper was never in. A RESTARTED runner re-reads that handle off the run
 * record and still gets a truthful `live: true`, so its double-dispatch guard holds.
 *
 * ── THE ONE THING THIS FILE DOES THAT `fix-run.mjs` DOES NOT ────────────────────────────────────────────────
 *
 * IT CARRIES `--reason`. `dispatch-lane.mjs#BRIEF_REQUIRED_BY_KIND['ci-heal']` is the only kind whose brief
 * requires a `REASON` placeholder (`red-ci` / `behind`), because the durable comment this arc posts says WHY
 * the heal fired (`ci-heal-mark.mjs#buildCiHealComment` branches on it). `createDispatchSinks` already
 * forwards `reason` onto the port request — #3640 put it there specifically so this item adds a registry ROW
 * and nothing else — so it reaches the provider, the argv, and this parse with no shell change at all.
 *
 * Everything else — the PR-keyed identity check, the `owner/repo` resolution off the checkout's own `origin`
 * remote, the exit-code rule — is `fix-run.mjs`'s, re-derived for this kind's own slug grammar rather than
 * imported, because {@link assertSessionSlugAgrees}'s whole value is that the two derivations it compares are
 * INDEPENDENT.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dispatchCiHeal, planCiHealDispatchWrapper, resolveCiHealAgentProvider } from './ci-heal-dispatch-wrapper.mjs';
import { DEFAULT_DELIVERY_AGENT_PROVIDER_NAME } from './deliver-item-wrapper.mjs';
import { REPO_ROOT } from './detached-dispatch.mjs';

/** Refused rather than defaulted: a heal with no PR has nothing to resolve, and no session slug has nothing
 *  to key its report by. `num` (the item) and `reason` are genuinely optional — `reason` degrades the durable
 *  comment to `ci-heal-mark.mjs`'s own generic clause and nothing more. */
const REQUIRED_FLAGS = Object.freeze(['pr', 'session']);

/**
 * PURE. `--k=v` argv → the shape {@link runCiHealCli} works with, refusing a missing required flag by NAME.
 * @param {string[]} argv
 * @returns {{pr: string, item: (string|null), sessionSlug: string, repo: (string|null), reason: (string|null),
 *   provider: string}}
 */
export function parseCiHealRunArgv(argv = []) {
  const flags = {};
  for (const a of Array.isArray(argv) ? argv : []) {
    if (typeof a !== 'string' || !a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = 'true';
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const missing = REQUIRED_FLAGS.filter((name) => !String(flags[name] ?? '').trim());
  if (missing.length) {
    throw new TypeError(
      `ci-heal-run: missing required flag(s) ${missing.map((m) => `--${m}=`).join(', ')} — `
      + 'a CI heal cannot resolve its PR or key its own report without them',
    );
  }
  const item = String(flags.num ?? '').trim();
  const repo = String(flags.repo ?? '').trim();
  const reason = String(flags.reason ?? '').trim();
  return {
    pr: String(flags.pr).trim(),
    item: item || null,
    sessionSlug: String(flags.session).trim(),
    repo: repo || null,
    reason: reason || null,
    // #3383 (mechanical-dispatcher) — parsed, NOT validated, here — same split `fix-run.mjs#parseFixRunArgv`
    // keeps for its own `--provider=`. `selectCiHealAgentProvider` below owns the name check + the default.
    provider: String(flags.provider ?? '').trim(),
  };
}

/**
 * #3383 (mechanical-dispatcher, Part 1) — WHICH CLI RUNS THE CI-HEAL AGENT. Same shape
 * `fix-run.mjs#selectFixAgentProvider`/`deliver-item-run.mjs#selectDeliveryAgentProvider` use: an explicit
 * `--provider=` beats the default, so one selection mechanism covers all three dispatch kinds.
 *
 * #3840 (Fork 5 of #3801): the delivery-agent environment-variable fallback is RETIRED — a process-wide
 * variable applied to every dispatch of that process, with no reason and no per-item scope. The one override is
 * the item's own `deliveryAgent:` marker with a required `deliveryAgentReason:`, which the dispatcher passes
 * here as `--provider=`.
 *
 * @param {string} flagValue - the parsed `--provider=` value, `''` when absent.
 * @returns {{name: string, provider: object}}
 */
export function selectCiHealAgentProvider(flagValue) {
  const name = String(flagValue || DEFAULT_DELIVERY_AGENT_PROVIDER_NAME).trim();
  return { name, provider: resolveCiHealAgentProvider(name) };
}

/**
 * THE `owner/repo` SLUG, FROM THE CHECKOUT'S OWN `origin` REMOTE. Both the SSH (`git@host:owner/repo.git`)
 * and HTTPS (`https://host/owner/repo`) spellings are accepted, and a trailing `.git` is stripped.
 *
 * REFUSES rather than falling back to a literal, for the reason `fix-run.mjs#resolveRepoSlug` states and this
 * kind makes worse: a wrong slug here does not fail loudly, it makes `gh pr checks` answer about a DIFFERENT
 * repository's PR of the same number — and this arc then FORCE-PUSHES based on that answer.
 *
 * @param {string} [root]
 * @param {{run?: Function}} [io]
 * @returns {string}
 */
export function resolveRepoSlug(root = REPO_ROOT, {
  run = (cmd, args, opts) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }),
} = {}) {
  const url = String(run('git', ['remote', 'get-url', 'origin'], { cwd: root }) ?? '').trim();
  const m = url.match(/(?:[:/])([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (!m) {
    throw new Error(
      `ci-heal-run: could not read an \`owner/repo\` slug out of this checkout's origin remote (${JSON.stringify(url)}) `
      + '— pass `--repo=owner/repo` explicitly rather than letting a heal resolve (and force-push to) a PR in '
      + 'the wrong repository',
    );
  }
  return m[1];
}

/**
 * THE PR-KEYED IDENTITY CHECK. The dispatcher's slug (`dispatch-lane.mjs#sessionSlugFor(num, 'ci-heal', pr)`
 * → `ci-heal-<PR>`) and the wrapper's own (`planCiHealDispatchWrapper` → `ci-heal-<PR>`) are derived
 * independently, and everything downstream — the report sidecar, the completion record, this dispatch's log
 * file — is keyed by one of them. A silent disagreement makes the wrapper report under a slug the dispatcher
 * never watches for.
 *
 * PURE. Throws rather than preferring one: which of the two is right is not knowable from here.
 * @returns {true}
 */
export function assertSessionSlugAgrees(dispatchedSlug, wrapperSlug) {
  if (String(dispatchedSlug) !== String(wrapperSlug)) {
    throw new TypeError(
      `ci-heal-run: the dispatcher's session slug (${JSON.stringify(String(dispatchedSlug))}) and the wrapper's `
      + `own (${JSON.stringify(String(wrapperSlug))}) disagree. Both are derived from the PR independently — `
      + '`dispatch-lane.mjs#sessionSlugFor` and `ci-heal-dispatch-wrapper.mjs#planCiHealDispatchWrapper` — and '
      + 'the report, the completion record and this dispatch\'s log are all keyed by the slug, so a heal run '
      + 'under a disagreement reports somewhere nobody is reading.',
    );
  }
  return true;
}

/**
 * THE CLI, AS A FUNCTION — extracted from the `IS_CLI` block for the same reason both siblings' are: the argv
 * parse, the exit-code mapping and the failure text are all reachable from a test without a subprocess,
 * without a real `claude`, and without a real `gh`.
 *
 * EXIT 1 MEANS THE HEAL THREW, never that its outcome was disappointing. `dispatchCiHeal` returns a `result`
 * string for every outcome it reasons about (`not-applicable`, `stood-down (...)`, `blocked-on-infra (no free
 * lane)`, `PR #N (ci-healed, re-pushed …)`) and releases what it holds in each; those are exit 0, because the
 * mechanism worked.
 *
 * @param {string[]} argv
 * @param {{dispatch?: Function, repoSlug?: Function, write?: Function, writeErr?: Function,
 *   selectProvider?: Function, env?: object}} [io]
 * @returns {Promise<{code: number, result: object|null}>}
 */
export async function runCiHealCli(argv = [], {
  dispatch = dispatchCiHeal,
  repoSlug = resolveRepoSlug,
  write = (line) => process.stdout.write(line),
  writeErr = (line) => process.stderr.write(line),
  selectProvider = selectCiHealAgentProvider,
} = {}) {
  let launch;
  let selected;
  try {
    launch = parseCiHealRunArgv(argv);
    const repo = launch.repo ?? repoSlug();
    launch = { ...launch, repo };
    assertSessionSlugAgrees(
      launch.sessionSlug,
      planCiHealDispatchWrapper({ pr: launch.pr, repo, item: launch.item, reason: launch.reason }).sessionSlug,
    );
    // #3383 — resolved BEFORE the heal starts, so a bad `--provider=` exits here rather than after a lane and a
    // rebase have already happened (see `selectCiHealAgentProvider`'s own docblock).
    selected = selectProvider(launch.provider);
  } catch (e) {
    writeErr(`error: ${String(e?.message ?? e)}\n`);
    return { code: 1, result: null };
  }
  write(
    `ci-heal-run: starting CI heal of PR #${launch.pr}`
    + `${launch.item ? ` (item #${launch.item})` : ''} in ${launch.repo} `
    + `(session ${launch.sessionSlug}, reason ${launch.reason ?? 'unknown'}, provider ${selected.name}) `
    + `— pid ${process.pid}\n`,
  );
  try {
    const result = await dispatch({
      pr: launch.pr, repo: launch.repo, item: launch.item, reason: launch.reason,
    }, selected.provider);
    write(`ci-heal-run: PR #${launch.pr} finished — ${result?.result ?? '(no result reported)'}\n`);
    return { code: 0, result };
  } catch (e) {
    writeErr(
      `ci-heal-run: PR #${launch.pr} FAILED (lane released best-effort by the wrapper): ${String(e?.message ?? e)}\n`,
    );
    return { code: 1, result: null };
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code } = await runCiHealCli(process.argv.slice(2));
  process.exitCode = code;
}
