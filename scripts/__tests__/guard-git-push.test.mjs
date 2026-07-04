/**
 * @file scripts/__tests__/guard-git-push.test.mjs
 * @description Proof of the #2217 pre-push strict-lock decision (guard-git-push.mjs) — LAYER 3 of the #2203
 *   lock that catches a SCRIPT-internal push to `main` the Bash-tool guard can't see. The git process is the
 *   I/O boundary (the hook pipes the ref list on stdin); the pure block/allow decision is unit-tested here.
 */
import { describe, it, expect } from 'vitest';
import { mainPushRefs, pushGuardDecision } from '../guard-git-push.mjs';

// A pre-push stdin line: `<localRef> <localSha> <remoteRef> <remoteSha>`.
const line = (localRef, remoteRef) => `${localRef} ${'a'.repeat(40)} ${remoteRef} ${'b'.repeat(40)}`;

describe('mainPushRefs', () => {
  it('matches a push to refs/heads/main', () => {
    expect(mainPushRefs(line('refs/heads/main', 'refs/heads/main'))).toEqual(['refs/heads/main']);
  });
  it('does NOT match a push to a lane/* ref (the sanctioned path)', () => {
    expect(mainPushRefs(line('HEAD', 'refs/heads/lane/x-2217'))).toEqual([]);
  });
  it('catches a DELETE of main (zero local sha, same remoteRef)', () => {
    expect(mainPushRefs(`(delete) ${'0'.repeat(40)} refs/heads/main ${'0'.repeat(40)}`)).toEqual(['refs/heads/main']);
  });
  it('matches even when a lane push is in the same batch (mixed refspecs)', () => {
    const stdin = [line('HEAD', 'refs/heads/lane/x-1'), line('refs/heads/main', 'refs/heads/main')].join('\n');
    expect(mainPushRefs(stdin)).toEqual(['refs/heads/main']);
  });
  it('ignores blank / malformed lines', () => {
    expect(mainPushRefs('\n  \nfoo\n')).toEqual([]);
    expect(mainPushRefs('')).toEqual([]);
  });
});

describe('pushGuardDecision', () => {
  it('BLOCKS a push to main (returns a #2203 reason)', () => {
    const r = pushGuardDecision(line('refs/heads/main', 'refs/heads/main'));
    expect(r).toMatch(/BLOCKED/);
    expect(r).toMatch(/#2203/);
    expect(r).toMatch(/MAIN_PUSH_OK=1/);
  });
  it('ALLOWS a lane/* push (returns null)', () => {
    expect(pushGuardDecision(line('HEAD', 'refs/heads/lane/x-2217'))).toBe(null);
  });
  it('ALLOWS a main push when the MAIN_PUSH_OK override is set (mirrors guard-bash)', () => {
    expect(pushGuardDecision(line('refs/heads/main', 'refs/heads/main'), { override: true })).toBe(null);
  });
  it('an empty payload (no refs) is allowed', () => {
    expect(pushGuardDecision('')).toBe(null);
  });
});
