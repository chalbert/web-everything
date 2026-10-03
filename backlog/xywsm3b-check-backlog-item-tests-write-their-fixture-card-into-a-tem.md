---
kind: story
size: 2
status: open
scope: ["we:scripts/check-backlog-item.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# check-backlog-item tests write their fixture card into a temp backlog, never the real one

Live case 2026-10-01 (PR #3311 split lane): we:scripts/__tests__/check-backlog-item.test.mjs writes its fixture card (id x0zzzz9) into the REAL repo backlog and deletes it in afterEach. When a run is cut off (the verify gate kill, or a sandboxed worker run) the file stays, and it was then staged as a new card in a PR lane, where it would have landed as a fake backlog item. Fix: point we:scripts/check-backlog-item.mjs at a temp backlog directory in the test (a root or backlog-dir option, defaulting to the repo), so the test never touches the real tree. Add a guard test: after the file runs, git status of the backlog directory is unchanged.

## Design

The premise holds on current main. The CLI has no override: `we:scripts/check-backlog-item.mjs:34` (`BACKLOG = join(ROOT, 'backlog')`) and the target is just `argv[0]` at `we:scripts/check-backlog-item.mjs:39`. The test writes its card into the real backlog at `we:scripts/__tests__/check-backlog-item.test.mjs:25` (`CARD`) and only deletes it in `afterEach` / `finally` (`we:scripts/__tests__/check-backlog-item.test.mjs:47-48`). A killed run leaves the file.

The repo already has the override convention this needs (#3445). The loader honours `WE_BACKLOG_DIR` at `we:src/_data/backlog.js:43` (`BACKLOG_DIR`). `we:scripts/backlog.mjs:79-81` takes `--backlog-dir=<path>` and sets `WE_BACKLOG_DIR` from it. Reuse that exact shape here. No new policy.

Change in `we:scripts/check-backlog-item.mjs`:
- Parse `--backlog-dir=<path>` from argv. Set `BACKLOG` to it when given, else `process.env.WE_BACKLOG_DIR`, else `join(ROOT, 'backlog')` (unchanged default).
- When the flag is given, set `process.env.WE_BACKLOG_DIR` BEFORE the loader `require` at `we:scripts/check-backlog-item.mjs:51`, so the loader reads the same directory.
- Pick the target from the positional args only (skip any `--backlog-dir=` token), so flag order does not matter. `--item <id>` keeps working.
- Update the usage line in the header to show the flag.

Change in `we:scripts/__tests__/check-backlog-item.test.mjs`:
- `beforeEach` makes a `mkdtempSync(join(tmpdir(), 'check-backlog-item-'))` dir; the card is written there. `afterEach` removes the whole temp dir.
- `run()` passes `--backlog-dir=<tmp>` to the CLI.
- Drop the `finally { clean(); }` wrappers; the temp dir makes them moot.
- Rewrite the file header: it no longer writes into the real backlog.

## MVP

The flag + env fallback in the CLI, and the test moved onto a temp dir with the guard tests below. Nothing else.

## Test plan

All in `we:scripts/__tests__/check-backlog-item.test.mjs` (vitest; run it with `npx vitest run` on that file).

- The three existing cases stay, now run against the temp dir. Preservation (GREEN today, same assertions). Mutation proof: deleting the locus-prefix block in the CLI still fails the first one.

New cases, in a new `describe('check-backlog-item reads a temp backlog, never the real one (xywsm3b)')`:
1. `lints a card that exists ONLY in --backlog-dir` — write the card to the temp dir, run with the flag. Exit 0 and output contains `x0zzzz9`. Capability, RED today: it exits 2 (`no backlog item found`), since the CLI ignores the flag and looks in the real tree.
2. `honours WE_BACKLOG_DIR when no flag is given` — same card, run with `env: { ...process.env, WE_BACKLOG_DIR: tmp }` and no flag. Exit 0. Capability, RED today: the CLI's own file lookup ignores the env var and exits 2.
3. `accepts the flag before the id` — args `['--backlog-dir=<tmp>', ID]`. Exit 0. Capability, RED today: the CLI takes the flag token as the target and exits 2.
4. `without an override it still reads the repo backlog` — no flag, no env (strip `WE_BACKLOG_DIR` from env), id `x0zzzz9`. Exit 2 with `no backlog item found`. Read-only on the real tree. Preservation, GREEN today. Mutation proof: dropping the `join(ROOT, 'backlog')` default makes the CLI crash with a non-2 code, so this fails.
5. `leaves the real backlog directory untouched` — `beforeAll` snapshots `git status --porcelain --untracked-files=all -- backlog` (run with `cwd: ROOT`); an `afterAll` asserts the same command prints the same text. Also assert, in each test, that no file in `join(ROOT, 'backlog')` starts with `x0zzzz9-`. Preservation, GREEN today on an uncut run. Mutation proof: pointing the fixture write back at `join(ROOT, 'backlog')` fails the per-test assertion.

## Proof plan

Live case: a cut-off run left the x0zzzz9 fixture card in a lane's real backlog (PR #3311 split lane). Replay that cut-off in a lane clone:

- **Before** (on main): start `npx vitest run` on `we:scripts/__tests__/check-backlog-item.test.mjs`. Poll the backlog directory until an `x0zzzz9-*` card appears, then `kill -9` the vitest process tree. Then `git status --porcelain --untracked-files=all -- backlog` shows the fixture card as untracked (`??`). Delete it after recording.
- **After** (with the change): the same kill. `git status --porcelain --untracked-files=all -- backlog` is empty, and no `x0zzzz9-*` card appears in the backlog directory at any point during the run.

Paste both outputs in the PR.

## Done when

1. **Executable** — `npx vitest run` on `we:scripts/__tests__/check-backlog-item.test.mjs` passes. Cases 1–3 fail on current main (the CLI ignores the override and exits 2).
2. `we:scripts/check-backlog-item.mjs` accepts `--backlog-dir=<path>` and `WE_BACKLOG_DIR`; with neither, it reads the repo backlog as before.
3. No line in the test file writes under `join(ROOT, 'backlog')`.
4. The kill replay in the Proof plan shows a stray card before and none after.

## Follow-ups

- Other tests that write into the real backlog would have the same leak. A grep for `join(ROOT, 'backlog'` next to `writeFileSync` under `we:scripts/__tests__/` would find them. Not in this card's scope.
