/** #3383 — Run independent copies of the run store, with and without an explicit shared root. */
import { it, expect } from 'vitest';
import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
it('separate checkouts resolve one root and can read each other’s writes', () => {
  const root = process.env.WE_COORDINATION_ROOT;
  const source = join(dirname(fileURLToPath(import.meta.url)), '..');
  const clones = ['a', 'b'].map((name) => {
    const dir = join(root, name); mkdirSync(join(dir, 'scripts/operations'), { recursive: true });
    for (const file of ['run-store.mjs', 'run-record.mjs', 'coordination-root.mjs']) copyFileSync(join(source, file), join(dir, 'scripts/operations', file));
    return dir;
  });
  const run = (cwd, env, body) => execFileSync(process.execPath, ['--input-type=module', '-e', `import * as store from './scripts/operations/run-store.mjs'; ${body}`], { cwd, env, encoding: 'utf8' }).trim();
  const env = { ...process.env, WE_COORDINATION_ROOT: join(root, 'shared') }; delete env.OPERATION_RUNS_DIR;
  expect(clones.map((c) => run(c, env, 'console.log(store.resolveRunsDir())'))).toEqual([join(root, 'shared/runs'), join(root, 'shared/runs')]);
  run(clones[0], env, "store.createFileRunStore().write(store.newRunRecord({id:'run-clone',op:'fixture'}));");
  expect(JSON.parse(run(clones[1], env, "console.log(JSON.stringify(store.createFileRunStore().read('run-clone')))"))).toMatchObject({ id: 'run-clone', op: 'fixture' });
  delete env.WE_COORDINATION_ROOT; env.HOME = join(root, 'home');
  expect(clones.map((c) => run(c, env, 'console.log(store.resolveRunsDir())'))).toEqual(Array(2).fill(join(env.HOME, 'workspace/.operations/coordination/runs')));
});
