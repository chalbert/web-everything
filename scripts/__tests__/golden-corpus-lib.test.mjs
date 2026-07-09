/**
 * @file golden-corpus-lib.test.mjs — proof of the PURE classification helpers behind #2270's
 *   `scripts/mine-golden-corpus.mjs`. The git plumbing (execFileSync, git show/log) is the untested
 *   boundary; `classifyBacklogTransition`/`isMemoryPath`/`isMemoryIndexPath` are pure content-in,
 *   verdict-out functions, so they're proven here against synthetic frontmatter — the same shape a
 *   real mined `before`/`after` pair has, without needing an actual git history.
 */
import { describe, it, expect } from 'vitest';
import { classifyBacklogTransition, isMemoryPath, isMemoryIndexPath, shortSha } from '../golden-corpus-lib.mjs';

const item = (fields) => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n# Title\n\nBody.\n`;

describe('classifyBacklogTransition', () => {
  it('open → active, no scaffoldedBy stamp ⇒ claim', () => {
    const before = item({ status: 'open', dateOpened: '"2026-07-01"' });
    const after = item({ status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-02"' });
    expect(classifyBacklogTransition(before, after)).toEqual({ verb: 'claim', opts: { as: undefined } });
  });

  it('open → preparing ⇒ claim with as="preparing"', () => {
    const before = item({ status: 'open' });
    const after = item({ status: 'preparing', dateStarted: '"2026-07-02"' });
    expect(classifyBacklogTransition(before, after)).toEqual({ verb: 'claim', opts: { as: 'preparing' } });
  });

  it('active|open → resolved ⇒ resolve, carrying newly-stamped graduatedTo/codifiedIn', () => {
    const before = item({ status: 'active' });
    const after = item({ status: 'resolved', dateResolved: '"2026-07-02"', graduatedTo: '"we:foo.ts"' });
    expect(classifyBacklogTransition(before, after)).toEqual({
      verb: 'resolve', opts: { graduatedTo: 'we:foo.ts', codifiedTo: undefined },
    });
  });

  it('a decision resolve carries codifiedIn too', () => {
    const before = item({ kind: 'decision', status: 'open' });
    const after = item({ kind: 'decision', status: 'resolved', dateResolved: '"2026-07-02"', codifiedIn: '"docs/agent/x.md#y"' });
    expect(classifyBacklogTransition(before, after)).toEqual({
      verb: 'resolve', opts: { graduatedTo: undefined, codifiedTo: 'docs/agent/x.md#y' },
    });
  });

  it('active → open WITH a scaffoldedBy stamp on before ⇒ settle, not release', () => {
    const before = item({ status: 'active', scaffoldedBy: '"batch-x"' });
    const after = item({ status: 'open' });
    expect(classifyBacklogTransition(before, after)).toEqual({ verb: 'settle', opts: {} });
  });

  it('active → open WITHOUT a scaffoldedBy stamp ⇒ release', () => {
    const before = item({ status: 'active' });
    const after = item({ status: 'open' });
    expect(classifyBacklogTransition(before, after)).toEqual({ verb: 'release', opts: {} });
  });

  it('preparing → open ⇒ release', () => {
    const before = item({ status: 'preparing' });
    const after = item({ status: 'open' });
    expect(classifyBacklogTransition(before, after)).toEqual({ verb: 'release', opts: {} });
  });

  it('no status change ⇒ null (a body-only edit is not a transition fixture)', () => {
    const before = item({ status: 'open' });
    const after = before.replace('Body.', 'Body, edited.');
    expect(classifyBacklogTransition(before, after)).toBeNull();
  });

  it('identical content ⇒ null', () => {
    const c = item({ status: 'open' });
    expect(classifyBacklogTransition(c, c)).toBeNull();
  });

  it('an unrecognized status pairing ⇒ null (e.g. resolved → parked)', () => {
    const before = item({ status: 'resolved' });
    const after = item({ status: 'parked' });
    expect(classifyBacklogTransition(before, after)).toBeNull();
  });

  it('null before/after ⇒ null (nothing to classify)', () => {
    expect(classifyBacklogTransition(null, item({ status: 'open' }))).toBeNull();
    expect(classifyBacklogTransition(item({ status: 'open' }), null)).toBeNull();
  });
});

describe('isMemoryPath / isMemoryIndexPath', () => {
  it('matches the current agent-memory-src home', () => {
    expect(isMemoryPath('agent-memory-src/12-project_foo.md')).toBe(true);
    expect(isMemoryPath('agent-memory-src/MEMORY.md')).toBe(true);
  });
  it('matches the pre-#2266 legacy .claude/agent-memory home', () => {
    expect(isMemoryPath('.claude/agent-memory/12-project_foo.md')).toBe(true);
  });
  it('rejects an unrelated path', () => {
    expect(isMemoryPath('backlog/123-foo.md')).toBe(false);
    expect(isMemoryPath('docs/agent/platform-decisions.md')).toBe(false);
  });
  it('isMemoryIndexPath picks out only the MEMORY.md index, not a per-entry file', () => {
    expect(isMemoryIndexPath('agent-memory-src/MEMORY.md')).toBe(true);
    expect(isMemoryIndexPath('.claude/agent-memory/MEMORY.md')).toBe(true);
    expect(isMemoryIndexPath('agent-memory-src/12-project_foo.md')).toBe(false);
  });
});

describe('shortSha', () => {
  it('takes the first 8 hex chars', () => {
    expect(shortSha('9c576af7892de57729c3c49cfd44a2cf5cc34209')).toBe('9c576af7');
  });
  it('degrades gracefully on empty/undefined input', () => {
    expect(shortSha(undefined)).toBe('');
    expect(shortSha('')).toBe('');
  });
});
