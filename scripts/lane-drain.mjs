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
 * POST-DRAIN RECONCILE (#2175): after each couple, `planPostDrain` decides the cleanup. On a LANDED couple the
 * drain deletes the `.lane-manifest.json` it carried onto main (post-land cleanup). On a FAILED couple
 * (merge red / resolve unreachable) it reconciles the stranded WE item `active→open` (`release --force`) so it
 * honestly re-enters as not-being-worked — WHILE the queued marker + `lane/*` refs are PRESERVED for the next
 * drain pass to retry (the drain-side of the #2072 closeout). Housekeeping publishes via the SANCTIONED
 * `push-if-green.mjs` helper — never a raw main push (the #2172 transport contract).
 *
 * The pure planners (`planDrain`, `planWatch`, `planPostDrain`, `buildPrLandArgs`) are unit-tested in
 * scripts/__tests__/lane-drain.test.mjs; the CLI owns git/pr-land/backlog at its boundary (mirrors
 * pr-land.mjs / lane-review.mjs).
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
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { parseQueued, isQueued, queuedNums } from './readiness/queued-state.mjs';
import { parseManifest, validateManifest, orderedRepos, extractManifestFromBody, MANIFEST_FILENAME } from './readiness/lane-manifest.mjs';
import { isHash, isNum, idFromName, applyLedger, swapHashes } from './backlog/id.mjs';
import { withNumberingLock, acquireDrainLease, heartbeatDrainLease, releaseDrainLease, drainLeaseStatus, drainOwner, DRAIN_LOCK_ROOT } from './readiness/drain-lock.mjs'; // #2391 dual-lock: numbering mutex + whole-process drain lease

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

// The exact files those generators write — the ONLY paths a post-land regen commit may carry. A regen commit
// must be scoped to these by an explicit pathspec, NEVER a bare `git diff --name-only` sweep: the drain runs in
// a checkout that can carry unrelated dirty tracked files (a concurrent session's in-flight claim), and a broad
// diff would sweep those FOREIGN edits into the "derived artifacts" commit and publish them (the shared-index
// commit race — same hazard `finalizeLand`'s explicit pathspec guards against). Kept in lock-step with
// DERIVED_REGEN above: one entry per generator's output.
export const DERIVED_OUTPUT_PATHS = ['AGENTS.md', 'src/_data/referenceIndex.json'];

/**
 * Decide the post-drain reconcile for a couple, from a drain-one result (#2175 reopen-on-fail). Pure — the
 * git/backlog actions are the CLI boundary. Returns `{ deleteManifest, reopen }`:
 *  - `deleteManifest` — the couple LANDED: its `.lane-manifest.json` rode the WE lane commit onto main, so the
 *    drain deletes it post-land (main carries no post-drain cruft; the manifest doc's "delete at landing").
 *  - `reopen` — the couple FAILED to land (a repo merge red, or the WE resolve is unreachable): the WE item is
 *    stranded `active` on main with no live session. Reconcile it `active→open` (the drain-side of the #2072
 *    closeout) so it honestly re-enters as not-being-worked — WHILE the queued marker + `lane/*` refs are
 *    PRESERVED (the drain never unqueues or deletes refs on failure), so the NEXT drain pass retries it.
 * A not-ready / dry-run / bad-input result reconciles nothing.
 */
export function planPostDrain(result) {
  const r = result || {};
  if (r.landed === true) return { deleteManifest: true, reopen: false };
  // Only a genuine land FAILURE reopens — not a defer (not-ready), a dry-run, or bad input (which never touched main).
  const failed = r.reason === 'merge-failed' || r.reason === 'resolve-unreachable';
  return { deleteManifest: false, reopen: failed };
}

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
    // the item stays active/queued, never falsely resolved. REOPEN-ON-FAIL (#2175): reconcile the stranded WE
    // item active→open (keeping its queue marker + lane/* refs) so it honestly re-enters as not-being-worked.
    const reopen = reopenStrandedItem(CWD, num);
    emit({ landed: false, reason: 'merge-failed', num, stoppedAt: step.repo, landedRepos: landed, prLand: res, reopened: reopen.reopened, reopenPushed: reopen.pushed, detail: `#${num} stopped at ${step.repo}: ${res ? res.detail : 'no result'} — earlier repos landed [${landed.join(', ') || 'none'}]; item stays queued (re-drain after fix)${reopen.reopened ? ', reopened active→open (#2175)' : ''}. WE resolve NOT landed.` }, 2);
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
    // REOPEN-ON-FAIL (#2175): all refs merged but the resolve isn't reachable — treat as a failed land, leave it
    // queued (marker NOT cleared), and reconcile the stranded item active→open (queue + refs preserved).
    const reopen = reopenStrandedItem(CWD, num);
    emit({ landed: false, reason: 'resolve-unreachable', num, landedRepos: landed, resolveReachable, reopened: reopen.reopened, reopenPushed: reopen.pushed, detail: `#${num} merged all refs but its resolve is NOT reachable on origin/main — leaving it queued (re-drain)${reopen.reopened ? ', reopened active→open (#2175)' : ''}. Queued marker NOT cleared.` }, 2);
  }

  // SUCCESS reconcile (#2175): sync local main to the merged origin/main, then unqueue + delete the manifest it
  // carried, in one commit, and publish (the single clear point + main-cleanup, all post-land).
  const fin = finalizeLand(CWD, num);
  // The couple's own assigned NNN (if it was a provisional hash) + any leftover hashes numbered alongside.
  const numberedList = (fin.numbered && fin.numbered.committed) ? fin.numbered.assigned : [];
  const assigned = (numberedList.find((a) => a.hash === num) || {}).nnn || null;
  const alsoNumbered = numberedList.filter((a) => a.hash !== num);

  emit({ landed: true, reason: 'landed', num, assignedNum: assigned, alsoNumbered, landedRepos: landed, unqueued: fin.unqueued, manifestDeleted: fin.manifestDeleted, mainPushed: fin.pushed, resolveReachable, detail: `landed #${num}${assigned ? ` → #${assigned} (JIT numbered)` : ''} across ${landed.join(' → ')} (impl-first/WE-last)${fin.unqueued ? ', unqueued' : ' (unqueue failed — clear it manually)'}${fin.manifestDeleted ? ', manifest cleaned' : ''}${alsoNumbered.length ? `, +${alsoNumbered.length} leftover(s) numbered (${alsoNumbered.map((a) => '#' + a.nnn).join(', ')})` : ''}${fin.pushed ? ', main published' : ''}` }, 0);
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

// Read a queued item's manifest for its WE lane `ref` (the queued entry's `lane`). Returns a parsed manifest
// or null (no manifest anywhere → the item is `unresolvable`, skipped-and-reported by planWatch, never drained).
//
// xnsk54v — the manifest now rides the PR BODY (drain-only orchestration metadata belongs on the PR, not
// committed into the tree). Try the PR first via `gh pr list --head <ref>`; fall back to the legacy
// tree-committed `.lane-manifest.json` off the ref for lanes queued BEFORE the cutover (drop the tree fallback
// once the queue has fully turned over). Reading off an object/PR — never the working tree.
function readManifestFromPrBody(CWD, ref) {
  try {
    const out = execFileSync('gh', ['pr', 'list', '--head', ref, '--state', 'open', '--json', 'body'], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return extractManifestFromBody(JSON.parse(out)?.[0]?.body);
  } catch { return null; } // gh absent / no open PR for the ref / no block → fall through to the ref file
}

function readManifestOffRef(CWD, ref) {
  if (!ref) return null;
  const fromPr = readManifestFromPrBody(CWD, ref);
  if (fromPr) return fromPr;
  // Legacy fallback: the tree-committed manifest is a NEW file in the WE lane commit, not on main yet — fetch
  // the ref and read it out of the object.
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

// A quiet, never-throwing git helper for the reconcile ops (best-effort — a failure is reported, never fatal:
// the LAND already succeeded/failed, and reconcile is cleanup on top of it).
function quietGit(CWD, a) {
  try { return execFileSync('git', a, { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

/** #2225 — the post-land heal/regen/numbering dirty-probe. These steps `git checkout --detach origin/main`
 *  and operate on POST-MERGE main, so untracked / git-ignored noise is irrelevant to their correctness — but
 *  a deps-symlinked lane clone (#2123, now the default solo-lane path) always carries an untracked
 *  `node_modules` SYMLINK (`.gitignore` has `node_modules/`, which matches a directory, not the symlink), so
 *  a bare `git status --porcelain` read as dirty and SKIPPED heal + regen on EVERY land from such a clone.
 *  Count only TRACKED modifications (which a detached checkout can carry over and wrongly sweep into the
 *  post-land commit); ignore untracked entries and any `node_modules` line. Feed it
 *  `git status --porcelain --untracked-files=no`. Pure. Shared single source (#2348) — pr-land.mjs
 *  re-exports this rather than forking its own copy; merge-ai-prs.mjs's JIT-numbering resync (below) uses it
 *  too, both via lane-drain.mjs (never a duplicate implementation, never a cross-import cycle). */
export function isPostLandTreeDirty(porcelainUntrackedNo) {
  return String(porcelainUntrackedNo || '')
    .split('\n')
    .some((l) => l.trim() !== '' && !/(^|[\s/])node_modules(\/|$|\s)/.test(l));
}

const QUEUED_REL = '.claude/skills/batch-backlog-items/queued.json';
// The hash→NNN ledger (#2288): the drain's local record of every hash it has already numbered, so a LATER
// couple that references an already-landed blocker by its old hash still resolves to the real number. Lives
// alongside the queued token — LOCAL-ONLY, gitignored drain state (Rule #105, like queued.json): it
// persists in the drain's checkout across invocations but never lands on main. APPEND-ONLY — it is never
// reset (a still-in-flight lane may reference a hash long before it is queued, so a queue-empty reset would
// drop a mapping a dependent still needs); entries are tiny, so unbounded growth is negligible.
const LEDGER_REL = '.claude/skills/batch-backlog-items/id-ledger.json';

/**
 * JIT numbering (#2288) — the one place a backlog id is minted. Numbers EVERY provisional (hash-keyed)
 * backlog file now present on main, not just the couple's own id: a landed lane can carry LEFTOVER items
 * scaffolded during close-out (born hash-keyed), and those need numbering too. A hash file only reaches
 * main via a landed lane (the sole-writer path), so sweeping all hash files touches only already-landed
 * content — never an item still in flight in another lane. Assigns DETERMINISTIC contiguous `max+1` in
 * topological (blockedBy) order — the drain is the sole SERIAL writer to main (#2290), so unlike scaffold's
 * randomized gap-fill (#2292, which only exists to stop PARALLEL births colliding) there is no collision to
 * avoid; max+1 keeps numbers contiguous (the #2288 "no burned gap numbers" goal). Records each `hash→NNN`
 * in the ledger, then blind-replaces EVERY ledgered hash across all `backlog/*.md` (filenames + contents) —
 * numbering each item AND repairing any cross-lane `blockedBy`/`parent`/`#ref` that still points at an
 * already-numbered blocker by its old hash. Commits the rename+rewrites in ONE scoped commit; the caller
 * publishes. Best-effort like the rest of the reconcile: a failure is reported, the land stands.
 */
export function numberPendingHashes(CWD, { dryRun = false } = {}) {
  const BL = join(CWD, 'backlog');
  let stems;
  try { stems = readdirSync(BL).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')); }
  catch { return { assigned: [], committed: false, error: 'cannot read backlog/' }; }
  // Number only TRACKED hash files — a hash file reaches main solely via a landed lane, so it is committed.
  // An UNTRACKED hash `.md` in the checkout is local cruft (an uncommitted scaffold), NOT a landed item:
  // including it would make `git rm` fail and abort numbering for the real landed couple (PR #194 review).
  const trackedStems = new Set((quietGit(CWD, ['ls-files', 'backlog/*.md']) || '')
    .split('\n').filter(Boolean).map((f) => f.replace(/^backlog\//, '').replace(/\.md$/, '')));
  const pending = stems.filter((s) => isHash(idFromName(s)) && trackedStems.has(s)); // tracked hash files = landed in-flight items to number
  if (pending.length === 0) return { assigned: [], committed: false };

  const files = stems.map((name) => ({ name, content: readFileSync(join(BL, `${name}.md`), 'utf8') }));
  const contentByName = new Map(files.map((f) => [f.name, f.content]));

  // Order the pending hashes TOPOLOGICALLY: a pending item whose blockedBy names ANOTHER pending hash is
  // numbered AFTER it (referenced item first, #2288). Cosmetic for correctness (applyLedger repairs every
  // ref regardless) but keeps assignment deterministic + contiguous by dependency depth. Grab blockedBy
  // hash tokens whether the YAML is flow-style (`[…]`) or block-style (`\n  - x…`) — the token pattern is
  // the same either way.
  const pendingHashes = new Set(pending.map(idFromName));
  const blockersOf = (stem) => {
    const m = contentByName.get(stem).match(/^blockedBy:\s*(\[[^\]]*\]|(?:\n[ \t]*-[ \t]*.+)+)/m);
    return m ? (m[1].match(/x[0-9a-z]{6}/g) || []).filter((h) => pendingHashes.has(h)) : [];
  };
  const ordered = [];
  const done = new Set();
  const remaining = [...pending].sort(); // stable base order
  while (remaining.length) {
    const i = remaining.findIndex((s) => blockersOf(s).every((h) => done.has(h)));
    const [stem] = i >= 0 ? remaining.splice(i, 1) : remaining.splice(0, 1); // cycle → break by taking the first
    ordered.push(stem); done.add(idFromName(stem));
  }

  // Assign contiguous max+1 in that order; record in the LOCAL ledger.
  let maxNum = stems.map(idFromName).filter(isNum).reduce((m, n) => Math.max(m, Number(n)), 0);
  const ledgerAbs = join(CWD, LEDGER_REL);
  let ledger = {};
  try { ledger = JSON.parse(readFileSync(ledgerAbs, 'utf8')) || {}; } catch { ledger = {}; }
  const assigned = [];
  for (const stem of ordered) {
    const hash = idFromName(stem);
    maxNum += 1;
    const nnn = String(maxNum).padStart(3, '0');
    ledger[hash] = nnn;
    assigned.push({ hash, nnn });
  }

  // applyLedger numbers each item AND stamps its bornAs:<hash> proof-of-land (#2392) — the durable,
  // cross-clone, renumber-immune landed record read back via landedNumberFor. Derived from the same
  // ledger that assigns the number, so the local id-ledger.json (numbering bookkeeping) and
  // bornAs-on-main (the sole cross-clone landed proof) cannot diverge. It also returns pathRenames
  // (#2400) — co-referenced ON-DISK report files whose stem embeds a numbered hash.
  const { renames, rewrites, pathRenames } = applyLedger(files, ledger);
  // #2400 — path-value refs are derived from UNTRUSTED backlog content, so CONFINE them to inside the repo
  // before acting: a crafted `relatedReport`/body token like `../../../outside/notes-<hash>.md` would
  // otherwise make `writeFileSync(join(CWD, to))` + `git rm from` write outside the tree and delete an
  // arbitrary file. Reject any absolute path or any token that escapes CWD after resolve (both `from` and
  // `to`), then keep only those whose file actually exists on disk (a bare URL / prose mention resolves to
  // no file and is a harmless no-op). Survivors get a `git rm` OLD + write-to-NEW + internal-ref rewrite below.
  const repoRoot = resolve(CWD);
  const inRepo = (p) => typeof p === 'string' && p !== '' && !isAbsolute(p) &&
    (resolve(CWD, p) === repoRoot || resolve(CWD, p).startsWith(repoRoot + sep));
  const livePathRenames = pathRenames.filter(({ from, to }) =>
    inRepo(from) && inRepo(to) && existsSync(join(CWD, from)));
  // #2319 — `number-stranded --dry-run`: report the planned mapping + renames without touching the tree/index.
  if (dryRun) return {
    assigned, committed: false, dryRun: true,
    renamed: renames.map((r) => r.to),
    wouldRename: [...renames, ...livePathRenames].map((r) => ({ from: r.from, to: r.to })),
  };
  const rewriteByName = new Map(rewrites.map((r) => [r.name, r.content]));
  const renameFroms = new Set(renames.map((r) => r.from));
  // A rename is `git rm OLD` + write-to-NEW (NOT `git mv`): a scoped `git commit -- <paths>` is pathspec
  // mode (it errors on a rename staged in the index / the now-absent old path), but it DOES commit a
  // `git rm` deletion — the pattern finalizeLand uses for the manifest. `toAdd` = paths that EXIST on disk
  // (a `git add` of an already-rm'd old path errors and aborts the whole add); `commitPaths` also carries
  // the deleted old paths so the pathspec commit records the deletion (already staged by `git rm`).
  const toAdd = [];
  const commitPaths = [];
  for (const { name, content } of rewrites) {
    if (renameFroms.has(name)) continue; // a renamed file's content is written to its NEW path below
    writeFileSync(join(BL, `${name}.md`), content);
    toAdd.push(`backlog/${name}.md`); commitPaths.push(`backlog/${name}.md`);
  }
  for (const { from, to } of renames) {
    const content = rewriteByName.has(from) ? rewriteByName.get(from) : readFileSync(join(BL, `${from}.md`), 'utf8');
    writeFileSync(join(BL, `${to}.md`), content);
    if (quietGit(CWD, ['rm', '--quiet', `backlog/${from}.md`]) == null)
      return { assigned, committed: false, error: `git rm ${from} failed` };
    toAdd.push(`backlog/${to}.md`);
    commitPaths.push(`backlog/${from}.md`, `backlog/${to}.md`);
  }
  // #2400 — rename each co-referenced ON-DISK file (a `relatedReport`, a body link to `reports/…-<hash>.md`)
  // whose stem embeds a numbered hash, and rewrite its internal self-refs (`/slice <hash>`, `#<hash>`) with
  // the same whole-ledger blind swap. Without this the item's rewritten ref dangles + the report is hidden →
  // the #2387 red-main regression. These paths live OUTSIDE `backlog/`, so `git rm` + write-to-new, not `git mv`.
  const ledgerEntries = Object.entries(ledger).filter(([h]) => isHash(h));
  for (const { from, to } of livePathRenames) {
    const content = swapHashes(readFileSync(join(CWD, from), 'utf8'), ledgerEntries);
    writeFileSync(join(CWD, to), content);
    if (quietGit(CWD, ['rm', '--quiet', from]) == null)
      return { assigned, committed: false, error: `git rm ${from} failed` };
    toAdd.push(to);
    commitPaths.push(from, to);
  }
  // APPEND-ONLY — never reset. A lane can reference a hash while merely IN-FLIGHT (being worked), long
  // before it is queued, so resetting when the ready-to-merge queue drains would drop the mapping a
  // still-in-flight dependent needs → its edge would land as a dangling hash (PR #194 review, blocking).
  // Entries are tiny (`hash→NNN`); the ledger is LOCAL-ONLY, gitignored, machine-disposable drain
  // bookkeeping (Rule #105) that never lands on main, so unbounded growth is negligible (a TTL prune is a
  // possible future refinement, not a correctness need).
  writeFileSync(ledgerAbs, JSON.stringify(ledger, null, 2) + '\n');
  quietGit(CWD, ['add', '--', ...new Set(toAdd)]); // stage rewrites + new renamed files (deletions already staged by git rm; ledger stays untracked)
  const paths = [...new Set(commitPaths)];
  const summary = assigned.map((a) => `${a.hash}→#${a.nnn}`).join(', ');
  const committed = quietGit(CWD, ['commit', '-m', `drain: JIT-number ${summary} at land (#2288)`, '--', ...paths]) != null;
  return { assigned, committed, renamed: [...renames, ...livePathRenames].map((r) => r.to), changedPaths: paths };
}

/**
 * Resolve a birth-hash to the NNN it LANDED as, by reading the sole cross-clone proof-of-land: the
 * `bornAs:<hash>` line `numberPendingHashes` stamped into a numbered item's frontmatter on origin/main
 * (#2392). Returns the landed NNN string, or null when the hash has no bornAs record on main (it has not
 * landed). Unlike the local `id-ledger.json` — per-clone numbering bookkeeping, invisible to other
 * clones — this reads the SHARED main tree, so any clone can ask "did hash X land, and as what number?".
 * That is the durable, renumber-immune lookup the serial-batch→drain coordination gate (#2387) needs;
 * bornAs is derived from the ledger at land, so the two never disagree. Best-effort: a git failure (no
 * origin/main ref, no match) reads as "not landed" → null.
 * @param {string} hash  the item's birth hash (`x`+6 base36)
 * @param {string} [CWD]  a clone whose origin/main carries the landed backlog
 * @returns {string|null}
 */
export function landedNumberFor(hash, CWD = resolveWeRoot()) {
  if (!isHash(hash)) return null;
  // Whole-line match on origin/main so a longer token can never partial-hit; `-l` lists the matching
  // path(s) as `origin/main:backlog/NNN-slug.md` — the NNN in that path is the landed number.
  const out = quietGit(CWD, ['grep', '-l', '-E', `^bornAs: ${hash}$`, 'origin/main', '--', 'backlog/']);
  if (!out) return null;
  const line = out.split('\n').find(Boolean) || '';
  const m = line.match(/backlog\/(\d{1,5})-.*\.md$/);
  return m ? m[1] : null;
}

// Sync local main to the merged origin/main via a LOCAL fast-forward (never a work-merge — the couple's work
// is landed by pr-land, #2172 contract). `pull --ff-only` fetches + ff's the current branch; a non-ff / dirty
// collision aborts and we degrade gracefully (best-effort). Never touches a lane/* ref.
function syncMain(CWD) { quietGit(CWD, ['pull', '--ff-only']); }

// Publish local main to origin via the SANCTIONED gated-push helper (#2073) — never a raw git write of the
// branch (the #2172 contract: lane-drain re-uses the shared transports, never re-implements them). The
// couple's tree was just gated by pr-land's required CI, so `--assume-green` skips the redundant re-gate (the
// documented integrator path). ff-only inside the helper; a non-ff leaves origin untouched and is reported.
function publishMain(CWD) {
  try { const r = JSON.parse(execFileSync('node', ['scripts/push-if-green.mjs', '--assume-green', '--json'], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()); return !!r.pushed; }
  catch (e) { try { return !!JSON.parse(String(e.stdout || '').trim()).pushed; } catch { return false; } }
}

// SUCCESS reconcile (#2175): the couple landed via PR onto ORIGIN/main, so sync local main to it, then UNQUEUE
// + DELETE the `.lane-manifest.json` it carried, in ONE commit, and publish. Best-effort at every step — a
// leftover manifest / un-pushed unqueue is recoverable cruft, never a reason to unwind a successful landing.
function finalizeLand(CWD, num) {
  syncMain(CWD); // bring the merged origin/main (incl. the manifest the WE lane commit carried) local
  // Clear the queued marker (the single clear point) + stage the manifest deletion if it's tracked on main.
  let unqueued = false;
  try { execFileSync('node', ['scripts/backlog.mjs', 'unqueue', num], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); unqueued = true; } catch { unqueued = false; }
  let manifestDeleted = false;
  if (quietGit(CWD, ['ls-files', MANIFEST_FILENAME])) manifestDeleted = quietGit(CWD, ['rm', '--quiet', MANIFEST_FILENAME]) != null;
  // Commit ONLY this couple's paths via an explicit `-- <pathspec>` — a bare `git commit` would sweep any
  // foreign STAGED hunks (a concurrent session, a pre-staged tree) into the drain's commit and publish them
  // (the shared-index commit race). The pathspec form commits exactly these paths' index+worktree state (the
  // `git rm` deletion + the unqueue edit), ignoring the rest of the index — never `git add -A`.
  const commitPaths = manifestDeleted ? [QUEUED_REL, MANIFEST_FILENAME] : [QUEUED_REL];
  let pushed = false;
  const unqueueCommitted = quietGit(CWD, ['commit', '-m', `drain: unqueue + cleanup #${num} lane manifest post-land (#2175)`, '--', ...commitPaths]) != null;
  // JIT numbering (#2288): AFTER unqueue (so the ledger-reset check sees the emptied queue), number every
  // provisional hash file the couple landed — the couple's own hash AND any leftover items scaffolded in
  // its lane during close-out. A couple that carried no hash files (a legacy numeric item) is a no-op. The
  // single publish below pushes the unqueue commit and the numbering commit to main together.
  //
  // #2391 — number+publish is the NUMBERING CRITICAL SECTION (sole-serial-writer, #2288/#2290). Wrap it in the
  // TTL-bounded numbering mutex so two concurrent lands never both mint an NNN off the same base. A crashed
  // holder expires by the lease; a pathological live-contention falls through un-locked (reported), never hangs.
  const numLock = withNumberingLock(() => {
    const numbered = numberPendingHashes(CWD);
    const pushed = (unqueueCommitted || numbered.committed) ? publishMain(CWD) : false;
    return { numbered, pushed };
  });
  const numbered = numLock.result.numbered;
  pushed = numLock.result.pushed;
  if (numLock.contended) process.stderr.write(`lane-drain ⚠ #${num}: numbering mutex not acquired (held by ${numLock.heldBy || '?'}) — numbered+published without it (#2391); the #2318 duplicate-NNN tripwire is the backstop\n`);
  return { unqueued, manifestDeleted, pushed, numbered };
}

// FAILURE reconcile (#2175 reopen-on-fail): a couple that failed to land leaves the WE item STRANDED `active`
// on main with no live session. Flip it `active→open` (`release --force`) so it honestly re-enters as
// not-being-worked — release touches NEITHER the queued marker NOR the `lane/*` refs, so the couple stays
// queued with its durable refs for the NEXT drain pass to retry. Best-effort commit + publish of the flip.
function reopenStrandedItem(CWD, num) {
  syncMain(CWD); // reconcile against the merged state before reading/writing the item's status
  try { execFileSync('node', ['scripts/backlog.mjs', 'release', num, '--force'], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { return { reopened: false, pushed: false }; } // not `active` (already open/resolved, or another session owns it) → leave it
  const path = (quietGit(CWD, ['ls-files', `backlog/${num}-*.md`]) || '').split('\n').filter(Boolean)[0];
  let pushed = false;
  if (path) {
    // Scope the commit to ONLY this item's backlog file (explicit `-- <path>`) — never a bare commit that would
    // absorb a foreign staged hunk (the shared-index commit race).
    if (quietGit(CWD, ['commit', '-m', `drain: reopen stranded #${num} after failed land (#2175)`, '--', path]) != null) pushed = publishMain(CWD);
  }
  return { reopened: true, pushed };
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

  // #2391 — WHOLE-PROCESS DRAIN LEASE: at most one drain runs at a time. Acquire it for this run's full
  // lifetime; a second launch that finds a LIVE lease no-ops (its couples are already being landed), while a
  // STALE lease (a crashed drain) is reclaimed via the TTL. Heartbeated each pass; released at the end. A
  // DRY-RUN lands nothing, so it does NOT take the exclusive lease — it must be free to PLAN alongside a live
  // drain (and never block a real one launched right after it).
  const leaseOwner = drainOwner();
  if (!DRY_RUN) {
    const lease = acquireDrainLease(DRAIN_LOCK_ROOT, leaseOwner);
    if (!lease.ok) {
      const st = drainLeaseStatus(DRAIN_LOCK_ROOT);
      if (AS_JSON) process.stdout.write(JSON.stringify({ ok: true, mode: follow ? 'watch' : 'drain', skipped: 'drain-in-progress', heldBy: st.owner, detail: `another drain already holds the lease (${st.owner}) — no-op (#2391)` }) + '\n');
      else process.stderr.write(`lane-drain · another drain already running (lease held by ${st.owner || '?'}) — no-op (#2391)\n`);
      process.exit(0);
    }
  }

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
    if (!DRY_RUN) heartbeatDrainLease(DRAIN_LOCK_ROOT, leaseOwner); // #2391 — keep the whole-process lease alive across a long watch
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
  if (!DRY_RUN) releaseDrainLease(DRAIN_LOCK_ROOT, leaseOwner); // #2391 — free the whole-process lease for the next drain launch
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stderr.write(`lane-drain ${follow ? 'watch' : 'drain'} ${fullyDrained ? '✓' : '⚠'} ${result.detail}\n`);
  // Exit 0 ONLY when the queue fully drained (nothing left needing attention); else 2. A dry-run reports 0
  // (it plans, never drains) — its plan is in the JSON.
  process.exit(DRY_RUN || fullyDrained ? 0 : 2);
}
