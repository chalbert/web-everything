import { describe, it, expect } from 'vitest';
import { isLaneLocus } from '../guard-lane.mjs';

// #1961 correctness finding 1 — the numberStranded lane refusal shipped with ZERO coverage: no test
// exercised the CLI with a lane-shaped cwd, so mutating the guard to always pass would redden nothing.
// The predicate is extracted and exported so the refusal is testable without spawning the CLI.
describe('isLaneLocus — the numberStranded locus refusal (#1961)', () => {
  it('is TRUE inside a lane clone, where a hand-picked NNN would be rejected by check:standards', () => {
    expect(isLaneLocus('/home/user/.lanes/web-everything/lane-1')).toBe(true);
    expect(isLaneLocus('/home/user/.lanes/web-everything/lane-1/backlog')).toBe(true);
  });

  it('is FALSE in a primary checkout, the one place number-stranded belongs', () => {
    expect(isLaneLocus('/home/user/web-everything')).toBe(false);
    expect(isLaneLocus('/home/user/frontierui')).toBe(false);
  });

  it('is FALSE for an empty or absent path — never guess a locus', () => {
    expect(isLaneLocus('')).toBe(false);
    expect(isLaneLocus(null)).toBe(false);
    expect(isLaneLocus(undefined)).toBe(false);
  });

  it('does not match a directory merely NAMED like the marker', () => {
    expect(isLaneLocus('/home/user/my.lanes-notes')).toBe(false);
    expect(isLaneLocus('/home/user/lanes/web-everything')).toBe(false);
  });
});
