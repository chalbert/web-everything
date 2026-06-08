/**
 * @file scripts/autofix/__tests__/engine.test.mjs
 * @description Demo-first proof of the conformance auto-fix loop (#095).
 *
 * Runs the real {@link autofix} orchestrator against an IN-MEMORY fixture instead of the live repo,
 * so the verify-gated loop is exercised end-to-end without corrupting real specs. The fake `verify`
 * mirrors `check-standards`'s deprecated-status rule (and flags unparseable JSON), giving us both
 * accept and revert paths deterministically:
 *   - GREEN  — a good patch clears the failure and introduces nothing new → kept, suite goes green.
 *   - REVERT — a patch that doesn't clear its target is rolled back → reported as a give-up.
 *   - REVERT — a patch that introduces a NEW failure is rolled back → reported as a give-up.
 */
import { describe, it, expect } from 'vitest';
import { CustomFixerRegistry, deprecatedStatusFixer, registerReferenceFixers, autofix } from '../engine.mjs';

// Mirror of check-standards' STATUS_SYNONYMS — the deprecated → canonical map.
const SYN = { implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft' };

/** In-memory filesystem + a verifier that reproduces the suite's deprecated-status / bad-JSON rules. */
function makeWorld(files) {
  const fs = { ...files };
  const read = (file) => fs[file];
  const write = (file, content) => {
    fs[file] = content;
  };
  const verify = () => {
    const failures = [];
    for (const [file, content] of Object.entries(fs)) {
      if (!file.endsWith('.json')) continue;
      let data;
      try {
        data = JSON.parse(content);
      } catch {
        failures.push({ message: `Invalid JSON in ${file}`, descriptor: { kind: 'invalid-json', file } });
        continue;
      }
      for (const row of Array.isArray(data) ? data : []) {
        if (row?.status && SYN[row.status])
          failures.push({
            message: `Block "${row.id}" uses deprecated status "${row.status}" — use canonical "${SYN[row.status]}"`,
            descriptor: { kind: 'deprecated-status', entity: 'Block', id: row.id, file, field: 'status', from: row.status, to: SYN[row.status] },
          });
      }
    }
    return { ok: failures.length === 0, failures };
  };
  return { fs, read, write, verify };
}

describe('conformance auto-fix loop (#095)', () => {
  it('drives the suite to green with the reference fixer (accept path)', async () => {
    const blocks = JSON.stringify([{ id: 'foo', status: 'implemented' }, { id: 'bar', status: 'wip' }], null, 2) + '\n';
    const { fs, read, write, verify } = makeWorld({ 'src/_data/blocks.json': blocks });
    const registry = registerReferenceFixers(new CustomFixerRegistry());

    const result = await autofix({ verify, read, write, registry });

    expect(result.ok).toBe(true);
    expect(result.gaveUp).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.applied.map((a) => a.summary).sort()).toEqual([
      'Block "bar" status: wip → draft',
      'Block "foo" status: implemented → active',
    ]);
    // The fixture file was actually rewritten to canonical values.
    const data = JSON.parse(fs['src/_data/blocks.json']);
    expect(data.map((r) => r.status)).toEqual(['active', 'draft']);
    expect(fs['src/_data/blocks.json'].endsWith('\n')).toBe(true); // newline convention preserved
  });

  it('reverts and gives up when a patch fails to clear its target failure', async () => {
    const blocks = JSON.stringify([{ id: 'foo', status: 'implemented' }], null, 2) + '\n';
    const { fs, read, write, verify } = makeWorld({ 'src/_data/blocks.json': blocks });

    // A broken fixer that rewrites to ANOTHER deprecated synonym — the failure (same id) never clears.
    const badFixer = {
      id: 'broken:to-another-synonym',
      handles: (f) => f.descriptor?.kind === 'deprecated-status',
      fix: (f, { read }) => {
        const data = JSON.parse(read(f.descriptor.file));
        data.find((r) => r.id === f.descriptor.id).status = 'done'; // still a synonym → still fails
        return { file: f.descriptor.file, newContent: JSON.stringify(data, null, 2) + '\n', summary: 'bad' };
      },
    };
    const registry = new CustomFixerRegistry().register(badFixer);
    const before = fs['src/_data/blocks.json'];

    const result = await autofix({ verify, read, write, registry });

    expect(result.ok).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.gaveUp).toHaveLength(1);
    expect(result.gaveUp[0].reason).toMatch(/did not clear/);
    expect(fs['src/_data/blocks.json']).toBe(before); // reverted to the snapshot, no trace left
  });

  it('reverts when a patch introduces a NEW failure (regression guard)', async () => {
    const blocks = JSON.stringify([{ id: 'foo', status: 'implemented' }], null, 2) + '\n';
    const { fs, read, write, verify } = makeWorld({ 'src/_data/blocks.json': blocks });

    // A fixer that clears the target but corrupts the file into invalid JSON — a new failure appears.
    const corruptingFixer = {
      id: 'broken:corrupts-json',
      handles: (f) => f.descriptor?.kind === 'deprecated-status',
      fix: (f) => ({ file: f.descriptor.file, newContent: '{ not json', summary: 'corrupt' }),
    };
    const registry = new CustomFixerRegistry().register(corruptingFixer);
    const before = fs['src/_data/blocks.json'];

    const result = await autofix({ verify, read, write, registry });

    expect(result.ok).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.gaveUp).toHaveLength(1);
    expect(result.gaveUp[0].reason).toMatch(/new failure/);
    expect(fs['src/_data/blocks.json']).toBe(before); // reverted
  });

  it('reports failures with no matching fixer as skipped, never faked', async () => {
    const { read, write, verify } = makeWorld({
      'src/_data/blocks.json': JSON.stringify([{ id: 'foo', status: 'active' }], null, 2) + '\n',
    });
    // A failure class no fixer handles.
    const verifyWithUnfixable = () => ({
      ok: false,
      failures: [{ message: 'mystery problem', descriptor: { kind: 'unknown-class', id: 'x' } }],
    });
    const registry = registerReferenceFixers(new CustomFixerRegistry());

    const result = await autofix({ verify: verifyWithUnfixable, read, write, registry });

    expect(result.ok).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].descriptor.kind).toBe('unknown-class');
  });

  it('the reference fixer gives up safely when the field is already fixed (no patch)', () => {
    // File already has the canonical value, but a stale descriptor still names the old `from`.
    const { read } = makeWorld({ 'src/_data/blocks.json': JSON.stringify([{ id: 'foo', status: 'draft' }], null, 2) });
    const patch = deprecatedStatusFixer.fix(
      { descriptor: { kind: 'deprecated-status', entity: 'Block', id: 'foo', file: 'src/_data/blocks.json', field: 'status', from: 'wip', to: 'draft' } },
      { read },
    );
    expect(patch).toBeNull(); // `"status": "wip"` isn't present → no guess, no rewrite
  });

  it('the reference fixer edits surgically — only the one field value changes', () => {
    const original = JSON.stringify([{ id: 'foo', status: 'implemented', summary: 'x' }, { id: 'bar', status: 'active' }], null, 2) + '\n';
    const { read } = makeWorld({ 'src/_data/blocks.json': original });
    const patch = deprecatedStatusFixer.fix(
      { descriptor: { kind: 'deprecated-status', entity: 'Block', id: 'foo', file: 'src/_data/blocks.json', field: 'status', from: 'implemented', to: 'active' } },
      { read },
    );
    // Exactly one substring changed; everything else (formatting, other rows) is byte-identical.
    expect(patch.newContent).toBe(original.replace('"status": "implemented"', '"status": "active"'));
  });
});
