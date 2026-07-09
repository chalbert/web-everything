/**
 * @file scripts/golden-corpus-lib.mjs
 * @description Pure helpers behind `scripts/mine-golden-corpus.mjs` (#2270). Kept side-effect-free
 * (no fs, no child_process, no `Date.now()`) so the mining logic itself is unit-testable against
 * synthetic before/after content — the CLI does all the git plumbing and calls these.
 *
 * #2270 harvests a golden corpus of skill/memory fixtures from git history: an idempotent miner
 * that turns historical backlog transitions, memory edits, and hook-relevant content changes into
 * replayable input+expected-output fixtures. Both #2273 (Tier-A deterministic snapshot harness) and
 * #2272 (Tier-B session-replay harness) consume the corpus this produces.
 */
import { readField } from './backlog/frontmatter.mjs';

/** Frontmatter fields the transition classifier reads/compares (kept in one place for clarity). */
const TRANSITION_FIELDS = ['status', 'kind', 'graduatedTo', 'codifiedIn', 'scaffoldedBy', 'dateStarted', 'dateResolved'];

/** Read the fields we care about off one revision of a backlog item's content. */
export function readTransitionFields(content) {
  const out = {};
  for (const f of TRANSITION_FIELDS) out[f] = readField(content, f) ?? null;
  return out;
}

/**
 * Classify a backlog item's status transition between two revisions of the SAME file, mirroring the
 * verbs `applyTransition` (scripts/backlog/frontmatter.mjs) and `settle` (scripts/backlog.mjs)
 * implement. Pure — takes plain before/after content strings, returns a fixture-shaping descriptor or
 * `null` when the pair isn't a transition this corpus models (e.g. a body-only edit with no status
 * change, or a status value this classifier doesn't recognize).
 *
 * Returned shape: `{ verb, opts }` where `opts` are the arguments a replay would pass to
 * `applyTransition(before, verb, opts)` (claim/resolve/release) — or, for `settle` (not exported as a
 * pure function upstream), the same `{ before, after }` pair for a direct-regex regression fixture.
 *
 * @param {string} before
 * @param {string} after
 * @returns {{ verb: 'claim'|'resolve'|'release'|'settle', opts: object } | null}
 */
export function classifyBacklogTransition(before, after) {
  if (before == null || after == null || before === after) return null;
  const b = readTransitionFields(before);
  const a = readTransitionFields(after);
  if (b.status === a.status) return null; // no status flip — not a transition fixture

  // claim: open → active|preparing, dateStarted newly stamped.
  if (b.status === 'open' && (a.status === 'active' || a.status === 'preparing') && !b.scaffoldedBy) {
    return { verb: 'claim', opts: { as: a.status === 'preparing' ? 'preparing' : undefined } };
  }

  // settle: a born-active scaffold (scaffoldedBy present in `before`) → open. Distinguished from
  // `release` (a claimed item handed back) by the scaffoldedBy stamp settle() strips.
  if (b.status === 'active' && a.status === 'open' && b.scaffoldedBy) {
    return { verb: 'settle', opts: {} };
  }

  // release: active|preparing → open, no scaffoldedBy stamp (a claimed-not-scaffolded item handed back).
  if ((b.status === 'active' || b.status === 'preparing') && a.status === 'open' && !b.scaffoldedBy) {
    return { verb: 'release', opts: {} };
  }

  // resolve: active|open → resolved, capturing graduatedTo/codifiedIn as newly stamped in `after`.
  if ((b.status === 'active' || b.status === 'open') && a.status === 'resolved') {
    return {
      verb: 'resolve',
      opts: {
        graduatedTo: a.graduatedTo && a.graduatedTo !== b.graduatedTo ? a.graduatedTo : undefined,
        codifiedTo: a.codifiedIn && a.codifiedIn !== b.codifiedIn ? a.codifiedIn : undefined,
      },
    };
  }

  return null;
}

/** A memory path this corpus mines: the always-loaded index (current or pre-#2266 legacy home) or a
 *  per-entry rule file, current (`agent-memory-src/`) or legacy (`.claude/agent-memory/`) home. Pure
 *  string test — no fs. */
export function isMemoryPath(path) {
  const p = String(path || '');
  return /^agent-memory-src\/.+\.md$/.test(p) || /^\.claude\/agent-memory\/.+\.md$/.test(p);
}

/** Is `path` the always-loaded memory INDEX (as opposed to a per-entry rule file)? Pure. */
export function isMemoryIndexPath(path) {
  return /(?:^|\/)MEMORY\.md$/.test(String(path || ''));
}

/** Stable short id for a fixture filename: first 8 hex chars of a commit sha. Pure. */
export function shortSha(sha) {
  return String(sha || '').slice(0, 8);
}
