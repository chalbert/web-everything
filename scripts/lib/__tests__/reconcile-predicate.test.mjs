/**
 * @file scripts/lib/__tests__/reconcile-predicate.test.mjs
 * @description Unit proof of #2859's canonical argv→flags reduction and reconcile predicate — the module
 * `plateau-app:tools/drain-daemon/lib.mjs`'s `childPassEnforcesHoldInvariant` mirrors and that
 * `plateau-app:tools/drain-daemon/lib.test.mjs`'s cross-repo contract test pins against directly. Redden this
 * file if the regex, the empty-label handling (`Boolean(label)` vs `label`), or the negation check drifts.
 */
import { describe, it, expect } from 'vitest';
import { parseArgvFlags, reconcileWouldRunFor } from '../reconcile-predicate.mjs';

describe('parseArgvFlags (#2859)', () => {
  it('records a bare --name as true', () => {
    expect(parseArgvFlags(['--watch'])).toEqual({ watch: true });
  });

  it('records a valued --name=value as its raw string', () => {
    expect(parseArgvFlags(['--label=ready-to-merge'])).toEqual({ label: 'ready-to-merge' });
  });

  it('records a present-but-empty --name= as the empty string, not true', () => {
    expect(parseArgvFlags(['--label='])).toEqual({ label: '' });
  });

  it('silently skips non-flag tokens (a script path, a positional)', () => {
    expect(parseArgvFlags(['scripts/merge-ai-prs.mjs', 'positional', '--label=x'])).toEqual({ label: 'x' });
  });

  it('is defensive against a non-array input', () => {
    expect(parseArgvFlags(undefined)).toEqual({});
    expect(parseArgvFlags(null)).toEqual({});
  });

  it('last occurrence wins for a repeated flag', () => {
    expect(parseArgvFlags(['--label=a', '--label=b'])).toEqual({ label: 'b' });
  });
});

describe('reconcileWouldRunFor (#2859)', () => {
  it('true: label present (non-empty), no negation', () => {
    expect(reconcileWouldRunFor(['--label=ready-to-merge'])).toBe(true);
  });

  it('false: no --label at all', () => {
    expect(reconcileWouldRunFor(['--watch'])).toBe(false);
    expect(reconcileWouldRunFor([])).toBe(false);
  });

  it('false: --label= present but empty (divergence 2 — presence-only match used to pass this)', () => {
    expect(reconcileWouldRunFor(['scripts/merge-ai-prs.mjs', '--label='])).toBe(false);
  });

  it('false: label present, bare --no-reconcile-labels negation', () => {
    expect(reconcileWouldRunFor(['--label=ready-to-merge', '--no-reconcile-labels'])).toBe(false);
  });

  it('false: label present, valued negation --no-reconcile-labels=1 (divergence 1 — exact-string .includes used to miss this)', () => {
    expect(reconcileWouldRunFor(['--label=ready-to-merge', '--no-reconcile-labels=1'])).toBe(false);
  });

  it('false: label present, valued negation --no-reconcile-labels=true', () => {
    expect(reconcileWouldRunFor(['--label=ready-to-merge', '--no-reconcile-labels=true'])).toBe(false);
  });

  it('false: label present, valued negation --no-reconcile-labels=false is STILL a negation (any value is truthy on the flags object)', () => {
    expect(reconcileWouldRunFor(['--label=ready-to-merge', '--no-reconcile-labels=false'])).toBe(false);
  });

  it('is defensive against a non-array input', () => {
    expect(reconcileWouldRunFor(undefined)).toBe(false);
    expect(reconcileWouldRunFor(null)).toBe(false);
  });
});
