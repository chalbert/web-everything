---
bornAs: xm36ez1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-30"
preparedAgainstSha: "e2370f38045cdff5ff33e40dd312f310fff7f1af"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2815's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/run.mjs:550` — Add a deterministic CLI integration test with a stale checkout fixture that asserts refusal and absence of a run record; removing the CLI preflight invocation must make that named test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2815@6889dc730a6054d5a547e87dc1535b3b2c8ef05f

## Design

**Premise check (against `main` at e2370f380).** Still true. `we:scripts/operations/run.mjs:534` `cliPreflight` and its call at `we:scripts/operations/run.mjs:565-571` (inside the `IS_CLI` block) exist. The only test touching them is `we:scripts/operations/__tests__/dispatch-path-isolation-and-executor.test.mjs:210`, which calls `cliPreflight` directly with stub `arm`/`assertFresh`. So deleting the `cliPreflight(name)` call at `we:scripts/operations/run.mjs:568` (the CLI wiring) breaks no test. That is the owed guard. `git log` shows no commit that closes it.

**Scope check.** `we:scripts/operations/__tests__/run.test.mjs` does not exist yet; this card creates it (an existing `run*.test.mjs` sibling is `we:scripts/operations/__tests__/run-crosses-processes.test.mjs`, which does not cover this). `we:scripts/operations/run.mjs` is listed in scope in case a small seam is needed, but the MVP expects no edit to it. Scope is otherwise accurate.

**Mechanism.** A vitest file that runs the REAL CLI (`process.execPath`, `we:scripts/operations/run.mjs`, `dispatch-lane`) as a child process against a stale checkout, and asserts (1) non-zero exit with the refusal message on stderr, and (2) an empty runs dir: no `<id>.json` record. Fixture, built with the real-git helpers in `we:scripts/operations/__tests__/helpers/real-repo.mjs` (`withBareOrigin`, `git`):
- Bare origin plus a full clone of this repo's tree (copy the tracked tree — `scripts/`, `skills-src/` and any top-level file `we:scripts/operations/run.mjs` imports transitively, e.g. `we:scripts/pr-land.mjs` — and symlink `node_modules`; the fixture must first prove the CLI loads via a `--help` probe), committed on `main` and pushed.
- A second commit that changes a CODE file (`isCodePath`, `we:scripts/lib/main-staleness.mjs:156`; e.g. `we:scripts/stale-fixture.mjs`) is pushed to origin from a scratch clone.
- The checkout under test is put on a DETACHED HEAD at the first commit (the #3604 case, see the `(c)` describe at `we:scripts/operations/__tests__/dispatch-path-isolation-and-executor.test.mjs:181`). A detached HEAD is not "on main", so `assertDispatcherFresh` (`we:scripts/operations/dispatch-lane-io.mjs:1200`) refuses at the shared guard (`not-on-base`: HEAD is off `main` and local `main` is behind), and never auto-fast-forwards.
- Env: `OPERATION_RUNS_DIR` and `OPERATION_CALLS_DIR` point at temp dirs inside the fixture (see `resolveRunsDir`, `we:scripts/operations/run-store.mjs:56`), so a leaked record is visible and nothing touches the real runs dir.

The refusal happens before `createFileRunStore()` is built (`we:scripts/operations/run.mjs:573-577`), which is why "no run record" is a meaningful assertion.

## MVP

Musts only:
1. New `we:scripts/operations/__tests__/run.test.mjs` with one named test, e.g. `dispatch-lane CLI refuses a stale checkout and writes no run record`, running the real CLI as above.
2. The control test (fresh checkout on `main`, invoked with `--help` so it can write no record and spawn no agent) is a Must: it proves the fixture can load the CLI at all. The refusal test asserts exit status 1, stderr matches `/refusing to dispatch|stale/i` (the message from `assertDispatcherFresh`), and the runs dir has zero `*.json` files.
3. Mutation proof recorded in the PR: with the `cliPreflight(name)` call removed from `we:scripts/operations/run.mjs`, that named test fails.

Out of scope (see Follow-ups): tests for other operations' preflight, a shared "real CLI fixture" helper, any change to `assertDispatcherFresh`.

## Test plan

- **`dispatch-lane CLI refuses a stale checkout and writes no run record`** — asserts refusal (exit 1 plus stderr message) and an empty runs dir. RED before the guard is wired: with the `cliPreflight(name)` call removed, the CLI proceeds past the preflight, so exit is not the stale refusal and/or a run record is written, so the assertions fail.
- **`a fresh checkout on main is not refused by the preflight`** (control) — same fixture with the checkout on `main` at origin's head; runs `dispatch-lane --help` and asserts exit 0 and stderr free of the refusal text. Guards against a false-green where the test passes only because the fixture is broken (e.g. the CLI dies on an unrelated import error). RED if the fixture cannot run the CLI at all.
- Both run with a generous per-test timeout, since each spawns node and git in a copied tree.

## Proof plan

- Run `npx vitest run` on `we:scripts/operations/__tests__/run.test.mjs` green, save the output.
- Mutation before/after: comment out `cliPreflight(name);` at `we:scripts/operations/run.mjs:568`, re-run, show the named test FAIL on the stderr-matches-refusal assertion (exit 1 alone could match by accident); restore, show it PASS. Paste both outputs in the PR body.
- Live probe: the fixture run itself is the live CLI probe (real child process, real git, real refusal on stderr); no separate surface is needed.

## Follow-ups

- File later: a shared real-CLI fixture helper if a second operation gains a CLI preflight.
- File later: extend the same real-CLI check to any other operation that gets a `cliPreflight` entry.

## Done when

1. **Executable** — `npx vitest run` on `we:scripts/operations/__tests__/run.test.mjs` passes, and fails when the `cliPreflight(name)` call is removed from `we:scripts/operations/run.mjs`.
