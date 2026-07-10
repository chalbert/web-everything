/**
 * @file scripts/lib/replay-substrate.mjs
 * @description #2272 — the ephemeral throwaway-clone substrate ratified by #2274 (codified in
 * docs/agent/platform-decisions.md#skill-memory-replay-substrate): a fabricated bare `origin.git` +
 * a real clone of it, created under `mkdtempSync` and discarded via `rmSync` — never the shared lane
 * pool (scripts/lane-pool.mjs) and never a real `~/workspace/.lanes` clone. Generalizes the pattern
 * already shipping in scripts/__tests__/lane-drain-numbering.test.mjs and
 * scripts/__tests__/lane-pool-refresh-guard.test.mjs so both the Tier-B session-replay harness
 * (scripts/session-replay.mjs) and future Tier-A mutation tests share one substrate primitive.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GIT_IDENTITY = ['-c', 'user.email=replay@webeverything.local', '-c', 'user.name=Replay Harness', '-c', 'commit.gpgsign=false'];

function git(args, cwd) {
  return execFileSync('git', [...GIT_IDENTITY, ...args], { cwd, encoding: 'utf8' }).trim();
}

/**
 * Creates a throwaway { origin.git (bare) + work (clone) } pair under a fresh mkdtemp dir, seeds an
 * initial commit on `main`, and pushes it — the "fabricated historical tree" #2274 requires as the
 * seed a fixture is layered onto. Disposable by construction: nothing here touches the shared lane
 * pool or a real lane clone, so `cleanup()` is always safe and never strands a lease.
 *
 * @param {{ prefix?: string }} [opts]
 * @returns {{ base: string, originDir: string, workDir: string, mainShaBefore: string,
 *            git: (args: string[], cwd?: string) => string, cleanup: () => void }}
 */
export function createReplaySubstrate({ prefix = 'replay-' } = {}) {
  const base = mkdtempSync(join(tmpdir(), prefix));
  const originDir = join(base, 'origin.git');
  const workDir = join(base, 'work');

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, workDir]);
  mkdirSync(join(workDir, 'backlog'), { recursive: true });
  writeFileSync(
    join(workDir, 'README.md'),
    '# Ephemeral replay fixture\n\nSeeded by scripts/lib/replay-substrate.mjs — never a real project checkout.\n',
  );
  git(['add', '-A'], workDir);
  git(['commit', '--quiet', '-m', 'seed: ephemeral replay substrate init'], workDir);
  git(['push', '--quiet', 'origin', 'main'], workDir);
  const mainShaBefore = git(['rev-parse', 'origin/main'], workDir);

  return {
    base,
    originDir,
    workDir,
    mainShaBefore,
    git: (args, cwd = workDir) => git(args, cwd),
    cleanup: () => {
      try {
        rmSync(base, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    },
  };
}
