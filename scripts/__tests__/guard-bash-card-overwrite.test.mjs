// #4070 — a card rewritten through Bash (heredoc, `>`, `cp`, `mv` over it) skips the Edit/Write hooks that
// validate it. The `>>`/`sed -i` half was already denied; these pin the truncating half, through the pure
// detector, `reason()`, and the real hook process a dispatched agent's Bash call goes through.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusOverwriteTargets, reason } from '../guard-bash.mjs';
import { loadLedger } from '../conveyor/brief-rule-ledger.mjs';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'guard-bash.mjs');
const OVERWRITE = /Don't overwrite backlog\|reports/;

function hook(command) {
  const run = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' }),
    encoding: 'utf8',
    env: { ...process.env, WE_DISPATCH_KIND: 'fix' },
  });
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(0);
  expect(run.stderr).toBe('');
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

describe('resolved directory writes and documented limits (#4416)', () => {
  const denied = [
    ['cp /tmp/draft.md backlog/x.md', ['backlog/x.md']],
    ...['backlog', 'reports'].flatMap((dir) => [
      [`cp /tmp/draft.md ${dir}`, [`${dir}/draft.md`]],
      [`cp /tmp/draft.md ${dir}/`, [`${dir}/draft.md`]],
      [`cp /tmp/a.md /tmp/b.md /tmp/notes.txt ${dir}/`, [`${dir}/a.md`, `${dir}/b.md`]],
      [`cp '/tmp/draft card.md' '${dir}/nested folder/'`, [`${dir}/nested folder/draft card.md`]],
      [`cp /tmp/draft.md '${dir}/spaced card.md'`, [`${dir}/spaced card.md`]],
      [`env FOO=1 gcp -f -- /tmp/draft.md ./${dir}/`, [`./${dir}/draft.md`]],
      [`install -m 644 /tmp/draft.md ${dir}/`, [`${dir}/draft.md`]],
      [`ginstall -m 644 /tmp/draft.md ${dir}`, [`${dir}/draft.md`]],
      [`mv /tmp/draft.md ${dir}/`, [`${dir}/draft.md`]],
      [`gmv /tmp/draft.md ${dir}`, [`${dir}/draft.md`]],
    ]),
  ];
  it.each(denied)('denies %s through detector, reason and hook JSON', (command, targets) => {
    expect(corpusOverwriteTargets(command)).toEqual(targets);
    const why = reason(command);
    const output = JSON.parse(hook(command)).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    for (const target of targets) {
      expect(why).toContain(target);
      expect(JSON.stringify(output)).toContain(target);
    }
    expect(why).toMatch(/Edit\/Write tools/);
    expect(JSON.stringify(output)).toMatch(/Edit\/Write tools/);
  });

  it.each([
    'cp backlog/a.md /tmp/', 'cp /tmp/a.md /tmp/backlog/',
    'cp /tmp/a.txt reports/', 'cat reports/a.md',
    'mv backlog/a.md backlog/b.md', 'mv backlog/a.md reports/',
    'git mv backlog/a.md backlog/b.md',
    'git commit -m "never echo > backlog/spaced card.md"',
  ])('preserves allowed control %s', (command) => {
    expect(corpusOverwriteTargets(command)).toEqual([]);
    expect(reason(command)).toBeNull();
    expect(hook(command)).toBe('');
  });

  it.each([
    ['cp -t backlog /tmp/a.md', '-t'],
    ['cp --target-directory backlog /tmp/a.md', '--target-directory'],
    ['cp --target-directory=reports /tmp/a.md', '--target-directory'],
    ['dd if=/tmp/a.md of=backlog/a.md', 'dd of='],
    ['rsync /tmp/a.md reports/', 'rsync'],
    ['ln -sf /tmp/a.md backlog/a.md', 'ln -sf'],
    ['cp /tmp/a.md backlog/nested', 'bare nested directories'],
    ['node -e "require(\'fs\').writeFileSync(\'backlog/a.md\', \'x\')"', 'interpreter'],
  ])('pins residual %s to its ledger limitation %s', (command, limitation) => {
    expect(corpusOverwriteTargets(command)).toEqual([]);
    expect(reason(command)).toBeNull();
    expect(hook(command)).toBe('');
    expect(loadLedger().rules.find((r) => r.id === 'card-edit-via-tools').gap).toContain(limitation);
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
