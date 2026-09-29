/**
 * @file breaks/lease-reaper-graphql-unattributed.mjs — #4415. LIVE incident, 2026-09-29 ~10:30Z: the app
 * installation's shared GraphQL bucket was exhausted (`gh pr list … rate-limited: GraphQL: API rate limit
 * already exceeded for installation ID 163880042`), and the drain backed off every pass. `gh-spend.mjs report
 * --hours=1 --by=caller+op` showed the bucket spent 1147 points that hour, of which 1020.9 were UNATTRIBUTED —
 * spent by `gh` calls whose argv never reached `gh-throttle.mjs`'s own call log at all, so no caller+op row
 * could explain them.
 *
 * ROOT CAUSE: `scripts/conveyor/lease-reaper.mjs#fetchPrStatesForRepo` (the resident `lease-reaper` daemon's own
 * PR-terminal reap axis, one `gh pr list --state all --limit 400 --json …` call PER constellation repo with a
 * held lease, EVERY tick of the always-running `com.we.lease-reaper` launchd job) shelled a bare `execFileSync`
 * — never `execFileSyncThrottled` — so it (a) never appeared in `gh-throttle.mjs`'s attribution log at all, and
 * (b) paid the shared GraphQL bucket via `gh pr list`'s default GraphQL-backed listing, not the separate REST
 * `core` bucket. `scripts/lane-pool.mjs#deadLeasePlan` (the acquire-time twin of this same axis, run on EVERY
 * `acquire`/`list --acquirable` across every session in every pool) carried the identical defect and is fixed
 * in the same change — this break scenario exercises the resident DAEMON path specifically, since that is the
 * one running unattended, unbounded, all the time, with no operator turn to notice it degrade.
 *
 * Fix: `fetchPrStatesForRepo` moved onto the shared REST + ETag-conditional path (`../../lib/gh-rest-read.mjs`'s
 * own `#4351` mechanism, the SAME one `build-dispatch-daemon.mjs`'s prior top-spender fix uses, see the sibling
 * `build-dispatch-graphql-exhausted.mjs` break) — `ghRestGetPaged`, defaulting to `execFileSyncThrottled`, so
 * every call is BOTH attributed (caller+op in the throttle's own log) AND on the `core` bucket, never `graphql`.
 *
 * Scenario: a PATH-faked `gh` that logs every invocation's argv to a file (so this test can tell `pr list`
 * apart from `api …` after the fact) and answers either shape successfully — the invariant under test is never
 * "does `gh` fail", it is "which bucket, and is the call attributed at all". `fetchPrStatesForRepo('we', {}, {})`
 * is called with NO `exec` override — the daemon's own real default — inside a fresh child process (so a
 * REST-vs-GraphQL choice made at import time, if any, is never contaminated by a previous test's import cache).
 */
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ghThrottleLockRoot, ghThrottleLogPath } from '../../../lib/gh-throttle.mjs';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const FIXTURE = fileURLToPath(new URL('./fixtures/lease-reaper-graphql-unattributed.mjs', import.meta.url));

export default {
  id: 'lease-reaper-graphql-unattributed',
  title: 'the resident lease-reaper daemon\'s own PR-terminal read was a bare, unattributed, GraphQL-backed gh `pr list` — invisible to gh-spend.mjs and the top drain of the shared graphql bucket',
  card: 'we:backlog/4415',
  fixedBy: { sha: 'fd3ebc13d', where: 'lane/graphql-unattributed-spender', paths: ['scripts/conveyor/lease-reaper.mjs', 'scripts/lane-pool.mjs'] },
  fixPresent(root) {
    const p = join(root, 'scripts/conveyor/lease-reaper.mjs');
    return existsSync(p) && /ghRestGetPaged/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-lease-reaper-graphql-'));
    const bin = mkdtempSync(join(tmpdir(), 'soak-lease-reaper-graphql-gh-'));
    const lockRoot = join(dir, 'throttle');
    const etagDir = join(dir, 'etag');
    const argvLog = join(dir, 'argv.log');
    const listBody = join(dir, 'list.json');
    writeFileSync(listBody, JSON.stringify([
      { number: 900, headRefName: 'lane/181-x', state: 'MERGED', mergedAt: '2026-09-22T00:00:00Z', mergeCommit: { oid: 'deadbeef' } },
    ]));
    // Logs the FULL argv of every invocation (one line, space-joined) before answering, so the assertions below
    // can tell a `pr list` (GraphQL) call apart from an `api …` (REST) one after the child has exited.
    writeFileSync(join(bin, 'gh'), [
      '#!/bin/sh',
      `printf '%s\\n' "$*" >> '${argvLog}'`,
      'case "$*" in',
      // The old, broken shape: `gh pr list --state all …` — answer with a plain JSON body (success), same as
      // the pre-fix code always got in production — the fix is about ATTRIBUTION/BUCKET, not about `gh` failing.
      `  "pr list"*) cat '${listBody}';;`,
      // The REST shape (`gh api -i repos/.../pulls?state=all&…`): the `-i` include-headers reply gh-rest-read.mjs
      // expects, with an Etag so a second call in the same run would 304 (not exercised here — one call only).
      `  *"api -i"*pulls*) printf 'HTTP/2.0 200 OK\\r\\nEtag: W/"e1"\\r\\n\\r\\n'; cat '${listBody}';;`,
      // The throttle's own best-effort budget probe (`gh api rate_limit`/`gh api graphql -f query=…`) — any
      // parseable JSON is fine; the throttle reads it defensively and null-falls-back either way.
      `  *) printf 'HTTP/2.0 200 OK\\r\\n\\r\\n'; echo '{}';;`,
      'esac',
      '',
    ].join('\n'));
    chmodSync(join(bin, 'gh'), 0o755);
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      WE_GH_THROTTLE_LOCK_ROOT: lockRoot,
      WE_GH_ETAG_DIR: etagDir,
    };
    const violations = [];
    let report;
    try {
      const out = execFileSync(process.execPath, [FIXTURE, REPO_ROOT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env });
      log?.(out.trim());
      report = JSON.parse(out.trim().split('\n').pop());
    } catch (e) {
      violations.push({ invariant: 'crash', detail: String(e?.stderr || e?.message || e).split('\n')[0] });
      return { violations };
    }
    if (!report.ok) {
      violations.push({ invariant: 'fetch-threw', detail: `fetchPrStatesForRepo('we', {}, {}) threw: ${report.error}` });
      return { violations, report };
    }
    if (!report.axisOn || report.itemCount < 1) {
      violations.push({ invariant: 'axis-off', detail: `expected the PR-terminal axis ON with 1 item resolved, got ${JSON.stringify(report)}` });
    }
    const argvLines = existsSync(argvLog) ? readFileSync(argvLog, 'utf8').trim().split('\n').filter(Boolean) : [];
    if (argvLines.some((l) => l.startsWith('pr list'))) {
      violations.push({ invariant: 'graphql-pr-list-used', detail: `at least one invocation used the GraphQL-backed gh 'pr list' (argv log: ${JSON.stringify(argvLines)}) — the shared graphql bucket is still being spent here` });
    }
    const callLogPath = ghThrottleLogPath(ghThrottleLockRoot(undefined, env));
    const callLines = existsSync(callLogPath) ? readFileSync(callLogPath, 'utf8').trim().split('\n').filter(Boolean) : [];
    const attributed = callLines.some((l) => { try { return /lease-reaper/i.test(JSON.parse(l).op || ''); } catch { return false; } });
    if (!attributed) {
      violations.push({ invariant: 'unattributed-spend', detail: `no line in gh-throttle's own call log (${callLogPath}) carries an op naming lease-reaper — this call's spend is invisible to gh-spend.mjs report, exactly the 2026-09-29 incident shape (argv log: ${JSON.stringify(argvLines)}, call log lines: ${callLines.length})` });
    }
    return { violations, report: { ...report, argvLines, attributed } };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
