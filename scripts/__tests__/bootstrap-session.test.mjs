/**
 * @file bootstrap-session.test.mjs — a fresh machine gets the setup its HOST needs, once, idempotently.
 *   Pure over injected env / settings / existence probes; no io, so the ephemeral plan is testable from a
 *   laptop and the laptop plan from a container.
 */
import { describe, it, expect } from 'vitest';
import {
  detectHost,
  memoryDirs,
  planSteps,
  selfKey,
  siblingsFor,
  skillsDeployScript,
  withBootstrapHook,
  withoutBootstrapHook,
  bootstrapStatus,
} from '../bootstrap-session.mjs';

const step = (steps, id) => steps.find((s) => s.id === id);

describe('detectHost', () => {
  it('reads a cloud container from either runner signal alone', () => {
    expect(detectHost({ CLAUDE_CODE_CONTAINER_ID: 'container_01X' }).ephemeral).toBe(true);
    expect(detectHost({ CCR_AGENT_PROXY_ENABLED: '1' }).ephemeral).toBe(true);
  });

  // Requiring BOTH would fail closed the moment the runner renames one — and failing closed here means the
  // laptop plan (lane pool, guard) runs on a VM that has neither.
  it('names which signals fired, so a rename is diagnosable rather than silent', () => {
    const { signals } = detectHost({ CLAUDE_CODE_CONTAINER_ID: 'c', CCR_AGENT_PROXY_ENABLED: '1' });
    expect(signals).toEqual(['CLAUDE_CODE_CONTAINER_ID', 'CCR_AGENT_PROXY_ENABLED']);
  });

  it('treats a bare workstation env as durable', () => {
    expect(detectHost({ HOME: '/Users/someone' })).toEqual({ ephemeral: false, signals: [] });
  });

  // The proxy flag is set to '1', not merely present; '0' must not read as a container.
  it('does not read a disabled proxy flag as a container', () => {
    expect(detectHost({ CCR_AGENT_PROXY_ENABLED: '0' }).ephemeral).toBe(false);
  });
});

describe('memoryDirs', () => {
  it('derives the user-level key exactly as check-memory.mjs does', () => {
    const { user, repo } = memoryDirs('/workspace/web-everything', '/root');
    expect(user).toBe('/root/.claude/projects/-workspace-web-everything/memory');
    expect(repo).toBe('/workspace/web-everything/.claude/agent-memory');
  });
});

describe('planSteps', () => {
  it('deploys every skill on an ephemeral host and only the present ones on a laptop', () => {
    expect(step(planSteps({ ephemeral: true }), 'skills').argv).toEqual(['--all']);
    expect(step(planSteps({ ephemeral: false }), 'skills').argv).toEqual([]);
  });

  // The pool exists to dodge a branch guard, share objects via --reference and persist between batches.
  // A cloud VM has none of those, so provisioning one costs an `npm ci` per lane for nothing.
  it('skips the lane pool on an ephemeral host, with the reason attached', () => {
    const lanes = step(planSteps({ ephemeral: true }), 'lanes');
    expect(lanes.skip).toMatch(/reclaimed on idle/);
  });

  it('never plans to install the guard on an ephemeral host', () => {
    expect(step(planSteps({ ephemeral: true }), 'guard').skip).toBeTruthy();
  });

  it('resolves memory to the in-repo copy when the user-level dir is absent', () => {
    const exists = (p) => p.endsWith('/.claude/agent-memory');
    const found = step(planSteps({ ephemeral: true, root: '/workspace/web-everything', home: '/root', exists }), 'memory').verify();
    expect(found).toEqual({ via: 'repo', dir: '/workspace/web-everything/.claude/agent-memory' });
  });

  it('prefers the user-level dir when the laptop reserved lane is mounted', () => {
    const found = step(planSteps({ ephemeral: false, root: '/ws/webeverything', home: '/home/n', exists: () => true }), 'memory').verify();
    expect(found.via).toBe('user');
  });

  it('reports memory as absent rather than guessing a path', () => {
    expect(step(planSteps({ ephemeral: true, exists: () => false }), 'memory').verify()).toBeNull();
  });

  // Cloud siblings arrive via the harness's add_repo + credential-proxied clone; no script here can do it.
  it('reports missing siblings as siblings of the repo root, never clones them', () => {
    const found = step(planSteps({ ephemeral: true, root: '/workspace/web-everything', exists: () => false }), 'siblings').verify();
    expect(found.map((s) => s.name)).toEqual(['frontierui', 'plateau-app']);
    expect(found.map((s) => s.path)).toEqual(['/workspace/frontierui', '/workspace/plateau-app']);
    expect(found.every((s) => s.present === false)).toBe(true);
  });
});

// This script must survive its own relocation: the lane/delivery machinery is Plateau's product, and WE is a
// public PEER that dogfoods it. Anything that hard-codes "I am WE" inverts silently on the day of the move.
describe('relocation', () => {
  it('derives which constellation repo it is in, under either WE directory name', () => {
    expect(selfKey('/workspace/web-everything')).toBe('we');
    expect(selfKey('/Users/n/workspace/webeverything')).toBe('we');
    expect(selfKey('/workspace/plateau-app')).toBe('plateau-app');
  });

  it('returns null for an unrecognised checkout rather than assuming WE', () => {
    expect(selfKey('/workspace/some-fork')).toBeNull();
  });

  // The whole point: moved to plateau-app, WE becomes the sibling. A hard-coded list would have reported
  // plateau-app as missing from itself and never mentioned WE at all.
  it('names WE as a sibling once it lives in plateau-app', () => {
    const found = siblingsFor('/workspace/plateau-app', () => false);
    expect(found.map((s) => s.name)).toEqual(['we', 'frontierui']);
    expect(found.find((s) => s.name === 'we').path).toBe('/workspace/web-everything');
  });

  it('never lists the checkout it is in as its own sibling', () => {
    for (const root of ['/workspace/web-everything', '/workspace/frontierui', '/workspace/plateau-app']) {
      expect(siblingsFor(root, () => false).map((s) => s.name)).not.toContain(selfKey(root));
    }
  });

  it('lists the whole constellation from an unrecognised checkout, rather than a confident subset', () => {
    expect(siblingsFor('/workspace/some-fork', () => false).map((s) => s.name)).toEqual(['we', 'frontierui', 'plateau-app']);
  });

  it('resolves a sibling at whichever directory name it actually occupies', () => {
    const exists = (p) => p === '/ws/webeverything';
    expect(siblingsFor('/ws/plateau-app', exists).find((s) => s.name === 'we')).toMatchObject({ path: '/ws/webeverything', present: true });
  });
});

describe('skillsDeployScript', () => {
  it('prefers this checkout when it carries the CLI', () => {
    const exists = (p) => p === '/ws/webeverything/scripts/sync-skills-deploy.mjs';
    expect(skillsDeployScript('/ws/webeverything', exists)).toBe('/ws/webeverything/scripts/sync-skills-deploy.mjs');
  });

  // The two halves can move in either order — a bootstrap in plateau-app must still find the skills SoT in WE.
  it('falls back to a present sibling that carries it', () => {
    const exists = (p) => p === '/ws/web-everything' || p === '/ws/web-everything/scripts/sync-skills-deploy.mjs';
    expect(skillsDeployScript('/ws/plateau-app', exists)).toBe('/ws/web-everything/scripts/sync-skills-deploy.mjs');
  });

  it('reports absence rather than returning a path that resolves nowhere', () => {
    expect(skillsDeployScript('/ws/plateau-app', () => false)).toBeNull();
  });
});

describe('withBootstrapHook', () => {
  it('registers the script under SessionStart with an absolute path', () => {
    const out = withBootstrapHook({}, '/ws/webeverything/scripts/bootstrap-session.mjs');
    expect(bootstrapStatus(out, () => true)).toEqual([
      { path: '/ws/webeverything/scripts/bootstrap-session.mjs', resolves: true, absolute: true },
    ]);
  });

  // REPAIR, not append. Re-running after the checkout moves must replace the stale path — a second
  // registration pointing nowhere looks installed while doing nothing.
  it('replaces an existing entry rather than adding a second', () => {
    let s = withBootstrapHook({}, '/old/scripts/bootstrap-session.mjs');
    s = withBootstrapHook(s, '/ws/webeverything/scripts/bootstrap-session.mjs');
    const found = bootstrapStatus(s, () => true);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('/ws/webeverything/scripts/bootstrap-session.mjs');
  });

  it('preserves SessionStart hooks it does not own', () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } };
    const out = withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    const commands = out.hooks.SessionStart.flatMap((b) => b.hooks.map((h) => h.command));
    expect(commands).toContain('node other.mjs');
  });

  it('leaves other hook types untouched', () => {
    const before = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node scripts/guard-lane.mjs' }] }] } };
    const out = withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    expect(out.hooks.PreToolUse).toEqual(before.hooks.PreToolUse);
  });

  it('does not mutate the settings it was given', () => {
    const before = { hooks: { SessionStart: [] } };
    withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs');
    expect(before.hooks.SessionStart).toHaveLength(0);
  });

  it('round-trips: uninstall removes exactly what install added', () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } };
    const out = withoutBootstrapHook(withBootstrapHook(before, '/ws/scripts/bootstrap-session.mjs'));
    expect(out).toEqual(before);
  });
});

describe('bootstrapStatus', () => {
  it('flags an entry whose path no longer resolves', () => {
    const s = withBootstrapHook({}, '/moved/scripts/bootstrap-session.mjs');
    expect(bootstrapStatus(s, () => false)[0].resolves).toBe(false);
  });

  it('reports nothing for settings that register no bootstrap', () => {
    expect(bootstrapStatus({})).toEqual([]);
    expect(bootstrapStatus({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node other.mjs' }] }] } })).toEqual([]);
  });
});
