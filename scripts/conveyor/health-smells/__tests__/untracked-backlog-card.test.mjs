/**
 * @file scripts/conveyor/health-smells/__tests__/untracked-backlog-card.test.mjs
 * @description #4317 — the PURE `evaluate()` of the `untracked-backlog-card` smell, over plain
 *   `untrackedBacklogCards` fixtures shaped like `probeUntrackedBacklogCards`'s own return value (no fs here —
 *   see the sibling smell tests, e.g. `gh-shim-lane-path.test.mjs`, for the same no-fs convention). The
 *   probe's own aging filter is exercised separately in `we:scripts/conveyor/__tests__/health-watch.test.mjs`.
 */
import { describe, it, expect } from 'vitest';
import untrackedBacklogCard from '../untracked-backlog-card.mjs';

describe('untracked-backlog-card', () => {
  const NOW = Date.parse('2026-09-28T12:00:00Z');

  it('opens an episode for an aged untracked card the probe surfaced', () => {
    const untrackedBacklogCards = [{
      cloneRoot: '/Users/op/workspace/wev-review-daemon',
      rel: 'backlog/x3u9t41-file-the-prevention-guard.md',
      mtimeMs: NOW - 45 * 60_000,
    }];
    const [out] = untrackedBacklogCard.evaluate({ untrackedBacklogCards }, { now: NOW });
    expect(out.breach).toBe(true);
    expect(out.subject).toBe('/Users/op/workspace/wev-review-daemon');
    expect(out.measure.count).toBe(1);
    expect(out.measure.ageMin).toBe(45);
    expect(out.measure.rels).toEqual(['backlog/x3u9t41-file-the-prevention-guard.md']);
    expect(out.summary).toContain('UNTRACKED');
    expect(out.recommendation).toContain('lane');
  });

  it('reports one episode per CLONE, independently', () => {
    const untrackedBacklogCards = [
      { cloneRoot: '/a', rel: 'backlog/x1111a1-a.md', mtimeMs: NOW - 20 * 60_000 },
      { cloneRoot: '/b', rel: 'backlog/x2222b2-b.md', mtimeMs: NOW - 90 * 60_000 },
    ];
    const out = untrackedBacklogCard.evaluate({ untrackedBacklogCards }, { now: NOW });
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.subject).sort()).toEqual(['/a', '/b']);
  });

  // #4317 advisory review (2026-09-29): one episode PER CARD turned the 23 live orphans (22 in
  // `wev-review-daemon`, 1 in `wev-control`) into 23 `investigate` episodes on the first tick after deploy — an
  // investigation storm for what is one problem per clone. Grouping by clone bounds the episode count by the
  // number of daemon clones, however large the orphan backlog grows.
  it('a large orphan backlog opens a BOUNDED number of episodes — one per clone, not one per card', () => {
    const untrackedBacklogCards = [
      ...Array.from({ length: 22 }, (_, i) => ({
        cloneRoot: '/ws/wev-review-daemon', rel: `backlog/x${String(i).padStart(6, '0')}-orphan.md`, mtimeMs: NOW - (30 + i) * 60_000,
      })),
      { cloneRoot: '/ws/wev-control', rel: 'backlog/xcontrol-orphan.md', mtimeMs: NOW - 20 * 60_000 },
    ];
    const out = untrackedBacklogCard.evaluate({ untrackedBacklogCards }, { now: NOW });
    expect(out).toHaveLength(2);
    const review = out.find((o) => o.subject === '/ws/wev-review-daemon');
    expect(review.measure.count).toBe(22);
    expect(review.measure.ageMin).toBe(51); // the OLDEST card's age
    expect(review.summary).toContain('22');
  });

  // The probe itself omits a card once it lands or disappears (query-time, aging-filtered) — a subject simply
  // absent from evaluate()'s own return is how `we:scripts/conveyor/health-watch-core.mjs#stepEpisodes` treats
  // a previously-open episode as clean and closes it after `closeAfter` ticks; this smell needs no explicit
  // "gone" branch of its own.
  it('returns no episodes once the probe reports nothing (the card landed or was removed)', () => {
    expect(untrackedBacklogCard.evaluate({ untrackedBacklogCards: [] }, { now: NOW })).toEqual([]);
  });

  it('returns no episodes when the probe itself never ran this tick', () => {
    expect(untrackedBacklogCard.evaluate({ untrackedBacklogCards: undefined }, { now: NOW })).toEqual([]);
  });
});
