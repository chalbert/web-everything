/**
 * @file scripts/conveyor/__tests__/helpers/session-reaper-cli-harness.mjs
 * @description The stub-`claude`/`gh` harness the real-CLI reaper tests share (`session-reaper-cli.test.mjs`,
 *   `session-reap-evidence-cli.test.mjs`, `session-reap-stop-cli.test.mjs`) — lifted VERBATIM out of the one file they used to
 *   live in when it was split. A test file calls {@link installReaperCliHarness} once at its top level (which registers the
 *   `beforeEach`/`afterEach` that build and remove the stub bin dir) and reads the live-bound `binDir` / `argvFile` /
 *   `ghArgvFile` / `runsDir` exports exactly as it read the old module-level variables.
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REAPER_CLI = resolve(HERE, '..', '..', 'session-reaper.mjs');
export const EXEC_TIMEOUT_MS = 30_000;

export let binDir;
export let argvFile;
export let ghArgvFile;
export let runsDir;

/** Register the stub-dir lifecycle hooks in the CALLING test file's root suite. */
export function installReaperCliHarness() {
  beforeEach(() => {
    binDir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-bin-'));
    argvFile = join(binDir, 'argv.txt');
    ghArgvFile = join(binDir, 'gh-argv.txt');
    // A private, empty run store: the reaper reads the follow-up ledger, and a test must never see the live one.
    runsDir = join(binDir, 'runs');
    mkdirSync(runsDir);
    // THE STUB `claude`. `sh` builtins only, on a `PATH` holding nothing else, so the child has no way to reach a
    // real `claude` — no agent is ever stopped and no real listing is ever read. Appends (`>>`, not `>`) because a
    // real pass shells `claude` MORE THAN ONCE (the list, then one `stop` per reaped session) and every call needs
    // to survive to be asserted, in order.
    const stub = join(binDir, 'claude');
    writeFileSync(
      stub,
      [
        '#!/bin/sh',
        'printf \'%s\\n\' "$*" >> "$STUB_ARGV_FILE"',
        'case "$1" in',
        '  agents) printf \'%s\' "$STUB_AGENTS" ;;',
        // `stop` optionally fails its first `STUB_STOP_FAIL_TIMES` invocations PER id (a per-id counter file
        // under `STUB_STOP_COUNT_DIR`, default unset ⇒ 0 ⇒ succeeds immediately, byte-identical to the old
        // unconditional `exit 0`) — proves `stopSessionWithRetry` (WE #3479, found live 2026-09-04) actually
        // retries through the REAL CLI, not just against a fixture-injected fake `exec`.
        '  stop)',
        '    id="$2"',
        '    cnt_file="$STUB_STOP_COUNT_DIR/stopcount-$id"',
        // A shell BUILTIN (`read`), never an external `cat` — the stub's `PATH` deliberately holds nothing but
        // itself (see the header above), so any external command here would silently break the same way `cat`
        // first did (found running this stub for real, not guessed: "cat: command not found").
        '    n=0',
        '    if [ -f "$cnt_file" ]; then read n < "$cnt_file"; fi',
        '    n=$((n + 1))',
        '    echo "$n" > "$cnt_file"',
        '    if [ "$n" -le "${STUB_STOP_FAIL_TIMES:-0}" ]; then',
        '      echo "stub: transient claude-stop failure, attempt $n" >&2',
        '      exit 7',
        '    fi',
        '    exit 0 ;;',
        'esac',
      ].join('\n') + '\n',
    );
    chmodSync(stub, 0o755);
    // THE STUB `gh` — a separate argv file (kept apart from `claude`'s so the base-axis assertions below stay
    // byte-identical) and a canned `pr view` answer, keyed by PR number via `STUB_GH_PR_<num>` so one test can
    // stand up several distinct PR ground-truth answers at once without a real network call.
    const ghStub = join(binDir, 'gh');
    writeFileSync(
      ghStub,
      [
        '#!/bin/sh',
        'printf \'%s\\n\' "$*" >> "$STUB_GH_ARGV_FILE"',
        'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
        // The `--repo <owner/repo>` argument (absent = the legacy cwd-repo call) picks a per-repo answer,
        // `STUB_GH_PR_<num>_<WE|FUI|PA>`, falling back to `STUB_GH_PR_<num>`. The value `ABSENT` reproduces gh's
        // "Could not resolve to a PullRequest" (exit 1); `ERROR` is any other gh failure (exit 1).
        '  slug=""; prev=""',
        '  for a in "$@"; do if [ "$prev" = "--repo" ]; then slug="$a"; fi; prev="$a"; done',
        '  case "$slug" in',
        '    chalbert/web-everything) sfx=WE ;;',
        '    chalbert/frontierui) sfx=FUI ;;',
        '    chalbert/plateau-app) sfx=PA ;;',
        '    *) sfx=NONE ;;',
        '  esac',
        '  eval "ans=\\$STUB_GH_PR_$3_$sfx"',
        '  if [ -z "$ans" ]; then eval "ans=\\$STUB_GH_PR_$3"; fi',
        '  if [ "$ans" = "ABSENT" ]; then echo "GraphQL: Could not resolve to a PullRequest with the number of $3. (repository.pullRequest)" >&2; exit 1; fi',
        '  if [ "$ans" = "ERROR" ]; then echo "gh: HTTP 502" >&2; exit 1; fi',
        // A literal `{}` inside a `${var:-word}` default confuses `sh`'s own brace matching (found running this
        // stub for real, not guessed) — an explicit if/else avoids nesting `{}` inside the expansion syntax.
        '  if [ -n "$ans" ]; then printf \'%s\' "$ans"; else printf \'{}\'; fi',
        'fi',
      ].join('\n') + '\n',
    );
    chmodSync(ghStub, 0o755);
  });

  afterEach(() => {
    rmSync(binDir, { recursive: true, force: true });
  });
}

/** Run the REAL `session-reaper.mjs` CLI in a child whose `PATH` holds only the stub `claude`/`gh`. */
export function runReaperCli(args = [], { agents = '[]', env = {} } = {}) {
  return execFileSync(process.execPath, [REAPER_CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: EXEC_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    env: {
      HOME: process.env.HOME,
      PATH: binDir,
      STUB_AGENTS: agents,
      STUB_ARGV_FILE: argvFile,
      STUB_GH_ARGV_FILE: ghArgvFile,
      STUB_STOP_COUNT_DIR: binDir,
      OPERATION_RUNS_DIR: runsDir,
      ...env,
    },
  });
}

/** A throwaway backlog dir holding exactly the item cards a test needs, for `WE_BACKLOG_DIR`. */
export function makeBacklogDir(items) {
  const dir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-backlog-'));
  for (const [id, status] of Object.entries(items)) {
    writeFileSync(join(dir, `${id}-fixture-item.md`), `---\nstatus: ${status}\n---\n# Fixture ${id}\n`);
  }
  return dir;
}
