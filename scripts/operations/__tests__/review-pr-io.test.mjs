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

import { createReviewPrSinks, isPreWriteRefusal, reviewSidecarDir } from '../review-pr-io.mjs';
import { REVIEW_EFFECTS } from '../review-pr.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'review-pr-io-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const CTX = { key: 'run-1#4#0', runId: 'run-1', type: 'x', stepIndex: 4, step: 'record', index: 0 };

describe('the write-up sink', () => {
  it('writes the comment body to the operation sidecar, deterministically', async () => {
    const sinks = createReviewPrSinks({ root });
    const result = await sinks[REVIEW_EFFECTS.WRITE_UP]({ bodyFile: 'o-n-7-verdict.md', body: '# hello' }, CTX);
    expect(readFileSync(result.path, 'utf8')).toBe('# hello');
    expect(result.path).toBe(join(reviewSidecarDir(root), 'o-n-7-verdict.md'));
    // Re-applying writes the SAME bytes to the SAME path — which is why it is declared idempotent.
    const again = await sinks[REVIEW_EFFECTS.WRITE_UP]({ bodyFile: 'o-n-7-verdict.md', body: '# hello' }, CTX);
    expect(again.path).toBe(result.path);
    expect(readFileSync(result.path, 'utf8')).toBe('# hello');
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
    expect(argv).toContain(`--body-file=${join(reviewSidecarDir(root), 'o-n-7-verdict.md')}`);
    // It never builds a `gh` call of its own — the single home owns the write arc, the markers and the ordering.
    expect(argv.join(' ')).not.toContain('gh ');
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
