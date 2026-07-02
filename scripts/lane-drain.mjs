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
 *
 * The manifest path is supplied by the caller (the monitor #2173 reads each queued item's
 * `we:.lane-manifest.json` off its WE lane ref and passes it here) — drain-one lands a KNOWN couple; DISCOVERY
 * is the monitor's job. Exit codes: 0 = landed (or dry-run / not-ready-reported); 2 = a repo merge was RED /
 * failed (couple stopped, main left as far as it got); 3 = bad input (no manifest, invalid, not queued).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseQueued, isQueued } from './readiness/queued-state.mjs';
import { parseManifest, validateManifest, orderedRepos } from './readiness/lane-manifest.mjs';

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

// Allow importing the pure helpers without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli();

function runCli() {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  // The drain must run in the WE checkout (it reads WE's queued.json + drives WE's backlog.mjs). Resolve WE's
  // git toplevel from cwd and use it as the anchor for EVERY WE-side call — so the WE land targets the real WE
  // repo even if invoked from a subdir, rather than silently relying on cwd == WE root (review #1).
  let CWD;
  try { CWD = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8' }).trim(); }
  catch { CWD = process.cwd(); }

  function emit(result, code) {
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    else process.stderr.write(`lane-drain ${result.landed ? '✓ landed' : result.reason === 'not-ready' ? '· not ready' : result.reason === 'dry-run' ? '· dry-run' : '✗ ' + (result.reason || 'failed')}: ${result.detail}\n`);
    process.exit(code);
  }

  if (sub !== 'drain-one') emit({ landed: false, reason: 'usage', detail: 'the core slice offers `drain-one <NNN> --manifest=<path>` (land one queued couple). The monitor loop is #2173.' }, 3);
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
