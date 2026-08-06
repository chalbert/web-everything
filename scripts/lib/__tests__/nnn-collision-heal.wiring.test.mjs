/**
 * @file scripts/lib/__tests__/nnn-collision-heal.wiring.test.mjs
 * @description #2746 review — proves the #2546 content guard is WIRED INTO `planBaseCollisionHeal`, not merely
 *   importable beside it. The original tests called `assertContentPreserved` directly, so deleting both guard
 *   calls from the module would not have failed a single test — the PR's actual behavioural change was
 *   untested. Here `rewriteRefs` is mocked at the module boundary (the sanctioned seam — no test-only option
 *   on the production signature) to return blanked content, and the planner must THROW. Delete the guard call
 *   in `planBaseCollisionHeal` and this test goes red.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../backlog/renumber-collisions.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // a "broken rewrite" — exactly the #558 blank-on-rewrite failure the guard exists to catch
    rewriteRefs: (text, oldNum, newNum, slug) => {
      const real = actual.rewriteRefs(text, oldNum, newNum, slug);
      return real !== text ? '' : text;   // blanked ONLY when the sweep actually rewrote something
    },
  };
});

const { planBaseCollisionHeal } = await import('../nnn-collision-heal.mjs');

const mk = (num, slug, body = '') => ({
  name: `${num}-${slug}.md`,
  text: `---\nkind: story\nstatus: open\n---\n\n# ${slug}\n\n${body}\n`,
});

describe('planBaseCollisionHeal — the #2546 guard is wired in (not just imported)', () => {
  it('THROWS when the rewrite blanks a referencing file', () => {
    const laneFiles = [
      mk('2219', 'drain-finding', 'the storm-collision finding'),
      { name: '1800-refs.md', text: '---\nkind: story\n---\n\n# refs\n\nAuthored body.\nSee #2219.\n' },
    ];
    expect(() => planBaseCollisionHeal(laneFiles, {
      baseNums: ['2218', '2219', '2221'],
      baseNames: ['2218-x.md', '2219-existing-item.md', '2221-z.md'],
    })).toThrow();
  });
});
