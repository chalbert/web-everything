/**
 * @file breaks/health-file-request-open-pr-result.mjs — live-proof break, 2026-09-28 (WE #4079 health daemon
 * slice 5, PR #2881 / lane/4079-slice5). The new lane-bound landing pass
 * (`scripts/operations/health-file-request-land.mjs#landOne`) that files a health-daemon-discovered card and
 * opens its PR shipped with two real bugs its own unit tests never caught — only a LIVE run against a scratch
 * state root did (it filed a genuine card and opened `chalbert/web-everything#2877`):
 *
 *   1. `run.mjs open-pr --json`'s actual output is the declared operation's own RUN RECORD shape
 *      (`{runId, op, stopped, verdict, findings, …}`, `scripts/operations/cli-adapter.mjs#outcomePayload`) —
 *      `open-pr`'s `verdictFrom` is `'plan'` (the pre-submit plan), so the real `{pr, url}` lives nested at
 *      `findings.submit.effects[].result`, never at the JSON's top level. A naive `JSON.parse(out).pr` silently
 *      reads `undefined` every time, so `patchLedgerEntry`'s `entry.pr` is never actually set and the ledger's
 *      own "already landed" no-op check (keyed on `entry.pr`) can never fire — the SAME entry would be
 *      re-filed/re-landed on every later pass.
 *   2. the un-flagged `open-pr` call defaults to `open-pr`'s OWN default mode, `park` (parked `review:pending`,
 *      awaiting a human) — never `label-on-green` — which would strand every filed card forever and defeat the
 *      point of an autonomous, capped filing pass.
 *
 * FIX (PR #2881, commit 4fda65d72): `parseOpenPrResult(out)` reads the nested `findings.submit.effects[]`
 * shape (falling back to `{pr:null, url:null}` on anything else, never throwing — a malformed result must not
 * stop the ledger patch that DOES have real card/cardFile data to record), and `landOne`'s `open-pr` call is
 * pinned to `--mode=label-on-green`.
 *
 * SCENARIO: `scripts/operations/health-file-request-land.mjs` is a BRAND NEW file in this PR (no prior version
 * on `main` to regress against), so this break drives its real exported functions directly with a fully
 * injected `runFn` — no daemon tick, no fleet, no real subprocess — the same `daemons: []` shape
 * `rebuild-finalize-starved.mjs`/`daemon-overlay-lock-wait.mjs` use for a bug in one function rather than a
 * multi-daemon interaction:
 *   - `parseOpenPrResult` is fed the REAL nested run-record JSON `open-pr --json` actually prints (captured
 *     from this PR's own live-proof run, PR #2877) and must return the real `{pr, url}`.
 *   - `landOne` is fed a fake `runFn` that answers `file-item`/`git`/`verify` successfully and returns that same
 *     nested run-record for the `open-pr` call; the fake records every `(cmd, args)` tuple. The break asserts
 *     the recorded `open-pr` call carries `--mode=label-on-green`, and that `landOne`'s own return value has
 *     `pr`/`prUrl` actually set (not `null`) — exactly the two facts the live PR #2877 catch turned on.
 *
 * RED (this file absent, or the naive/un-flagged shape restored): `scripts/operations/health-file-request-land.mjs`
 * does not exist on `main` at all (this whole file is new), so `red-green.mjs`'s reverse-apply of commit
 * 4fda65d72 deletes it from the copy — the dynamic import fails and the break reports
 * `health-file-request-land-missing`. GREEN: the file exists, `parseOpenPrResult` recovers the nested `{pr,
 * url}`, and the recorded `open-pr` call carries `--mode=label-on-green`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSoak } from '../soak.mjs';

const MODULE_REL = 'scripts/operations/health-file-request-land.mjs';

// The exact nested shape `run.mjs open-pr --json` prints (`cli-adapter.mjs#outcomePayload`, `verdictFrom:
// 'plan'`) — captured against this PR's own live-proof run (PR #2877). A flat `{pr, url}` never appears at the
// top level; only under `findings.submit.effects[].result`.
const OPEN_PR_JSON = JSON.stringify({
  runId: 'soak-run-1', op: 'open-pr', stopped: false,
  verdict: { action: 'plan', reason: 'soak: plan only, submit applied below' },
  findings: {
    submit: {
      effects: [
        { type: 'open-pr.submit', status: 'applied', result: { pr: 2877, url: 'https://github.com/chalbert/web-everything/pull/2877' } },
      ],
    },
  },
});

function fakeEntry() {
  return {
    key: 'smell:subject', ref: 'health-file-request/smell-subject', episodeId: 'ep-1', smell: 'soak-smell',
    subject: 'soak-subject', title: 'soak: filing request card', digest: 'soak digest body', scope: ['scripts/lib/x.mjs'],
    size: 2, card: null, cardFile: null, attemptId: 'attempt-1',
  };
}

export default {
  id: 'health-file-request-open-pr-result',
  title: "health-file-request-land's landing pass silently never recorded a filed PR (open-pr --json's nested "
    + 'run-record shape misread as a flat {pr,url}) and defaulted new filing PRs to the un-reviewed park mode '
    + 'instead of label-on-green',
  card: 'WE #4079 slice 5, live catch PR #2877, fixed in PR #2881 (lane/4079-slice5)',
  fixedBy: {
    sha: '4fda65d72',
    where: 'lane/4079-slice5',
    paths: [MODULE_REL],
  },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, MODULE_REL), 'utf8');
      return /findings\?\.submit\?\.effects/.test(src) && /--mode=label-on-green/.test(src);
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    return runSoak({
      name: 'break:health-file-request-open-pr-result',
      rounds: 1,
      daemons: [], // drives `parseOpenPrResult`/`landOne` directly (see perRound) — no daemon tick loop needed.
      mainEvery: 0,
      fleet: false,
      log,
      async perRound(w, round, ctx, api) {
        if (round !== 0) return;
        const modulePath = join(w.simCloneRoot, MODULE_REL);
        if (!existsSync(modulePath)) {
          api.violation('health-file-request-land-missing', `${MODULE_REL} is not present on this tree — the filing pass this break covers does not exist here`);
          return;
        }
        let mod;
        try {
          mod = await import(pathToFileURL(modulePath).href);
        } catch (e) {
          api.violation('health-file-request-land-import-failed', `importing ${MODULE_REL} failed: ${String(e?.message || e).split('\n')[0]}`);
          return;
        }
        if (typeof mod.parseOpenPrResult !== 'function' || typeof mod.landOne !== 'function') {
          api.violation('health-file-request-land-missing-exports', `${MODULE_REL} does not export both parseOpenPrResult and landOne`);
          return;
        }

        const parsed = mod.parseOpenPrResult(OPEN_PR_JSON);
        api.say(`r00 parseOpenPrResult(<nested open-pr run record>) -> ${JSON.stringify(parsed)}`);
        if (parsed.pr !== 2877 || parsed.url !== 'https://github.com/chalbert/web-everything/pull/2877') {
          api.violation('open-pr-result-not-parsed', `parseOpenPrResult misread open-pr's own nested run-record shape (findings.submit.effects[].result) — got ${JSON.stringify(parsed)}, expected {pr:2877,url:".../pull/2877"}; a naive top-level {pr,url} read silently returns undefined here`);
        }

        const calls = [];
        const fakeRunFn = (cmd, args, cwd) => {
          calls.push({ cmd, args, cwd });
          const joined = args.join(' ');
          if (joined.includes('file-item')) return JSON.stringify({ verdict: { num: 9001, rel: 'backlog/9001-soak-filed-card.md' } });
          if (joined.includes('open-pr')) return OPEN_PR_JSON;
          return ''; // git add/commit/push, verify — no output needed
        };
        const fakeAcquire = () => ({ lane: '7', holder: 'soak-holder', path: w.simCloneRoot });
        const fakeRelease = () => '';

        const outcome = mod.landOne(fakeEntry(), { runFn: fakeRunFn, acquireFn: fakeAcquire, releaseFn: fakeRelease });
        api.say(`r00 landOne(...) -> ${JSON.stringify(outcome)}`);

        const openPrCall = calls.find((c) => c.args.some((a) => String(a).includes('open-pr')) && c.args[0] !== 'file-item');
        const openPrArgs = openPrCall ? openPrCall.args.join(' ') : '';
        if (!/--mode=label-on-green/.test(openPrArgs)) {
          api.violation('open-pr-mode-not-label-on-green', `landOne's open-pr call did not carry --mode=label-on-green (args: ${openPrArgs || '(no open-pr call recorded)'}) — an un-flagged call defaults to open-pr's own park mode, stranding every filed card awaiting a human forever`);
        }
        if (outcome.status !== 'landed' || outcome.pr !== 2877 || outcome.prUrl !== 'https://github.com/chalbert/web-everything/pull/2877') {
          api.violation('ledger-pr-not-set', `landOne did not record the filed PR on its return value (got pr=${outcome.pr}, prUrl=${outcome.prUrl}) — patchLedgerEntry's entry.pr would never actually be set, so the ledger's own "already landed" no-op check (keyed on entry.pr) could never fire and the same entry would be re-filed every later pass`);
        }
      },
    });
  },
  judge(report) {
    return report.violations
      .filter((v) => [
        'health-file-request-land-missing', 'health-file-request-land-import-failed', 'health-file-request-land-missing-exports',
        'open-pr-result-not-parsed', 'open-pr-mode-not-label-on-green', 'ledger-pr-not-set', 'crash',
      ].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
