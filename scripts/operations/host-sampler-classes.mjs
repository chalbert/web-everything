/**
 * @file scripts/operations/host-sampler-classes.mjs
 * @description COMMAND-CLASS ATTRIBUTION for the host sampler (epic #3383, capacity refinement 2026-09-21). The
 * first 18.6 hours of telemetry could say the host was loaded but attributed most CPU to `node-other` /
 * `unattributed`: `check-standards` and `verify-lane` were not families of their own, and macOS daemons
 * (`fseventsd`, `photolibraryd`, `WindowServer`, `mds`) landed in `other`. This module is the fixed, closed
 * table that fixes it. It sits BESIDE the original {@link ./host-sampler.mjs#FAMILIES} (which stays byte-identical
 * so every existing reader and record keeps meaning what it meant): the same `ps` rows are classified twice, once
 * by the old family table and once by this class table, and the class figures are written as NEW records.
 *
 * PURE: no fs, no clock, no env, no process. {@link classifyCommandClass} maps one command line to exactly one
 * class; {@link refineWithRoster} lets the roster of live `claude agents` sessions (pid → kind) correct the
 * three Claude classes; {@link summarizeClasses} sums count / CPU% / RSS per class over parsed `ps` rows.
 *
 * THE CLOSED CLASS LIST is the operator's fifteen plus ONE addition, `claude-infra` (the pooled `bg-pty-host`
 * and `daemon` helpers, ~100 MB of idle RSS each on the live host, that would otherwise inflate a real class),
 * the same precedent the original family table set.
 */

/** @typedef {'vitest'|'check-standards'|'verify-lane'|'playwright'|'eleventy-or-vite-dev'|'git'|'npm-npx'|'node-tooling'|'claude-interactive'|'claude-background-worker'|'claude-review-or-print'|'claude-infra'|'container'|'system-macos'|'vscode'|'other'} CommandClass */

export const COMMAND_CLASSES = Object.freeze([
  'vitest', 'check-standards', 'verify-lane', 'playwright', 'eleventy-or-vite-dev', 'git', 'npm-npx', 'node-tooling',
  'claude-interactive', 'claude-background-worker', 'claude-review-or-print', 'claude-infra',
  'container', 'system-macos', 'vscode', 'other',
]);

/** The classes whose presence means a HEAVY command is running (the heavy-admission pool's business). `container` is NOT
 *  here: the Apple `container` system services (apiserver, network, image store) stay resident and idle all day, so a
 *  process count would call every sample heavy. A container is heavy only when it is BUSY ({@link CONTAINER_ACTIVE_CPU_PCT}):
 *  a containerized `check:standards` burns its CPU inside the VM process. */
export const HEAVY_CLASSES = Object.freeze(['vitest', 'check-standards', 'verify-lane', 'playwright']);

/** Summed `container` class CPU (% of one core) at or above which the container class counts as running heavy work. */
export const CONTAINER_ACTIVE_CPU_PCT = 5;

/** The classes that make a sample "not quiet" for a system + VS Code baseline: heavy commands and dev servers. */
export const NOT_QUIET_CLASSES = Object.freeze([...HEAVY_CLASSES, 'eleventy-or-vite-dev']);

/** The classes the operator's own machine runs regardless of this system (the reservation's first customer). */
export const SYSTEM_CLASSES = Object.freeze(['system-macos', 'vscode']);

const baseName = (p) => String(p).replace(/^.*\//, '');
const LAUNCHERS = new Set(['node', 'nodejs', 'npm', 'npx', 'pnpm', 'yarn', 'sh', 'bash', 'zsh', 'tsx', 'ts-node']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const NODE_TOOLS = new Set(['node', 'nodejs', 'tsx', 'ts-node', 'esbuild', 'tsc', 'tsserver', 'eslint', 'prettier', 'nodemon']);

/** macOS system paths and daemon names. A `/usr/bin/<tool>` is NOT here: `/usr/bin/git` must stay `git`. */
const SYSTEM_PATH = /^\/(System\/|usr\/libexec\/|usr\/sbin\/|sbin\/|Library\/(Apple|PrivilegedHelperTools)\/|Applications\/Utilities\/)/;
const SYSTEM_NAMES = /^(fseventsd|photolibraryd|WindowServer|mds|mds_stores|mdworker|mdworker_shared|cloudphotod|cloudd|kernel_task|launchd|logd|trustd|distnoted|cfprefsd|coreaudiod|bluetoothd|spindump|syslogd|powerd|configd|opendirectoryd|nsurlsessiond|searchpartyd|contextstored|PerfPowerServices|akd|accountsd|adid|Finder|Dock|SystemUIServer|loginwindow|universalaccessd|sharingd|rapportd|IMDPersistenceAgent|com\.apple\..*)$/;

/**
 * PURE. Map one `ps` command line to exactly one {@link COMMAND_CLASSES} entry. Rules run in a fixed order over the
 * `head` (the text before the first ` -x` flag: executable plus subcommand/script words) so a flag VALUE can never
 * make an unrelated process look like another class (`grep vitest`, `--user-data-dir=.../Google/Chrome`).
 * A command-only rule can NOT tell a review worker from a build worker (both are `claude bg-spare`): that is
 * {@link refineWithRoster}'s job, from the roster's pid → name map.
 * @param {*} command
 * @returns {CommandClass}
 */
export function classifyCommandClass(command) {
  const key = String(command ?? '');
  const hit = CLASS_MEMO.get(key);
  if (hit !== undefined) return hit;
  const cls = classifyUncached(key);
  if (CLASS_MEMO.size >= CLASS_MEMO_MAX) CLASS_MEMO.clear();
  CLASS_MEMO.set(key, cls);
  return cls;
}

/** A sample classifies the same ~900 command lines four times over and the set barely changes between samples: memoise
 *  (pure function, so the cache cannot change an answer), bounded so a long-running loop never grows without limit. */
const CLASS_MEMO = new Map();
const CLASS_MEMO_MAX = 8192;

function classifyUncached(command) {
  const c = String(command ?? '');
  const head = c.split(/ --?[A-Za-z]/)[0];
  const exe = baseName(head.split(' ')[0]);
  const launcher = LAUNCHERS.has(exe);

  // ── claude ──
  if (exe === 'claude' || exe === 'claude.exe' || /\/claude-code\/(bin\/claude\.exe|cli\.js)/.test(head) || /\/native-binary\/claude( |$)/.test(head)) {
    if (/\bbg-pty-host\b/.test(head) || /(^| )daemon( |$)/.test(head)) return 'claude-infra';
    if (/\bbg-spare\b/.test(head)) return 'claude-background-worker';
    if (/(^| )(-p|--print)( |$)/.test(c)) return /--sdk-url\b/.test(c) ? 'claude-interactive' : 'claude-review-or-print';
    return 'claude-interactive';
  }

  // ── the heavy commands, before the generic launchers swallow them ──
  // The admission wrapper is a waiter/holder, not the work: its argv names the wrapped command but it burns nothing.
  if (/heavy-admission\.mjs/.test(head)) return 'node-tooling';
  if (launcher && /\bverify-lane(\.mjs)?\b/.test(c)) return 'verify-lane';
  if (launcher && /\bcheck[-:]standards(\.mjs)?\b/.test(c)) return 'check-standards';
  if (launcher && (/\bvitest\b/.test(c) || /(^| )npm (run )?test(:unit)?( |$)/.test(head) || /\btest:unit\b/.test(c))) return 'vitest';
  if (/\/node_modules\/(\.bin\/)?vitest/.test(head) || /^node \(vitest/.test(c)) return 'vitest';
  if (/ms-playwright/.test(head) || exe === 'playwright' || (launcher && /\bplaywright\b/.test(head)) || /chrome-headless-shell/.test(head)) return 'playwright';

  // ── dev servers (the operator's own; never agent load) ──
  if (launcher && /\beleventy\b/.test(c) && /--(serve|watch)\b/.test(c)) return 'eleventy-or-vite-dev';
  if (/(^|[/ ])vite( |$)/.test(head) && !/\bvite (build|preview|optimize)\b/.test(head) && (launcher || /node_modules\/\.bin\/vite/.test(head))) return 'eleventy-or-vite-dev';
  if (/\bwrangler dev\b/.test(head) || (exe === 'npm' && /^npm (run )?(start|dev|serve)( |$)/.test(head))) return 'eleventy-or-vite-dev';

  // ── containers (Apple `container` CLI + its VM, docker-alikes) ──
  if (exe === 'container' || /^container-(apiserver|runtime|network|core)/.test(exe) || exe === 'docker' || exe === 'colima' || exe === 'limactl'
    || /com\.apple\.Virtualization\.VirtualMachine/.test(head)) return 'container';

  // ── VS Code (its claude extension is already `claude-interactive` above) ──
  if (/Visual Studio Code\.app|\/\.vscode\/|\/Code Helper|\/vscode-server\//.test(head) || exe === 'code' || exe === 'Electron') return 'vscode';

  // ── tools ──
  if (exe === 'git' || exe.startsWith('git-')) return 'git';
  if (exe === 'npm' || exe === 'npx' || exe === 'pnpm' || exe === 'yarn') return 'npm-npx';
  if (NODE_TOOLS.has(exe)) return 'node-tooling';
  if (SHELLS.has(exe)) return 'node-tooling'; // the Bash-tool shells around a command: ~0 CPU, ~1 MB

  // ── macOS itself ──
  if (SYSTEM_PATH.test(head) || SYSTEM_NAMES.test(exe) || /^\/usr\/bin\/(top|ps|lsof|sysctl|vm_stat|iostat|pmset|df|log|mdutil)( |$)/.test(head)) return 'system-macos';
  return 'other';
}

/**
 * PURE. Correct the Claude classes from the roster of live sessions: `sessionByPid` maps pid → `{kind, name}` where
 * `kind` is one of `build|prepare|review|task|interactive`. A `claude bg-spare` whose pid is a `review-*` session is
 * a review worker, one that is an interactive session is interactive; an unmatched `bg-spare` stays
 * `claude-background-worker` (it may be an idle spare, the roster cannot say).
 * @param {CommandClass} cls
 * @param {number} pid
 * @param {Map<number,{kind:string}>|null} sessionByPid
 */
export function refineWithRoster(cls, pid, sessionByPid) {
  if (!sessionByPid || !cls.startsWith('claude-') || cls === 'claude-infra') return cls;
  const s = sessionByPid.get(pid);
  if (!s) return cls;
  if (s.kind === 'review') return 'claude-review-or-print';
  if (s.kind === 'interactive') return 'claude-interactive';
  return 'claude-background-worker';
}

/**
 * PURE. Sum count, CPU% (of one core) and RSS bytes per class over parsed `ps` rows. Every class key is present
 * (zeros included) so a reader never has to tell "absent" from "none running".
 * @param {Array<{pid?:number, pcpu?:number, rssKb?:number, command?:string}>} rows
 * @param {{sessionByPid?:Map<number,{kind:string}>|null}} [o]
 * @returns {Record<string,{cpuPct:number,memBytes:number,count:number}>}
 */
export function summarizeClasses(rows, { sessionByPid = null } = {}) {
  const out = {};
  for (const k of COMMAND_CLASSES) out[k] = { cpuPct: 0, memBytes: 0, count: 0 };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    const b = out[refineWithRoster(classifyCommandClass(r.command), r.pid, sessionByPid)];
    b.cpuPct += Number.isFinite(r.pcpu) ? r.pcpu : 0;
    b.memBytes += Number.isFinite(r.rssKb) ? r.rssKb * 1024 : 0;
    b.count += 1;
  }
  for (const k of COMMAND_CLASSES) out[k].cpuPct = Math.round(out[k].cpuPct * 10) / 10;
  return out;
}

/** Roster session → the worker kind the reservation question needs. Pure; the name grammar is `<kind>-<id>`. */
export const WORKER_KINDS = Object.freeze(['build', 'prepare', 'review', 'task', 'interactive']);

/** @param {{kind?:string,name?:string}} agent one `claude agents --json` row */
export function workerKind(agent) {
  if (agent?.kind === 'interactive') return 'interactive';
  const n = String(agent?.name ?? '');
  if (/^build([-_ ]|$)/i.test(n)) return 'build';
  if (/^prepare([-_ ]|$)|^prepare-decision/i.test(n)) return 'prepare';
  if (/^review([-_ ]|$)/i.test(n)) return 'review';
  return 'task';
}
