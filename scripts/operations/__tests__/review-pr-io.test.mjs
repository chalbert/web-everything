/**
 * @file review-pr-io.test.mjs — the `review-pr` io shell (#3035): the four sinks, with no `gh` and no network.
 *
 * WHAT IS WORTH PINNING HERE is not that a file gets written — it is the THREE-STATE mapping the executor
 * depends on. A sink that guesses "nothing landed" on an unrecognised failure double-posts a durable comment;
 * a sink that guesses "something landed" on a plain typo wedges the run. So:
 *
 *   - a refusal the single home emits BEFORE any write → `notApplied` → the entry is `failed` and retried;
 *   - ANY other failure → a plain throw → the entry stays `pending` → the executor refuses to replay it.
 *
 * The label sink's subprocess is injected, so the argv it would hand `we:scripts/review-set-label.mjs` is
 * assertable without running it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PR_VIEW_FIELDS, createReviewPrSinks, filePrView, ghPrView, isPreWriteRefusal, priorRoundsFor,
  prViewFileName, readPr, resolveViewReader, revParseCommit, reviewBodyPath, reviewSidecarDir,
} from '../review-pr-io.mjs';
import { REVIEW_EFFECTS, REVIEW_PR_CHANNEL } from '../review-pr.mjs';
import { VERDICTS, appendVerdict, buildVerdictRecord, readVerdictLedger } from '../../lib/verdict-ledger.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'review-pr-io-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const CTX = { key: 'run-1#4#0', runId: 'run-1', type: 'x', stepIndex: 4, step: 'record', index: 0 };

describe('the write-up sink', () => {
  it('writes the comment body to the operation sidecar, deterministically', async () => {
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.WRITE_UP]({ bodyFile: 'o-n-7-verdict.md', body: '# hello' }, CTX);
    expect(readFileSync(result.path, 'utf8')).toBe('# hello');
    expect(result.path).toBe(join(reviewSidecarDir(root), 'run-1', 'o-n-7-verdict.md'));
    // Re-applying writes the SAME bytes to the SAME path — which is why it is declared idempotent. A REPLAY
    // is the same run resuming, so it arrives with the same `ctx.runId` and the run-scoping is invisible to it.
    const again = await sinks[REVIEW_EFFECTS.WRITE_UP]({ bodyFile: 'o-n-7-verdict.md', body: '# hello' }, CTX);
    expect(again.path).toBe(result.path);
    expect(readFileSync(result.path, 'utf8')).toBe('# hello');
  });

  it('SCOPES the staged write-up by run — two runs on the same PR do not cross-stage', async () => {
    // The payload name is keyed by PR only, so before this the second run's bytes replaced the first's and
    // the label sink shelled the single home with `--body-file=` pointing at the wrong verdict.
    const sinks = createReviewPrSinks({ root });
    const payload = (body) => ({ bodyFile: 'o-n-7-verdict.md', body });
    const a = await sinks[REVIEW_EFFECTS.WRITE_UP](payload('# run A'), { ...CTX, runId: 'run-a' });
    const b = await sinks[REVIEW_EFFECTS.WRITE_UP](payload('# run B'), { ...CTX, runId: 'run-b' });
    expect(a.path).not.toBe(b.path);
    expect(readFileSync(a.path, 'utf8')).toBe('# run A');
    expect(readFileSync(b.path, 'utf8')).toBe('# run B');
  });

  it('REFUSES a missing or unsafe run id rather than falling back to the shared path', async () => {
    const sinks = createReviewPrSinks({ root });
    for (const runId of [undefined, '', '..', '../../etc', 'a/b']) {
      await expect(sinks[REVIEW_EFFECTS.WRITE_UP]({ bodyFile: 'o-n-7-verdict.md', body: 'x' }, { ...CTX, runId }))
        .rejects.toThrow(/valid run id/);
    }
    // …and the file name stays a bare name, so the payload cannot escape the run's directory either.
    expect(() => reviewBodyPath({ root, runId: 'run-1', bodyFile: '../x.md' })).toThrow(/bare file name/);
  });
});

describe('the label sink', () => {
  const payload = {
    pr: 7, repo: 'o/n', to: 'accepted', actor: 'operator', bodyFile: 'o-n-7-verdict.md',
    addLabel: 'review:accepted', removeLabels: ['review:pending'],
  };

  it('shells the SINGLE HOME with the target, the actor and the staged body file', async () => {
    const seen = [];
    const sinks = createReviewPrSinks({ root, runNode: (argv) => { seen.push(argv); return '{"ok":true,"pr":7,"to":"accepted"}'; } });
    const result = await sinks[REVIEW_EFFECTS.LABEL](payload, CTX);
    expect(result).toEqual({ ok: true, pr: 7, to: 'accepted' });
    const argv = seen[0];
    expect(argv[0]).toBe(join(root, 'scripts', 'review-set-label.mjs'));
    expect(argv).toContain('--repo=o/n');
    expect(argv).toContain('--to=accepted');
    expect(argv).toContain('--actor=operator');
    // The SAME run-scoped path effect 0 staged — derived from `ctx.runId`, not re-derived from the payload.
    expect(argv).toContain(`--body-file=${join(reviewSidecarDir(root), 'run-1', 'o-n-7-verdict.md')}`);
    // It never builds a `gh` call of its own — the single home owns the write arc, the markers and the ordering.
    expect(argv.join(' ')).not.toContain('gh ');
  });

  // #2898 — the single home renders the attribution it is GIVEN. Before this the CLI hardcoded "via the
  // Plateau Loop review console" for every caller, so the live run on PR #1146 posted a comment claiming a
  // surface it never touched, three lines above its own footer naming this operation.
  it('passes the CHANNEL through, so the durable comment names the surface it came through', async () => {
    const seen = [];
    const sinks = createReviewPrSinks({ root, runNode: (argv) => { seen.push(argv); return '{"ok":true}'; } });
    await sinks[REVIEW_EFFECTS.LABEL]({ ...payload, channel: REVIEW_PR_CHANNEL }, CTX);
    expect(seen[0]).toContain(`--channel=${REVIEW_PR_CHANNEL}`);
  });

  it('omits --channel entirely for a payload written before the field existed', async () => {
    const seen = [];
    const sinks = createReviewPrSinks({ root, runNode: (argv) => { seen.push(argv); return '{"ok":true}'; } });
    await sinks[REVIEW_EFFECTS.LABEL](payload, CTX);
    // The single home's own default for an absent channel is the NEUTRAL sentence, never a wrong one — so a
    // `--resume` across the upgrade degrades to "no surface stated", not to another caller's identity.
    expect(seen[0].some((a) => a.startsWith('--channel='))).toBe(false);
  });

  it('maps a PROVEN pre-write refusal to `notApplied`, so it is retried rather than refused', async () => {
    const sinks = createReviewPrSinks({
      root,
      runNode: () => { throw Object.assign(new Error('exit 1'), { stdout: '{"error":"gate-self: review:human is human-ceremony-only — clear via /review in a session"}' }); },
    });
    await expect(sinks[REVIEW_EFFECTS.LABEL](payload, CTX)).rejects.toMatchObject({ notApplied: true });
  });

  it('maps an UNRECOGNISED failure to INDETERMINATE — the comment may already be posted', async () => {
    const sinks = createReviewPrSinks({
      root,
      runNode: () => { throw Object.assign(new Error('exit 1'), { stdout: '{"error":"could not resolve host: api.github.com"}' }); },
    });
    const err = await sinks[REVIEW_EFFECTS.LABEL](payload, CTX).catch((e) => e);
    expect(err.notApplied).toBeUndefined();
    expect(String(err.message)).toMatch(/outcome is UNKNOWN/);
  });

  it('treats a zero-exit `{"error":…}` the same way — refusal vs unknown, never "it worked"', async () => {
    const refuse = createReviewPrSinks({ root, runNode: () => '{"error":"invalid --repo — expected <owner/name>"}' });
    await expect(refuse[REVIEW_EFFECTS.LABEL](payload, CTX)).rejects.toMatchObject({ notApplied: true });
    const unknown = createReviewPrSinks({ root, runNode: () => '{"error":"something nobody has seen"}' });
    await expect(unknown[REVIEW_EFFECTS.LABEL](payload, CTX)).rejects.toThrow(/outcome is UNKNOWN/);
  });

  it('recognises the pre-write refusals the single home actually emits, and nothing else', () => {
    for (const text of [
      'gate-self: review:human is human-ceremony-only — clear via /review in a session',
      'no review:human label — nothing to clear (use --to=accepted for an ordinary parked PR)',
      'invalid --to — expected \'accepted\' or \'changes\'',
      'PR 7 is MERGED, not OPEN — a review verdict here would be inert',
      'the rendered comment is 70000 chars, over GitHub\'s 65536 limit',
    ]) expect(isPreWriteRefusal(text)).toBe(true);
    for (const text of ['fatal: unable to access', 'HTTP 502', 'connection reset by peer']) {
      expect(isPreWriteRefusal(text)).toBe(false);
    }
  });
});

// The recorded basis used to name `origin/<branch>` — a ref that moves. The `reviewed-sha` marker covers the
// merge gate; it does not make the "Net basis" line reproducible, which is what this pins.
describe('the rev is pinned to a commit', () => {
  const SHA = 'd7ad4774849fe32af2a317510a43b7ca1375e6b3';

  it('resolves the candidate ref to its full commit SHA, guarding a dash-leading refname', () => {
    const calls = [];
    const exec = (cmd, args) => { calls.push([cmd, ...args]); return `${SHA}\n`; };
    expect(revParseCommit(exec, 'origin/lane/3058-seed-encoding')).toBe(SHA);
    expect(calls[0]).toEqual(['git', 'rev-parse', '--verify', '--end-of-options', 'origin/lane/3058-seed-encoding^{commit}']);
  });

  it('returns null — never a half-pin — when the rev will not resolve, and never throws', () => {
    expect(revParseCommit(() => { throw new Error('fatal: Needed a single revision'); }, 'origin/gone')).toBe(null);
    expect(revParseCommit(() => 'd7ad477\n', 'origin/x')).toBe(null); // an abbreviation is not a pin
    expect(revParseCommit(() => '', 'origin/x')).toBe(null);
    expect(revParseCommit(null, 'origin/x')).toBe(null);
    expect(revParseCommit(() => SHA, '')).toBe(null);
  });
});

describe('the ledger and notice sinks', () => {
  // #3007 — the sink now reaches the REAL verdict ledger, so every test here redirects its home. Without
  // this, running the suite would append to the operator's live ledger, which is a merge authority in
  // waiting. The redirect is set/torn down per test alongside the temp root.
  let ledgerDir;
  const prevLedgerDir = process.env.WE_VERDICT_LEDGER_DIR;
  beforeEach(() => {
    ledgerDir = mkdtempSync(join(tmpdir(), 'review-pr-io-ledger-'));
    process.env.WE_VERDICT_LEDGER_DIR = ledgerDir;
  });
  afterEach(() => {
    if (prevLedgerDir === undefined) delete process.env.WE_VERDICT_LEDGER_DIR;
    else process.env.WE_VERDICT_LEDGER_DIR = prevLedgerDir;
    rmSync(ledgerDir, { recursive: true, force: true });
    rmSync(`${ledgerDir}-locks`, { recursive: true, force: true });
  });

  it('RECONCILES against the row the single home already wrote — it does not append a second one', async () => {
    // Effect 1 shells `we:scripts/review-set-label.mjs`, which is the single home of BOTH the label swap and
    // the ledger row. By the time this sink runs the row exists, and appending again would put two rows in an
    // append-only merge authority for one verdict.
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 7, verdict: VERDICTS.ACCEPTED, at: '2026-08-10T12:00:00.000Z', source: 'review-set-label',
    }));
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 7, repo: 'o/n', to: 'accepted' }, CTX);
    expect(result).toMatchObject({ reconciled: true, verdict: 'accepted', source: 'review-set-label' });
    expect(readVerdictLedger('o/n')).toHaveLength(1);
    // The gitignored session-local sidecar the seam used before a writer existed is GONE, not migrated.
    expect(existsSync(join(reviewSidecarDir(root), 'verdicts.pending.jsonl'))).toBe(false);
  });

  it('is a no-op on replay — a second apply finds the same row and still writes nothing new', async () => {
    const sinks = createReviewPrSinks({ root });
    await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 8, repo: 'o/n', to: 'changes', actor: 'a', lens: 'correctness' }, CTX);
    const again = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 8, repo: 'o/n', to: 'changes', actor: 'a', lens: 'correctness' }, CTX);
    expect(again.reconciled).toBe(true);
    expect(readVerdictLedger('o/n')).toHaveLength(1);
  });

  it('writes a recovery row when the single home\'s fail-soft append missed, and says which path made it', async () => {
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({
      pr: 9, repo: 'o/n', to: 'accepted', actor: 'operator', lens: 'correctness', findings: [],
    }, CTX);
    expect(result).toMatchObject({ reconciled: false, source: 'operation-reconcile' });
    const rows = readVerdictLedger('o/n');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pr: 9, verdict: 'accepted', source: 'operation-reconcile', clears: true });
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE MULTI-ROUND CASE (PR #1149 review). "Already reconciled" is about THIS ROUND'S VERDICT, never about
  // the PR having any row at all. A PR that got `changes` and later `accepted` is the ordinary shape of a
  // review, so the first cut's `if (folded && folded.current)` mis-fired on most PRs: it found round 1's
  // `changes` row, called itself reconciled, and dropped the acceptance on the floor while the label said
  // accepted. Both directions are pinned — the miss must be recovered, and the hit must NOT double-write.
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────

  it('round 2 accepted after a round-1 `changes` row WRITES the fresh verdict — a stale row is not reconciliation', async () => {
    // Round 1: the reviewer bounced it, and the single home recorded that.
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 42, verdict: VERDICTS.CHANGES, at: '2026-08-01T10:00:00.000Z', source: 'review-set-label',
    }));
    // Round 2: the reviewer accepts, the label swaps, and the single home's fail-soft append misses.
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({
      pr: 42, repo: 'o/n', to: 'accepted', actor: 'operator', lens: 'correctness', findings: [],
    }, CTX);
    expect(result).toMatchObject({ reconciled: false, verdict: 'accepted', source: 'operation-reconcile' });
    const rows = readVerdictLedger('o/n');
    expect(rows.map((r) => r.verdict)).toEqual(['changes', 'accepted']);
    // The FOLD is what a Phase-2 gate would read, and it now holds the verdict the label mirrors.
    expect(rows[rows.length - 1].clears).toBe(true);
  });

  it('round 2 accepted whose single-home row DID land reconciles — the multi-round case never double-writes', async () => {
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 43, verdict: VERDICTS.CHANGES, at: '2026-08-01T10:00:00.000Z', source: 'review-set-label',
    }));
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 43, verdict: VERDICTS.ACCEPTED, at: '2026-08-02T10:00:00.000Z', source: 'review-set-label',
    }));
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 43, repo: 'o/n', to: 'accepted' }, CTX);
    expect(result).toMatchObject({ reconciled: true, verdict: 'accepted', source: 'review-set-label' });
    expect(readVerdictLedger('o/n')).toHaveLength(2);
  });

  it('a RECOVERY row is written once and only once — the replay after it finds its own row and stops', async () => {
    // The dangerous replay: the recovery path appended, then the effect is applied again. If the comparison
    // looked at anything but the LIVE verdict this would put two `accepted` rows in an append-only authority.
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 44, verdict: VERDICTS.CHANGES, at: '2026-08-01T10:00:00.000Z', source: 'review-set-label',
    }));
    const sinks = createReviewPrSinks({ root });
    const first = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 44, repo: 'o/n', to: 'accepted' }, CTX);
    const replay = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 44, repo: 'o/n', to: 'accepted' }, CTX);
    expect(first.reconciled).toBe(false);
    expect(replay).toMatchObject({ reconciled: true, verdict: 'accepted', source: 'operation-reconcile' });
    expect(readVerdictLedger('o/n').map((r) => r.verdict)).toEqual(['changes', 'accepted']);
  });

  it('another PR\'s rows are not this PR\'s reconciliation', async () => {
    appendVerdict(buildVerdictRecord({
      repo: 'o/n', pr: 45, verdict: VERDICTS.ACCEPTED, at: '2026-08-01T10:00:00.000Z', source: 'review-set-label',
    }));
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 46, repo: 'o/n', to: 'accepted' }, CTX);
    expect(result.reconciled).toBe(false);
    expect(readVerdictLedger('o/n').map((r) => r.pr)).toEqual([45, 46]);
  });

  it('a recovery row records the verdict the target actually implies — `clear-human` is not `changes`', async () => {
    // The first cut's `payload.to === 'accepted' ? ACCEPTED : CHANGES` recorded a `clear-human` clearance as a
    // HOLD. Both sides now derive through the writer's own `verdictForLabelTarget`, so they cannot diverge.
    const sinks = createReviewPrSinks({ root });
    await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 47, repo: 'o/n', to: 'clear-human' }, CTX);
    await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 48, repo: 'o/n', to: 'rearm' }, CTX);
    const rows = readVerdictLedger('o/n');
    expect(rows.map((r) => [r.pr, r.verdict, r.clears])).toEqual([[47, 'clear-human', true], [48, 'pending', false]]);
  });

  it('refuses through `notApplied` on a label target it does not know — a guessed disposition is worse than none', async () => {
    const sinks = createReviewPrSinks({ root });
    await expect(sinks[REVIEW_EFFECTS.LEDGER]({ pr: 49, repo: 'o/n', to: 'merge-it' }, CTX))
      .rejects.toThrow(/unknown label target/);
    expect(readVerdictLedger('o/n')).toEqual([]);
  });

  it('refuses through `notApplied` when the record is unbuildable — nothing landed, so it is retriable', async () => {
    const sinks = createReviewPrSinks({ root });
    await expect(sinks[REVIEW_EFFECTS.LEDGER]({ pr: 'not-a-pr', repo: 'o/n', to: 'accepted' }, CTX))
      .rejects.toThrow(/positive integer/);
    expect(readVerdictLedger('o/n')).toEqual([]);
  });

  it('emits the notice through the injected channel and writes nothing', async () => {
    const lines = [];
    const sinks = createReviewPrSinks({ root, out: (l) => lines.push(l) });
    await sinks[REVIEW_EFFECTS.NOTICE]({ notice: 'PR o/n#7 — human review accepted by operator.' }, CTX);
    expect(lines).toEqual(['PR o/n#7 — human review accepted by operator.']);
    expect(existsSync(join(reviewSidecarDir(root), 'verdicts.pending.jsonl'))).toBe(false);
    expect(readVerdictLedger('o/n')).toEqual([]);
  });
});

/**
 * THE ROUND NUMBER IS ROUNDS SINCE THE LAST CLEAR, not rows ever written (#3072; PR #1178 review, finding 3).
 *
 * `history` holds every verdict a PR has ever carried, including rows from an already-CONVERGED loop, so
 * counting its length made a brand-new review of a previously-accepted PR report itself as round N of a cap of
 * 5. Measured on real repo data before the fix: PRs 1162 and 1164 each ran three `changes` rounds then an
 * `accepted` that cleared them, and the old expression reported `exhausted` on the FIRST round of the next
 * loop. #1164's four-round run is why the cap is 5, so the miscount strangled the exact case the cap allows.
 */
describe('priorRounds counts the CURRENT loop', () => {
  let ledgerDir;
  const prevLedgerDir = process.env.WE_VERDICT_LEDGER_DIR;
  beforeEach(() => {
    ledgerDir = mkdtempSync(join(tmpdir(), 'review-pr-io-rounds-'));
    process.env.WE_VERDICT_LEDGER_DIR = ledgerDir;
  });
  afterEach(() => {
    if (prevLedgerDir === undefined) delete process.env.WE_VERDICT_LEDGER_DIR;
    else process.env.WE_VERDICT_LEDGER_DIR = prevLedgerDir;
    rmSync(ledgerDir, { recursive: true, force: true });
    rmSync(`${ledgerDir}-locks`, { recursive: true, force: true });
  });

  const row = (verdict, at) => appendVerdict(buildVerdictRecord({
    repo: 'o/n', pr: 7, verdict, at, source: 'review-set-label',
  }));
  /** The REAL helper the reader calls, over the ledger as it now stands. */
  const priorRounds = () => priorRoundsFor('o/n', 7);

  it('is 0 on a PR with no history at all', () => {
    expect(priorRounds()).toBe(0);
  });

  it('counts the bounces of an open loop', () => {
    row(VERDICTS.CHANGES, '2026-08-10T12:00:00.000Z');
    row(VERDICTS.CHANGES, '2026-08-10T13:00:00.000Z');
    expect(priorRounds()).toBe(2);
  });

  // THE ONE THAT WAS WRONG. Three bounces then an accept is a CONVERGED loop; the next review starts over.
  it('RESETS after a clearing verdict — a converged loop does not count against the next one', () => {
    row(VERDICTS.CHANGES, '2026-08-10T12:00:00.000Z');
    row(VERDICTS.CHANGES, '2026-08-10T13:00:00.000Z');
    row(VERDICTS.CHANGES, '2026-08-10T14:00:00.000Z');
    row(VERDICTS.ACCEPTED, '2026-08-10T15:00:00.000Z');
    expect(priorRounds()).toBe(0); // history.length would be 4 — round 5 of 5, i.e. `exhausted` on a fresh loop
  });

  it('counts only the bounces since that clear', () => {
    row(VERDICTS.CHANGES, '2026-08-10T12:00:00.000Z');
    row(VERDICTS.ACCEPTED, '2026-08-10T13:00:00.000Z');
    row(VERDICTS.CHANGES, '2026-08-10T14:00:00.000Z');
    expect(priorRounds()).toBe(1);
  });
});

/**
 * The PR-view transport (the ONE network reach, made swappable).
 *
 * What is worth pinning is not that a file can be read — it is that the swap cannot widen what the review
 * trusts. `gh` stays the default when nothing is staged; a staged view supplies the SAME field set; and a
 * missing or corrupt file FAILS rather than degrading to an empty view, which would silently review a PR as
 * if it had no body, no labels and no comments.
 */
describe('the PR-view transport', () => {
  it('defaults to gh when no view directory is staged', () => {
    expect(resolveViewReader({})).toBe(ghPrView);
  });

  it('swaps to the on-disk reader when WE_PR_VIEW_DIR is set', () => {
    expect(resolveViewReader({ WE_PR_VIEW_DIR: root })).not.toBe(ghPrView);
  });

  it('names a staged view by encoded slug and number', () => {
    expect(prViewFileName('chalbert/web-everything', 1465)).toBe('chalbert%2Fweb-everything-1465.json');
  });

  // The `-` flattening was NOT injective: a repo name may contain `-`, so two different repos landed on one
  // file and the second staged view silently answered for the first — wrong labels/body, right diff.
  it('never collides two different repos onto one file', () => {
    expect(prViewFileName('foo-bar/baz', 5)).not.toBe(prViewFileName('foo/bar-baz', 5));
  });

  it('reads a staged view the resolver points at', () => {
    const view = { number: 7, title: 'x', body: 'b', labels: [], comments: [], files: [], headRefName: 'lane/x' };
    writeFileSync(join(root, prViewFileName('o/r', 7)), JSON.stringify(view));
    expect(resolveViewReader({ WE_PR_VIEW_DIR: root })({ pr: 7, repo: 'o/r' })).toEqual(view);
  });

  it('THROWS on a missing staged view, naming the path and the way back to gh', () => {
    expect(() => filePrView({ pr: 9, repo: 'o/r', dir: root }))
      .toThrow(/no pre-fetched view at .*o%2Fr-9\.json[\s\S]*WE_PR_VIEW_DIR/);
  });

  it('THROWS on a corrupt staged view rather than yielding an empty one', () => {
    writeFileSync(join(root, prViewFileName('o/r', 9)), '{not json');
    expect(() => filePrView({ pr: 9, repo: 'o/r', dir: root })).toThrow(/is not valid JSON/);
  });

  it('asks both transports for the same field set', () => {
    expect(PR_VIEW_FIELDS).toContain('headRefName');
    expect(PR_VIEW_FIELDS).toContain('body');
    expect(PR_VIEW_FIELDS).toContain('labels');
    expect(PR_VIEW_FIELDS).toContain('comments');
    expect(PR_VIEW_FIELDS).toContain('files');
  });
});

/**
 * The `readView` WIRING inside `readPr` — the integration point, not just the transports.
 *
 * The transports each had unit tests, but nothing called the real `readPr` with an injected `readView`, so a
 * dropped or misnamed argument at the one call site would have surfaced only against a live `gh` or a staged
 * file (review-pr correctness juror on #1466). `exec` is injected too, so this stays io-free: no `gh`, no
 * `git`, no network — the property the file header claims.
 */
describe('readPr wires the injected view transport', () => {
  const VIEW = {
    number: 7, title: 'a title', url: 'https://example.invalid/7', body: 'a body',
    labels: [{ name: 'review:pending' }], comments: [], files: [{ path: 'a.mjs', additions: 1, deletions: 0 }],
    headRefName: 'lane/x',
  };
  // Enough of a git for the net-diff helpers to resolve a basis and an empty diff without touching a repo.
  const execStub = () => '';

  it('calls readView with the pr, repo and cwd it was given', () => {
    const seen = [];
    readPr({ pr: 7, repo: 'o/n', exec: execStub, cwd: '/somewhere', readView: (o) => { seen.push(o); return VIEW; } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ pr: 7, repo: 'o/n', cwd: '/somewhere' });
  });

  it('carries the transport-supplied view through into the read finding', () => {
    const out = readPr({ pr: 7, repo: 'o/n', exec: execStub, readView: () => VIEW });
    expect(out.headRefName).toBe('lane/x');
    expect(out.body).toBe('a body');
  });

  it('validates pr and repo BEFORE calling the transport — a bad request never reaches it', () => {
    let called = 0;
    const readView = () => { called += 1; return VIEW; };
    expect(() => readPr({ pr: 0, repo: 'o/n', exec: execStub, readView })).toThrow(/positive integer/);
    expect(() => readPr({ pr: 7, repo: 'not-a-slug', exec: execStub, readView })).toThrow(/owner\/name/);
    expect(called).toBe(0);
  });

  it('propagates a transport failure rather than reviewing an empty view', () => {
    expect(() => readPr({
      pr: 7, repo: 'o/n', exec: execStub, readView: () => { throw new Error('no pre-fetched view at /x.json'); },
    })).toThrow(/no pre-fetched view/);
  });
});
