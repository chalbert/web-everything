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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { VERIFY_FILENAME, verifyStartBody, verifyFinishBody, verifyGateDecision } from './lib/lane-verify.mjs';

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
const REQUIRE_VERIFIED = !!flags['require-verified'];
const MODE = positionals[0] === 'check' ? 'check' : 'verify';

const MARKER = join(REPO, '.git', VERIFY_FILENAME);

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return null; } };

function readMarker() {
  if (!existsSync(MARKER)) return null;
  try {
    const parsed = JSON.parse(readFileSync(MARKER, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null; // a corrupt marker reads as "no verification" — the gate then refuses under --require-verified
  }
}
function writeMarker(record) {
  writeFileSync(MARKER, JSON.stringify(record, null, 2) + '\n');
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
  const breakGlass = process.env.WE_LAND_UNVERIFIED === '1';
  const v = verifyGateDecision({ record: readMarker(), headSha, breakGlass, requireVerified: REQUIRE_VERIFIED });
  emit({ sha: headSha, status: v.status, reason: v.reason, ok: v.ok, detail: v.detail }, v.ok ? 0 : 2);
}

// ── `verify` — run the suites SYNCHRONOUSLY and record the outcome ───────────────────────────────────
// 1. Stamp the `running` marker BEFORE the suites start, so a kill mid-run leaves a stranded (detectably
//    unfinished) marker rather than nothing.
writeMarker(verifyStartBody({ sha: headSha, suites: GATE, startedAt: new Date().toISOString() }));

// 2. Run the gate in the FOREGROUND, blocking until it exits (inherited stdio — the agent sees the output live).
let exitCode = 0;
try {
  execSync(GATE, { cwd: REPO, stdio: 'inherit' });
} catch (e) {
  exitCode = Number.isFinite(e && e.status) ? e.status : 2;
}

// 3. Rewrite the marker to its terminal green/red form.
const finished = verifyFinishBody(readMarker() || verifyStartBody({ sha: headSha, suites: GATE, startedAt: null }), {
  finishedAt: new Date().toISOString(),
  exitCode,
});
writeMarker(finished);

emit(
  { sha: headSha, status: finished.status, reason: finished.status, exitCode, detail: finished.status === 'green' ? `suites passed — recorded green for ${headSha.slice(0, 8)} (delivery may proceed).` : `suites FAILED (exit ${exitCode}) — recorded red for ${headSha.slice(0, 8)}; the finish-guard will refuse to land until this is green.` },
  finished.status === 'green' ? 0 : 2,
);
