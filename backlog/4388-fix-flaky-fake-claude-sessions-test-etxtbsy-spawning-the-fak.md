---
bornAs: x3ni496
kind: story
size: 2
status: open
scope: ["we:scripts/operations/__tests__/"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "88396bb20d4b7b7ecca6b442d0ace2f85eee66db"
tags: []
---

# Fix flaky fake-claude-sessions test: ETXTBSY spawning the fake claude binary

CI run 36495657201 (PR #2875, 2026-09-28) failed in we:scripts/operations/__tests__/fake-claude-sessions.test.mjs ('scripted actions — writeCompletion / exit / setState, through the real completion-store') with 'spawnSync claude ETXTBSY': the test writes the fake claude executable and spawns it while a write handle is still open (a Linux race). A cards-only PR went red on it. MVP: close/fsync the file before chmod+spawn (or write to a temp name and rename), and retry once on ETXTBSY in the test helper. Must: the test passes 50 runs in a loop on Linux CI.

## Design

Premise checked against `main` (88396bb): still live. `createFakeClaude` does `writeFileSync(bin, …)` then `chmodSync(bin, 0o755)` at `we:scripts/operations/__tests__/helpers/fake-claude.mjs:311-312` (the path the failing test uses; `withFakeClaude` has the same shape at `:211-212` but is not the failing path). No ETXTBSY handling exists in `we:scripts/operations/`.

Mechanism: Linux `execve` fails with ETXTBSY while ANY process holds a write fd on that inode. `writeFileSync` closes its own fd, but a fork from elsewhere in the process (other test code spawning via `execFileSync`) between our `open(O_WRONLY)` and `close` inherits a copy that lives until that child `exec`s. **Temp-name + rename does NOT help**: `rename(2)` keeps the inode, so the inherited fd still pins it under the new name. (The card's original "or rename" idea is therefore dropped.) Only a bounded retry of the exec is reliable, and it belongs in the test helper — production `defaultSpawnAgent` must not gain a test-only retry.

Fix: add `retryEtxtbsy(fn)` to `we:scripts/operations/__tests__/helpers/fake-claude.mjs`: call `fn`; on `e.code === 'ETXTBSY'` (or message match) sleep ~25ms via `Atomics.wait` and retry, up to 5 attempts total, then rethrow the last error; any other error rethrows immediately. Expose `fake.exec(cmd, argv, opts)` on the `createFakeClaude` return: `execFileSync` wrapped in `retryEtxtbsy`. Every site in the sessions test that execs the fake `claude` routes through it, not only spawn:
- `defaultSpawnAgent(..., { exec: fake.exec })` (`we:scripts/operations/dispatch-lane-io.mjs:1752`, injectable third arg);
- `defaultListAgents({ exec: fake.exec, env })` (it accepts `{ exec }`; called on many lines of the test, sometimes as the FIRST exec after `createFakeClaude()`);
- `stopSession({ exec: fake.exec })` (builds its own exec lambda today, `we:scripts/operations/dispatch-abort.mjs:72`);
- the bare `execFileSync('claude', bg(7, …))` in the test.
Production code paths still run unmodified; only the low-level exec gains the retry.

## MVP

Musts only:
- `retryEtxtbsy` (bounded, 5 tries) + `fake.exec` on `createFakeClaude`.
- `we:scripts/operations/__tests__/fake-claude-sessions.test.mjs` routes ALL its `claude` execs (spawn, list, stop, bare) through `fake.exec`.
- Unit tests for the wrapper and for routing.

Deliberately OUT (see Follow-ups): atomic write/rename (proven useless above); touching `withFakeClaude` (not the failing path); production retry; other createFakeClaude/withFakeClaude consumers.

## Test plan

New `we:scripts/operations/__tests__/fake-claude-etxtbsy.test.mjs` (unit tier):
- **retries then succeeds** — `fn` throws `{code:'ETXTBSY'}` twice then returns → value returned, called 3 times. RED before: `retryEtxtbsy` does not exist (import fails) and a bare exec would propagate the first error.
- **bounded** — always ETXTBSY → rethrown after exactly 5 calls.
- **no blanket catch** — `{code:'ENOENT'}` → rethrown after 1 call.
- **`fake.exec` retries on a real exec** — create a fake, wrap so the underlying exec throws ETXTBSY on first call per invocation (inject a stub via an optional `{ execImpl }` on `createFakeClaude`), then assert `defaultListAgents({ exec: fake.exec })`, `defaultSpawnAgent(..., { exec: fake.exec })` and `stopSession({ exec: fake.exec })` each succeed. RED before: `fake.exec` does not exist; this proves all three sites route through the retry.
- Regression: the existing `fake-claude-sessions` suite stays green.

## Proof plan

- The race is Linux-only, so the required proof is Linux: the PR's CI `test` check (green) AND one Linux container run (`node:22`, repo mounted) of `npx vitest run --config we:vitest.integration.config.ts fake-claude-sessions` looped 50×, pass count recorded in the PR body. A darwin loop is a smoke check only and is labelled as such.
- Before/after: the unit tests above with an injected ETXTBSY fail without the wrapper and pass with it. This does not reproduce the real race; the Linux loop is the evidence for that.

## Follow-ups

- Route other fake-claude consumers (`dispatch-spawn-live`, `judge-provider-port`, `parked-pr-conflict-dispatch-integration`, sim-clock, sim-scenarios-smoke, the soak breaks) through `fake.exec` / `retryEtxtbsy` and apply it to `withFakeClaude`.
- Audit other test helpers that write an executable then exec it (grep test dirs for `chmodSync` with 0o755).
- A periodic Linux stress job for the simulator tier.

## Done when

1. **Executable** — `for i in $(seq 50); do npx vitest run --config we:vitest.integration.config.ts fake-claude-sessions || exit 1; done` exits 0 on Linux, and `npx vitest run fake-claude-etxtbsy` passes (it fails before this lands because `retryEtxtbsy` / `fake.exec` do not exist).
