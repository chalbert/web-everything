#!/usr/bin/env node
/**
 * soak-replay-gate-cli.mjs — CI-wired executable for `we:scripts/lib/soak-replay-gate.mjs` (the "every daemon
 * bug fix adds a soak break scenario, or waives it" gate, #4075). Wired as a required status check via
 * `.github/workflows/soak-replay-gate.yml`, mirroring `.github/workflows/review-gate.yml` /
 * `scripts/check-review-gate.mjs`'s own shape (a separate top-level workflow, checked out at `ref: main` for
 * bootstrap safety, reading the PR's title/body straight from the trusted event payload — no PR-body signal
 * here is ever executed, only read as data). It does NOT edit `.github/workflows/ci.yml`, so it cannot conflict
 * with PR #2770's in-flight `daemon-soak` job restructuring.
 *
 * Usage:
 *   node scripts/soak-replay-gate-cli.mjs --title=<t> --body=<b> --files-json='["a.mjs","b.mjs"]'
 *   node scripts/soak-replay-gate-cli.mjs --title=<t> --body=<b> --files-status=$'M\ta.mjs\nA\tb.mjs'
 *   node scripts/soak-replay-gate-cli.mjs --title=<t> --body=<b> --base-sha=<sha> --head-sha=<sha>
 *   node scripts/soak-replay-gate-cli.mjs --pr=1234 [--repo=owner/name]   # fetched live via gh (manual/local)
 *   node scripts/soak-replay-gate-cli.mjs --pr=1234 --json               # machine-readable result
 *
 * `--files-json` takes a JSON array of either plain path strings, or `{path, changeType}` objects (GitHub's own
 * `gh pr view --json files` shape — ADDED/MODIFIED/DELETED/RENAMED). `--files-status` takes `git diff
 * --name-status` output (`<letter>\t<path>` per line, `git diff -M --name-status` for rename detection) — the
 * cheap form CI already has on hand without another API call; letters are mapped to the same changeType names.
 *
 * `--base-sha`/`--head-sha` (backlog/4264) compute the changed-file list THEMSELVES, from the MERGE-BASE of the
 * two shas to head — never a plain two-endpoint `base..head` diff, which misattributes anything `main` changed
 * since the PR's branch diverged to the PR itself (live misfire: PR #2822, see
 * `we:scripts/lib/soak-gate-merge-base-diff.mjs`'s own header for the full incident). This is now the mode
 * `.github/workflows/soak-replay-gate.yml` actually calls; `--files-status`/`--files-json` stay for direct/manual
 * use and existing tests.
 *
 * Exit codes: 0 = clear (rule doesn't apply, or it's satisfied — see `reason`); 1 = a live daemon fix with no
 * break scenario and no waiver; 3 = usage error.
 */
import { execFileSync } from 'node:child_process';
import { evaluateSoakReplayGate } from './lib/soak-replay-gate.mjs';
import { computeSoakGateNameStatus, defaultExec } from './lib/soak-gate-merge-base-diff.mjs';

const NAME_STATUS_LETTER = { A: 'ADDED', M: 'MODIFIED', D: 'DELETED', C: 'ADDED' };

/** Parses `git diff --name-status` text into `{path, changeType}` entries (R### → RENAMED, tab-separated). */
export function parseNameStatus(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      if (tab === -1) return null;
      const code = line.slice(0, tab);
      const rest = line.slice(tab + 1);
      // A rename/copy line is `R100\told\tnew` (two paths, tab-separated); the NEW path is what matters here.
      const parts = rest.split('\t');
      const path = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const letter = code[0];
      const changeType = letter === 'R' ? 'RENAMED' : (NAME_STATUS_LETTER[letter] || 'MODIFIED');
      return { path, changeType };
    })
    .filter(Boolean);
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function usageError(detail, asJson) {
  if (asJson) console.log(JSON.stringify({ ok: false, reason: 'usage', detail }));
  else console.error(`soak-replay-gate ✗ usage: ${detail}`);
  process.exitCode = 3;
}

export function main(argv = process.argv.slice(2)) {
  const flags = parseFlags(argv);
  const AS_JSON = !!flags.json;

  let title;
  let body;
  let files;

  if (flags.pr) {
    const repoFlag = flags.repo ? ['--repo', String(flags.repo)] : [];
    try {
      const data = JSON.parse(
        execFileSync('gh', ['pr', 'view', String(flags.pr), ...repoFlag, '--json', 'title,body,files'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim() || '{}',
      );
      title = data.title || '';
      body = data.body || '';
      files = Array.isArray(data.files) ? data.files : [];
    } catch (e) {
      usageError(`could not read PR ${flags.pr}: ${String(e.message || e).split('\n')[0]}`, AS_JSON);
      return;
    }
  } else {
    title = typeof flags.title === 'string' ? flags.title : '';
    body = typeof flags.body === 'string' ? flags.body : '';
    if (typeof flags['files-json'] === 'string') {
      try {
        files = JSON.parse(flags['files-json']);
      } catch (e) {
        usageError(`--files-json is not valid JSON: ${String(e.message || e)}`, AS_JSON);
        return;
      }
    } else if (typeof flags['files-status'] === 'string') {
      files = parseNameStatus(flags['files-status']);
    } else if (typeof flags['base-sha'] === 'string' && typeof flags['head-sha'] === 'string') {
      try {
        const diff = computeSoakGateNameStatus({ exec: defaultExec, baseSha: flags['base-sha'], headSha: flags['head-sha'] });
        files = parseNameStatus(diff.nameStatus);
      } catch (e) {
        usageError(`could not compute the merge-base diff for --base-sha/--head-sha: ${String(e.message || e).split('\n')[0]}`, AS_JSON);
        return;
      }
    } else {
      usageError(
        'pass --files-json=<JSON array>, --files-status=<git diff --name-status text>, --base-sha=<sha> --head-sha=<sha>, or --pr=<number> [--repo=<owner/name>]',
        AS_JSON,
      );
      return;
    }
  }

  const verdict = evaluateSoakReplayGate({ title, body, files });
  if (AS_JSON) {
    console.log(JSON.stringify({ ok: verdict.ok, applicable: verdict.applicable, reason: verdict.reason, waiver: verdict.waiver || null }));
  } else if (!verdict.ok) {
    console.error(`soak-replay-gate ✗ ${verdict.reason}`);
  } else {
    console.error(`soak-replay-gate ✓ ${verdict.reason}`);
  }
  process.exitCode = verdict.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
