/**
 * @file scripts/__tests__/audit-backlog-health.test.mjs
 * @description Unit harness for the `A1` missing-done-when-proof predicate (#2949) — the first test
 * file `audit-backlog-health.mjs` has ever had. `missingDoneWhenProof` is exported specifically so this
 * file can exercise it directly against synthetic fixture bodies, rather than round-tripping through the
 * whole live audit (which reads the real backlog dir and writes `audits/backlog-health-audit.md`).
 */
import { describe, it, expect } from 'vitest';
import { missingDoneWhenProof } from '../audit-backlog-health.mjs';

describe('missingDoneWhenProof — A1 (#2949)', () => {
  it('hits when the body has neither a `## Done when` nor `## Acceptance` heading', () => {
    const it_ = { body: '# Title\n\nSome digest paragraph with no proof section at all.\n' };
    expect(missingDoneWhenProof(it_)).toEqual({ hit: true, reason: 'no-section' });
  });

  it('hits when the section exists but carries no backticked path/command-shaped token', () => {
    const it_ = {
      body: '# Title\n\ndigest.\n\n## Done when\n\nIt works when it feels done and the reviewer agrees.\n',
    };
    expect(missingDoneWhenProof(it_)).toEqual({ hit: true, reason: 'no-executable-token' });
  });

  it('does not hit when the section names a real, path-shaped token', () => {
    const it_ = {
      body:
        '# Title\n\ndigest.\n\n## Done when\n\n1. **Executable** — a vitest case in `scripts/__tests__/audit-backlog-health.test.mjs` passes.\n',
    };
    expect(missingDoneWhenProof(it_)).toEqual({ hit: false, reason: null });
  });

  it('does not hit when the section carries an explicit exemption phrase', () => {
    const it_ = {
      body: '# Title\n\ndigest.\n\n## Done when\n\ndoc-only — pure prose change, no tier-1 command applies.\n',
    };
    expect(missingDoneWhenProof(it_)).toEqual({ hit: false, reason: null });
  });

  it('also recognizes the legacy `## Acceptance` heading', () => {
    const noToken = { body: '# Title\n\ndigest.\n\n## Acceptance\n\nLooks right on review.\n' };
    expect(missingDoneWhenProof(noToken)).toEqual({ hit: true, reason: 'no-executable-token' });
    const withToken = {
      body: '# Title\n\ndigest.\n\n## Acceptance criteria\n\n`scripts/check-standards.mjs` reports 0 errors.\n',
    };
    expect(missingDoneWhenProof(withToken)).toEqual({ hit: false, reason: null });
  });
});
