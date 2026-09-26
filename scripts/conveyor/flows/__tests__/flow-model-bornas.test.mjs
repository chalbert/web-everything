// resolveBornAsCite (#4075/xmd4pfa) — a flow's `cite` naming a backlog file by its pre-numbering hash must
// still resolve once the drain's JIT numbering (#2288) renames that file away, via the target's own
// `bornAs: <hash>` frontmatter. Pure unit coverage with synthetic fixtures — no real backlog/ dir touched.
// This is the RED→GREEN proof for the live incident: build-dispatch.flow.json cited
// `backlog/xr05jjl-….md`, the drain renamed that card to #4220, and the citation-existence gate in
// real-flows.test.mjs went red on main until this resolver (and the corresponding real-flows.test.mjs wiring)
// landed.
import { describe, it, expect } from 'vitest';
import { resolveBornAsCite } from '../flow-model.mjs';

describe('resolveBornAsCite', () => {
  it('resolves a renamed hash-name cite to its current file via bornAs', () => {
    const files = {
      '4220-describe-every-conveyor-flow.md': '---\nbornAs: xr05jjl\nstatus: resolved\n---\n\nBody.\n',
      '2200-unrelated.md': '---\nkind: story\n---\n\nOther.\n',
    };
    const resolved = resolveBornAsCite('backlog/xr05jjl-describe-every-conveyor-flow.md', {
      exists: () => false, // the literal hash-named path no longer exists on disk
      listBacklogFiles: () => Object.keys(files),
      readBacklogFile: (name) => files[name],
    });
    expect(resolved).toBe('backlog/4220-describe-every-conveyor-flow.md');
  });

  it('is a genuine RED case (unresolved) before the target carries any bornAs record', () => {
    // Proves the resolver does not paper over a real dangling cite: no file anywhere claims this bornAs.
    const files = { '2200-unrelated.md': '---\nkind: story\n---\n\nOther.\n' };
    const resolved = resolveBornAsCite('backlog/xr05jjl-describe-every-conveyor-flow.md', {
      exists: () => false,
      listBacklogFiles: () => Object.keys(files),
      readBacklogFile: (name) => files[name],
    });
    // Unresolved — the caller (real-flows.test.mjs) then correctly reports this path as dangling.
    expect(resolved).toBe('backlog/xr05jjl-describe-every-conveyor-flow.md');
  });

  it('passes a path through unchanged when it already exists (no resolution needed)', () => {
    const resolved = resolveBornAsCite('backlog/4220-describe-every-conveyor-flow.md', {
      exists: () => true,
      listBacklogFiles: () => { throw new Error('must not scan backlog/ when the literal path already resolves'); },
      readBacklogFile: () => { throw new Error('unused'); },
    });
    expect(resolved).toBe('backlog/4220-describe-every-conveyor-flow.md');
  });

  it('passes a numeric-id path through unchanged even when missing — a real NNN never gets renamed again', () => {
    const resolved = resolveBornAsCite('backlog/9999-gone.md', {
      exists: () => false,
      listBacklogFiles: () => { throw new Error('must not scan backlog/ for a numeric id — no bornAs lookup applies'); },
      readBacklogFile: () => { throw new Error('unused'); },
    });
    expect(resolved).toBe('backlog/9999-gone.md');
  });

  it('ignores an unreadable backlog file while still finding the real match', () => {
    const files = {
      'broken.md': null, // simulates a read failure
      '4220-describe-every-conveyor-flow.md': '---\nbornAs: xr05jjl\n---\n\nBody.\n',
    };
    const resolved = resolveBornAsCite('backlog/xr05jjl-describe-every-conveyor-flow.md', {
      exists: () => false,
      listBacklogFiles: () => Object.keys(files),
      readBacklogFile: (name) => { if (files[name] === null) throw new Error('unreadable'); return files[name]; },
    });
    expect(resolved).toBe('backlog/4220-describe-every-conveyor-flow.md');
  });
});
