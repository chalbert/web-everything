#!/usr/bin/env node
/**
 * @file scripts/operations/fix-run.mjs
 * @description `#3640` — ONE FIX DISPATCH, IN ITS OWN PROCESS. The restartable per-dispatch entry point that
 * `we:scripts/operations/dispatch-providers/fix.mjs` spawns DETACHED, and the only production caller of
 * `we:scripts/operations/fix-dispatch-wrapper.mjs#dispatchFix`.
 *
 *   node scripts/operations/fix-run.mjs --pr=2108 --num=3629 --session=fix-2108
 *
 * Shaped deliberately like its `build` sibling `we:scripts/operations/deliver-item-run.mjs` (#3645), because
 * the reason both exist is identical — see that file's own header for the long form, and the two differences
 * this file has to state itself below.
 *
 * ── WHY DETACHED AND NOT FOREGROUND, GIVEN #3629 PROPOSED FOREGROUND ────────────────────────────────────────
 *
 * `we:backlog/3629-*.md` (the ratified design for this wrapper) says the fix wrapper should "foreground/block
 * on its agent spawn", reasoning by analogy with `deliver-item-wrapper.mjs`. That analogy is right about the
 * WRAPPER and wrong about the CALLER, and #3645's own commit (`d1c2d8ed6`) had already worked out why for the
 * identical shape:
 *
 *   * `dispatchFix` IS a blocking arc, and stays one. Its `provider.spawn` is an `execFileSync` budgeted at
 *     `FIX_AGENT_SPAWN_TIMEOUT_MS` (= `DELIVERY_AGENT_SPAWN_TIMEOUT_MS`, 60 minutes), plus a possible resume,
 *     plus a gate and a converge pass that block for minutes more.
 *   * The DISPATCH PATH it sits on is `we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass`, a
 *     SYNCHRONOUS `execFileSync` of `run.mjs dispatch-lane --num=<N>`, once per surfaced item, inside the
 *     resident runner's own tick.
 *
 * Blocking there would starve the rest of the tick, stop the singleton lease being heartbeated, and make
 * `run.mjs restart-runner` (`we:scripts/operations/restart-runner-io.mjs`, which SIGTERMs the supervisor and
 * takes the runner's process tree with it) kill a half-finished repair: a held lane, a lane ref pushed or not,
 * a PR left on `review:changes` with no stand-down marker and no re-arm. That is the parent epic's own
 * cross-cutting acceptance criterion, and this item's "Done when" clause 2, failing.
 *
 * So the block moves OUT of the runner, exactly as it did for `build`: this script is the separate process, the
 * provider spawns it `detached: true` (`setsid` — a new session leader, outside the runner's process group, so
 * a group signal never reaches it) and `.unref()`s it, the dispatch sink returns in milliseconds, and the
 * handle recorded is `pid:<n>`, whose liveness the KERNEL answers (`detached-dispatch.mjs#defaultIsPidAlive`)
 * rather than a `claude agents` listing this wrapper was never in. A RESTARTED runner re-reads that handle off
 * the run record and still gets a truthful `live: true`, so its double-dispatch guard holds.
 *
 * `#3629` IS NOT SUPERSEDED BY THIS — its design (minimal brief, wrapper owns the lifecycle, ONE converge pass
 * replacing the agent's own self-review) is implemented verbatim in `fix-dispatch-wrapper.mjs`. What diverges
 * is only WHERE that blocking arc runs, which #3629 could not have settled because `makeCliDispatchPass` and
 * `restart-runner` both postdate it.
 *
 * ── THE TWO THINGS THIS FILE DOES THAT ITS `build` SIBLING DOES NOT ─────────────────────────────────────────
 *
 *   1. IT IS PR-KEYED, NOT ITEM-KEYED. `dispatch-lane.mjs#sessionSlugFor` mints `fix-<PR>` for this kind (its
 *      own docblock explains why: a repair targets an existing PR, and there is no per-attempt suffix in that
 *      grammar). `fix-dispatch-wrapper.mjs#planFixDispatchWrapper` RE-DERIVES the same slug from the PR rather
 *      than importing it. Two independent derivations of one identity is a drift waiting to happen — and it is
 *      a load-bearing identity, because the fix report sidecar is keyed purely by that slug — so
 *      {@link assertSessionSlugAgrees} checks them against each other on every dispatch rather than trusting
 *      the coincidence.
 *   2. IT NEEDS AN `owner/repo` SLUG, which the dispatch effect payload does not carry. Resolved from the
 *      checkout's own `origin` remote ({@link resolveRepoSlug}), which is what `gh` itself would do — never
 *      defaulted to a literal, and never guessed from a directory basename
 *      (`we:scripts/lib/constellation-repos.mjs#repoKeyForDir` fails closed for exactly that reason).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dispatchFix, planFixDispatchWrapper, resolveFixAgentProvider } from './fix-dispatch-wrapper.mjs';
import { DEFAULT_DELIVERY_AGENT_PROVIDER_NAME } from './deliver-item-wrapper.mjs';
import { REPO_ROOT } from './detached-dispatch.mjs';

/** Refused rather than defaulted: a repair with no PR has nothing to resolve, and no session slug has nothing
 *  to key its report by. `num` (the item) is genuinely optional — `planFixDispatchWrapper` takes `item: null`
 *  and the brief's `$FIX_ITEM` is documented as "when known". */
const REQUIRED_FLAGS = Object.freeze(['pr', 'session']);

/**
 * PURE. `--k=v` argv → the shape {@link runFixCli} works with, refusing a missing required flag by NAME.
 * @param {string[]} argv
 * @returns {{pr: string, item: (string|null), sessionSlug: string, repo: (string|null), provider: string}}
 */
export function parseFixRunArgv(argv = []) {
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
      `fix-run: missing required flag(s) ${missing.map((m) => `--${m}=`).join(', ')} — `
      + 'a repair cannot resolve its PR or key its own report without them',
    );
  }
  const item = String(flags.num ?? '').trim();
  const repo = String(flags.repo ?? '').trim();
  return {
    pr: String(flags.pr).trim(),
    item: item || null,
    sessionSlug: String(flags.session).trim(),
    repo: repo || null,
    // #3383 (mechanical-dispatcher) — parsed, NOT validated, here: same split
    // `deliver-item-run.mjs#parseDeliverItemRunArgv` keeps for `build`'s own `--provider=`. This function stays
    // a PURE argv→shape mapper; `selectFixAgentProvider` below owns the name check and the default.
    provider: String(flags.provider ?? '').trim(),
  };
}

/**
 * #3383 (mechanical-dispatcher, Part 1) — WHICH CLI RUNS THE FIX AGENT. The SAME shape
 * `deliver-item-run.mjs#selectDeliveryAgentProvider` uses for `build`: an explicit `--provider=` beats the
 * default, and the default is unchanged (`claude-restricted`).
 *
 * #3840 (Fork 5 of #3801): the delivery-agent environment-variable fallback is RETIRED — a process-wide
 * variable applied to every dispatch of that process, with no reason and no per-item scope. The one override is
 * the item's own `deliveryAgent:` marker with a required `deliveryAgentReason:`, which the dispatcher passes
 * here as `--provider=`.
 *
 * Resolved BEFORE any lane is acquired or PR resolved (see {@link runFixCli}) — same reasoning as the build
 * kind's own resolver: a typo here must exit before real work starts, not after.
 *
 * @param {string} flagValue - the parsed `--provider=` value, `''` when absent.
 * @returns {{name: string, provider: object}}
 */
export function selectFixAgentProvider(flagValue) {
  const name = String(flagValue || DEFAULT_DELIVERY_AGENT_PROVIDER_NAME).trim();
  return { name, provider: resolveFixAgentProvider(name) };
}

/**
 * THE `owner/repo` SLUG, FROM THE CHECKOUT'S OWN `origin` REMOTE. Both the SSH (`git@host:owner/repo.git`) and
 * HTTPS (`https://host/owner/repo`) spellings are accepted, and a trailing `.git` is stripped — the same two
 * shapes `we:scripts/backlog.mjs` already has to handle (see its own note on the raw remote URL never being
 * stripped for it).
 *
 * REFUSES rather than falling back to a literal. A wrong repo slug here does not fail loudly — it makes
 * `gh pr view` answer about a DIFFERENT repository's PR of the same number, which is the worst available
 * outcome. `we:scripts/lib/constellation-repos.mjs` states the same fail-closed rule for its own lookups.
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
      `fix-run: could not read an \`owner/repo\` slug out of this checkout's origin remote (${JSON.stringify(url)}) `
      + '— pass `--repo=owner/repo` explicitly rather than letting a repair resolve a PR in the wrong repository',
    );
  }
  return m[1];
}

/**
 * THE PR-KEYED IDENTITY CHECK (see this file's header, difference 1). The dispatcher's slug
 * (`dispatch-lane.mjs#sessionSlugFor(num, 'fix', pr)` → `fix-<PR>`) and the wrapper's own
 * (`planFixDispatchWrapper` → `fix-<PR>`) are derived independently, and everything downstream — the fix report
 * sidecar, the completion record, this dispatch's log file — is keyed by one of them. A silent disagreement
 * would make the wrapper write its report under a slug the dispatcher never watches for.
 *
 * PURE. Throws rather than preferring one: which of the two is right is not knowable from here.
 * @returns {true}
 */
export function assertSessionSlugAgrees(dispatchedSlug, wrapperSlug) {
  if (String(dispatchedSlug) !== String(wrapperSlug)) {
    throw new TypeError(
      `fix-run: the dispatcher's session slug (${JSON.stringify(String(dispatchedSlug))}) and the wrapper's own `
      + `(${JSON.stringify(String(wrapperSlug))}) disagree. Both are derived from the PR independently — `
      + '`dispatch-lane.mjs#sessionSlugFor` and `fix-dispatch-wrapper.mjs#planFixDispatchWrapper` — and the fix '
      + 'report, the completion record and this dispatch\'s log are all keyed by the slug, so a repair run under '
      + 'a disagreement reports somewhere nobody is reading.',
    );
  }
  return true;
}

/**
 * THE CLI, AS A FUNCTION — extracted from the `IS_CLI` block for the same reason
 * `deliver-item-run.mjs#runDeliverItemCli` is: the argv parse, the exit-code mapping and the failure text are
 * all reachable from a test without a subprocess, without a real `claude`, and without a real `gh`.
 *
 * EXIT 1 MEANS THE REPAIR THREW, never that its outcome was disappointing. `dispatchFix` returns a `result`
 * string for every outcome it reasons about (`not-applicable`, `stood-down (...)`, `blocked-on-infra (no free
 * lane)`, `PR #N (re-armed review:pending)`) and releases what it holds in each; those are exit 0, because the
 * mechanism worked.
 *
 * @param {string[]} argv
 * @param {{dispatch?: Function, repoSlug?: Function, write?: Function, writeErr?: Function,
 *   selectProvider?: Function, env?: object}} [io]
 * @returns {Promise<{code: number, result: object|null}>}
 */
export async function runFixCli(argv = [], {
  dispatch = dispatchFix,
  repoSlug = resolveRepoSlug,
  write = (line) => process.stdout.write(line),
  writeErr = (line) => process.stderr.write(line),
  selectProvider = selectFixAgentProvider,
} = {}) {
  let launch;
  let selected;
  try {
    launch = parseFixRunArgv(argv);
    const repo = launch.repo ?? repoSlug();
    launch = { ...launch, repo };
    assertSessionSlugAgrees(
      launch.sessionSlug,
      planFixDispatchWrapper({ pr: launch.pr, repo, item: launch.item }).sessionSlug,
    );
    // #3383 — resolved BEFORE the repair starts, so a bad `--provider=` exits here rather than after a lane and
    // a claim have already been taken (see `selectFixAgentProvider`'s own docblock).
    selected = selectProvider(launch.provider);
  } catch (e) {
    writeErr(`error: ${String(e?.message ?? e)}\n`);
    return { code: 1, result: null };
  }
  write(
    `fix-run: starting repair of PR #${launch.pr}`
    + `${launch.item ? ` (item #${launch.item})` : ''} in ${launch.repo} `
    + `(session ${launch.sessionSlug}, provider ${selected.name}) — pid ${process.pid}\n`,
  );
  try {
    const result = await dispatch({ pr: launch.pr, repo: launch.repo, item: launch.item }, selected.provider);
    write(`fix-run: PR #${launch.pr} finished — ${result?.result ?? '(no result reported)'}\n`);
    return { code: 0, result };
  } catch (e) {
    writeErr(
      `fix-run: PR #${launch.pr} FAILED (lane released best-effort by the wrapper): ${String(e?.message ?? e)}\n`,
    );
    return { code: 1, result: null };
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code } = await runFixCli(process.argv.slice(2));
  process.exitCode = code;
}
