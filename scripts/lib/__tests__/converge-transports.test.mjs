/**
 * @file converge-transports.test.mjs — proof of the two-member TRANSPORT contract (#xztipiw).
 *
 * The contract is deliberately tiny, so most of the value here is in the boundary behaviour: it fails closed on
 * an unknown transport, it makes untracked files visible to the panel, and its editor prompt forbids committing.
 */
import { describe, it, expect } from 'vitest';
import {
  TRANSPORT_CONTRACT,
  validateTransport,
  resolveTransport,
  WORKING_TREE_TRANSPORT,
} from '../converge-transports.mjs';

describe('the contract is exactly two members plus a name', () => {
  it('requires nothing beyond transport / readMaterial / applyRevision', () => {
    expect([...TRANSPORT_CONTRACT.required].sort()).toEqual(['applyRevision', 'readMaterial', 'transport']);
  });

  it('accepts the working-tree implementation', () => {
    expect(validateTransport(WORKING_TREE_TRANSPORT)).toEqual({ valid: true, errors: [] });
  });

  it('reports every missing member at once rather than throwing', () => {
    const r = validateTransport({ transport: 'x' });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it('never throws on junk input', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      expect(() => validateTransport(junk)).not.toThrow();
      expect(validateTransport(junk).valid).toBe(false);
    }
  });
});

describe('resolveTransport fails closed', () => {
  it('resolves the working-tree transport by name', () => {
    const r = resolveTransport('working-tree');
    expect(r.ok).toBe(true);
    expect(r.transport).toBe(WORKING_TREE_TRANSPORT);
  });

  it('refuses an absent name rather than defaulting — a default would silently pick where writes land', () => {
    expect(resolveTransport(undefined).ok).toBe(false);
    expect(resolveTransport('').ok).toBe(false);
  });

  it('refuses an unknown name and says what is available', () => {
    const r = resolveTransport('pr-branch');
    expect(r.ok).toBe(false);
    expect(r.available).toContain('working-tree');
  });
});

describe('working-tree readMaterial', () => {
  const read = (ctx) => WORKING_TREE_TRANSPORT.readMaterial(ctx).command;

  it('diffs against the fork point, not against HEAD — uncommitted lane work must be in scope', () => {
    expect(read({ laneRoot: '/lanes/lane-4' })).toContain('git merge-base HEAD');
  });

  it('makes UNTRACKED files visible, or a brand-new file would never be judged', () => {
    expect(read({ laneRoot: '/lanes/lane-4' })).toContain('--intent-to-add');
  });

  it('does not fail the whole read when there is nothing untracked', () => {
    expect(read({ laneRoot: '/lanes/lane-4' })).toContain('|| true');
  });

  it('confines the `|| true` so a FAILED cd cannot fall through and diff the wrong repo', () => {
    // `cd X && A || true && B` parses as `((cd && A) || true) && B` — the brace group is what stops a bad lane
    // path from silently diffing whatever repo the caller was standing in.
    expect(read({ laneRoot: '/lanes/lane-4' })).toMatch(/&& \{ .* \|\| true; \} &&/);
  });

  it('NEVER uses `git add -A` / `.` / `--all` — a repo guard blocks it, and it sweeps up concurrent sessions', () => {
    const cmd = read({ laneRoot: '/lanes/lane-4' });
    expect(cmd).not.toMatch(/git add[^|&]*--all/);
    expect(cmd).not.toMatch(/git add\s+(-A|\.)\b/);
    expect(cmd).toContain('git ls-files --others --exclude-standard');
  });

  it('actually fails when the lane path does not exist', async () => {
    const { execSync } = await import('node:child_process');
    expect(() => execSync(read({ laneRoot: '/definitely/not/a/lane' }), { stdio: 'pipe' })).toThrow();
  });

  it('defaults the base ref but honours an override', () => {
    expect(read({ laneRoot: '/l' })).toContain("'origin/main'");
    expect(read({ laneRoot: '/l', baseRef: 'origin/release' })).toContain("'origin/release'");
  });

  it('quotes the lane path so a path with a space or a quote cannot break out', () => {
    const cmd = read({ laneRoot: "/lanes/lane 4'; rm -rf /" });
    expect(cmd).toContain(`'/lanes/lane 4'\\''; rm -rf /'`);
  });

  it('reports the cwd separately so a caller need not parse it back out', () => {
    expect(WORKING_TREE_TRANSPORT.readMaterial({ laneRoot: '/lanes/lane-4' }).cwd).toBe('/lanes/lane-4');
  });
});

describe('working-tree applyRevision', () => {
  const findings = [{ summary: 'unescaped input', impactIfUnfixed: 'broken' }];
  const built = (o = {}) => WORKING_TREE_TRANSPORT.applyRevision({ findings, round: 1, roundCap: 3, ctx: { laneRoot: '/lanes/lane-4' }, ...o });

  it('returns an agent prompt, not a shell command — the editor is a subagent', () => {
    expect(built().kind).toBe('agent');
  });

  it('carries the shared editor mandate rather than re-writing one', () => {
    // The mandate text is owned by we:scripts/lib/review-core.mjs; assert the finding reached it.
    expect(built().prompt).toContain('unescaped input');
  });

  it('names the lane the editor must work in', () => {
    expect(built().prompt).toContain('/lanes/lane-4');
  });

  it('FORBIDS committing and pushing — publishing stays the human\'s call', () => {
    const p = built().prompt;
    expect(p).toContain('git commit');
    expect(p).toContain('git push');
    expect(p).toMatch(/Do \*\*not\*\* run `git commit`/);
  });

  it('warns the editor not to revert changes it did not make (a human may be editing too)', () => {
    expect(built().prompt).toMatch(/not\*\* revert or stash/);
  });

  it('requires an explicit advanced flag and stated dismissals', () => {
    const p = built().prompt;
    expect(p).toContain('"advanced"');
    expect(p).toContain('"dismissed"');
  });

  it('tolerates being called with no findings', () => {
    expect(() => WORKING_TREE_TRANSPORT.applyRevision({})).not.toThrow();
  });
});
