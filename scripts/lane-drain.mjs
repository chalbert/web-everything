#!/usr/bin/env node
/**
 * lane-drain.mjs — the deferred merge-queue drain (#2162, spine of #2138). CORE SLICE: drain-one-couple
 * (#2172) — land ONE already-queued lane couple onto main via the #2153 PR transport, in the manifest's
 * impl-first/WE-last order, then clear its queued marker.
 *
 * WHY (#2138 / #2162): today the integrator runs INLINE inside the producing `/workflow` run (Phase 4 of
 * `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`). The #2138 ruling relocates it into
 * a standalone command a human launches as ready lanes accumulate: every producing session (parallel or
 * solo #2123) stops at "lane pushed + marked ready-to-merge", and this drain lands the queue serially under
 * the SAME integrator contract. This file is the CORE that lands ONE couple; the outer monitor/watch loop
 * (#2173), the producer stop-at-push wiring (#2174), and the reopen-on-fail reconcile (#2175) are its
 * sibling slices under the #2162 epic. It consumes the three shipped primitives: the ready-to-merge token
 * (`we:scripts/readiness/queued-state.mjs`, #2161), the lane manifest (`we:scripts/readiness/lane-manifest.mjs`,
 * #2163), and the PR substrate (`we:scripts/pr-land.mjs`, #2153) — it re-uses pr-land, never re-implements
 * the merge.
 *
 * CONTRACT (the integrator invariants this preserves):
 *  - IMPL-FIRST / WE-LAST: land each repo's `lane/*` ref in `orderedRepos` order; WE carries the
 *    `active→resolved` flip and lands LAST, so a failed impl merge never leaves a false `resolved` (#96
 *    atomicity by ordering, not a distributed transaction). STOP the couple at the first repo that fails.
 *  - CROSS-ITEM blockedBy: a manifest may name other queued items that must land first — if any is still
 *    queued, this couple is NOT ready; report `waitOn` and drain nothing (the monitor #2173 retries later).
 *  - SINGLE CLEAR POINT: only after the WE (resolve-carrying) ref lands does the drain `unqueue` the item —
 *    the queued marker is cleared exactly once, at landing (#2161).
 *
 * The pure planner (`planDrain`, `buildPrLandArgs`) is unit-tested in scripts/__tests__/lane-drain.test.mjs;
 * the CLI owns git/pr-land/backlog at its boundary (mirrors pr-land.mjs / lane-review.mjs).
 *
 * Usage:
 *   node scripts/lane-drain.mjs drain-one 2153 --manifest=/path/to/.lane-manifest.json   # land the couple for #2153
 *   node scripts/lane-drain.mjs drain-one 2153 --manifest=… --dry-run                     # print the ordered pr-land plan, land nothing
 *   node scripts/lane-drain.mjs drain-one 2153 --manifest=… --body-file=pr-body.md        # attach a PR body (the #2170 dismissals) to each PR
 *   node scripts/lane-drain.mjs drain-one 2153 --manifest=… --json                        # machine-readable result
 *   node scripts/lane-drain.mjs drain                                                      # ONE cascade pass: drain every ready couple in the queue, then regen derived once (#2173)
 *   node scripts/lane-drain.mjs drain --dry-run --json                                     # plan the queue (ready/deferred/invalid), drain nothing
 *   node scripts/lane-drain.mjs watch --interval=30                                        # poll + drain, then keep waiting for new producer enqueues (human-launched; --max-idle=N to bound)
 *
 * SUBCOMMANDS: `drain-one` lands a KNOWN couple (the CORE, #2172). `drain`/`watch` are the OUTER monitor loop
 * (#2173): they poll queued.json, read each queued item's `.lane-manifest.json` off its WE lane ref, order by
 * cross-item blockedBy (a couple whose blockedBy is still queued DEFERS until a later pass), drain each ready
 * couple serially via `drain-one`, and regenerate WE derived artifacts ONCE at the end (the Phase 4c
 * relocation). `drain` = one cascade pass then exit; `watch` = also wait (poll `--interval`s) for producers to
 * enqueue more. The pure `planWatch(queuedState, manifestByNum)` decides ready/deferred order (unit-tested).
 *
 * The manifest path is supplied by the caller (the monitor #2173 reads each queued item's
 * `we:.lane-manifest.json` off its WE lane ref and passes it here) — drain-one lands a KNOWN couple; DISCOVERY
 * is the monitor's job. Exit codes: 0 = landed (or dry-run / not-ready-reported); 2 = a repo merge was RED /
 * failed (couple stopped, main left as far as it got); 3 = bad input (no manifest, invalid, not queued).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { parseQueued, isQueued, queuedNums } from './readiness/queued-state.mjs';
import { parseManifest, validateManifest, orderedRepos, MANIFEST_FILENAME } from './readiness/lane-manifest.mjs';

// ── flag parsing (mirrors pr-land.mjs / lane-review.mjs) ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const sub = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const posNum = argv[1] && !argv[1].startsWith('--') ? argv[1] : null;
const flags = {};
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const expandHome = (p) => (p && p.startsWith('~') ? p.replace(/^~/, homedir()) : p);

// Per-repo landing config (mirrors REPOS in the orchestrator): where each repo's checkout lives (WE = the
// drain's cwd = primary) and its own gate. pr-land runs gh/git in `path`; the PR's required CI check is the
// per-repo landing authority (#1937), so the drain does not re-run the gate itself.
export const DRAIN_REPOS = {
  we: { name: 'webeverything', path: null /* primary checkout = cwd */ },
  frontierui: { name: 'frontierui', path: '~/workspace/frontierui' },
  'plateau-app': { name: 'plateau-app', path: '~/workspace/plateau-app' },
};

// ── PURE helpers (unit-tested in scripts/__tests__/lane-drain.test.mjs) ────────────────────────────────

/**
 * Plan a single couple's drain from its manifest + the current queued state. Pure — decides ORDER,
 * readiness, and the resolve carrier without touching git. Returns:
 *   { ok, errors, ready, waitOn, steps:[{repo, ref, carriesResolve}], resolveRepo }
 *  - `ok:false` (+ errors) — the manifest is invalid or the item is not queued → the caller must not drain.
 *  - `ready:false` (+ waitOn) — a cross-item `blockedBy` dependency is still queued (unlanded) → defer.
 *  - `steps` — repos in impl-first/WE-last merge order (the exact pr-land sequence); `resolveRepo` = WE.
 */
export function planDrain(manifest, queuedState) {
  const v = validateManifest(manifest);
  if (!v.ok) return { ok: false, errors: v.errors, ready: false, waitOn: [], steps: [], resolveRepo: null };
  const num = String(manifest.item).padStart(3, '0');
  if (!isQueued(queuedState, num)) {
    return { ok: false, errors: [`#${num} is not queued (nothing to drain — the token says it is not ready-to-merge)`], ready: false, waitOn: [], steps: [], resolveRepo: null };
  }
  // A cross-item blockedBy that is STILL queued has not landed yet → this couple must wait (the monitor
  // retries once the predecessor drains). A blockedBy already off the queue is considered landed.
  const waitOn = (manifest.blockedBy ?? [])
    .map((n) => String(n).padStart(3, '0'))
    .filter((n) => isQueued(queuedState, n));
  const steps = orderedRepos(manifest).map((r) => ({ repo: r.repo, ref: r.ref, carriesResolve: !!r.carriesResolve }));
  const resolveRepo = (steps.find((s) => s.carriesResolve) || {}).repo || 'we';
  return { ok: true, errors: [], ready: waitOn.length === 0, waitOn, steps, resolveRepo };
}

/**
 * Build the `node scripts/pr-land.mjs …` argv for one repo's ref. Pure. `--no-ff` merge history is pr-land's
 * default; `--repo` is passed only for a non-primary (non-WE) repo (WE lands in the drain's cwd). A body
 * file (the #2170 dismissals PR body) is forwarded when supplied. `--json` so the drain reads the result.
 */
export function buildPrLandArgs({ ref, repoPath = null, bodyFile = null, dryRun = false } = {}) {
  const args = ['scripts/pr-land.mjs', `--ref=${ref}`, '--json'];
  if (repoPath) args.push(`--repo=${repoPath}`);
  if (bodyFile) args.push(`--body-file=${bodyFile}`);
  if (dryRun) args.push('--dry-run');
  return args;
}

/**
 * Plan a full watch/drain pass over the queued set (#2173 — the drain's OUTER loop). Pure — decides, from
 * the queued token + each queued item's manifest, WHICH couples are ready to land now and in what ORDER,
 * WITHOUT touching git. The CLI reads each manifest off its WE lane ref and injects them as `manifestByNum`
 * ({ paddedNum: manifest|null }); discovery is the CLI's job, the ordering decision is here (so it is
 * unit-tested, mirroring planDrain). Returns:
 *   { ready:[num…], deferred:[{num, waitOn:[num…]}], invalid:[{num, errors}], unresolvable:[num…] }
 *  - ready        — queued, manifest valid, and every cross-item blockedBy has already LEFT the queue (landed).
 *                   A couple whose blockedBy is another *queued* (unlanded) item is NOT ready — it waits. Since a
 *                   still-queued blocker defers its dependent, the ready set within a pass is mutually
 *                   independent; ordered by num for determinism. Cross-item CHAINS drain across passes: draining
 *                   the head clears it from the queue, so the next pass finds the dependent ready (the cascade).
 *  - deferred     — queued + valid but a cross-item blockedBy is still queued (unlanded) → a later pass retries.
 *  - invalid      — queued but its manifest fails validation → skip + report (never drained; a bad couple must
 *                   not wedge the queue).
 *  - unresolvable — queued but no manifest could be read off its lane ref (missing/unreadable) → skip + report.
 */
export function planWatch(queuedState, manifestByNum) {
  const nums = queuedNums(queuedState);
  const ready = [];
  const deferred = [];
  const invalid = [];
  const unresolvable = [];
  for (const num of nums) {
    const m = manifestByNum ? manifestByNum[num] : null;
    if (m == null) { unresolvable.push(num); continue; }
    const v = validateManifest(m);
    if (!v.ok) { invalid.push({ num, errors: v.errors }); continue; }
    const waitOn = (m.blockedBy ?? [])
      .map((n) => String(n).padStart(3, '0'))
      .filter((n) => isQueued(queuedState, n));
    if (waitOn.length === 0) ready.push(num);
    else deferred.push({ num, waitOn });
  }
  ready.sort((a, b) => a.localeCompare(b));
  return { ready, deferred, invalid, unresolvable };
}

// The WE derived-artifact regen set the drain reproduces ONCE at the end of a watch pass — the Phase 4c
// relocation (#2173): the same #1935 Fork-2 "regenerate-on-merge" generators the inline integrator ran
// (gen:inventory rebuilds the AGENTS.md inventory block; gen:reference-index rebuilds
// src/_data/referenceIndex.json). Lanes never commit these (they are derived), so the drain regenerates them
// once after the couples land rather than per-couple. Kept in lock-step with the orchestrator's 4c set.
export const DERIVED_REGEN = [
  ['npm', 'run', 'gen:inventory'],
  ['npm', 'run', 'gen:reference-index'],
];

// Allow importing the pure helpers without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli();

// The drain must run in the WE checkout (it reads WE's queued.json + drives WE's backlog.mjs). Resolve WE's
// git toplevel from cwd and use it as the anchor for EVERY WE-side call — so the WE land targets the real WE
// repo even if invoked from a subdir, rather than silently relying on cwd == WE root (review #1).
function resolveWeRoot() {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8' }).trim(); }
  catch { return process.cwd(); }
}

function runCli() {
  if (sub === 'watch' || sub === 'drain') return runWatch({ follow: sub === 'watch' });
  if (sub !== 'drain-one') {
    const detail = 'usage: `drain-one <NNN> --manifest=<path>` (land one queued couple) · `drain` (one cascade pass over the queue) · `watch` (poll + drain, --follow to keep waiting for producers)';
    if (flags.json) process.stdout.write(JSON.stringify({ landed: false, reason: 'usage', detail }) + '\n');
    else process.stderr.write(`lane-drain ✗ usage: ${detail}\n`);
    process.exit(3);
  }
  return runDrainOne();
}

function runDrainOne() {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  const CWD = resolveWeRoot();

  function emit(result, code) {
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    else process.stderr.write(`lane-drain ${result.landed ? '✓ landed' : result.reason === 'not-ready' ? '· not ready' : result.reason === 'dry-run' ? '· dry-run' : '✗ ' + (result.reason || 'failed')}: ${result.detail}\n`);
    process.exit(code);
  }

  if (!posNum) emit({ landed: false, reason: 'no-num', detail: 'pass the item number: drain-one <NNN> --manifest=<path>' }, 3);
  const num = String(posNum).padStart(3, '0');

  // WE-root sanity (review #1): CWD is the git toplevel; confirm it is actually the WE checkout (has pr-land
  // + the queued token) before landing, so a drain launched from the wrong repo fails loud, never lands WE
  // against a stranger.
  const queuedPath = resolve(CWD, '.claude/skills/batch-backlog-items/queued.json');
  try { readFileSync(resolve(CWD, 'scripts/pr-land.mjs'), 'utf8'); readFileSync(queuedPath, 'utf8'); }
  catch { emit({ landed: false, reason: 'not-we-root', detail: `cwd's git root (${CWD}) is not the WE checkout (no scripts/pr-land.mjs + queued.json) — run the drain from webeverything` }, 3); }

  // Load the manifest (caller-supplied path — discovery is the monitor's job, #2173).
  if (typeof flags.manifest !== 'string') emit({ landed: false, reason: 'no-manifest', detail: 'pass --manifest=<path to the item\'s .lane-manifest.json>' }, 3);
  let manifestText = '';
  try { manifestText = readFileSync(expandHome(flags.manifest), 'utf8'); } catch (e) { emit({ landed: false, reason: 'manifest-unreadable', detail: `cannot read --manifest=${flags.manifest} (${String(e.message || e).split('\n')[0]})` }, 3); }
  const manifest = parseManifest(manifestText);
  if (!manifest) emit({ landed: false, reason: 'manifest-invalid', detail: `--manifest=${flags.manifest} is not a valid manifest (unparseable JSON)` }, 3);

  // Read the current queued state (the #2161 token) offline.
  let queuedState;
  try { queuedState = parseQueued(readFileSync(queuedPath, 'utf8')); } catch { queuedState = parseQueued(''); }

  const plan = planDrain(manifest, queuedState);
  if (!plan.ok) emit({ landed: false, reason: 'plan-invalid', num, detail: plan.errors.join('; ') }, 3);
  if (!plan.ready) emit({ landed: false, reason: 'not-ready', num, waitOn: plan.waitOn, detail: `#${num} waits on unlanded queued dependency(ies): ${plan.waitOn.join(', ')} — defer (the monitor retries after they drain)` }, 0);

  // A body file is couple-wide — validate it up front (review #2), so a bad path fails BEFORE any repo
  // lands, never after a partial couple (which would need a #2175 reopen).
  const bodyFile = typeof flags['body-file'] === 'string' ? expandHome(flags['body-file']) : null;
  if (bodyFile) { try { readFileSync(bodyFile, 'utf8'); } catch { emit({ landed: false, reason: 'bad-body-file', num, detail: `--body-file=${flags['body-file']} is unreadable — fix it before draining (a couple-wide body must not fail mid-land)` }, 3); } }

  if (DRY_RUN) {
    const planLines = plan.steps.map((s) => {
      const rc = DRAIN_REPOS[s.repo];
      const rp = rc && rc.path ? expandHome(rc.path) : CWD;
      return `node ${buildPrLandArgs({ ref: s.ref, repoPath: rp, bodyFile, dryRun: true }).join(' ')}   # ${s.repo}${s.carriesResolve ? ' (carries resolve — lands LAST)' : ''}`;
    });
    emit({ landed: false, reason: 'dry-run', num, order: plan.steps.map((s) => s.repo), plan: planLines, detail: `would land #${num} across ${plan.steps.map((s) => s.repo).join(' → ')} (impl-first/WE-last), then unqueue` }, 0);
  }

  // Land each repo's ref in order; STOP at the first failure (impl-first/WE-last atomicity). Only after the
  // WE (resolve) ref lands do we unqueue — the single clear point (#2161).
  const landed = [];
  for (const step of plan.steps) {
    const repoCfg = DRAIN_REPOS[step.repo];
    const repoPath = repoCfg && repoCfg.path ? expandHome(repoCfg.path) : CWD; // WE = the resolved WE root (review #1), never implicit cwd
    const args = buildPrLandArgs({ ref: step.ref, repoPath, bodyFile });
    let res = null;
    try { res = JSON.parse(execFileSync('node', args, { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch (e) {
      // pr-land exits non-zero (red check / conflict / gh error) — its JSON is on stdout even then.
      try { res = JSON.parse(String(e.stdout || '').trim()); } catch { res = { merged: false, reason: 'pr-land-error', detail: String(e.message || e).split('\n')[0] }; }
    }
    if (res && res.merged) { landed.push(step.repo); continue; }
    // A repo failed → stop the couple here. WE never lands (if it was later), so the resolve never lands →
    // the item stays active/queued, never falsely resolved. The reopen-on-fail reconcile is #2175.
    emit({ landed: false, reason: 'merge-failed', num, stoppedAt: step.repo, landedRepos: landed, prLand: res, detail: `#${num} stopped at ${step.repo}: ${res ? res.detail : 'no result'} — earlier repos landed [${landed.join(', ') || 'none'}]; item stays queued (re-drain after fix). WE resolve NOT landed.` }, 2);
  }

  // Every repo landed (WE last) → confirm the WE resolve is reachable on origin/main, then clear the queued
  // marker. The resolve lives in backlog/<num>-<slug>.md; find the slug from the local tree, then read that
  // path off the freshly-fetched origin/main (git show needs the exact path — no globs).
  const gitC = (a) => execFileSync('git', a, { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tryGit = (a) => { try { return gitC(a); } catch { return null; } };
  let resolveReachable = null;
  try {
    tryGit(['fetch', 'origin', '--quiet']);
    const path = (tryGit(['ls-files', `backlog/${num}-*.md`]) || '').split('\n').filter(Boolean)[0];
    if (path) { const body = tryGit(['show', `origin/main:${path}`]); resolveReachable = body != null ? /^status:\s*resolved/m.test(body) : null; }
  } catch { resolveReachable = null; }

  // Gate the single clear point on the resolve actually being on main (review #3): if the check is
  // EXPLICITLY false (WE merged but the resolve is somehow not reachable), do NOT unqueue — leave it queued
  // and exit 2 so the item re-drains / the #2175 reconcile handles it, never a false clear. A `null` (couldn't
  // determine — e.g. offline fetch) is advisory: proceed with the unqueue, since pr-land reported merged.
  if (resolveReachable === false) {
    emit({ landed: false, reason: 'resolve-unreachable', num, landedRepos: landed, resolveReachable, detail: `#${num} merged all refs but its resolve is NOT reachable on origin/main — leaving it queued (re-drain / #2175 reconcile). Queued marker NOT cleared.` }, 2);
  }

  let unqueued = false;
  try { execFileSync('node', ['scripts/backlog.mjs', 'unqueue', num], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); unqueued = true; } catch { unqueued = false; }

  emit({ landed: true, reason: 'landed', num, landedRepos: landed, unqueued, resolveReachable, detail: `landed #${num} across ${landed.join(' → ')} (impl-first/WE-last)${unqueued ? ', unqueued' : ' (unqueue failed — clear it manually)'}` }, 0);
}

// ── watch/drain — the outer monitor loop (#2173) ───────────────────────────────────────────────────────
// Block the event loop for `sec` seconds without a busy-wait (follow mode's inter-poll sleep). A human
// Ctrl-Cs a `watch`; an automated caller bounds it with --max-idle.
function sleepSync(sec) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, sec) * 1000); } catch { /* env without SAB — skip the wait */ }
}

// Read the queued token offline (a corrupt/absent file degrades to an empty queue, never a crash).
function readQueued(queuedPath) {
  try { return parseQueued(readFileSync(queuedPath, 'utf8')); } catch { return parseQueued(''); }
}

// Read a queued item's `.lane-manifest.json` off its WE lane ref (the queued entry's `lane`). The manifest is
// a NEW file in the WE lane commit, so it is NOT on main yet — fetch the ref and read it out of the object,
// never the working tree. Returns a parsed manifest or null (missing ref / no manifest / bad JSON → the item
// is `unresolvable`, skipped-and-reported by planWatch, never drained).
function readManifestOffRef(CWD, ref) {
  if (!ref) return null;
  try { execFileSync('git', ['fetch', 'origin', ref, '--quiet'], { cwd: CWD, stdio: ['ignore', 'ignore', 'ignore'] }); } catch { /* best-effort; the ref may already be local */ }
  for (const rev of ['FETCH_HEAD', `origin/${ref}`, ref]) {
    try {
      const txt = execFileSync('git', ['show', `${rev}:${MANIFEST_FILENAME}`], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = parseManifest(txt);
      if (m) return m;
    } catch { /* try the next candidate rev */ }
  }
  return null;
}

// Drain ONE ready couple by spawning the drain-one subcommand (a fresh process per couple — drain-one owns the
// merge + single-clear-point and calls process.exit, so it cannot be re-entered in-process). Returns its JSON
// result (drain-one prints JSON to stdout even on a non-zero exit). This is the exact `lane-drain.mjs drain-one`
// invocation the item spec calls for.
function drainOneCouple(CWD, num, manifestPath, bodyFile) {
  const args = ['scripts/lane-drain.mjs', 'drain-one', num, `--manifest=${manifestPath}`, '--json'];
  if (bodyFile) args.push(`--body-file=${bodyFile}`);
  try {
    return JSON.parse(execFileSync('node', args, { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
  } catch (e) {
    try { return JSON.parse(String(e.stdout || '').trim()); } catch { return { landed: false, reason: 'spawn-error', detail: String(e.message || e).split('\n')[0] }; }
  }
}

// Regenerate the WE derived-artifact set ONCE (the Phase 4c relocation) after the couples land. Best-effort:
// a generator failure is reported, never fatal (the couples already landed; a stale derived artifact is a
// re-runnable follow-up, not a reason to unwind a green land).
function regenDerived(CWD) {
  const done = [];
  const failedGen = [];
  for (const cmd of DERIVED_REGEN) {
    try { execFileSync(cmd[0], cmd.slice(1), { cwd: CWD, stdio: ['ignore', 'ignore', 'pipe'] }); done.push(cmd.join(' ')); }
    catch (e) { failedGen.push({ cmd: cmd.join(' '), detail: String(e.message || e).split('\n')[0] }); }
  }
  return { done, failed: failedGen };
}

function runWatch({ follow }) {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  // Require an explicit `=N` value (a bare `--interval` sets flags.interval === true → would coerce to 1s).
  const interval = (typeof flags.interval === 'string' && Number(flags.interval) > 0) ? Number(flags.interval) : 30;
  // Idle polls to wait for NEW producer enqueues after the queue drains: follow (`watch`) waits forever by
  // default (a human Ctrl-Cs it); one-shot (`drain`) never waits. `--max-idle=N` bounds either (tests / cron).
  const maxIdle = typeof flags['max-idle'] === 'string' ? Number(flags['max-idle']) : (follow ? Infinity : 0);
  const bodyFile = typeof flags['body-file'] === 'string' ? expandHome(flags['body-file']) : null;
  const CWD = resolveWeRoot();
  const queuedPath = resolve(CWD, '.claude/skills/batch-backlog-items/queued.json');
  const log = (msg) => { if (!AS_JSON) process.stderr.write(`lane-drain · ${msg}\n`); };

  function fail(reason, detail, code) {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, reason, detail }) + '\n');
    else process.stderr.write(`lane-drain ✗ ${reason}: ${detail}\n`);
    process.exit(code);
  }

  // WE-root sanity (mirrors drain-one): the watch reads WE's queued.json + drives WE's drain-one, so a launch
  // from the wrong repo must fail loud, never poll a stranger's tree.
  try { readFileSync(resolve(CWD, 'scripts/pr-land.mjs'), 'utf8'); readFileSync(queuedPath, 'utf8'); }
  catch { fail('not-we-root', `cwd's git root (${CWD}) is not the WE checkout (no scripts/pr-land.mjs + queued.json) — run the drain from webeverything`, 3); }

  const tmpDir = mkdtempSync(join(tmpdir(), 'lane-drain-'));
  const landed = [];
  const failedCouples = [];
  const landedButQueued = []; // drain-one reported landed but its unqueue failed → item stuck in the queue (needs a manual clear); NEVER re-drained
  const attempted = new Set(); // couples this run already ran drain-one on — a hard guard so a land-but-unqueue-fail never re-drains an already-merged couple (the hot-loop hazard)
  let lastPlan = { ready: [], deferred: [], invalid: [], unresolvable: [] };
  let anyLanded = false;

  // One pass = read the queue, resolve each couple's manifest off its lane ref, plan, drain every READY couple
  // NOT YET ATTEMPTED this run. Cross-item CHAINS drain ACROSS passes (draining a head clears it from the
  // queue → the dependent is ready next pass), so this returns the count of NEW couples that landed this pass;
  // the caller loops while that is > 0. Progress is gated on a NEW couple landing, NOT on drain-one's `landed`
  // flag alone — a couple that lands but fails to unqueue stays in the queue, and the `attempted` guard stops
  // it re-planning as ready forever (the reviewed hot-loop hazard).
  function onePass() {
    const queuedState = readQueued(queuedPath);
    const manifestByNum = {};
    for (const q of queuedState.queued) manifestByNum[q.num] = readManifestOffRef(CWD, q.lane);
    const plan = planWatch(queuedState, manifestByNum);
    lastPlan = plan;
    if (plan.unresolvable.length) log(`unresolvable (no manifest on lane ref): ${plan.unresolvable.map((n) => '#' + n).join(', ')}`);
    if (plan.invalid.length) log(`invalid manifest (skipped): ${plan.invalid.map((i) => '#' + i.num).join(', ')}`);
    if (plan.deferred.length) log(`deferred (waits on unlanded dep): ${plan.deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}`);
    const toDrain = plan.ready.filter((num) => !attempted.has(num)); // never re-attempt a couple in one run
    if (DRY_RUN) { log(`dry-run: would drain ${toDrain.map((n) => '#' + n).join(', ') || 'nothing'} (impl-first/WE-last per couple)`); return 0; }
    let landedThisPass = 0;
    for (const num of toDrain) {
      attempted.add(num);
      const mpath = join(tmpDir, `${num}.lane-manifest.json`);
      writeFileSync(mpath, JSON.stringify(manifestByNum[num], null, 2));
      const res = drainOneCouple(CWD, num, mpath, bodyFile);
      if (res && res.landed) {
        landed.push(num); anyLanded = true; landedThisPass++;
        if (res.unqueued === false) { landedButQueued.push(num); log(`⚠ landed #${num} but its unqueue FAILED — still in the queue; clear it manually (won't re-drain)`); }
        else log(`✓ landed #${num}`);
      } else {
        failedCouples.push({ num, reason: res ? res.reason : 'spawn-failed', detail: res ? res.detail : '' });
        log(`✗ #${num} not landed (${res ? res.reason : 'spawn-failed'}) — left queued (${res ? res.detail : ''})`);
      }
    }
    return landedThisPass;
  }

  let idlePolls = 0;
  for (;;) {
    const n = onePass();
    if (n > 0) { idlePolls = 0; continue; } // a NEW couple landed — re-poll immediately (a landed head may free a dependent)
    if (idlePolls >= maxIdle) break;         // drained/stuck and no more idle budget → done
    idlePolls++;
    log(`queue drained/stuck — idle poll ${idlePolls}${maxIdle === Infinity ? '' : `/${maxIdle}`} (sleeping ${interval}s for new producer enqueues; Ctrl-C to stop)…`);
    sleepSync(interval);
  }

  // Regenerate WE derived artifacts ONCE at the end of the run (the Phase 4c relocation) — only if something
  // landed and we are not dry-running.
  let derived = { done: [], failed: [] };
  if (anyLanded && !DRY_RUN) {
    log(`regenerating WE derived artifacts once (${DERIVED_REGEN.map((c) => c.join(' ')).join(', ')})…`);
    derived = regenDerived(CWD);
    if (derived.failed.length) log(`⚠ derived regen partial: ${derived.failed.map((f) => f.cmd).join(', ')} failed — re-run by hand`);
  }

  // Clean up the per-run temp dir (the manifests handed to drain-one) — no orphaned tmp cruft.
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }

  // The honest completion signal is the QUEUE ITSELF: did everything drain? A non-empty queue at exit — a
  // failed couple, an invalid/unresolvable manifest, a couple that landed-but-didn't-unqueue, or a
  // permanently-deferred item whose blocker never landed — means the drain did NOT fully clear the queue, so
  // it must NOT report success (the reviewed stuck-queue-exits-0 defect). Read the post-run queue as truth
  // rather than trusting the in-loop flags. (A dry-run never mutates the queue, so it always exits 0.)
  const remainingQueue = DRY_RUN ? [] : queuedNums(readQueued(queuedPath));
  const fullyDrained = remainingQueue.length === 0;

  const result = {
    ok: true,
    mode: follow ? 'watch' : 'drain',
    dryRun: DRY_RUN,
    fullyDrained,
    landed,
    landedButQueued,
    failed: failedCouples,
    deferred: lastPlan.deferred,
    invalid: lastPlan.invalid,
    unresolvable: lastPlan.unresolvable,
    remainingQueue,
    derivedRegenerated: derived.done,
    derivedFailed: derived.failed,
    detail: `${DRY_RUN ? 'dry-run: ' : ''}landed ${landed.length} couple(s)${landed.length ? ` (${landed.map((n) => '#' + n).join(', ')})` : ''}${failedCouples.length ? `, ${failedCouples.length} failed (left queued)` : ''}${landedButQueued.length ? `, ${landedButQueued.length} landed-but-not-cleared` : ''}${lastPlan.deferred.length ? `, ${lastPlan.deferred.length} deferred` : ''}${!DRY_RUN && !fullyDrained ? `, ${remainingQueue.length} still queued` : ''}`,
  };
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stderr.write(`lane-drain ${follow ? 'watch' : 'drain'} ${fullyDrained ? '✓' : '⚠'} ${result.detail}\n`);
  // Exit 0 ONLY when the queue fully drained (nothing left needing attention); else 2. A dry-run reports 0
  // (it plans, never drains) — its plan is in the JSON.
  process.exit(DRY_RUN || fullyDrained ? 0 : 2);
}
