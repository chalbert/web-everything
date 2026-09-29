// #4070 — a card rewritten through Bash (heredoc, `>`, `cp`, `mv` over it) skips the Edit/Write hooks that
// validate it. The `>>`/`sed -i` half was already denied; these pin the truncating half, through the pure
// detector, `reason()`, and the real hook process a dispatched agent's Bash call goes through.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusOverwriteTargets, reason } from '../guard-bash.mjs';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'guard-bash.mjs');
const OVERWRITE = /Don't overwrite backlog\|reports/;

function hook(command) {
  const run = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' }),
    encoding: 'utf8',
    env: { ...process.env, WE_DISPATCH_KIND: 'fix' },
  });
  return run.stdout;
}

describe('corpusOverwriteTargets — shell writes that replace a card (#4070)', () => {
  it.each([
    ["cat > backlog/4070-x.md <<'EOF'\nbody\nEOF", 'backlog/4070-x.md'],
    ['echo hi > backlog/4070-x.md', 'backlog/4070-x.md'],
    ['printf x >| ./backlog/4070-x.md', './backlog/4070-x.md'],
    ['node gen.mjs &> reports/2026-09-24-x.md', 'reports/2026-09-24-x.md'],
    ['echo hi > /Users/a/.lanes/web-everything/lane-3/backlog/4070-x.md', '/Users/a/.lanes/web-everything/lane-3/backlog/4070-x.md'],
    ['cp /tmp/draft.md backlog/4070-x.md', 'backlog/4070-x.md'],
    ['cp -f -- /tmp/draft.md backlog/4070-x.md', 'backlog/4070-x.md'],
    ['install -m 644 /tmp/draft.md backlog/4070-x.md', 'backlog/4070-x.md'],
    ['mv /tmp/draft.md backlog/4070-x.md', 'backlog/4070-x.md'],
    ['env FOO=1 cp /tmp/draft.md backlog/4070-x.md', 'backlog/4070-x.md'],
  ])('flags %j', (cmd, target) => {
    expect(corpusOverwriteTargets(cmd)).toContain(target);
  });

  it.each([
    'cat backlog/4070-x.md > /tmp/x.md',                        // reading a card into scratch
    'grep -l foo backlog/*.md > /tmp/claude-501/hits.txt',       // a listing into the agent scratchpad
    'cp backlog/4070-x.md /tmp/',                               // copying a card OUT
    'git mv backlog/4070-a.md backlog/4070-b.md',               // a same-number rename (renumber arm owns NNN)
    'mv backlog/4070-a.md backlog/4070-b.md',
    'git commit -m "never echo > backlog/x.md"',                 // a quoted mention, not a redirect
    'echo hi > backlog/README.txt',                             // not a markdown card
    'echo hi > mybacklog/x.md',                                 // not the corpus directory
    'echo hi > /tmp/backlog/x.md',                              // scratch
  ])('leaves %j alone', (cmd) => {
    expect(corpusOverwriteTargets(cmd)).toEqual([]);
  });
});

describe('reason() + the real hook deny the overwrite (#4070)', () => {
  it('reason() names the overwritten path and the Edit/Write remedy', () => {
    const r = reason('cat > backlog/4070-x.md');
    expect(r).toMatch(OVERWRITE);
    expect(r).toContain('backlog/4070-x.md');
    expect(r).toMatch(/Edit\/Write tools/);
  });

  it('the append/in-place arm still answers first for its own shapes', () => {
    expect(reason('echo x >> backlog/4070-x.md')).toMatch(/append\/in-place-edit/);
  });

  it('the hook process denies a heredoc card rewrite from a dispatched agent', () => {
    const out = hook("cat > backlog/4070-x.md <<'EOF'\n---\nstatus: resolved\n---\nEOF");
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe('deny');
    expect(out).toMatch(OVERWRITE);
  });

  it('the hook process still allows reading a card into scratch', () => {
    expect(hook('cat backlog/4070-x.md > /tmp/x.md')).toBe('');
  });
});
