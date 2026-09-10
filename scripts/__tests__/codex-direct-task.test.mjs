/**
 * @file codex-direct-task.test.mjs — the mechanical parts of the personal Codex-direct-task escape hatch,
 * proved WITHOUT spawning anything real (mirrors `judge-spawn.test.mjs`'s split: pure argv/plan functions get
 * cheap, exhaustive tests; the one thing that actually needed a real process — whether agentic mode's `--json`
 * stream shows granular tool calls — was checked with a real, live `codex exec` invocation while building this
 * file, recorded in the module's own header and in the delivering PR, not re-proved here).
 */

import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CODEX_CLI,
  DEFAULT_TIMEOUT_MS,
  CODEX_EFFORT_MAP,
  buildCodexDirectTaskArgv,
  buildCodexPrompt,
  buildScratchCloneArgv,
  planDepsInstall,
  parseJsonlLine,
  parseJsonlEvents,
  summarizeEvents,
  setupScratchClone,
  captureDiff,
  runGate,
  runCodexDirectExec,
  codexDirectTask,
} from '../codex-direct-task.mjs';

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

describe('buildCodexDirectTaskArgv — pure argv for agentic/workspace-write mode', () => {
  it('always carries exec, --json, workspace-write sandbox, and -C, never a positional prompt', () => {
    const argv = buildCodexDirectTaskArgv({ cwd: '/tmp/scratch' });
    expect(argv[0]).toBe('exec');
    expect(argv).toContain('--json');
    expect(flagValue(argv, '-s')).toBe('workspace-write');
    expect(flagValue(argv, '-C')).toBe('/tmp/scratch');
    expect(argv).toContain('--skip-git-repo-check');
    // No positional prompt anywhere in argv — the task rides stdin (avoids the #3371-probe-0 stdin trap).
    expect(argv.some((a) => a.includes('Add') || a.includes('task'))).toBe(false);
  });

  it('requires a non-empty cwd', () => {
    expect(() => buildCodexDirectTaskArgv({})).toThrow(/cwd/);
    expect(() => buildCodexDirectTaskArgv({ cwd: '  ' })).toThrow(/cwd/);
  });

  it('adds -o only when outputLastMessageFile is given', () => {
    expect(buildCodexDirectTaskArgv({ cwd: '/d' })).not.toContain('-o');
    const argv = buildCodexDirectTaskArgv({ cwd: '/d', outputLastMessageFile: '/d/last.txt' });
    expect(flagValue(argv, '-o')).toBe('/d/last.txt');
  });

  it('does NOT pass --ephemeral by default, but does when asked', () => {
    expect(buildCodexDirectTaskArgv({ cwd: '/d' })).not.toContain('--ephemeral');
    expect(buildCodexDirectTaskArgv({ cwd: '/d', ephemeral: true })).toContain('--ephemeral');
  });

  it('forwards --add-dir once per entry', () => {
    const argv = buildCodexDirectTaskArgv({ cwd: '/d', addDirs: ['/a', '/b'] });
    const idxs = argv.reduce((acc, a, i) => (a === '--add-dir' ? [...acc, i] : acc), []);
    expect(idxs.map((i) => argv[i + 1])).toEqual(['/a', '/b']);
  });

  it('maps model to -m, rejecting a flag-shaped value', () => {
    expect(flagValue(buildCodexDirectTaskArgv({ cwd: '/d', model: 'gpt-5-codex' }), '-m')).toBe('gpt-5-codex');
    expect(() => buildCodexDirectTaskArgv({ cwd: '/d', model: '--danger' })).toThrow();
  });

  it('maps effort through CODEX_EFFORT_MAP, clamping xhigh/max to high, and rejects unknown levels', () => {
    for (const [level, mapped] of Object.entries(CODEX_EFFORT_MAP)) {
      const argv = buildCodexDirectTaskArgv({ cwd: '/d', effort: level });
      expect(flagValue(argv, '-c')).toBe(`model_reasoning_effort=${mapped}`);
    }
    expect(() => buildCodexDirectTaskArgv({ cwd: '/d', effort: 'ultra' })).toThrow();
  });
});

describe('buildCodexPrompt — folds in the do-not-commit instruction', () => {
  it('keeps the task text verbatim and appends the constraint', () => {
    const p = buildCodexPrompt('Add a comment to notes.txt');
    expect(p).toContain('Add a comment to notes.txt');
    expect(p).toMatch(/do not run `git commit`/);
    expect(p).toMatch(/do not run `git push`/);
  });

  it('rejects an empty task', () => {
    expect(() => buildCodexPrompt('')).toThrow();
    expect(() => buildCodexPrompt('   ')).toThrow();
  });
});

describe('buildScratchCloneArgv — pure local-clone argv', () => {
  it('clones repoRoot into dest, quietly', () => {
    expect(buildScratchCloneArgv({ repoRoot: '/repo', dest: '/tmp/x' })).toEqual(['clone', '--quiet', '/repo', '/tmp/x']);
  });
  it('requires both paths', () => {
    expect(() => buildScratchCloneArgv({ dest: '/tmp/x' })).toThrow(/repoRoot/);
    expect(() => buildScratchCloneArgv({ repoRoot: '/repo' })).toThrow(/dest/);
  });
});

describe('planDepsInstall — ci vs install vs nothing, over an injected existsFn', () => {
  it('returns null when there is no package.json', () => {
    expect(planDepsInstall('/d', () => false)).toBeNull();
  });
  it('uses npm ci when a lockfile is present', () => {
    const existsFn = (p) => p.endsWith('package.json') || p.endsWith('package-lock.json');
    expect(planDepsInstall('/d', existsFn)).toEqual({ bin: 'npm', args: ['ci'] });
  });
  it('falls back to npm install with no lockfile', () => {
    const existsFn = (p) => p.endsWith('package.json');
    expect(planDepsInstall('/d', existsFn)).toEqual({ bin: 'npm', args: ['install'] });
  });
});

describe('JSONL parsing — tolerant of blank/malformed lines, never throws', () => {
  it('parseJsonlLine returns null for blank or unparsable input', () => {
    expect(parseJsonlLine('')).toBeNull();
    expect(parseJsonlLine('   ')).toBeNull();
    expect(parseJsonlLine('not json')).toBeNull();
    expect(parseJsonlLine('{"a":1}')).toEqual({ a: 1 });
  });

  it('parseJsonlEvents drops blank/unparsable lines and keeps order', () => {
    const stdout = '{"type":"a"}\n\n{"type":"b"}\nnope\n{"type":"c"}\n';
    expect(parseJsonlEvents(stdout).map((e) => e.type)).toEqual(['a', 'b', 'c']);
  });
});

describe('summarizeEvents — the real agentic-mode event shape observed in a live codex exec run', () => {
  // This is the ACTUAL (trimmed) shape a real `codex exec --json -s workspace-write` run produced against a
  // real scratch git repo, adding a one-line comment to notes.txt — see the module header for the full
  // transcript and the exact command. Pinned here so a future Codex CLI update that changes this shape fails
  // a test instead of silently degrading `summarizeEvents`.
  const REAL_EVENTS = [
    { type: 'thread.started', thread_id: '01a08aed-f2ec-7ad0-b4e2-7a7ab89abb98' },
    { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'I will read notes.txt…' } },
    { type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: "/bin/bash -lc 'pwd; rg --files'", status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: "/bin/bash -lc 'pwd; rg --files'", aggregated_output: 'notes.txt\n', exit_code: 0, status: 'completed' } },
    { type: 'item.started', item: { id: 'item_2', type: 'command_execution', command: "/bin/bash -lc 'cat notes.txt'", status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_2', type: 'command_execution', command: "/bin/bash -lc 'cat notes.txt'", aggregated_output: 'scratch file for a probe\n', exit_code: 0, status: 'completed' } },
    { type: 'item.started', item: { id: 'item_3', type: 'file_change', changes: [{ path: '/scratch/notes.txt', kind: 'update' }], status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_3', type: 'file_change', changes: [{ path: '/scratch/notes.txt', kind: 'update' }], status: 'completed' } },
    { type: 'item.completed', item: { id: 'item_4', type: 'agent_message', text: 'Added a purpose comment. No other edits.' } },
    { type: 'turn.completed', usage: { input_tokens: 62159, cached_input_tokens: 53504, output_tokens: 219 } },
  ];

  it('extracts the thread id, turn count, every tool command, every file change, and the terminal status', () => {
    const s = summarizeEvents(REAL_EVENTS);
    expect(s.threadId).toBe('01a08aed-f2ec-7ad0-b4e2-7a7ab89abb98');
    expect(s.turns).toBe(1);
    expect(s.commands).toEqual(["/bin/bash -lc 'pwd; rg --files'", "/bin/bash -lc 'cat notes.txt'"]);
    expect(s.filesChanged).toEqual([{ path: '/scratch/notes.txt', kind: 'update' }]);
    expect(s.agentMessages).toEqual(['I will read notes.txt…', 'Added a purpose comment. No other edits.']);
    expect(s.terminal).toBe('turn.completed');
    expect(s.usage.input_tokens).toBe(62159);
  });

  it('reads the LAST terminal event, never the first, over a multi-turn stream', () => {
    const events = [
      { type: 'thread.started', thread_id: 't1' },
      { type: 'turn.started' },
      { type: 'turn.completed', usage: { input_tokens: 1 } },
      { type: 'turn.started' },
      { type: 'turn.failed', error: { message: 'boom' } },
    ];
    expect(summarizeEvents(events).terminal).toBe('turn.failed');
  });

  it('reports null/empty over an empty stream (a spawn that produced no output at all)', () => {
    const s = summarizeEvents([]);
    expect(s.threadId).toBeNull();
    expect(s.terminal).toBeNull();
    expect(s.commands).toEqual([]);
    expect(s.filesChanged).toEqual([]);
  });
});

describe('setupScratchClone — clones locally and installs deps, over injected execFn/mkTempDir/existsFn', () => {
  it('clones from repoRoot, fixes up origin to the real remote, and installs deps when a lockfile exists', () => {
    const calls = [];
    const execFn = (bin, args, opts) => {
      calls.push({ bin, args, opts });
      if (bin === 'git' && args.includes('get-url')) return 'https://github.com/x/y.git\n';
      return '';
    };
    const mkTempDir = (prefix) => `${prefix}FAKE`;
    const existsFn = (p) => p.endsWith('package.json') || p.endsWith('package-lock.json');

    const result = setupScratchClone({ repoRoot: '/repo', execFn, mkTempDir, existsFn });

    expect(result.dest).toMatch(/FAKE$/);
    expect(result.depsInstall).toEqual({ bin: 'npm', args: ['ci'] });
    // clone happened first, against the real buildScratchCloneArgv recipe
    const cloneCall = calls.find((c) => c.bin === 'git' && c.args[0] === 'clone');
    expect(cloneCall.args).toEqual(buildScratchCloneArgv({ repoRoot: '/repo', dest: result.dest }));
    // origin fixup attempted
    expect(calls.some((c) => c.bin === 'git' && c.args.includes('set-url') && c.args.includes('https://github.com/x/y.git'))).toBe(true);
    // deps actually installed in the clone
    expect(calls.some((c) => c.bin === 'npm' && c.args[0] === 'ci' && c.opts?.cwd === result.dest)).toBe(true);
  });

  it('tolerates a repoRoot with no origin remote — clone still succeeds', () => {
    const execFn = (bin, args) => {
      if (bin === 'git' && args.includes('get-url')) throw new Error('no such remote');
      return '';
    };
    const result = setupScratchClone({
      repoRoot: '/repo', execFn, mkTempDir: (p) => `${p}FAKE`, existsFn: () => false,
    });
    expect(result.dest).toMatch(/FAKE$/);
    expect(result.depsInstall).toBeNull(); // existsFn says no package.json
  });

  it('skips dep install when installDeps is false, even with a lockfile present', () => {
    const execFn = () => '';
    const result = setupScratchClone({
      repoRoot: '/repo', execFn, mkTempDir: (p) => `${p}FAKE`, existsFn: () => true, installDeps: false,
    });
    expect(result.depsInstall).toBeNull();
  });

  it('requires a non-empty repoRoot', () => {
    expect(() => setupScratchClone({ execFn: () => '' })).toThrow(/repoRoot/);
  });
});

describe('captureDiff — the review artifact, never a commit/push', () => {
  // Every real call is shaped `['-C', dir, <subcommand>, ...]` (see `captureDiff`'s own `execFn('git', ['-C',
  // dir, 'status', ...])` etc.), so these mocks match on `args.includes(...)`, never `args[0]`.
  it('reports a clean tree as no changes', () => {
    const execFn = (bin, args) => {
      if (args.includes('status')) return '';
      if (args.includes('diff') && args.includes('--stat')) return '';
      if (args.includes('diff')) return '';
      if (args.includes('log')) return '';
      return '';
    };
    const r = captureDiff({ dir: '/d', startSha: 'abc123', execFn });
    expect(r.hasChanges).toBe(false);
    expect(r.commits).toEqual([]);
  });

  it('intent-to-adds untracked files (content-free) so they surface in the diff, and reports the diff/stat', () => {
    const calls = [];
    const execFn = (bin, args) => {
      calls.push(args.join(' '));
      if (args.includes('status')) return '?? new-file.txt\n M existing.txt\n';
      if (args.includes('diff') && args.includes('--stat')) return ' 2 files changed\n';
      if (args.includes('diff')) return 'diff --git a/existing.txt …';
      if (args.includes('log')) return '';
      return '';
    };
    const r = captureDiff({ dir: '/d', startSha: 'abc123', execFn });
    expect(calls).toContain('-C /d add --intent-to-add -- new-file.txt');
    expect(r.hasChanges).toBe(true);
    expect(r.diffStat).toContain('2 files changed');
  });

  it('never stages real content — the only `add` call it can make is --intent-to-add', () => {
    const calls = [];
    const execFn = (bin, args) => {
      calls.push(args);
      if (args.includes('status')) return '?? x.txt\n';
      return '';
    };
    captureDiff({ dir: '/d', startSha: 'abc', execFn });
    const addCalls = calls.filter((a) => a.includes('add'));
    expect(addCalls.length).toBeGreaterThan(0);
    expect(addCalls.every((a) => a.includes('--intent-to-add'))).toBe(true);
  });

  it('surfaces commits Codex made despite the prompt instruction, via `git log startSha..HEAD`', () => {
    const execFn = (bin, args) => {
      if (args.includes('status')) return '';
      if (args.includes('log')) return 'abcdef1 codex: whoops, committed anyway\n';
      return '';
    };
    const r = captureDiff({ dir: '/d', startSha: 'abc', execFn });
    expect(r.commits).toEqual(['abcdef1 codex: whoops, committed anyway']);
    expect(r.hasChanges).toBe(true);
  });

  it('requires dir and startSha', () => {
    expect(() => captureDiff({ startSha: 'x', execFn: () => '' })).toThrow(/dir/);
    expect(() => captureDiff({ dir: '/d', execFn: () => '' })).toThrow(/startSha/);
  });
});

describe('runGate — none/standards/full, never commits', () => {
  it('mode "none" (default) runs nothing and passes', () => {
    const execFn = vi.fn();
    const r = runGate({ dir: '/d', mode: 'none', execFn });
    expect(r.ran).toBe(false);
    expect(r.pass).toBe(true);
    expect(execFn).not.toHaveBeenCalled();
  });

  it('mode "standards" runs only check:standards', () => {
    const execFn = vi.fn(() => 'ok');
    const r = runGate({ dir: '/d', mode: 'standards', execFn });
    expect(r.steps.map((s) => s.cmd)).toEqual(['npm run check:standards']);
    expect(r.pass).toBe(true);
  });

  it('mode "full" runs check:standards then the full vitest suite', () => {
    const execFn = vi.fn(() => 'ok');
    const r = runGate({ dir: '/d', mode: 'full', execFn });
    expect(r.steps.map((s) => s.cmd)).toEqual(['npm run check:standards', 'npx vitest run']);
  });

  it('a failing step is caught and reported, not thrown — and marks the gate failed', () => {
    const execFn = vi.fn((bin, args) => {
      if (args.includes('check:standards')) { const e = new Error('exit 1'); e.stdout = 'BAD'; throw e; }
      return 'ok';
    });
    const r = runGate({ dir: '/d', mode: 'full', execFn });
    expect(r.pass).toBe(false);
    expect(r.steps[0].pass).toBe(false);
    expect(r.steps[0].output).toContain('BAD');
    expect(r.steps[1].pass).toBe(true); // the second step still ran
  });
});

describe('runCodexDirectExec / codexDirectTask — the orchestrator, over an injected spawnFn + execFn', () => {
  /** Same fakeSpawn shape `judge-spawn.test.mjs` uses — records argv/stdin, replays canned stdout. */
  function fakeSpawn(stdout, { code = 0 } = {}) {
    const seen = { cli: null, argv: null, opts: null, stdin: '' };
    const fn = (cli, argv, opts) => {
      seen.cli = cli; seen.argv = argv; seen.opts = opts;
      const child = {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(Buffer.from(stdout)), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: (d) => { seen.stdin = d; } },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(code), 1); },
        kill: () => {},
      };
      return child;
    };
    return { fn, seen };
  }

  it('spawns codex with the exact argv buildCodexDirectTaskArgv would produce, writes the task to stdin, and logs raw stdout to the log file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-codex-direct-test-'));
    const logFile = join(dir, 'events.jsonl');
    const stdout = '{"type":"thread.started","thread_id":"t1"}\n{"type":"turn.completed","usage":{}}\n';
    const { fn, seen } = fakeSpawn(stdout);
    try {
      const r = await runCodexDirectExec({ dir, task: 'do the thing', logFile, stream: false, spawnFn: fn });
      expect(seen.cli).toBe(CODEX_CLI);
      expect(seen.argv).toEqual(buildCodexDirectTaskArgv({ cwd: dir, outputLastMessageFile: join(dir, '.git', 'codex-direct-task-last-message.txt') }));
      expect(seen.stdin).toContain('do the thing');
      expect(seen.stdin).toMatch(/do not run `git commit`/);
      expect(r.stdout).toBe(stdout);
      const logged = readFileSync(logFile, 'utf8');
      expect(logged).toBe(stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('SIGKILLs the child on the parent-imposed timeout wall and still resolves with partial output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-codex-direct-test-'));
    const logFile = join(dir, 'events.jsonl');
    let killed = false;
    const spawnFn = () => {
      let closeCb = null;
      return {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(Buffer.from('{"type":"turn.started"}\n')), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        // A real child only emits 'close' AFTER it is actually killed — simulate that instead of never closing,
        // so the promise this test awaits actually settles (the SIGKILL itself does not resolve anything; the
        // subsequent 'close' event is what `runCodexDirectExec` waits for).
        on: (e, cb) => { if (e === 'close') closeCb = cb; },
        kill: () => { killed = true; if (closeCb) setTimeout(() => closeCb(null), 1); },
      };
    };
    try {
      const r = await runCodexDirectExec({ dir, task: 't', logFile, stream: false, timeoutMs: 5, spawnFn });
      expect(killed).toBe(true);
      expect(r.timedOut).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('codexDirectTask: with an explicit --dir, does NOT create a scratch clone, and captures a real diff via execFn', async () => {
    const stdout = '{"type":"thread.started","thread_id":"t1"}\n{"type":"turn.completed","usage":{}}\n';
    const { fn: spawnFn } = fakeSpawn(stdout);
    const execCalls = [];
    const execFn = (bin, args, opts) => {
      execCalls.push({ bin, args });
      if (args.includes('rev-parse')) return 'startsha123\n';
      if (args.includes('status')) return ' M edited.txt\n';
      if (args.includes('diff') && args.includes('--stat')) return ' 1 file changed\n';
      if (args.includes('diff')) return 'diff --git a/edited.txt …';
      if (args.includes('log')) return '';
      return '';
    };
    const dir = mkdtempSync(join(tmpdir(), 'we-codex-direct-test-'));
    try {
      const report = await codexDirectTask({
        task: 'edit a file', dir, gate: 'none', stream: false, execFn, spawnFn,
      });
      expect(report.scratch.created).toBe(false);
      expect(report.dir).toBe(dir);
      expect(report.startSha).toBe('startsha123');
      expect(report.diff.hasChanges).toBe(true);
      expect(report.events.threadId).toBe('t1');
      expect(execCalls.some((c) => c.bin === 'git' && c.args.includes('clone'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('codexDirectTask: with no --dir, requires repoRoot and creates a scratch clone first', async () => {
    const { fn: spawnFn } = fakeSpawn('{"type":"turn.completed","usage":{}}\n');
    await expect(codexDirectTask({ task: 't', execFn: () => '', spawnFn })).rejects.toThrow(/repoRoot/);
  });

  it('codexDirectTask: no --dir + repoRoot given → clones, then runs codex, then diffs the CLONE, never the source', async () => {
    const stdout = '{"type":"turn.completed","usage":{}}\n';
    const { fn: spawnFn, seen } = fakeSpawn(stdout);
    const execFn = (bin, args) => {
      if (bin === 'git' && args[0] === 'clone') return '';
      if (bin === 'git' && args.includes('get-url')) throw new Error('no origin');
      if (bin === 'git' && args.includes('rev-parse')) return 'sha0\n';
      if (bin === 'git' && args.includes('status')) return '';
      if (bin === 'git' && args.includes('diff')) return '';
      if (bin === 'git' && args.includes('log')) return '';
      return '';
    };
    const report = await codexDirectTask({
      task: 't', repoRoot: '/repo', gate: 'none', stream: false, execFn, spawnFn,
      mkTempDir: (p) => `${p}FAKE`, existsFn: () => false,
    });
    expect(report.scratch.created).toBe(true);
    expect(report.dir).toMatch(/FAKE$/);
    expect(flagValueFrom(seen.argv, '-C')).toBe(report.dir);
  });

  function flagValueFrom(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  }
});
