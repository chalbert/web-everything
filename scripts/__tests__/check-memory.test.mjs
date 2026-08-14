/**
 * check-memory.test.mjs — pins the write-time gate's TARGET MATCH (`isMemoryIndexPath`).
 *
 * WHY THIS FILE EXISTS. The gate's target match was an inline `/\/memory\/MEMORY\.md$/`, which matched only
 * the user-level `~/.claude/projects/<key>/memory/` spelling. #2266 moved the corpus to `agent-memory-src/`
 * and the predicate did not follow, so the PreToolUse gate on the always-loaded index silently stopped
 * firing for lane-clone edits — the ONLY place memory may be edited. A dead fail-open gate is invisible by
 * construction: it never errors, it just stops objecting. These cases are what makes it stay alive.
 */
import { describe, it, expect } from 'vitest';
import { isMemoryIndexPath, isMemoryCorpusPath } from '../check-memory.mjs';

describe('isMemoryIndexPath', () => {
  // One corpus, three legitimate spellings — a hook event can carry any of them.
  it.each([
    ['user-level harness dir', '/Users/x/.claude/projects/-Users-x-workspace-webeverything/memory/MEMORY.md'],
    ['in-repo symlink', '/Users/x/workspace/webeverything/.claude/agent-memory/MEMORY.md'],
    ['tracked source of truth', '/Users/x/workspace/webeverything/agent-memory-src/MEMORY.md'],
    ['lane clone (the regression)', '/Users/x/workspace/.lanes/web-everything/lane-4/agent-memory-src/MEMORY.md'],
    ['lane clone via the symlink', '/Users/x/workspace/.lanes/web-everything/lane-4/.claude/agent-memory/MEMORY.md'],
    ['relative, as a tool may send it', 'agent-memory-src/MEMORY.md'],
  ])('gates the index: %s', (_label, path) => {
    expect(isMemoryIndexPath(path)).toBe(true);
  });

  // Fail-open is CORRECT for anything that is not the always-loaded index — the gate must not intercept
  // ordinary writes. These pin that the widened pattern did not become a catch-all.
  it.each([
    ['a leaf memory file', '/Users/x/workspace/webeverything/agent-memory-src/44-feedback_state.md'],
    ['a category sub-index', '/Users/x/workspace/webeverything/agent-memory-src/index-arch.md'],
    ['a same-named file elsewhere', '/Users/x/workspace/webeverything/docs/MEMORY.md'],
    ['a directory merely ending in -memory', '/Users/x/workspace/webeverything/scratch-memory/MEMORY.md'],
    ['a lookalike suffix', '/Users/x/workspace/webeverything/agent-memory-src/MEMORY.md.bak'],
    ['a lookalike prefix', '/Users/x/workspace/webeverything/agent-memory-src/OLD-MEMORY.md'],
  ])('stays open: %s', (_label, path) => {
    expect(isMemoryIndexPath(path)).toBe(false);
  });

  // The gate reads `ev?.tool_input?.file_path`, which is absent on plenty of real hook events.
  it.each([[undefined], [null], [''], [42], [{}]])('stays open on a non-string target (%s)', (path) => {
    expect(isMemoryIndexPath(path)).toBe(false);
  });
});

/**
 * #3015 widened the `--pre` gate's TARGET from the index alone to the whole memory corpus, because the
 * secret scrub has to cover topic files too — they are committed and pushed, and unlike the backlog they
 * have NO CLI writer, so this hook is their only write-time gate. The BUDGET / tree-shape rules stay
 * index-only, which is why the two predicates are separate rather than one widened one.
 */
describe('isMemoryCorpusPath — the #3015 widening', () => {
  it.each([
    ['the index itself', 'agent-memory-src/MEMORY.md'],
    ['a numbered topic file', '/Users/x/workspace/webeverything/agent-memory-src/44-feedback_state.md'],
    ['a category sub-index', '/Users/x/workspace/webeverything/agent-memory-src/index-arch.md'],
    ['a topic file via the in-repo symlink', '/Users/x/w/.claude/agent-memory/12-thing.md'],
    ['a topic file in a lane clone', '/Users/x/workspace/.lanes/web-everything/lane-4/agent-memory-src/9-x.md'],
    ['the user-level harness dir', '/Users/x/.claude/projects/-Users-x-w/memory/33-note.md'],
  ])('gates the corpus: %s', (_label, path) => {
    expect(isMemoryCorpusPath(path)).toBe(true);
  });

  it.each([
    ['a same-named dir elsewhere', '/Users/x/w/docs/notes.md'],
    ['a nested path under the corpus dir', '/Users/x/w/agent-memory-src/sub/deep.md'],
    ['a non-markdown file', '/Users/x/w/agent-memory-src/data.json'],
    ['a directory merely ending in -memory', '/Users/x/w/scratch-memory/note.md'],
  ])('stays open: %s', (_label, path) => {
    expect(isMemoryCorpusPath(path)).toBe(false);
  });

  it.each([[undefined], [null], [''], [42], [{}]])('stays open on a non-string target (%s)', (path) => {
    expect(isMemoryCorpusPath(path)).toBe(false);
  });

  it('every index path is also a corpus path — the widening is a superset, never a replacement', () => {
    for (const p of ['agent-memory-src/MEMORY.md', '/a/b/.claude/agent-memory/MEMORY.md', '/a/memory/MEMORY.md']) {
      expect(isMemoryIndexPath(p)).toBe(true);
      expect(isMemoryCorpusPath(p)).toBe(true);
    }
  });
});
