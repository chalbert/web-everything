/**
 * @file golden-corpus-snapshot.test.mjs — #2273 Tier-A deterministic snapshot harness for the script
 * surface, wired into CI (backlog epic #2268).
 *
 * Golden/snapshot testing of the deterministic script layer skills sit on — `scripts/backlog.mjs`
 * (claim/resolve/release/settle), the locus-prefix / guard-bash / guard-lane hooks, and (structurally)
 * `scripts/check-memory.mjs`'s budget gate — against the golden corpus `scripts/golden-corpus/*`
 * harvested from real project history by `scripts/mine-golden-corpus.mjs` (#2270): input fixture in,
 * assert the exact resulting content out. Every case here is a REAL historical (or spec-derived, for the
 * two hooks that fire pre-commit) input+expected-output pair, not a synthetic one authored for this test
 * — so a change to any of these scripts "proves it breaks no historical case" the moment this suite runs
 * in CI (`npm test`).
 *
 * Substrate (decision #2274, ratified 2026-07-09): each category replays the REAL EXPORTED pure decision
 * function the CLI/hook itself calls (`applyTransition`/`applySettle`, `decide`, `laneGuardDecision`,
 * `scanRepoLocusPrefixes`, `checkBudget`) — never a hand-copied re-implementation, so there is nothing
 * here to drift out of sync with the shipped logic. The heavier ephemeral-clone CLI substrate (spawn the
 * actual `backlog.mjs` subprocess in a throwaway directory, asserting a real process exit code) is a
 * separate, smaller integration-smoke layer — see `backlog-cli-snapshot.test.mjs` — kept apart because
 * the CLI stamps `dateStarted`/`dateResolved` from the wall clock, so a full byte-for-byte replay of a
 * historically-DATED fixture can only happen at the pure-function layer where `today` is an injected arg.
 *
 * `scaffold` has no historical "before" to replay (a first-appearance commit carries no CLI args), so
 * `backlog-created` fixtures are checked structurally instead (valid kind/status/dateOpened) — matching
 * the corpus's own `selfValidated: false` note for that category. `backlog-settle` currently mines 0
 * fixtures (no historical settle commit met the miner's self-validation bar yet); the suite still wires
 * the category so it activates automatically the moment the corpus gains one, per #2270's idempotent
 * re-mine.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTransition, applySettle } from '../backlog/frontmatter.mjs';
import { decide } from '../guard-bash.mjs';
import { laneGuardDecision } from '../guard-lane.mjs';
import { scanRepoLocusPrefixes } from '../check-standards-rules.mjs';
import { checkBudget } from '../check-memory.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, '..', 'golden-corpus');

/** Every fixture in a corpus category, id-sorted (stable test order) and tagged with its own filename. */
function loadCategory(cat) {
  const dir = join(CORPUS, cat);
  if (!existsSync(dir)) return []; // a currently-empty category (e.g. backlog-settle) has no directory
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ __id: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

/** Minimal top-level frontmatter field reader — mirrors `scripts/backlog/frontmatter.mjs#readField`
 *  closely enough for read-only assertions here, without importing a CLI-adjacent module for it. */
function readFm(content, key) {
  const m = String(content ?? '').match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

const KNOWN_KINDS = ['story', 'epic', 'task', 'decision'];
const KNOWN_STATUSES = ['open', 'active', 'preparing', 'resolved', 'parked'];

describe('Tier-A golden-corpus snapshot harness (#2273)', () => {
  describe.each(['backlog-claim', 'backlog-resolve', 'backlog-release'])(
    '%s — applyTransition() reproduces the historical after byte-for-byte',
    (cat) => {
      const fixtures = loadCategory(cat);
      it('the corpus actually mined fixtures for this category', () => {
        expect(fixtures.length).toBeGreaterThan(0);
      });
      it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
        const res = applyTransition(fx.before, fx.verb, fx.opts || {});
        expect(res.error).toBeUndefined();
        expect(res.content).toBe(fx.after);
      });
    },
  );

  describe('backlog-settle — applySettle() reproduces the historical after byte-for-byte', () => {
    const fixtures = loadCategory('backlog-settle');
    if (fixtures.length === 0) {
      // No historical settle commit has cleared the miner's self-validation bar yet (index.json count:
      // 0) — assert that fact explicitly rather than silently running zero cases, so a corpus re-mine
      // that finally seeds one is the thing that flips this test from green-trivial to green-meaningful.
      it('the corpus has not mined a settle fixture yet — category wired, inert until seeded', () => {
        expect(fixtures).toEqual([]);
      });
    } else {
      it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
        const res = applySettle(fx.before);
        expect(res.error).toBeUndefined();
        expect(res.content).toBe(fx.after);
      });
    }
  });

  describe('backlog-created — structural shape of a freshly-scaffolded item', () => {
    const fixtures = loadCategory('backlog-created');
    it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
      expect(fx.before).toBeNull(); // first-appearance revision — no prior content by definition
      expect(KNOWN_KINDS).toContain(readFm(fx.after, 'kind'));
      expect(KNOWN_STATUSES).toContain(readFm(fx.after, 'status'));
      expect(readFm(fx.after, 'dateOpened')).toBeTruthy();
    });
  });

  describe('hook-locus-prefix — scanRepoLocusPrefixes() flags before, clean after', () => {
    const fixtures = loadCategory('hook-locus-prefix');
    it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
      const before = scanRepoLocusPrefixes([{ path: fx.file, content: fx.before }]);
      const after = scanRepoLocusPrefixes([{ path: fx.file, content: fx.after }]);
      expect(before.length).toBe(fx.expect.findingsBefore);
      expect(after.length).toBe(fx.expect.findingsAfter);
    });
  });

  describe('hook-guard-bash — decide() reproduces the spec-derived deny/allow reason', () => {
    const fixtures = loadCategory('hook-guard-bash');
    it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
      const got = decide(fx.cmd, fx.ctx || {});
      if (fx.expect.reason == null) expect(got).toBeNull();
      else expect(got).toBe(fx.expect.reason);
    });
  });

  describe('hook-guard-lane — laneGuardDecision() reproduces the spec-derived allow/deny', () => {
    // Synthetic workspace roots substituted for the corpus's {{PRIMARY_ROOT}}/{{LANE_ROOT}}/
    // {{SCRATCHPAD_ROOT}} placeholders — laneGuardDecision is a pure string/path classifier, so any
    // consistent synthetic layout exercises the same branches as the real ~/workspace tree does.
    const WORKSPACE = '/synthetic-workspace';
    const WE_ROOT = join(WORKSPACE, 'webeverything');
    const SCRATCHPAD = '/synthetic-scratchpad';
    const fixtures = loadCategory('hook-guard-lane');
    it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
      const real = fx.filePathTemplate
        .replace('{{PRIMARY_ROOT}}', WORKSPACE)
        .replace('{{LANE_ROOT}}', WORKSPACE)
        .replace('{{SCRATCHPAD_ROOT}}', SCRATCHPAD);
      const decision = laneGuardDecision(real, WE_ROOT) ? 'deny' : 'allow';
      expect(decision).toBe(fx.expect.decision);
    });
  });

  describe('memory — structural shape + check-memory.mjs budget replay', () => {
    const fixtures = loadCategory('memory');
    it.each(fixtures.map((fx) => [fx.__id, fx]))('%s', (_id, fx) => {
      expect(fx.after).toBeTruthy();
      if (fx.isIndex) {
        // The always-loaded MEMORY.md index itself — replay the REAL gate's budget check.
        const { v } = checkBudget(fx.after);
        expect(v).toEqual([]);
      } else {
        // A per-entry topic file or category sub-index always carries a stable `name:` frontmatter key.
        expect(readFm(fx.after, 'name')).toBeTruthy();
      }
    });
  });

  it("index.json category counts match what's actually on disk (no silent corpus/index drift)", () => {
    const index = JSON.parse(readFileSync(join(CORPUS, 'index.json'), 'utf8'));
    for (const [cat, count] of Object.entries(index.counts)) {
      expect(loadCategory(cat).length).toBe(count);
    }
    expect(Object.values(index.counts).reduce((a, b) => a + b, 0)).toBe(index.total);
  });
});
