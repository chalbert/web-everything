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
import { isMemoryIndexPath } from '../check-memory.mjs';

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
