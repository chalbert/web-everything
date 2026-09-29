/**
 * @file breaks/build-dispatch-graphql-exhausted.mjs — #4351's own build-dispatch follow-up (guided by #4309 spend accounting). LIVE
 * incident, 2026-09-29: the build-dispatch daemon's own per-tick open-PR read (`cliFetchOpenPrs`, once per
 * constellation repo) called `gh pr list --json …` — the shared GraphQL bucket — even though it only ever read
 * `number`/`headRefName`/`labels`/`files` off the result. It was the single largest GraphQL spender in the
 * fleet (121 calls/3h at ~50 points/call, `gh-spend.mjs report --by=caller+op`), and whenever that shared
 * bucket ran dry (a DIFFERENT caller could exhaust it — the bucket is per-identity, not per-caller), this daemon's
 * tick failed outright: `build-dispatch-daemon.log` shows repeated "tick failed (non-fatal): gh-throttle:
 * GitHub graphql API rate limit exceeded … shared backoff until …" lines, meaning this daemon stopped
 * dispatching ANY build for up to an hour, purely because of an unrelated caller's GraphQL spend.
 *
 * Fix: `cliFetchOpenPrs` moved onto `open-pr-fetch.mjs#fetchOpenPrsRest` — REST (`gh api …`), which spends the
 * separate `core` bucket. A GraphQL exhaustion (real or simulated below) no longer touches this call at all.
 *
 * Scenario: a PATH-faked `gh` fails EVERY `gh pr …` invocation with GitHub's own real primary-GraphQL-exhaustion
 * error shape (`GraphQL: API rate limit exceeded for installation ID …`) — the exact text the real throttle
 * classifies as a primary-bucket exhaustion (`gh-throttle.mjs#primaryExhaustedResource`) — while `gh api …`
 * (REST) succeeds normally. `cliFetchOpenPrs()` is called directly, in a fresh child process (so a thrown
 * rejection there is observable without also crashing this test process).
 */
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const FIXTURE = fileURLToPath(new URL('./fixtures/build-dispatch-graphql-exhausted.mjs', import.meta.url));

/** GitHub's own real primary-exhaustion shape for the `graphql` resource (see `gh-throttle.mjs`'s own
 *  `primaryExhaustedResource`: needs `GraphQL:` + `API rate limit … exceeded` to classify as `graphql`, not
 *  `core` — the exact distinction this card's fix depends on). */
const GRAPHQL_EXHAUSTED = 'GraphQL: API rate limit exceeded for installation ID 32881234. (query pullRequests)';

export default {
  id: 'build-dispatch-graphql-exhausted',
  title: 'the build-dispatch daemon\'s own open-PR read spent the shared GraphQL bucket, so an unrelated caller exhausting it stalled every build dispatch',
  card: 'we:backlog/4351 (its own build-dispatch-daemon follow-up note, guided by #4309 spend accounting)',
  fixedBy: { sha: '7c5842a97', where: 'lane/builder-pr-list-rest', paths: ['scripts/conveyor/open-pr-fetch.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'] },
  fixPresent(root) {
    const p = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(p) && /fetchOpenPrsRest/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-build-dispatch-graphql-'));
    const bin = mkdtempSync(join(tmpdir(), 'soak-build-dispatch-graphql-gh-'));
    const lockRoot = join(dir, 'throttle');
    const etagDir = join(dir, 'etag');
    const listBody = join(dir, 'list.json');
    const filesBody = join(dir, 'files.json');
    writeFileSync(listBody, JSON.stringify([{ number: 1, head: { ref: 'lane/1-x' }, labels: [], draft: false }]));
    writeFileSync(filesBody, JSON.stringify([{ filename: 'a.mjs' }]));
    writeFileSync(join(bin, 'gh'), [
      '#!/bin/sh',
      // Every `gh pr …` (GraphQL) invocation fails with GitHub's real primary-exhaustion shape.
      `[ "$1" = "pr" ] && { echo '${GRAPHQL_EXHAUSTED}' >&2; exit 1; }`,
      // `gh api …` (REST, core bucket) is unaffected — same conditional-GET reply shape gh-rest-read.mjs expects.
      'case "$*" in',
      `  *If-None-Match*) printf 'HTTP/2.0 304 Not Modified\\r\\nEtag: "e1"\\r\\n\\r\\n'; echo "gh: HTTP 304" >&2; exit 1;;`,
      `  *pulls/*/files*) printf 'HTTP/2.0 200 OK\\r\\nEtag: W/"e1"\\r\\n\\r\\n'; cat '${filesBody}';;`,
      `  *pulls*) printf 'HTTP/2.0 200 OK\\r\\nEtag: W/"e1"\\r\\n\\r\\n'; cat '${listBody}';;`,
      // The throttle's own budget-exhaustion probe (`gh api graphql -f query=…` / `gh api rate_limit …`) — any
      // parseable JSON is fine, `parseBudgetProbe` reads it defensively and null-falls-back either way.
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
      violations.push({ invariant: 'tick-open-pr-read-failed', detail: `cliFetchOpenPrs() rejected while ONLY the graphql bucket was exhausted: ${report.error}` });
    } else if (!report.repos.length || report.repos.some((r) => r.count < 0)) {
      violations.push({ invariant: 'no-prs-read', detail: `expected a per-repo PR count for every constellation repo, got ${JSON.stringify(report.repos)}` });
    }
    return { violations, report };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
