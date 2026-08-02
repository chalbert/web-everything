#!/usr/bin/env node
/**
 * verify-lane.mjs — run a lane's required suites SYNCHRONOUSLY and record a green/red verification marker
 * keyed to the lane's HEAD commit (#2833, subagent-stall mitigation).
 *
 * WHY. A build subagent's delivery arc is: run the suites, then `pr-land` / `lane-pool release` to finish.
 * Twice one night a subagent BACKGROUNDED its long test run and then yielded/terminated before it finished —
 * leaving the lane mid-flight: producing nothing, never erroring, so nothing reclaimed it. The root cause was
 * that the verification was BACKGROUNDABLE and yielding mid-run LOOKED complete.
 *
 * This is the sanctioned "run your checks" step for the build flow, and it removes that footgun two ways:
 *   1. It runs the suites in the FOREGROUND (`stdio:'inherit'`), blocking until they exit — "background then
 *      yield" is no longer the path of least resistance, because the tool itself is a blocking call.
 *   2. It writes a lifecycle MARKER (`.git/.lane-verify`, keyed to HEAD): `running` at start, rewritten to
 *      `green`/`red` at finish. If the process is killed mid-run, the marker is stranded at `running` — so the
 *      delivery gate (`pr-land`'s finish-guard) can SEE the verification never completed and refuse to land.
 *
 * The pure decision half (marker shape + the gate decision `pr-land` calls) lives in `scripts/lib/lane-verify.mjs`.
 *
 * Usage:
 *   node scripts/verify-lane.mjs                      # run the default gate (test:unit + check:standards) foreground, record green/red for HEAD
 *   node scripts/verify-lane.mjs --gate="npm run test:unit"   # override the suite command
 *   node scripts/verify-lane.mjs --repo=~/workspace/.lanes/web-everything/lane-3   # verify a specific lane clone
 *   node scripts/verify-lane.mjs --json              # machine-readable {sha, status, exitCode} on stdout
 *   node scripts/verify-lane.mjs check               # READ-ONLY: print the current marker's gate verdict for HEAD, run nothing
 *   node scripts/verify-lane.mjs check --require-verified   # exit non-zero unless HEAD has a fresh GREEN marker (the gate pr-land applies)
 *
 * Exit codes: 0 = green (marker recorded green) / `check` verdict ok; 2 = red (suites failed — marker recorded
 * red) / `check` verdict not-ok; 3 = usage / git error (no marker written).
 */
import { execSync } from 'node:child_process';
import { writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { VERIFY_FILENAME, verifyStartBody, verifyFinishBody, verifyGateDecision, readVerifyMarker, resolveVerifyOptions } from './lib/lane-verify.mjs';

// ── tiny arg parsing (matches push-if-green.mjs / lane-pool.mjs) ─────────────────────────────────────
const flags = {};
const positionals = [];
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  } else positionals.push(a);
}

const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const REPO = resolve(expandHome(flags.repo) || process.cwd());
const GATE = typeof flags.gate === 'string' ? flags.gate : 'npm run test:unit && npm run check:standards';
const AS_JSON = !!flags.json;
// #2833 finding 5 — resolve the gate options through the SHARED resolver so `check` mode agrees with pr-land:
// `--require-verified` OR `WE_REQUIRE_VERIFIED=1`, and the `WE_LAND_UNVERIFIED=1` break-glass. Previously `check`
// read only `flags['require-verified']`, so the same env produced two different verdicts at the two call sites.
const { requireVerified: REQUIRE_VERIFIED, breakGlass: VERIFY_BREAK_GLASS } = resolveVerifyOptions({ flags, env: process.env });
const MODE = positionals[0] === 'check' ? 'check' : 'verify';

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return null; } };

// Resolve the marker inside the REAL git dir. `.git` is a DIRECTORY in a clone (the lane case) but a FILE in a
// worktree, and can be relocated via $GIT_DIR — so `git rev-parse --absolute-git-dir` is the only correct way to
// locate it (#2833 finding 4: a hardcoded `join(REPO, '.git', …)` throws ENOTDIR in a worktree). Falls back to
// the literal only if git can't answer, in which case the downstream git ops fail loudly anyway.
const GIT_DIR = tryGit(['rev-parse', '--absolute-git-dir']) || join(REPO, '.git');
const MARKER = join(GIT_DIR, VERIFY_FILENAME);

// #2833 finding 2 — the marker read is single-sourced in lane-verify.mjs (`readVerifyMarker`) so this writer and
// pr-land's finish-guard can never drift. It resolves `<gitDir>/.lane-verify`, folds a valid-JSON non-object to
// `{ corrupt: true }` (never `absent`, which would fail OPEN), and returns null only for a genuinely missing file.
const readMarker = () => readVerifyMarker(GIT_DIR);
function writeMarker(record) {
  // Atomic: write a temp sibling in the same git dir, then rename over the marker — so a concurrent reader
  // (pr-land's finish-guard) never observes a half-written file (#2833 finding 5). renameSync is atomic within a
  // filesystem, and the temp lives beside the marker so it always is.
  const tmp = `${MARKER}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
  renameSync(tmp, MARKER);
}

function emit(result, exitCode) {
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stderr.write(`verify-lane [lane @ ${result.sha ? result.sha.slice(0, 8) : '?'}] ${result.status}: ${result.detail}\n`);
  process.exit(exitCode);
}

const headSha = tryGit(['rev-parse', 'HEAD']);
if (!headSha) emit({ sha: null, status: 'error', reason: 'no-head', detail: `could not resolve HEAD in ${REPO} — is this a git checkout?` }, 3);

// ── `check` — READ-ONLY: report the finish-guard verdict for HEAD, run nothing. This is exactly the gate
//    pr-land applies, exposed so a delivery step can pre-flight it (and so it is directly testable end-to-end).
if (MODE === 'check') {
  const v = verifyGateDecision({ record: readMarker(), headSha, breakGlass: VERIFY_BREAK_GLASS, requireVerified: REQUIRE_VERIFIED });
  emit({ sha: headSha, status: v.status, reason: v.reason, ok: v.ok, detail: v.detail }, v.ok ? 0 : 2);
}

// ── `verify` — run the suites SYNCHRONOUSLY and record the outcome ───────────────────────────────────
// 1. Stamp the `running` marker BEFORE the suites start, so a kill mid-run leaves a stranded (detectably
//    unfinished) marker rather than nothing.
//    #2833 finding 4: the same sha compare-and-set the FINISH write applies (below) must also guard the START
//    write. Two overlapping runs share one clone's marker; without this, `verify-lane` for a NEW sha would
//    overwrite an existing TERMINAL (`green`/`red`) record belonging to a DIFFERENT sha with a `running` marker
//    — destroying a sibling run's recorded result before any CAS could protect it. Refuse to clobber a terminal
//    record for a foreign sha (a `running`/absent/own-sha marker is fine to overwrite: re-verifying is legitimate).
const preStart = readMarker();
if (preStart && !preStart.corrupt && (preStart.status === 'green' || preStart.status === 'red') && preStart.sha && preStart.sha !== headSha) {
  emit(
    {
      sha: headSha, status: 'superseded', reason: 'superseded', exitCode: null,
      detail: `refusing to START verification for ${headSha.slice(0, 8)}: the on-disk marker holds a terminal ${preStart.status} record for ${String(preStart.sha).slice(0, 8)} (an overlapping verify-lane run) — overwriting it with a running marker would destroy that result; no marker written for this run.`,
    },
    3,
  );
}
writeMarker(verifyStartBody({ sha: headSha, suites: GATE, startedAt: new Date().toISOString() }));

// 2. Run the gate in the FOREGROUND, blocking until it exits (inherited stdio — the agent sees the output live).
let exitCode = 0;
try {
  execSync(GATE, { cwd: REPO, stdio: 'inherit' });
} catch (e) {
  exitCode = Number.isFinite(e && e.status) ? e.status : 2;
}

// 3. Rewrite the marker to its terminal green/red form — for the sha THIS run actually verified.
//    #2833 finding 1: two overlapping verify-lane runs share one clone's marker. The finish write must
//    (a) stamp OUR sha (`headSha`, captured at start) — NOT re-read the on-disk marker's sha, or a slow run
//        finishing at X copies a newer run's sha Y onto its green and publishes a false green for Y; and
//    (b) refuse to overwrite a marker whose sha is not ours — an older/overlapping run must never clobber a
//        newer run's record (compare-and-set on the sha). A slow GREEN run at X must NOT stamp green over a
//        RED record for Y.
const onDisk = readMarker();
if (onDisk && !onDisk.corrupt && onDisk.sha && onDisk.sha !== headSha) {
  emit(
    {
      sha: headSha, status: 'superseded', reason: 'superseded', exitCode,
      detail: `suites finished (exit ${exitCode}) for ${headSha.slice(0, 8)}, but the on-disk marker now belongs to ${String(onDisk.sha).slice(0, 8)} (an overlapping verify-lane run) — refusing to overwrite it; no marker written for this run.`,
    },
    3,
  );
}
// Reuse the on-disk start body's audit fields only when it is OUR run's marker; otherwise synthesize a fresh one.
const startBody = onDisk && !onDisk.corrupt && onDisk.sha === headSha
  ? onDisk
  : verifyStartBody({ sha: headSha, suites: GATE, startedAt: null });
const finished = verifyFinishBody(startBody, {
  finishedAt: new Date().toISOString(),
  exitCode,
  sha: headSha,
});
writeMarker(finished);

emit(
  { sha: headSha, status: finished.status, reason: finished.status, exitCode, detail: finished.status === 'green' ? `suites passed — recorded green for ${headSha.slice(0, 8)} (delivery may proceed).` : `suites FAILED (exit ${exitCode}) — recorded red for ${headSha.slice(0, 8)}; the finish-guard will refuse to land until this is green.` },
  finished.status === 'green' ? 0 : 2,
);
