// Regression test for the scope-prefix locus derivation (#xdx3ifb multi-repo slice 3) — the pure
// `inferLocusFromScope` predicate in src/_data/backlog.js. Locus is "which gate/loop honestly CLOSES the
// item"; before this slice a `plateau:`-scoped item with no cross-repo TAG fell all the way through to the
// `webeverything` default — the wrong gate. This pins the fix over SYNTHETIC scope arrays (the same approach
// unshaped-no-scope.test.ts / tier.test.ts take), independent of the live backlog.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inferLocusFromScope } = require('../backlog.js') as {
  inferLocusFromScope: (scope: unknown) => string | null;
};

describe('inferLocusFromScope — the scope-prefix locus signal (#xdx3ifb)', () => {
  it('a `plateau:`-scoped item resolves to `plateau-app` — its real gate — not `webeverything`', () => {
    expect(inferLocusFromScope(['plateau:src/components/Board.tsx'])).toBe('plateau-app');
  });

  it('the full-name `plateau-app:` prefix resolves the same as the short `plateau:` tag', () => {
    expect(inferLocusFromScope(['plateau-app:src/components/Board.tsx'])).toBe('plateau-app');
  });

  it('a `fui:`/`frontierui:`-scoped item resolves to `frontierui`', () => {
    expect(inferLocusFromScope(['fui:src/tokens/color.ts'])).toBe('frontierui');
    expect(inferLocusFromScope(['frontierui:src/tokens/color.ts'])).toBe('frontierui');
  });

  it('a `we:`/`webeverything:`-scoped item resolves to `webeverything`', () => {
    expect(inferLocusFromScope(['we:scripts/conveyor/pr-work-unit.mjs'])).toBe('webeverything');
    expect(inferLocusFromScope(['webeverything:scripts/x.mjs'])).toBe('webeverything');
  });

  it('takes the first scope entry that carries a recognized prefix, in order', () => {
    expect(inferLocusFromScope(['unknown:whatever', 'plateau:src/x.tsx', 'we:scripts/y.mjs'])).toBe('plateau-app');
  });

  it('returns null (never guesses) for no usable scope — absent, non-array, empty, or an unrecognized prefix', () => {
    expect(inferLocusFromScope(undefined)).toBeNull();
    expect(inferLocusFromScope([])).toBeNull();
    expect(inferLocusFromScope('plateau:src/x.tsx')).toBeNull(); // non-array
    expect(inferLocusFromScope(['nonsense-without-a-colon'])).toBeNull();
    expect(inferLocusFromScope(['some-other-repo:src/x.ts'])).toBeNull();
  });
});
