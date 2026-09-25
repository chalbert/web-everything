/**
 * @file scripts/__tests__/merge-ai-prs-merge-trace-post-confirm.test.mjs
 * @description #xngv3vn (epic #3383/#4075) — LIVE INCIDENT, chalbert/web-everything#2596, 2026-09-24: the drain
 *   posted "📌 Merge trace — landed head `053c499f0…` — merged by drain" at 23:53Z while the PR stayed OPEN and
 *   CONFLICTING. Root cause: the merge-trace comment (`buildMergeTraceReason` — "landed head ... merged by ...",
 *   a PAST-TENSE, confirmed-fact claim) used to be posted UNCONDITIONALLY, right before the merge write even
 *   ran, inside `runCli`'s per-candidate merge loop in `we:scripts/merge-ai-prs.mjs`. A merge attempt that then
 *   failed (a real conflict — `gh pr merge` refusing) left that false claim permanently on the PR, with no
 *   correction.
 *
 *   The fix defers the WRITE (not the read — `traceHeadSha`/`traceReason` are still computed eagerly, so the
 *   trace still names the exact commit this pass is about to attempt) into a `postMergeTrace()` closure that is
 *   called ONLY from a branch that has already confirmed the merge landed (fresh `merged.push`, the
 *   already-merged-by-a-concurrent-lander idempotent no-op, and the contended-fallback already-merged recovery)
 *   — never from the genuine-failure path that feeds `failedMerges`.
 *
 *   `runCli` is not exported (only runs under the `IS_CLI` guard) and this file's own established norm (see
 *   `merge-ai-prs-ai-detection-and-drain-ordering.test.mjs`'s #984 F2 block) is to prove call-site wiring
 *   inside it via SOURCE-CONTRACT assertions rather than executing the whole CLI — the loop's real effects
 *   (git/gh) are already covered end-to-end by that file's `runCli`-executing siblings for other concerns, and
 *   this particular ordering guarantee is a pure "which branch calls which closure" fact the source text can
 *   prove directly and far more cheaply than a full fake-`gh` subprocess harness.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

describe('merge-ai-prs — #xngv3vn: the merge-trace comment is posted only after a CONFIRMED merge', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  // Isolate the per-candidate merge block this bug lived in: from the trace-read comment down to the start of
  // the next top-level section (the local-main sync), so every assertion below is scoped to it and cannot be
  // satisfied by an unrelated `postMergeTrace`-shaped string elsewhere in this 400KB+ file.
  const blockStart = src.indexOf('// #2412 Gap 2 — the before-land trace');
  const blockEnd = src.indexOf('// Sync the LOCAL main checkout to the just-advanced origin/main');
  it('the merge-trace block exists and precedes the local-main sync (sanity anchor)', () => {
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);
  });
  const block = src.slice(blockStart, blockEnd);

  it('defines postMergeTrace as a closure (the write is not inlined at the read site)', () => {
    expect(block).toMatch(/const postMergeTrace = \(\) => \{/);
  });

  it('the trace READ (traceHeadSha/traceReason) still happens eagerly, ahead of the merge attempt', () => {
    const readIdx = block.indexOf('const traceHeadSha = fetchPrHeadSha(');
    const closureIdx = block.indexOf('const postMergeTrace = ()');
    const lockIdx = block.indexOf('const landLock = withLandWriteLock(');
    expect(readIdx).toBeGreaterThan(-1);
    expect(closureIdx).toBeGreaterThan(readIdx);
    expect(lockIdx).toBeGreaterThan(closureIdx);
  });

  it('postMergeTrace() is called in the fresh-merge success path, right after merged.push', () => {
    const pushIdx = block.indexOf('merged.push({ num: c.num, repo: c.repo, headSha: c.headSha ?? null }); progressed = true;');
    expect(pushIdx).toBeGreaterThan(-1);
    const afterPush = block.slice(pushIdx, pushIdx + 400);
    expect(afterPush).toMatch(/postMergeTrace\(\);/);
  });

  // xvzc4v4 (merge-safety review, bug 2) — both windows below were widened (700→2400, 400→1600) to fit the
  // explanatory comment this fix added ahead of each branch's `postMergeTrace();` call. The invariant these two
  // tests prove is unchanged: `merged.push`/`postMergeTrace()` still fire only on a CONFIRMED-merge branch —
  // bug 2's fix is that these two branches now ALSO push into `merged` (see the couple test file for that half),
  // never that they call `postMergeTrace()` any differently than before.
  it('postMergeTrace() is called on the already-merged-by-a-concurrent-lander idempotent path (still a confirmed merge)', () => {
    const idx = block.indexOf("skipped === 'already-merged'");
    expect(idx).toBeGreaterThan(-1);
    const branch = block.slice(idx, idx + 2400);
    expect(branch).toMatch(/postMergeTrace\(\);/);
  });

  it('postMergeTrace() is called on the contended-write-fallback already-merged recovery path (still a confirmed merge)', () => {
    const catchIdx = block.indexOf('} catch (e) {');
    expect(catchIdx).toBeGreaterThan(-1);
    const afterCatch = block.slice(catchIdx);
    const alreadyMergedIdx = afterCatch.indexOf('if (isPrAlreadyMerged(c.repo, c.num)) {');
    expect(alreadyMergedIdx).toBeGreaterThan(-1);
    const branch = afterCatch.slice(alreadyMergedIdx, alreadyMergedIdx + 1600);
    expect(branch).toMatch(/postMergeTrace\(\);/);
  });

  it('postMergeTrace() is NEVER called on the genuine merge-failure path that feeds failedMerges (the #2596 bug)', () => {
    // Anchored to START right AFTER the contended-fallback already-merged recovery's own `continue;` (a real
    // confirmed-merge branch this suite already covers above), so this region is exactly the genuine-failure
    // path — never accidentally including the recovery branch's own legitimate `postMergeTrace()` call.
    // xvzc4v4 — the anchor text is this branch's own (post-bug-2-fix) stderr message, unique to it.
    const recoveryContinueIdx = block.indexOf('confirmed merged despite the gh error above');
    expect(recoveryContinueIdx).toBeGreaterThan(-1);
    const genuineFailureStart = block.indexOf('continue;', recoveryContinueIdx) + 'continue;'.length;
    const failedPushIdx = block.indexOf('failedMerges.push({', genuineFailureStart);
    expect(failedPushIdx).toBeGreaterThan(genuineFailureStart);
    const genuineFailureRegion = block.slice(genuineFailureStart, failedPushIdx);
    expect(genuineFailureRegion).not.toMatch(/postMergeTrace\(\);/);
  });

  it('exactly 3 call sites of postMergeTrace() total: one per confirmed-merge branch, 0 anywhere else', () => {
    const calls = block.match(/postMergeTrace\(\);/g) || [];
    expect(calls).toHaveLength(3);
  });

  // xvzc4v4 (merge-safety review, bug 2) — the actual fix: BOTH already-merged recovery branches now also push
  // into `merged` (previously only the fresh-merge branch did, on the mistaken theory that "another lander"
  // always owns the post-land numbering/resolve-on-land/derived-regen follow-up — false whenever nothing else
  // actually merged it, e.g. our own `gh` call throwing after a real server-side merge, or a GitHub-UI merge).
  it('bug 2 fix: the pre-check already-merged branch also records the PR into `merged` (its numbering/regen follow-up now runs)', () => {
    const idx = block.indexOf("skipped === 'already-merged'");
    const branch = block.slice(idx, idx + 2400);
    expect(branch).toMatch(/merged\.push\(\{ num: c\.num, repo: c\.repo, headSha: c\.headSha \?\? null \}\);/);
  });
  it('bug 2 fix: the contended-write-fallback already-merged branch also records the PR into `merged`', () => {
    const catchIdx = block.indexOf('} catch (e) {');
    const afterCatch = block.slice(catchIdx);
    const alreadyMergedIdx = afterCatch.indexOf('if (isPrAlreadyMerged(c.repo, c.num)) {');
    const branch = afterCatch.slice(alreadyMergedIdx, alreadyMergedIdx + 1600);
    expect(branch).toMatch(/merged\.push\(\{ num: c\.num, repo: c\.repo, headSha: c\.headSha \?\? null \}\);/);
  });
});
