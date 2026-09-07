// Freeze the backlog corpus for a test file's lifetime (#3531).
//
// `we:src/_data/backlog.js` reads `we:backlog/*.md` from disk on EVERY call, and its unblock-leverage
// fields (`directUnblocks` / `transitiveUnblocks` / `unblocksToReady` / `leverageScore`) are a pure
// function of that corpus — nothing else in the loader can move them (see the elimination proof pinned in
// `we:src/_data/__tests__/frozen-backlog.test.ts`). So a test that loads TWICE and compares the two is
// asserting determinism only if the corpus cannot change between the reads. Against the live directory it
// cannot promise that: `we:backlog/` is a working directory that scaffold/resolve/drain write to, and at
// full-suite size the two reads are far enough apart in wall-clock for a concurrent write to land between
// them. That is the whole of #3531 — not env pollution from a sibling test, which is provably incapable of
// moving those fields once the module is loaded.
//
// The seam is therefore ISOLATION, not the assertion: copy the corpus once, point the loader at the copy.
// The determinism claim keeps its full force (the same derivation, run twice, over the real 3500-card
// corpus) and simply stops racing a directory other processes own.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Copy `sourceDir` into a throwaway temp directory and hand back the copy plus its disposer. Later writes
 * to `sourceDir` are invisible to the copy — that immutability is the point, not an implementation detail.
 */
export function freezeBacklogCorpus(sourceDir: string): { dir: string; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'we-frozen-backlog-'));
  cpSync(sourceDir, dir, { recursive: true });
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Run `load` with `WE_BACKLOG_DIR` pointed at `dir`, then restore the variable to EXACTLY its prior state —
 * including "was not set at all", which a naive save/restore turns into an empty string.
 *
 * The narrow window matters. `we:src/_data/backlog.js` resolves `BACKLOG_DIR` once, at module load, so the
 * only call that needs the override is the `require`; holding the variable any longer would leave the
 * worker-global `process.env` dirty for whatever file vitest packs in next — reintroducing the very
 * cross-file leak #3531 was filed suspecting.
 */
export function withFrozenBacklogDir<T>(dir: string, load: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'WE_BACKLOG_DIR');
  const prior = process.env.WE_BACKLOG_DIR;
  process.env.WE_BACKLOG_DIR = dir;
  try {
    return load();
  } finally {
    if (had) process.env.WE_BACKLOG_DIR = prior as string;
    else delete process.env.WE_BACKLOG_DIR;
  }
}
