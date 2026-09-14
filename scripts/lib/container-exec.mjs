/**
 * @file scripts/lib/container-exec.mjs
 * @description THE HEAVY-COMMAND CONTAINER POOL POC (#3621 sequencing note, tracked on #3383) — runs a heavy
 *   command inside a real Apple `container` CLI instance (Containerization framework, Apple-Silicon-only)
 *   instead of directly on the host, so the cap `we:scripts/readiness/heavy-admission.mjs` already enforces
 *   (currently `DEFAULT_ADMISSION_CAP = 2`, an in-process COUNTING semaphore with no resource boundary behind
 *   it) becomes a real, hypervisor-enforced CPU/memory ceiling rather than a purely cooperative limit that
 *   assumes concurrent heavy commands behave.
 *
 * WHY THIS SLICE, NOW, AHEAD OF PER-LANE CONTAINERS. `we:backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl.md`'s
 * own 2026-09-11 amendment (live-tested on this machine) named the heavy-command-pool slice as the cheap half
 * of that item's research: `we:scripts/readiness/heavy-admission.mjs` already owns the invocation-time
 * chokepoint, the command needs no auth/billing change (unlike a per-lane container, which would need
 * `ANTHROPIC_API_KEY` + `GH_TOKEN` + an ssh key mounted in), and it "answers this item's founding incident
 * directly" (the #3594 busy-spin CPU-runaway incident that opened #3621). That amendment's own estimate:
 * "plausibly 1-2 days for a working first cut." This module IS that first cut — scoped to exactly ONE heavy
 * command (`check:standards`), proven for real on this machine (see the module's own test suite and the PR
 * that introduced this file for the measured evidence), not yet extended to `test:unit`/Playwright.
 *
 * WHAT IS PROVEN, STATED PLAINLY SO A FUTURE READER DOES NOT OVERCLAIM SCOPE:
 *   - `check:standards` runs inside the container and produces the SAME error/warning count as the host run,
 *     given the SAME repo state (verified side-by-side; the one environment-caused difference is a single
 *     warning swap tied to sibling `frontierui`/`plateau-app` checkouts not being mounted in this POC — a
 *     scope gap, not a correctness bug — see `EXTRA_MOUNTS` below for how a future pass would close it).
 *   - The CPU cap is REAL under this exact command: a `--cpus N` container genuinely bounds host CPU draw,
 *     reproducing #3621's own busy-spin containment result (8 unbounded spinners capped to ~2 cores' worth
 *     of host CPU instead of ~8, on this 12-core host).
 *   - `check:standards` needs NO npm dependency that requires a native (darwin-arm64) binding — its actual
 *     import closure is pure JS (`gray-matter`, `markdown-it`) plus `git` (installed into the image; alpine's
 *     base does not ship it). This lets this POC mount the lane's OWN `node_modules` read-only rather than
 *     baking a separate linux-arm64 tree — cheaper than #3621's own `npm ci`-in-container path, but ONLY valid
 *     for commands with this same pure-JS dependency shape. `test:unit` (vitest, esbuild, rollup — all carry
 *     native darwin bindings in this lane's tree) is NOT proven to work this way; #3621's own measured
 *     `MODULE_NOT_FOUND` failure over a host-darwin mount almost certainly still applies there, and extending
 *     coverage to it needs the baked-linux-tree approach #3621 already measured (`npm ci` in-image, ~14s,
 *     mounted apart from the source dirs — see that item's 2026-09-11 amendment for the numbers).
 *   - Git needs to see the SAME alternate-object-database path a lane clone's `.git/objects/info/alternates`
 *     records (an ABSOLUTE host path to the primary checkout, since lane cloning shares objects via
 *     `--reference` — see `we:scripts/lane-pool-paths.mjs`) — so the primary checkout is bind-mounted into the
 *     container at the IDENTICAL absolute path, read-only, alongside the lane's own read-write mount. Without
 *     this, `git merge-base origin/main HEAD` and similar calls fail inside the container (confirmed: this was
 *     the first real failure mode hit while building this POC, before the alternates mount was added).
 *
 * OPT-IN, NOT WIRED AS A DEFAULT. `we:scripts/readiness/heavy-admission.mjs`'s `run` CLI mode gains a
 * `--container` flag (see that file) that swaps its default host `execSync` for {@link execContainerized}
 * from this module. Nothing calls it automatically yet — `verify-lane.mjs`'s own gate execution, and every
 * other existing heavy-command call site, still runs on the host exactly as before. Wiring a default-on path
 * is deliberately left for a follow-up once `test:unit`/Playwright are proven the same way `check:standards`
 * is proven here (see this file's own header for what remains open).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** The image this POC proved `check:standards` against — `node:22-alpine` plus `git` (alpine's base image
 *  ships no git at all, and `check-standards.mjs` shells out to it for its provenance/surface-classifier
 *  gates). Overridable via `WE_HEAVY_ADMISSION_CONTAINER_IMAGE` for a future, larger image (e.g. one with a
 *  baked linux-arm64 `node_modules` for `test:unit`) without touching this module. */
export const DEFAULT_CONTAINER_IMAGE = 'we-heavy-admission:poc';

/** Conservative defaults, deliberately mirroring `heavy-admission.mjs#DEFAULT_ADMISSION_CAP`'s own
 *  conservative-not-near-full-utilization stance — a container's `--cpus`/`--memory` are the REAL enforcement
 *  layer the semaphore's cap-of-2 always assumed existed but never had. */
export const DEFAULT_CONTAINER_CPUS = 2;
export const DEFAULT_CONTAINER_MEMORY = '2g';

export function resolveContainerImage(env = process.env) {
  return typeof env.WE_HEAVY_ADMISSION_CONTAINER_IMAGE === 'string' && env.WE_HEAVY_ADMISSION_CONTAINER_IMAGE
    ? env.WE_HEAVY_ADMISSION_CONTAINER_IMAGE
    : DEFAULT_CONTAINER_IMAGE;
}

export function resolveContainerCpus(env = process.env) {
  const n = Number(env.WE_HEAVY_ADMISSION_CONTAINER_CPUS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_CONTAINER_CPUS;
}

export function resolveContainerMemory(env = process.env) {
  return typeof env.WE_HEAVY_ADMISSION_CONTAINER_MEMORY === 'string' && env.WE_HEAVY_ADMISSION_CONTAINER_MEMORY
    ? env.WE_HEAVY_ADMISSION_CONTAINER_MEMORY
    : DEFAULT_CONTAINER_MEMORY;
}

/**
 * Read a lane (or any) checkout's git-alternates primary-repo root, if one is recorded — PURE over an injected
 * `readFile` so this is unit-testable without a real `.git` directory. Returns `null` when the checkout has no
 * alternates file (a primary checkout, or a full non-`--reference` clone) — nothing extra needs mounting then.
 * The alternates file's own content is `<primary>/.git/objects` (one line, no trailing newline guaranteed) —
 * strip the trailing `/objects`(`/.git/objects`) to get the checkout ROOT a bind mount needs.
 * @param {string} checkoutRoot
 * @param {(path:string)=>string} readFile  defaults to a real `readFileSync(path,'utf8')`
 * @returns {string|null}
 */
export function readAlternatesPrimaryRoot(checkoutRoot, readFile = (p) => readFileSync(p, 'utf8')) {
  const alternatesPath = join(checkoutRoot, '.git', 'objects', 'info', 'alternates');
  let raw;
  try { raw = readFile(alternatesPath); } catch { return null; }
  const line = String(raw).split('\n').map((s) => s.trim()).find(Boolean);
  if (!line) return null;
  // `<primary>/.git/objects` → `<primary>` (also tolerates a trailing slash).
  const objectsSuffix = `${'.git'}${'/'}objects`;
  const idx = line.lastIndexOf(`/${objectsSuffix}`);
  return idx === -1 ? null : line.slice(0, idx);
}

/**
 * Build the full `container run` argv for one heavy-command execution — PURE, no I/O, so the exact mount/cap
 * shape is unit-testable without a real `container` binary. Mirrors the shape proven manually while building
 * this POC: the checkout mounted read-write at its OWN absolute path (so relative repo-internal paths the
 * command prints/reads still resolve the same way they do on the host), the alternates primary root (if any)
 * mounted read-only at ITS OWN identical absolute path (so git's alternate-object-database lookup — an
 * absolute path baked into `.git/objects/info/alternates` — resolves inside the guest exactly as it does on
 * the host), and the command run with `cwd` as the container's own working directory.
 *
 * @param {object} opts
 * @param {string} opts.command        already-shell-quoted command string (mirrors `heavy-admission.mjs`'s
 *                                     own `run` mode, which already shell-quotes its argv tail the same way)
 * @param {string} opts.cwd            the checkout root the command runs in (mounted rw at this same path)
 * @param {string|null} [opts.alternatesPrimaryRoot]  from {@link readAlternatesPrimaryRoot}; mounted ro at its
 *                                     own path when present, omitted when null
 * @param {string} [opts.image]
 * @param {number} [opts.cpus]
 * @param {string} [opts.memory]
 * @returns {string[]} argv for `execFileSync('container', argv, …)`
 */
export function buildContainerRunArgs({
  command, cwd, alternatesPrimaryRoot = null,
  image = DEFAULT_CONTAINER_IMAGE, cpus = DEFAULT_CONTAINER_CPUS, memory = DEFAULT_CONTAINER_MEMORY,
}) {
  const args = ['run', '--rm', '--cpus', String(cpus), '--memory', String(memory)];
  args.push('--volume', `${cwd}:${cwd}:rw`);
  if (alternatesPrimaryRoot) args.push('--volume', `${alternatesPrimaryRoot}:${alternatesPrimaryRoot}:ro`);
  args.push('-w', cwd, image, 'sh', '-c', command);
  return args;
}

/**
 * Run `command` inside a real Apple `container` instance, synchronously, with inherited stdio — a drop-in
 * `exec` for `heavy-admission.mjs#runUnderAdmission`'s injectable `exec` option (same `(command, opts) =>
 * void`/throws-on-nonzero-exit shape `execSync` already has, so the admission wrapper's acquire → execute →
 * release sequencing does not need to know or care whether the command ran on the host or in a container).
 *
 * FAILS LOUD, not open, on a missing `container` binary or a container-runtime error distinct from the
 * COMMAND's own nonzero exit — a caller that opted into `--container` asked for the isolation; silently
 * falling back to an unslotted host run would defeat the whole point without saying so. (Contrast this with
 * `runUnderAdmission`'s OWN fail-open behaviour on a queuing TIMEOUT, which is a different, deliberate,
 * already-documented tradeoff about capacity contention, not about whether isolation happens at all.)
 *
 * @param {string} command   already-shell-quoted (the same string `heavy-admission.mjs run` already built)
 * @param {object} opts
 * @param {string} [opts.cwd]
 * @param {object} [opts.env]                    for {@link resolveContainerImage}/cpus/memory — not passed
 *                                                INTO the container itself (a heavy command like
 *                                                `check:standards` needs no host secrets; scope stays minimal)
 * @param {(bin:string, argv:string[], opts:object)=>void} [opts.execFile]  defaults to a real `execFileSync` —
 *                                                injectable for tests
 * @param {(root:string, readFile?:Function)=>(string|null)} [opts.readAlternates]  defaults to
 *                                                {@link readAlternatesPrimaryRoot} — injectable for tests
 */
export function execContainerized(command, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const env = opts.env || process.env;
  const execFile = opts.execFile || ((bin, argv, o) => execFileSync(bin, argv, o));
  const readAlternates = opts.readAlternates || readAlternatesPrimaryRoot;
  const alternatesPrimaryRoot = readAlternates(cwd);
  const args = buildContainerRunArgs({
    command, cwd, alternatesPrimaryRoot,
    image: resolveContainerImage(env), cpus: resolveContainerCpus(env), memory: resolveContainerMemory(env),
  });
  // `stdio: 'inherit'` (plus any caller-supplied opts.stdio override) — same fidelity `runUnderAdmission`'s
  // default host `exec` already has; a heavy command's real-time output must reach the caller either way.
  execFile('container', args, { stdio: 'inherit', ...opts, cwd: undefined /* the CONTAINER's cwd is -w, not this process's */ });
}

/** Cheap presence probe for the `container` CLI — used by this module's own integration test to self-skip on
 *  a host without Apple's tool (Apple-Silicon-only, per #3621's own permanent-portability finding), and
 *  available to any future caller that wants to check before opting a dispatch into `--container`. */
export function containerCliAvailable(execFile = (bin, argv, o) => execFileSync(bin, argv, o)) {
  try { execFile('container', ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

/** Whether the POC image (or a caller-resolved image) is already built — a friendlier failure than a raw
 *  `container run` "image not found" error when a fresh checkout hasn't built it yet. */
export function containerImageAvailable(image = DEFAULT_CONTAINER_IMAGE, execFile = (bin, argv, o) => execFileSync(bin, argv, o)) {
  try {
    const out = execFile('container', ['image', 'list'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return String(out).split('\n').some((line) => line.trim().startsWith(image.split(':')[0]) && line.includes(image.split(':')[1] || 'latest'));
  } catch { return false; }
}

/** Path to this POC's own `Containerfile`, so a build helper (or a human) never has to hardcode it twice. */
export function containerfilePath() {
  return join(dirname(new URL(import.meta.url).pathname), 'container-exec', 'Containerfile');
}

// @test-only-export-ok: introspection helper for this module's own test suite today (proves the POC
// Containerfile this header documents actually exists on disk); a future build-helper script (image-build
// automation is a named open item on this POC — see the module header) is the real eventual consumer.
export function containerfileExists() {
  return existsSync(containerfilePath());
}
