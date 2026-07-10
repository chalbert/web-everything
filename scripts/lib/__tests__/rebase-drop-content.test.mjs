/**
 * @file rebase-drop-content.test.mjs — proof of #2371, the "safe-content" rebase-drop that widens #2198 beyond
 *   the manifest-only case: auto-resolve a `git merge-tree` conflict whose every hunk is non-overlapping
 *   (disjoint base-line ranges), still skip a genuinely overlapping hunk for `/finish`.
 */
import { describe, it, expect } from 'vitest';
import {
  LANE_MANIFEST,
  splitLinesKeepEnds,
  diffLines,
  hunksOverlap,
  unionMerge,
  threeWayMergeLines,
  mergeTextThreeWay,
  decodeBlobTextStrict,
  parseConflictStages,
  planContentMerges,
  rebaseDropContent,
  MAX_DIFF_LINES,
} from '../rebase-drop-content.mjs';

describe('splitLinesKeepEnds', () => {
  it('keeps trailing newlines so join("") reproduces the original bytes', () => {
    const text = 'a\nb\nc\n';
    const lines = splitLinesKeepEnds(text);
    expect(lines).toEqual(['a\n', 'b\n', 'c\n']);
    expect(lines.join('')).toBe(text);
  });
  it('a final line with no trailing newline is kept bare', () => {
    const text = 'a\nb';
    expect(splitLinesKeepEnds(text)).toEqual(['a\n', 'b']);
  });
  it('empty text → []', () => {
    expect(splitLinesKeepEnds('')).toEqual([]);
  });
});

const L = (...s) => s.map((x) => `${x}\n`); // helper: build "line\n" arrays

describe('diffLines', () => {
  it('identical arrays → no hunks', () => {
    expect(diffLines(L('a', 'b', 'c'), L('a', 'b', 'c'))).toEqual([]);
  });
  it('a pure append → one INSERT hunk at the end (aStart===aEnd===n)', () => {
    const base = L('a', 'b', 'c');
    const hunks = diffLines(base, L('a', 'b', 'c', 'd'));
    expect(hunks).toEqual([{ aStart: 3, aEnd: 3, bStart: 3, bEnd: 4 }]);
  });
  it('a mid-file replace → one hunk spanning the changed range', () => {
    const hunks = diffLines(L('a', 'b', 'c'), L('a', 'X', 'c'));
    expect(hunks).toEqual([{ aStart: 1, aEnd: 2, bStart: 1, bEnd: 2 }]);
  });
  it('a deletion → bStart===bEnd', () => {
    const hunks = diffLines(L('a', 'b', 'c'), L('a', 'c'));
    expect(hunks).toEqual([{ aStart: 1, aEnd: 2, bStart: 1, bEnd: 1 }]);
  });
  it('too large to diff safely → null', () => {
    const big = new Array(MAX_DIFF_LINES + 1).fill('x\n');
    expect(diffLines(big, ['y\n'])).toBeNull();
    expect(diffLines(['y\n'], big)).toBeNull();
  });
});

describe('hunksOverlap', () => {
  it('two zero-width insertions at the SAME position do not overlap (the append/append case)', () => {
    expect(hunksOverlap({ aStart: 5, aEnd: 5 }, { aStart: 5, aEnd: 5 })).toBe(false);
  });
  it('disjoint ranges do not overlap', () => {
    expect(hunksOverlap({ aStart: 0, aEnd: 2 }, { aStart: 4, aEnd: 6 })).toBe(false);
  });
  it('an insertion immediately after a replaced range does not overlap (adjacent, not intersecting)', () => {
    expect(hunksOverlap({ aStart: 1, aEnd: 3 }, { aStart: 3, aEnd: 3 })).toBe(false);
  });
  it('overlapping ranges DO overlap', () => {
    expect(hunksOverlap({ aStart: 1, aEnd: 4 }, { aStart: 3, aEnd: 5 })).toBe(true);
  });
  it('an identical replaced range overlaps (conservative — same-content edits still flagged)', () => {
    expect(hunksOverlap({ aStart: 1, aEnd: 2 }, { aStart: 1, aEnd: 2 })).toBe(true);
  });
});

describe('unionMerge', () => {
  it('append/append: both appended lines are kept, ours before theirs', () => {
    const base = L('a', 'b', 'c');
    const ours = L('a', 'b', 'c', 'OURS');
    const theirs = L('a', 'b', 'c', 'THEIRS');
    const oursHunks = diffLines(base, ours);
    const theirsHunks = diffLines(base, theirs);
    const merged = unionMerge(base, oursHunks, theirsHunks, ours, theirs);
    expect(merged.join('')).toBe('a\nb\nc\nOURS\nTHEIRS\n');
  });
  it('disjoint mid-file edits both land in their own positions', () => {
    const base = L('a', 'b', 'c', 'd', 'e');
    const ours = L('a', 'X', 'c', 'd', 'e'); // edits line 2
    const theirs = L('a', 'b', 'c', 'd', 'Y'); // edits line 5
    const merged = unionMerge(base, diffLines(base, ours), diffLines(base, theirs), ours, theirs);
    expect(merged.join('')).toBe('a\nX\nc\nd\nY\n');
  });
});

describe('threeWayMergeLines', () => {
  it('non-overlapping append/append → ok, union', () => {
    const base = L('a', 'b');
    const r = threeWayMergeLines(base, L('a', 'b', 'OURS'), L('a', 'b', 'THEIRS'));
    expect(r.ok).toBe(true);
    expect(r.lines.join('')).toBe('a\nb\nOURS\nTHEIRS\n');
  });
  it('overlapping edits to the same line → unsafe', () => {
    const base = L('a', 'b', 'c');
    const r = threeWayMergeLines(base, L('a', 'X', 'c'), L('a', 'Y', 'c'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/overlapping/);
  });
  it('too large on either side → unsafe', () => {
    const big = new Array(MAX_DIFF_LINES + 1).fill('x\n');
    const r = threeWayMergeLines(big, big, big);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/too large/);
  });
});

describe('mergeTextThreeWay', () => {
  it('happy path: text in, merged text out', () => {
    const r = mergeTextThreeWay('a\nb\n', 'a\nb\nOURS\n', 'a\nb\nTHEIRS\n');
    expect(r.ok).toBe(true);
    expect(r.text).toBe('a\nb\nOURS\nTHEIRS\n');
  });
  it('binary content (NUL byte) → refused outright', () => {
    const r = mergeTextThreeWay('a\0b', 'a\0b\nx', 'a\0b\ny');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('binary content');
  });
});

describe('decodeBlobTextStrict (byte-exactness guard)', () => {
  it('valid UTF-8 bytes round-trip to the exact text', () => {
    const buf = Buffer.from('héllo — café\n', 'utf8'); // multi-byte UTF-8, still lossless
    expect(decodeBlobTextStrict(buf)).toBe('héllo — café\n');
  });
  it('a plain string (already-safe text) is passed through', () => {
    expect(decodeBlobTextStrict('a\nb\n')).toBe('a\nb\n');
  });
  it('a NUL-free but NON-UTF-8 blob (latin-1 byte) → null, NOT lossily decoded to U+FFFD', () => {
    const buf = Buffer.from([0x61, 0xe9, 0x0a]); // 'a', lone 0xE9 (latin-1 'é' / invalid UTF-8), '\n'
    expect(buf.includes(0)).toBe(false); // NUL-free: the old NUL-only guard would have let this through
    expect(buf.toString('utf8')).toContain('�'); // proof the utf8 decode is lossy
    expect(decodeBlobTextStrict(buf)).toBeNull();
  });
  it('a NUL byte is caught even though NUL itself is valid UTF-8', () => {
    expect(decodeBlobTextStrict(Buffer.from([0x61, 0x00, 0x62]))).toBeNull();
  });
  it('null in → null out', () => {
    expect(decodeBlobTextStrict(null)).toBeNull();
  });
});

// A `git merge-tree --write-tree` conflict block WITH stage mode/oid info (unlike the manifest test's simpler
// helper, this carries distinct per-stage OIDs so `cat-file` can be scripted per-blob).
function conflictOutStages(entries) {
  const lines = ['t'.repeat(40)];
  for (const e of entries) {
    for (const stage of [1, 2, 3]) {
      const st = e.stages[stage];
      if (st) lines.push(`${st.mode} ${st.oid} ${stage}\t${e.path}`);
    }
  }
  lines.push('', 'Auto-merging …', `CONFLICT (content): Merge conflict in ${entries[0].path}`);
  return lines.join('\n');
}
// `git merge-tree`'s conflict-info oids must be VALID HEX for `parseMergeTree`'s regex to recognize the line —
// map each short tag to a stable hex string (a literal word like "base" fails the [0-9a-f]+ hex check).
const OID_HEX = { base: 'aaaa1', ours: 'bbbb2', thr: 'cccc3', mb: 'dddd4', mo: 'eeee5', mt: 'ffff6', b1: 'aaaa7', o1: 'bbbb8', t1: 'cccc9' };
const oid = (tag) => (OID_HEX[tag] || tag).padEnd(40, '0');

describe('parseConflictStages', () => {
  it('clean merge (exit 0) → {}', () => {
    expect(parseConflictStages('tree\n', 0)).toEqual({});
  });
  it('collects mode/oid per stage per path', () => {
    const out = conflictOutStages([
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const parsed = parseConflictStages(out, 1);
    expect(parsed['reports/x.md']).toEqual({
      1: { mode: '100644', oid: oid('base') },
      2: { mode: '100644', oid: oid('ours') },
      3: { mode: '100644', oid: oid('thr') },
    });
  });
  it('a stage missing on one side (add/add) is simply absent', () => {
    const out = conflictOutStages([
      { path: 'new.md', stages: { 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const parsed = parseConflictStages(out, 1);
    expect(parsed['new.md'][1]).toBeUndefined();
  });
});

describe('planContentMerges', () => {
  const blobs = { [oid('base')]: 'a\nb\n', [oid('ours')]: 'a\nb\nOURS\n', [oid('thr')]: 'a\nb\nTHEIRS\n' };
  const readBlob = (o) => (o in blobs ? blobs[o] : null);
  const stages100644 = { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } };

  it('every path safe → ok with merged text per path', () => {
    const r = planContentMerges(['reports/x.md'], { 'reports/x.md': stages100644 }, readBlob);
    expect(r.ok).toBe(true);
    expect(r.merges['reports/x.md']).toBe('a\nb\nOURS\nTHEIRS\n');
  });
  it('missing a common-ancestor stage (add/add) → unsafe, names the path', () => {
    const stages = { 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } };
    const r = planContentMerges(['new.md'], { 'new.md': stages }, readBlob);
    expect(r.ok).toBe(false);
    expect(r.path).toBe('new.md');
    expect(r.reason).toMatch(/no common-ancestor/);
  });
  it('a non-100644 mode conflict → unsafe', () => {
    const stages = { ...stages100644, 3: { mode: '100755', oid: oid('thr') } };
    const r = planContentMerges(['x.sh'], { 'x.sh': stages }, readBlob);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/mode conflict/);
  });
  it('an overlapping hunk in the content itself → unsafe', () => {
    const overlapBlobs = { [oid('base')]: 'a\nb\nc\n', [oid('ours')]: 'a\nX\nc\n', [oid('thr')]: 'a\nY\nc\n' };
    const rb = (o) => overlapBlobs[o] ?? null;
    const r = planContentMerges(['x.md'], { 'x.md': stages100644 }, rb);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/overlapping/);
  });
  it('short-circuits on the FIRST unsafe path', () => {
    const stagesBad = { 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } }; // missing stage 1
    const r = planContentMerges(['bad.md', 'reports/x.md'], { 'bad.md': stagesBad, 'reports/x.md': stages100644 }, readBlob);
    expect(r.ok).toBe(false);
    expect(r.path).toBe('bad.md');
  });
});

// A scripted `run` that returns canned results per git subcommand and records the call sequence — mirrors
// rebase-drop-manifest.test.mjs's `scriptedRun`.
function scriptedRun(script) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts?.env, cwd: opts?.cwd, input: opts?.input });
    const key = args[0];
    const handler = script[key];
    const res = typeof handler === 'function' ? handler(args, opts) : handler;
    return { status: 0, stdout: '', stderr: '', ...(res || {}) };
  };
  return { run, calls };
}

const MERGE_TREE_CLEAN = { 'merge-tree': { status: 0, stdout: 'cleanTree'.padEnd(40, '0') + '\n' } };

describe('rebaseDropContent', () => {
  it('a clean merge → skip (nothing to do — not a candidate at all)', () => {
    const { run } = scriptedRun({ ...MERGE_TREE_CLEAN });
    const r = rebaseDropContent({ laneRef: 'lane/x-clean', run });
    expect(r.action).toBe('skip');
    expect(r.reason).toMatch(/no conflict/);
  });

  it('manifest-only conflict → skip, delegates to rebaseDropManifest', () => {
    const out = conflictOutStages([
      { path: LANE_MANIFEST, stages: { 1: { mode: '100644', oid: oid('b1') }, 2: { mode: '100644', oid: oid('o1') }, 3: { mode: '100644', oid: oid('t1') } } },
    ]);
    const { run } = scriptedRun({ 'merge-tree': { status: 1, stdout: out } });
    const r = rebaseDropContent({ laneRef: 'lane/x-manifest', run });
    expect(r.action).toBe('skip');
    expect(r.reason).toMatch(/manifest-only/);
  });

  it('a non-overlapping content conflict on ONE report file → rebased, merged content hashed + staged, pushed', () => {
    const out = conflictOutStages([
      { path: 'reports/2026-07-09-x.md', stages: {
        1: { mode: '100644', oid: oid('base') },
        2: { mode: '100644', oid: oid('ours') },
        3: { mode: '100644', oid: oid('thr') },
      } },
    ]);
    const blobs = { [oid('base')]: 'intro\n', [oid('ours')]: 'intro\nOURS verdict\n', [oid('thr')]: 'intro\nTHEIRS verdict\n' };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? '' }),
      'read-tree': { status: 0 },
      'hash-object': { status: 0, stdout: 'mergedBlob'.padEnd(40, '0') + '\n' },
      'update-index': { status: 0 },
      'write-tree': { status: 0, stdout: 'resolvedTree'.padEnd(40, '0') + '\n' },
      'commit-tree': { status: 0, stdout: 'newCommitSha'.padEnd(40, '0') + '\n' },
      push: { status: 0 },
    });
    const r = rebaseDropContent({ laneRef: 'lane/x-2371', run });
    expect(r.action).toBe('rebased');
    expect(r.mergedPaths).toEqual(['reports/2026-07-09-x.md']);
    expect(r.droppedManifest).toBe(false);
    // the merged text (union of both appends) was hashed via stdin, not a real file.
    const ho = calls.find((c) => c.args[0] === 'hash-object');
    expect(ho.input).toBe('intro\nOURS verdict\nTHEIRS verdict\n');
    const up = calls.find((c) => c.args[0] === 'update-index');
    expect(up.args).toEqual(['update-index', '--cacheinfo', `100644,${'mergedBlob'.padEnd(40, '0')},reports/2026-07-09-x.md`]);
    // no manifest rm — it never conflicted.
    expect(calls.some((c) => c.args[0] === 'rm')).toBe(false);
    const ct = calls.find((c) => c.args[0] === 'commit-tree');
    expect(ct.args).toEqual(['commit-tree', 'resolvedTree'.padEnd(40, '0'), '-p', 'origin/main', '-p', 'origin/lane/x-2371', '-m', expect.any(String)]);
    const push = calls.find((c) => c.args[0] === 'push');
    expect(push.args).toEqual(['push', 'origin', `${'newCommitSha'.padEnd(40, '0')}:refs/heads/lane/x-2371`]);
  });

  it('a non-overlapping content conflict AND the manifest also conflicting → both dropped/merged in one rebuild', () => {
    const out = conflictOutStages([
      { path: LANE_MANIFEST, stages: { 1: { mode: '100644', oid: oid('mb') }, 2: { mode: '100644', oid: oid('mo') }, 3: { mode: '100644', oid: oid('mt') } } },
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const blobs = { [oid('base')]: 'intro\n', [oid('ours')]: 'intro\nOURS\n', [oid('thr')]: 'intro\nTHEIRS\n' };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? '' }),
      'read-tree': { status: 0 },
      rm: { status: 0 },
      'hash-object': { status: 0, stdout: 'mergedBlob'.padEnd(40, '0') + '\n' },
      'update-index': { status: 0 },
      'write-tree': { status: 0, stdout: 'resolvedTree'.padEnd(40, '0') + '\n' },
      'commit-tree': { status: 0, stdout: 'newCommitSha'.padEnd(40, '0') + '\n' },
      push: { status: 0 },
    });
    const r = rebaseDropContent({ laneRef: 'lane/x-both', run });
    expect(r.action).toBe('rebased');
    expect(r.droppedManifest).toBe(true);
    const rm = calls.find((c) => c.args[0] === 'rm');
    expect(rm.args).toEqual(['rm', '--cached', '--ignore-unmatch', LANE_MANIFEST]);
  });

  it('an overlapping (real) content conflict → skip, names the path, no commit-tree/push', () => {
    const out = conflictOutStages([
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const blobs = { [oid('base')]: 'a\nb\nc\n', [oid('ours')]: 'a\nX\nc\n', [oid('thr')]: 'a\nY\nc\n' };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? '' }),
    });
    const r = rebaseDropContent({ laneRef: 'lane/x-overlap', run });
    expect(r.action).toBe('skip');
    expect(r.reason).toMatch(/reports\/x\.md/);
    expect(r.reason).toMatch(/overlapping/);
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('a NUL-free but NON-UTF-8 blob → skip (byte-exactness guard), no commit-tree/push', () => {
    const out = conflictOutStages([
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    // stage-3 (theirs) is raw latin-1: 'a', lone 0xE9 ('é' / invalid UTF-8), '\n' — NUL-free, so the old
    // NUL-only guard would have lossily decoded it to U+FFFD and hashed the corrupted bytes back onto main.
    const blobs = {
      [oid('base')]: Buffer.from('a\n', 'utf8'),
      [oid('ours')]: Buffer.from('a\nOURS\n', 'utf8'),
      [oid('thr')]: Buffer.from([0x61, 0xe9, 0x0a]),
    };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? Buffer.alloc(0) }),
    });
    const r = rebaseDropContent({ laneRef: 'lane/x-latin1', run });
    expect(r.action).toBe('skip');
    expect(r.reason).toMatch(/reports\/x\.md/);
    expect(r.reason).toMatch(/non-UTF-8/);
    expect(calls.some((c) => c.args[0] === 'hash-object')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('an add/add conflict (no common-ancestor stage) → skip, not silently resolved', () => {
    const out = conflictOutStages([
      { path: 'new.md', stages: { 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const { run } = scriptedRun({ 'merge-tree': { status: 1, stdout: out } });
    const r = rebaseDropContent({ laneRef: 'lane/x-addadd', run });
    expect(r.action).toBe('skip');
    expect(r.reason).toMatch(/new\.md/);
  });

  it('a failed plumbing step (write-tree) → error, no push', () => {
    const out = conflictOutStages([
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const blobs = { [oid('base')]: 'a\n', [oid('ours')]: 'a\nO\n', [oid('thr')]: 'a\nT\n' };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? '' }),
      'read-tree': { status: 0 },
      'hash-object': { status: 0, stdout: 'mergedBlob'.padEnd(40, '0') + '\n' },
      'update-index': { status: 0 },
      'write-tree': { status: 1, stderr: 'fatal: bad index' },
    });
    const r = rebaseDropContent({ laneRef: 'lane/x-err', run });
    expect(r.action).toBe('error');
    expect(r.reason).toMatch(/write-tree/);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('no laneRef → error', () => {
    expect(rebaseDropContent({ run: () => ({ status: 0, stdout: '' }) }).action).toBe('error');
  });

  it('a failed fetch → error, no merge-tree/push', () => {
    const { run, calls } = scriptedRun({ fetch: { status: 1, stderr: 'fatal: not found' }, ...MERGE_TREE_CLEAN });
    const r = rebaseDropContent({ laneRef: 'lane/x-gone', run });
    expect(r.action).toBe('error');
    expect(r.reason).toMatch(/fetch/);
    expect(calls.some((c) => c.args[0] === 'merge-tree')).toBe(false);
  });

  it('#2263 — a given `cwd` routes every git invocation through a sibling clone', () => {
    const out = conflictOutStages([
      { path: 'reports/x.md', stages: { 1: { mode: '100644', oid: oid('base') }, 2: { mode: '100644', oid: oid('ours') }, 3: { mode: '100644', oid: oid('thr') } } },
    ]);
    const blobs = { [oid('base')]: 'a\n', [oid('ours')]: 'a\nO\n', [oid('thr')]: 'a\nT\n' };
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: out },
      'cat-file': (args) => ({ status: 0, stdout: blobs[args[2]] ?? '' }),
      'read-tree': { status: 0 },
      'hash-object': { status: 0, stdout: 'mergedBlob'.padEnd(40, '0') + '\n' },
      'update-index': { status: 0 },
      'write-tree': { status: 0, stdout: 'resolvedTree'.padEnd(40, '0') + '\n' },
      'commit-tree': { status: 0, stdout: 'newCommitSha'.padEnd(40, '0') + '\n' },
      push: { status: 0 },
    });
    rebaseDropContent({ laneRef: 'lane/x-cwd', run, cwd: '/repos/frontierui' });
    for (const subcmd of ['fetch', 'merge-tree', 'cat-file', 'read-tree', 'hash-object', 'update-index', 'write-tree', 'commit-tree', 'push']) {
      expect(calls.find((c) => c.args[0] === subcmd)?.cwd).toBe('/repos/frontierui');
    }
  });
});
