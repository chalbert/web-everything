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
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createReviewPrSinks, isPreWriteRefusal, revParseCommit, reviewBodyPath, reviewSidecarDir,
} from '../review-pr-io.mjs';
import { REVIEW_EFFECTS, REVIEW_PR_CHANNEL } from '../review-pr.mjs';

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
  it('appends a ledger row to the SIDECAR, and says in the result that it is not the #3007 ledger', async () => {
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.LEDGER]({ pr: 7, repo: 'o/n', to: 'accepted' }, CTX);
    expect(result.note).toMatch(/NOT the #3007 verdict ledger/);
    const row = JSON.parse(readFileSync(result.path, 'utf8').trim());
    expect(row).toMatchObject({ effectKey: CTX.key, runId: CTX.runId, pr: 7, to: 'accepted' });
    // It is a sidecar under `.operations/`, which is gitignored — never a committed store.
    expect(result.path.includes(join('.operations', 'review'))).toBe(true);
  });

  it('emits the notice through the injected channel and writes nothing', async () => {
    const lines = [];
    const sinks = createReviewPrSinks({ root, out: (l) => lines.push(l) });
    await sinks[REVIEW_EFFECTS.NOTICE]({ notice: 'PR o/n#7 — human review accepted by operator.' }, CTX);
    expect(lines).toEqual(['PR o/n#7 — human review accepted by operator.']);
    expect(existsSync(join(reviewSidecarDir(root), 'verdicts.pending.jsonl'))).toBe(false);
  });
});
