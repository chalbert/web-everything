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
    expect(block).toMatch(/postMergeTrace = makeMergeTrace\(traceHeadSha, preread\.comments\);/);
    expect(src).toMatch(/const makeMergeTrace = \(headSha, prereadComments\) => \(\) => \{/);
  });

  // xvzc4v4 advisory fix — the closure used to be a `const` INSIDE the per-candidate `try`, so the `catch`
  // branch's call to it threw a ReferenceError (a sibling lexical scope) and crashed the whole pass. It is now
  // a `let` declared ABOVE the `try`, assigned inside it. (The crash itself is covered by a real-execution test in
  // gate-entrypoint-integration.test.mjs — these source checks alone could not see it.) It starts as a REAL
  // poster for the judged head, never a no-op stub: a stub silently dropped the trace for a PR found already
  // merged right after revalidation, before the land path rebinds it (real-execution test there too).
  it('postMergeTrace is declared with `let` ABOVE the per-candidate try, so the catch branch can reach it', () => {
    const declIdx = src.indexOf('let postMergeTrace = makeMergeTrace(c.listedHeadSha || c.headSha || null, null);');
    expect(src).not.toMatch(/let postMergeTrace = \(\) => \{\};/);
    expect(declIdx).toBeGreaterThan(-1);
    const tryIdx = src.indexOf('try {', declIdx);
    expect(tryIdx).toBeGreaterThan(declIdx);
    expect(tryIdx).toBeLessThan(blockStart);
    expect(block).not.toMatch(/const postMergeTrace\b/);
  });

  it('the trace READ (traceHeadSha/traceReason) still happens eagerly, ahead of the merge attempt', () => {
    // xvzc4v4 advisory fix — the head is the SHA revalidation pinned, not a separate best-effort read.
    const readIdx = block.indexOf('const traceHeadSha = revalidated.headSha;');
    const closureIdx = block.indexOf('postMergeTrace = makeMergeTrace(');
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

  // xvzc4v4 (merge-safety review, bug 2 + advisory fix) — every already-merged branch now routes through the one
  // `recordAlreadyMerged()` helper (merged.push + bookkeeping + `postMergeTrace()`), so these assert the helper
  // call; the helper's own body is asserted separately below. The windows are wide to fit each branch's comment.
  it('the already-merged-by-a-concurrent-lander idempotent path records + traces via recordAlreadyMerged() (still a confirmed merge)', () => {
    const idx = block.indexOf("skipped === 'already-merged'");
    expect(idx).toBeGreaterThan(-1);
    const branch = block.slice(idx, idx + 2400);
    expect(branch).toMatch(/recordAlreadyMerged\(\);/);
  });

  it('the contended-write-fallback already-merged recovery path records + traces via recordAlreadyMerged() (still a confirmed merge)', () => {
    const catchIdx = block.indexOf('} catch (e) {');
    expect(catchIdx).toBeGreaterThan(-1);
    const afterCatch = block.slice(catchIdx);
    const alreadyMergedIdx = afterCatch.indexOf('if (isPrAlreadyMerged(c.repo, c.num)) {');
    expect(alreadyMergedIdx).toBeGreaterThan(-1);
    const branch = afterCatch.slice(alreadyMergedIdx, alreadyMergedIdx + 1600);
    expect(branch).toMatch(/recordAlreadyMerged\(\);/);
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
    expect(genuineFailureRegion).not.toMatch(/recordAlreadyMerged\(\);/);
  });

  it('exactly 2 call sites of postMergeTrace() in the file: the fresh-merge path and the recordAlreadyMerged helper', () => {
    expect(block.match(/postMergeTrace\(\);/g) || []).toHaveLength(1);
    expect(src.match(/postMergeTrace\(\);/g) || []).toHaveLength(2);
    // the helper's 3 callers: revalidation-found-merged, the in-lock pre-check, and the post-throw re-probe
    expect(src.match(/recordAlreadyMerged\(\);/g) || []).toHaveLength(3);
  });

  // xvzc4v4 (merge-safety review, bug 2) — the actual fix: every already-merged branch records the PR into
  // `merged` (previously only the fresh-merge branch did, on the mistaken theory that "another lander" always
  // owns the post-land numbering/resolve-on-land/derived-regen follow-up — false whenever nothing else actually
  // merged it, e.g. our own `gh` call throwing after a real server-side merge, or a GitHub-UI merge).
  it('bug 2 fix: the recordAlreadyMerged helper records the PR into `merged` and posts the trace', () => {
    const idx = src.indexOf('const recordAlreadyMerged = () => {');
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, src.indexOf('};', idx));
    expect(body).toMatch(/merged\.push\(\{ num: c\.num, repo: c\.repo, headSha: c\.headSha \?\? null \}\);/);
    expect(body).toMatch(/postMergeTrace\(\);/);
  });
});
