/**
 * @file scripts/__tests__/audit-backlog-health.test.mjs
 * @description Unit harness for the `A1` missing-done-when-proof predicate (#2949) — the first test
 * file `audit-backlog-health.mjs` has ever had. `missingDoneWhenProof` is exported specifically so this
 * file can exercise it directly against synthetic fixture bodies, rather than round-tripping through the
 * whole live audit (which reads the real backlog dir and writes `audits/backlog-health-audit.md`).
 */
import { describe, it, expect } from 'vitest';
import { missingDoneWhenProof, forkLeansOnUnruled, PROSE_PREREQ, ANY_REF, CITATION_GUARD } from '../audit-backlog-health.mjs';

// #3522: exercise the live extractors so G1/D2 cannot silently lose short or long ids.
describe('PROSE_PREREQ — G1', () => {
  it('hits on 1-2 digit prerequisite ids', () => {
    const body = 'Requires #7 and builds on #39.';
    expect([...body.matchAll(PROSE_PREREQ)].map(m => m[2])).toEqual(['7', '39']);
  });

  it('hits on a 4-digit prerequisite id without truncating it', () => {
    const body = 'Gated on #3512.';
    expect([...body.matchAll(PROSE_PREREQ)].map(m => m[2])).toEqual(['3512']);
  });

  it('accepts longer prerequisite ids, including citations without a hash', () => {
    const body = 'Depends on #12345 and requires 123456.';
    expect([...body.matchAll(PROSE_PREREQ)].map(m => m[2])).toEqual(['12345', '123456']);
  });

  it('requires a right word boundary instead of reading a numeric prefix', () => {
    const body = 'Requires #2209suffix and builds on #3512_suffix.';
    expect([...body.matchAll(PROSE_PREREQ)]).toEqual([]);
  });
});

describe("CITATION_GUARD — G1 'blocked on/by' enumeration guard", () => {
  it('recognizes a 4-digit citation to the left as already-anchored', () => {
    const body = 'Related to #2209, blocked by #3512 for scheduling.';
    const m = [...body.matchAll(PROSE_PREREQ)].find(m => m[2] === '3512');
    expect(CITATION_GUARD.test(body.slice(Math.max(0, m.index - 40), m.index))).toBe(true);
  });

  it('recognizes a 1-2 digit citation to the left as already-anchored', () => {
    const body = 'Related to #7, blocked by #39 for scheduling.';
    const m = [...body.matchAll(PROSE_PREREQ)].find(m => m[2] === '39');
    expect(CITATION_GUARD.test(body.slice(Math.max(0, m.index - 40), m.index))).toBe(true);
  });

  it('does not match when there is no citation to the left', () => {
    const body = 'This item is blocked by #39 for scheduling.';
    const m = [...body.matchAll(PROSE_PREREQ)].find(m => m[2] === '39');
    expect(CITATION_GUARD.test(body.slice(Math.max(0, m.index - 40), m.index))).toBe(false);
  });
});

describe('ANY_REF — D2 (also G3/G7)', () => {
  it('hits on 1-2 digit ids in hash and backlog-path citations', () => {
    const body = 'See #7, #39, /backlog/7 and /backlog/39.';
    expect([...body.matchAll(ANY_REF)].map(m => m[1])).toEqual(['7', '39', '7', '39']);
  });

  it('hits on 4-digit ids in hash and backlog-path citations without truncating them', () => {
    const body = 'See #2209 and /backlog/3512-gate-fix/.';
    expect([...body.matchAll(ANY_REF)].map(m => m[1])).toEqual(['2209', '3512']);
  });

  it('accepts longer ids in hash and backlog-path citations', () => {
    const body = 'See #12345 and /backlog/123456.';
    expect([...body.matchAll(ANY_REF)].map(m => m[1])).toEqual(['12345', '123456']);
  });

  it('requires a right word boundary instead of reading a numeric prefix', () => {
    const body = 'See #2209suffix, #3512_suffix, /backlog/2209suffix and /backlog/3512_suffix.';
    expect([...body.matchAll(ANY_REF)]).toEqual([]);
  });
});

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

// ── G8 unruled-premise (#1935's deterministic backstop) ──────────────────────────────────────────
// A prepared decision whose `## Fork` default leans on a still-open sibling decision, with no
// `blockedBy` edge recording it. Real miss this was built from: #2249's default cited #2209's
// attribute set as its merit ground while #2209 was itself unruled, and the card carried only
// `relatedTo` — so readiness ranked #2249 top of the queue, ahead of its own premise.

const ranges = (b) => {
  const out = []; const idx = [...b.matchAll(/^## /gm)].map((m) => m.index);
  for (let i = 0; i < idx.length; i += 1) out.push({ start: idx[i], end: idx[i + 1] ?? b.length });
  return out;
};
const norm = (x) => String(x);

describe('forkLeansOnUnruled — G8', () => {
  it('hits when a fork cites a still-open decision with no blockedBy edge', () => {
    const body = '## Fork 1 — a vs b\n\nDefault (a), matching #2209 attributes.\n';
    expect(forkLeansOnUnruled(body, new Set(), (r) => r === '2209', ranges, norm)).toEqual(['2209']);
  });

  it('does not hit when the dependency is already recorded on blockedBy', () => {
    const body = '## Fork 1 — a vs b\n\nDefault (a), matching #2209 attributes.\n';
    expect(forkLeansOnUnruled(body, new Set(['2209']), (r) => r === '2209', ranges, norm)).toEqual([]);
  });

  it('does not hit on a citation outside a fork — Context is background, not the default leaning', () => {
    const body = '## Context\n\nSee #2209 for the attribute set.\n';
    expect(forkLeansOnUnruled(body, new Set(), (r) => r === '2209', ranges, norm)).toEqual([]);
  });

  it('does not hit when the cited decision is already resolved', () => {
    const body = '## Fork 1 — a vs b\n\nPrecedent: #2112 settled the delimiter policy.\n';
    expect(forkLeansOnUnruled(body, new Set(), () => false, ranges, norm)).toEqual([]);
  });

  it('collects several leaned-on decisions from one fork without duplicating', () => {
    const body = '## Fork 1\n\nRests on #3010 and #3129, and again on #3010.\n';
    const hits = forkLeansOnUnruled(body, new Set(), (r) => ['3010', '3129'].includes(r), ranges, norm);
    expect(hits.sort()).toEqual(['3010', '3129']);
  });

  // #1957 review, correctness/coverage-gap: the citation regex was `\d{3,4}`, fitted to the id shape of
  // every open decision at the time. `norm` strips leading zeros, so `backlog/039-*.md` has id `39` — a
  // 1-2 digit referent the bound could never see, and 98 items carry one. These two pin both ends of the
  // range so a future re-narrowing reddens instead of going quietly blind.
  it('hits on a 1-2 digit id — `norm` strips the leading zeros off `039-*.md`, so the referent is `39`', () => {
    const body = '## Fork 1 — a vs b\n\nDefault (a), matching #39 attributes.\n';
    expect(forkLeansOnUnruled(body, new Set(), (r) => r === '39', ranges, norm)).toEqual(['39']);
  });

  it('still hits on a 4-digit id — widening the low end did not drop the high end', () => {
    const body = '## Fork 1 — a vs b\n\nDefault (a), matching #3512 attributes.\n';
    expect(forkLeansOnUnruled(body, new Set(), (r) => r === '3512', ranges, norm)).toEqual(['3512']);
  });
});
