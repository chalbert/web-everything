import { describe, it, expect } from 'vitest';
import {
  emptyClaimState, parseClaims, serializeClaims, pruneExpiredClaims,
  porcelainFiles, recordClaim, baselineFor, mineFiles,
  findingFiles, classifyFinding, partitionFindings, partitionLocal,
  claimedIdsFor, partitionById,
} from '../readiness/claimScope.mjs';

describe('claimScope — claim-time baseline + finding attribution (#952, #949)', () => {
  describe('porcelainFiles', () => {
    it('extracts paths from porcelain lines incl. rename targets', () => {
      const p = ' M backlog/001-a.md\n?? scripts/new.mjs\nR  old.ts -> renamed.ts\nA  added.json';
      expect([...porcelainFiles(p)].sort()).toEqual(['added.json', 'backlog/001-a.md', 'renamed.ts', 'scripts/new.mjs']);
    });
    it('is empty for empty input', () => {
      expect(porcelainFiles('').size).toBe(0);
      expect(porcelainFiles(undefined).size).toBe(0);
    });
  });

  describe('parse/serialize round-trip', () => {
    it('tolerates junk and round-trips a valid state', () => {
      expect(parseClaims('not json').sessions).toEqual([]);
      const s = recordClaim(emptyClaimState(), { session: 'b1', id: '952-x', baselineFiles: ['a.ts'], nowIso: '2026-06-18T00:00:00Z' });
      const round = parseClaims(serializeClaims(s));
      expect(round.sessions[0]).toMatchObject({ session: 'b1', ids: ['952-x'], baseline: ['a.ts'] });
    });
  });

  describe('recordClaim — baseline once, ids appended', () => {
    it('captures baseline on first claim and keeps it on later claims', () => {
      let s = recordClaim(emptyClaimState(), { session: 'b1', id: '1', baselineFiles: ['ext.ts'], nowIso: 'T0' });
      // a later claim in the same session: ext.ts AND my own first file are now dirty — baseline must NOT grow
      s = recordClaim(s, { session: 'b1', id: '2', baselineFiles: ['ext.ts', 'mine1.ts'], nowIso: 'T1' });
      expect(baselineFor(s, 'b1')).toEqual(new Set(['ext.ts']));
      expect(s.sessions[0].ids).toEqual(['1', '2']);
    });
    it('isolates baselines per session', () => {
      let s = recordClaim(emptyClaimState(), { session: 'b1', id: '1', baselineFiles: ['x.ts'], nowIso: 'T0' });
      s = recordClaim(s, { session: 'b2', id: '9', baselineFiles: ['x.ts', 'y.ts'], nowIso: 'T0' });
      expect(baselineFor(s, 'b2')).toEqual(new Set(['x.ts', 'y.ts']));
    });
  });

  describe('mineFiles — dirty-now minus baseline', () => {
    const state = recordClaim(emptyClaimState(), { session: 'b1', id: '1', baselineFiles: ['ext.ts'], nowIso: 'T0' });
    it('returns only files dirtied after the baseline', () => {
      const mine = mineFiles(state, 'b1', new Set(['ext.ts', 'mine1.ts', 'mine2.ts']));
      expect(mine).toEqual(new Set(['mine1.ts', 'mine2.ts']));
    });
    it('returns null for an unknown session (→ caller falls back to strict)', () => {
      expect(mineFiles(state, 'nope', new Set(['a']))).toBeNull();
    });
    it('over-attributes a concurrent newly-dirty file (fail-safe, never a missed foreign red)', () => {
      // ext2.ts wasn't in the baseline (a concurrent session dirtied it after my claim) → leaks into mine
      const mine = mineFiles(state, 'b1', new Set(['ext.ts', 'ext2.ts']));
      expect(mine.has('ext2.ts')).toBe(true);
    });
  });

  describe('finding attribution + partition', () => {
    const mine = new Set(['mine.md']);
    const mineF = { message: 'x', descriptor: { file: 'mine.md' } };
    const extF = { message: 'y', descriptor: { file: 'theirs.md' } };
    const aggMixed = { message: 'z', descriptor: { kind: 'repo-locus', files: ['theirs.md', 'mine.md'] } };
    const aggForeign = { message: 'w', descriptor: { kind: 'repo-locus', files: ['theirs.md', 'other.md'] } };
    const pathless = { message: 'global error' };

    it('findingFiles reads .file and .files', () => {
      expect(findingFiles(aggMixed)).toEqual(['theirs.md', 'mine.md']);
      expect(findingFiles(pathless)).toEqual([]);
    });

    it('classifies mine / external / unattributable', () => {
      expect(classifyFinding(mineF, mine)).toBe('mine');
      expect(classifyFinding(extF, mine)).toBe('external');
      expect(classifyFinding(aggMixed, mine)).toBe('mine'); // aggregate touching one of my files
      expect(classifyFinding(aggForeign, mine)).toBe('external');
      expect(classifyFinding(pathless, mine)).toBe('unattributable');
    });

    it('partitions: blocking = mine + unattributable; external = foreign-only', () => {
      const { blocking, external } = partitionFindings([mineF, extF, aggMixed, aggForeign, pathless], mine);
      expect(blocking).toEqual([mineF, aggMixed, pathless]);
      expect(external).toEqual([extF, aggForeign]);
    });
  });

  describe('pruneExpiredClaims', () => {
    it('drops sessions past the TTL', () => {
      const now = 10_000_000;
      const ttlMs = 120 * 60_000;
      const s = { ttlMinutes: 120, sessions: [
        { session: 'old', ids: [], baseline: [], at: new Date(now - ttlMs - 1).toISOString() }, // just past TTL
        { session: 'fresh', ids: [], baseline: [], at: new Date(now - 60_000).toISOString() }, // 1 min ago
      ] };
      const pruned = pruneExpiredClaims(s, now);
      expect(pruned.sessions.map((x) => x.session)).toEqual(['fresh']);
    });
  });

  // #957: check:health --scope attributes by owning item id (its findings are id-keyed, not file-keyed).
  describe('claimedIdsFor + partitionById (id-axis attribution, #957)', () => {
    const state = recordClaim(
      recordClaim(emptyClaimState(), { session: 'b1', id: '957-x', baselineFiles: [], nowIso: 'T0' }),
      { session: 'b1', id: '964-y', baselineFiles: [], nowIso: 'T1' },
    );

    it('claimedIdsFor returns the session ids, null for an unknown session', () => {
      expect(claimedIdsFor(state, 'b1')).toEqual(new Set(['957-x', '964-y']));
      expect(claimedIdsFor(state, 'nope')).toBeNull();
    });

    it('partitionById: mine = claimed id; external = another id; no-id stays mine (fail-safe)', () => {
      const findings = [
        { id: 957, ref: 'a' },   // mine
        { id: 999, ref: 'b' },   // external
        { project: 'webdocs' },  // unattributable (D3 — no id) → mine, fail-safe
      ];
      const mineIds = new Set(['957', '964']);
      const { mine, external } = partitionById(findings, mineIds);
      expect(mine.map((f) => f.id ?? f.project)).toEqual([957, 'webdocs']);
      expect(external.map((f) => f.id)).toEqual([999]);
    });
  });

  // #1144: check:standards --local [--files=<list>] — per-lane gating for the parallel-batch orchestrator (#1147).
  describe('partitionLocal (file-isolation axis, #1144)', () => {
    const mineFile = { descriptor: { file: 'backlog/100-a.md' }, message: 'mine' };
    const otherFile = { descriptor: { file: 'backlog/200-b.md' }, message: 'other' };
    const multiFile = { descriptor: { files: ['backlog/100-a.md', 'backlog/200-b.md'] }, message: 'multi' };
    const pathless = { message: 'global — dup id, no owning file' }; // GLOBAL/RELATIONAL

    it('--files: blocks on findings touching my files, demotes other-file; path-less stays blocking (fail-safe)', () => {
      const fileSet = new Set(['backlog/100-a.md']);
      const { blocking, demoted } = partitionLocal([mineFile, otherFile, multiFile, pathless], { fileSet, local: false });
      expect(blocking.map((f) => f.message)).toEqual(['mine', 'multi', 'global — dup id, no owning file']);
      expect(demoted.map((f) => f.message)).toEqual(['other']);
    });

    it('--local --files: also demotes the path-less global (a lane cannot cause a cross-lane invariant)', () => {
      const fileSet = new Set(['backlog/100-a.md']);
      const { blocking, demoted } = partitionLocal([mineFile, otherFile, pathless], { fileSet, local: true });
      expect(blocking.map((f) => f.message)).toEqual(['mine']);
      expect(demoted.map((f) => f.message)).toEqual(['other', 'global — dup id, no owning file']);
    });

    it('--local alone (no file list): every file-attributable finding blocks; only path-less globals demote', () => {
      const { blocking, demoted } = partitionLocal([mineFile, otherFile, pathless], { local: true });
      expect(blocking.map((f) => f.message)).toEqual(['mine', 'other']);
      expect(demoted.map((f) => f.message)).toEqual(['global — dup id, no owning file']);
    });

    // #1159 — a global-consistency rule (cross-registry join, derived-artifact coherence) attributes to a
    // file the lane OWNS, yet can't be satisfied in isolation. `descriptor.global` demotes it under --local
    // even though its file is in the set; without --local it stays fail-safe blocking.
    const globalOnMine = { descriptor: { file: 'backlog/100-a.md', global: true }, message: 'global on my file' };
    it('--local --files: demotes a descriptor.global finding even when it touches my own file (#1159)', () => {
      const fileSet = new Set(['backlog/100-a.md']);
      const { blocking, demoted } = partitionLocal([mineFile, globalOnMine], { fileSet, local: true });
      expect(blocking.map((f) => f.message)).toEqual(['mine']);
      expect(demoted.map((f) => f.message)).toEqual(['global on my file']);
    });

    it('--files WITHOUT --local: a descriptor.global finding on my file stays blocking (fail-safe)', () => {
      const fileSet = new Set(['backlog/100-a.md']);
      const { blocking, demoted } = partitionLocal([globalOnMine], { fileSet, local: false });
      expect(blocking.map((f) => f.message)).toEqual(['global on my file']);
      expect(demoted).toEqual([]);
    });
  });
});
