/**
 * @file scripts/operations/detached-dispatch.mjs
 * @description THE PRIMITIVES EVERY DETACHED PER-KIND DISPATCH PROVIDER NEEDS — the handle SHAPE a detached
 *   dispatch carries (`pid:<n>`), the kernel probe that answers its liveness, the detached spawn itself, and
 *   the log path its narration lands in. Extracted from {@link ./dispatch-lane-io.mjs} VERBATIM.
 *
 * WHY THIS IS ITS OWN MODULE, AND WHY THAT IS NOT A SPLIT OF THE COHESIVE IO SHELL. `dispatch-lane-io.mjs`
 * carries an `@cohesive:` marker recording a prior ruling: its reader / sink / observer triple is ONE
 * operation's io boundary and must NOT be broken into three modules. Nothing here breaks it. The triple is
 * intact and still lives there; what moved out is the per-kind mechanical PROVIDER machinery #3645 ADDED to
 * that file — new code, not one of the three halves — plus the primitives it is built from. The reader, the
 * sink and the observer still sit together, still share the handle contract the sink's docblock owns, and
 * still get imported together.
 *
 * WHY IT MOVED AT ALL. #3645 wired exactly one launch kind (`build`) mechanically. Five siblings are queued to
 * wire the rest (`prepare` #3641, `prepare-decision` #3644, `fix` #3640, `ci-heal` #3642 — see
 * `we:backlog/3643-*.md`). Every one of them needs THESE FOUR THINGS and nothing else about the io shell: a
 * durable handle a later liveness read can resolve, a probe that answers it without the dispatching process
 * still existing, a spawn that survives the runner being restarted, and somewhere for the child's output to
 * go. Left inside the io shell they would be five lanes editing one 2000-line file; here each kind imports
 * them and touches nothing shared. See {@link ./dispatch-provider-registry.mjs} for how a kind is registered.
 *
 * THE DEPENDENCY IS ONE-WAY, deliberately: `dispatch-lane-io.mjs` → `detached-dispatch.mjs`, NEVER back. This
 * module knows nothing about the tick, the effect executor, the run store, or `claude`. That is what lets a
 * per-kind provider module import it without pulling the whole io shell (and its `claude agents` shelling)
 * into a process that only wants to spawn one child.
 *
 * A NOTE ON THE `{@link}`s IN THE MOVED DOCBLOCKS, which are kept verbatim rather than rewritten: references to
 * `isDispatchHandleLive`, `parseBackgroundedHandle`, `defaultSpawnAgent` and `stampLiveness` resolve in
 * {@link ./dispatch-lane-io.mjs}, which is where those still live — `isDispatchHandleLive` in particular STAYS
 * there because it composes `detachedHandlePid` (here) with `isHandleListed` (the `claude` listing read, which
 * is io-shell business), and splitting a composition from one of its halves buys nothing.
 *
 * IMPURE only in {@link defaultSpawnDetached} (`fs`, `child_process`) and {@link defaultIsPidAlive}
 * (`process.kill`). Everything else here is PURE.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markWorkerEnv } from './session-role.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION and never by cwd — the same reason `dispatch-lane-io.mjs` and
 *  `run-store.mjs` each resolve their own. Held here rather than imported from the io shell so the one-way
 *  dependency above holds: a provider module needs the root, and must not import the io shell to get it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** Where a detached delivery's stdout/stderr lands: `we:.operations/delivery-dispatch-logs/<slug>.log`, the
 *  same gitignored sidecar family `delivery-report-store.mjs` and `minimal-context-provider.mjs` already use. */
export function deliveryDispatchLogPath(sessionSlug, root = REPO_ROOT) {
  const safe = /^[A-Za-z0-9._-]+$/.test(String(sessionSlug || '')) ? String(sessionSlug) : 'unnamed-dispatch';
  return join(root, '.operations', 'delivery-dispatch-logs', `${safe}.log`);
}

/**
 * THE HANDLE SHAPE A DETACHED DELIVERY CARRIES. `pid:<n>` — deliberately unlike every `claude` handle
 * ({@link parseBackgroundedHandle} only ever yields lower-case hex), so {@link isDispatchHandleLive} can tell
 * the two apart with no extra field on the run record and no migration of the records already on disk.
 */
export const DETACHED_HANDLE_PREFIX = 'pid:';

/** The pid inside a `pid:<n>` handle, or `null` for anything else. PURE. */
export function detachedHandlePid(handle) {
  const raw = String(handle ?? '').trim();
  if (!raw.startsWith(DETACHED_HANDLE_PREFIX)) return null;
  const pid = Number(raw.slice(DETACHED_HANDLE_PREFIX.length));
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/**
 * IS THIS PID STILL RUNNING? `process.kill(pid, 0)` sends no signal — it only asks the kernel whether the
 * process exists and whether we may signal it. `EPERM` means it EXISTS and belongs to someone else, which is
 * still alive; `ESRCH` (and anything else) means gone.
 *
 * THIS IS THE READ THAT MAKES RESTART-SURVIVAL OBSERVABLE. It asks the kernel, not a listing and not the
 * process that started the delivery — so a runner that was restarted mid-delivery still gets a truthful `live:
 * true` for the detached process it no longer parents, and its double-dispatch guard holds the item instead of
 * starting a second build in an occupied lane.
 */
export function defaultIsPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return String(e?.code || '') === 'EPERM';
  }
}

/**
 * The DETACHED spawn primitive — named and exported for the same reason {@link defaultSpawnAgent} is: the
 * options ARE the contract (`detached`, the log fds, the `unref`), and an option no test can reach is an option
 * the next refactor deletes for free.
 *
 * `detached: true` makes the child a new session leader (Node calls `setsid`), so it is NOT in the runner's
 * process group and a group-wide signal — which is exactly what `we:scripts/operations/restart-runner-io.mjs`'s
 * shutdown sends — never reaches it. `.unref()` lets the dispatching process exit without waiting. `stdio` goes
 * to a real file because a detached child with a piped stdio nobody reads blocks on a full pipe, and because
 * the log is the only place a delivery's own narration survives.
 */
export function defaultSpawnDetached(argv, { cwd, logPath } = {}, {
  spawn = nodeSpawn,
  ensureDir = (d) => mkdirSync(d, { recursive: true }),
  openLog = (p) => openSync(p, 'a'),
} = {}) {
  ensureDir(dirname(logPath));
  const fd = openLog(logPath);
  const child = spawn(process.execPath, argv, { cwd, detached: true, stdio: ['ignore', fd, fd], env: markWorkerEnv(process.env) });
  if (typeof child.unref === 'function') child.unref();
  return child;
}
