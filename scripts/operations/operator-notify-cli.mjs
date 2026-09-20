/** @file One mechanical NEEDS YOU notification pass; delivery and queue failures stay visible. */
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runOperatorNotify, itemKey } from './operator-notify.mjs';
import * as io from './operator-notify-io.mjs';

export async function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? ((line) => console.log(line));
  const stderr = dependencies.stderr ?? ((line) => console.error(line));
  try {
    let path = io.DEFAULT_STATE_PATH;
    for (const arg of args) {
      if (arg.startsWith('--state=')) path = arg.slice(8);
      // runQuiet appends --repo to every pass. Scoping this queue would drop other
      // repos' state and re-notify them when they reappear, so accept and ignore it.
      else if (arg.startsWith('--repo=') || arg === '--once' || arg === '--json') continue;
      else throw new Error(`Unknown argument: ${arg}`);
    }
    const result = await runOperatorNotify({
      readQueue: dependencies.readQueue ?? io.readQueue,
      readState: dependencies.readState ?? (() => io.readState(path)),
      writeState: dependencies.writeState ?? ((state) => io.writeState(path, state)),
      notify: dependencies.notify ?? io.notifyDesktopChecked,
      now: dependencies.now ?? new Date().toISOString(),
    });
    if (args.includes('--json')) stdout(JSON.stringify(result));
    else {
      for (const row of result.notified) stdout(`notified ${itemKey(row)}  ${row.title}`);
      for (const { row } of result.failed) stdout(`NOT NOTIFIED ${itemKey(row)}  ${row.title}`);
    }
    for (const { error } of result.failed) stderr(error);
    for (const error of result.queueErrors) stderr(error);
    return result.exitCode;
  } catch (error) { stderr(String(error?.message ?? error)); return 1; }
}

/** Resolve symlinks and doubled slash spellings, as operator-queue does. */
export function isCliEntry(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (!argv1) return false;
  let resolved = argv1;
  try { resolved = realpathSync(argv1); } catch { /* not on disk — compare the raw spelling */ }
  return moduleUrl === pathToFileURL(resolved).href;
}
if (isCliEntry()) process.exitCode = await main();
