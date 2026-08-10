---
bornAs: xbqzlo9
kind: story
size: 3
status: open
dateOpened: "2026-08-10"
relatedTo: ["3057", "2961"]
scope:
  - "we:scripts/check-standards.mjs"
  - "we:scripts/lane-review.mjs"
  - "we:scripts/review-core-cli.mjs"
  - "we:scripts/check-readiness.mjs"
  - "we:scripts/propose-readiness.mjs"
  - "we:scripts/readiness/velocity-metrics.mjs"
  - "we:scripts/progress-board.mjs"
  - "we:scripts/conveyor/learnings-harvest.mjs"
  - "we:scripts/lib/write-all-sync.mjs"
tags: [cli, stdout, truncation, footgun, hygiene, capture]
---

# Sweep the `write(); process.exit()` stdout-truncation footgun out of the CLI shims — eight are still live, including the health gate

[PR #1150](https://github.com/chalbert/web-everything/pull/1150) fixed a real one:
[we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) ended
`process.stdout.write(bigJson); process.exit(0)`, so its ~20 KB roster came back as **8144 bytes of unparseable
JSON** through an `execFileSync` pipe — `process.exit()` does not wait for an unflushed stdout write. It stopped
there correctly, because #3057's "nothing else moved" guarantee required
[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs) to stay byte-unchanged. **This is a shape, not a
one-file bug.** A measured sweep found **eight live instances**, four of them losing over 99 % of their payload,
including [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) — the repo health gate itself. Capture
only; nothing here is built.

## The mechanism — and why the "~8 KB" number is only half of it

A `process.stdout.write` to a **pipe** goes async once the payload exceeds the pipe buffer. `process.exit()` tears
the process down at once, so the unflushed tail is dropped. A **tty** or a **redirect to a file** is synchronous
and wins the race — which is why this is invisible in manual use and only bites when a parent captures stdout.

Two refinements, both measured on this macOS checkout, that change how you triage a call site:

**1. The buffer is not one number.** Against the same command
([we:scripts/check-readiness.mjs](../scripts/check-readiness.mjs) `--json`):

| consumer | bytes delivered |
|---|---|
| `execFileSync` (Node) | **8 192** |
| shell `\| wc -c` | **65 536** |
| `> file` | **979 732** |

macOS pipes start at 8 KB and grow toward 64 KB depending on how fast the reader drains. So a 8–64 KB payload
truncates on *some* consumers and not others — the worst failure mode, because it reads as intermittent.

**2. One big write truncates deterministically; many small writes usually survive.** A single
`write(JSON.stringify(everything))` is one unflushed buffer and dies at the boundary every time. A loop of
`console.log` lines drains between writes and usually completes: the human (non-`--json`) mode of
[we:scripts/check-standards.mjs](../scripts/check-standards.mjs) delivered its full **333 611** bytes through
`execFileSync` in this measurement, while its `--json` mode — one write — lost 99.3 %. Racy is not safe; it just
means the `--json` paths are where the deterministic damage is.

## The eight live instances — every one measured, none inferred

Measured identically: same command through `execFileSync` (`maxBuffer: 64 MB`) versus redirected to a file.

| # | command | to a file | through a pipe | lost |
|---|---|---|---|---|
| 1 | [we:scripts/propose-readiness.mjs](../scripts/propose-readiness.mjs) `--json` | 1 722 269 | **8 192** | 99.5 % |
| 2 | [we:scripts/lane-review.mjs](../scripts/lane-review.mjs) `diff --base=…` | 1 446 671 | **8 192** | 99.4 % |
| 3 | [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) `--json` | 1 141 176 | **8 192** | 99.3 % |
| 4 | [we:scripts/check-readiness.mjs](../scripts/check-readiness.mjs) `--json` / `--select --json` | 979 732 | **8 192** | 99.2 % |
| 5 | [we:scripts/readiness/velocity-metrics.mjs](../scripts/readiness/velocity-metrics.mjs) `--json` | 644 201 | **8 192** | 98.7 % |
| 6 | [we:scripts/conveyor/learnings-harvest.mjs](../scripts/conveyor/learnings-harvest.mjs) `--json` | 39 743 | **8 192** | 79 % |
| 7 | [we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs) `comment --json` (60 findings) | 30 379 | **8 192** | 73 % |
| 8 | [we:scripts/progress-board.mjs](../scripts/progress-board.mjs) `--json` | 26 775 | **8 192** | 69 % |

**Two of these are not just data loss — they corrupt a decision.**

- **#2, [we:scripts/lane-review.mjs](../scripts/lane-review.mjs) `diff`, is the most dangerous.**
  [we:skills-src/batch-backlog-items/parallel-execute.workflow.js](../skills-src/batch-backlog-items/parallel-execute.workflow.js)
  step 7 instructs the lane to get its diff via `we:scripts/lane-review.mjs diff --base=origin/main` and *"SPAWN AN
  INDEPENDENT REVIEW SUBAGENT over it — hand it ONLY the diff."* A 1.4 MB diff arriving as 8 192 bytes means the
  #2170 pre-PR independent reviewer signs off on the first ~0.6 % of the change and reports clean. The reviewer
  cannot tell; nothing errors.
- **#3, [we:scripts/check-standards.mjs](../scripts/check-standards.mjs), is the health gate.** Any consumer that
  captures `--json` gets a truncated report and cannot read `ok`, the error list, or the counts.

**#7's shape, in full, since the reviewer named this file specifically.**
[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs) writes
`process.stdout.write(…); return process.exit(0)` at lines **354, 364** (`reduce`), **391, 394** (`comment`),
**432, 440** (`mandate`), **470, 478** (`rigor`), **514, 517** (`invite`), plus **306** in the shared `fail()`
helper — every subcommand, in both the `--json` and the human branch. `JSON.parse` on the piped `comment --json`
fails with *"Unterminated string in JSON at position 8092"*. Its `mandate --kind=lens --lens=correctness --json`
measures 5 197 bytes — under the floor today but at 63 % of it, and the mandate grows every time a rule is added
to `buildSubjectMandate`. `reduce` and `comment` take **caller-supplied findings**, so they are unbounded by
construction.

## The remedy already exists in this repo — twice — it just was never generalised

Two accepted fixes are on disk, and they are **not** interchangeable:

**(a) `process.exitCode = N` and return** — the #1150 fix, in
[we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) and
[we:skills-src/jury/panel-fanout.mjs](../skills-src/jury/panel-fanout.mjs). Node exits naturally once stdout
drains. Correct when the exit is the **last thing** the function does.

**(b) a synchronous `writeAllSync(fd, line)` drain loop, keeping `process.exit()`** — in
[we:scripts/backlog.mjs](../scripts/backlog.mjs),
[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) and
[we:scripts/readiness/conveyor-instrument.mjs](../scripts/readiness/conveyor-instrument.mjs). `writeSync` in an
EAGAIN retry loop fully drains before `process.exit` runs. **Required** where the exit is a *guard* that must halt
the caller in place — [we:scripts/backlog.mjs](../scripts/backlog.mjs)'s own header says so: swapping `die()` to an
async write would let the code after the guard keep running.
[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs)'s `fail()` is exactly that case, so it needs
**b**, not **a**.

Both remedies verified against the same pipe: [we:scripts/backlog.mjs](../scripts/backlog.mjs) `build-queue --json`
delivers **103 588** bytes intact;
[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) `--json` delivers **99 835**
intact; [we:scripts/readiness/conveyor-instrument.mjs](../scripts/readiness/conveyor-instrument.mjs) `--json`
delivers **8 766** intact (just past the boundary).

**Extract the helper while sweeping.** `writeAllSync` is copy-pasted in three files
([we:scripts/backlog.mjs](../scripts/backlog.mjs) line 83,
[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) line 584,
[we:scripts/readiness/conveyor-instrument.mjs](../scripts/readiness/conveyor-instrument.mjs) line 392). Move it to
`we:scripts/lib/write-all-sync.mjs` and import it, rather than adding a ninth copy.

## Why this kept happening — the knowledge was local, never promoted

Five files carry near-identical prose about the pipe buffer
([we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) line 155,
[we:skills-src/jury/panel-fanout.mjs](../skills-src/jury/panel-fanout.mjs) line 450,
[we:scripts/backlog.mjs](../scripts/backlog.mjs) line 76,
[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) line 577,
[we:scripts/conveyor/status-board.mjs](../scripts/conveyor/status-board.mjs) line 283) — five local rediscoveries,
never a rule.

[we:scripts/conveyor/status-board.mjs](../scripts/conveyor/status-board.mjs) is the microcosm. It works around the
bug **in its child** at lines 283–288, redirecting that child's stdout to a real file fd because — its own words —
[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) *"`process.exit(0)`s right after
writing its payload, which TRUNCATES an async write to a bounded ~8 KB pipe (the full JSON is ~23 KB) — a file fd
drains synchronously and always lands complete."* It then commits the identical bug on **its own** output at line
305. (The comment is also stale — that child was since fixed with `writeAllSync`.) The prevention this class earns
is a deterministic `check:standards` rule, not a sixth comment: **flag any `process.exit(` that follows a stdout
write in the same function unless the write went through `writeAllSync`.**

## Statically flagged, not measured — triage during the sweep

Same shape (a `JSON.stringify` write within a few lines of a `process.exit`), but needing arguments, network, or
live state to exercise.

**Likely over the floor** — [we:scripts/review-detail.mjs](../scripts/review-detail.mjs) (136, 148, 157) ·
[we:scripts/fetch-parked.mjs](../scripts/fetch-parked.mjs) (365, 410) ·
[we:scripts/pr-state.mjs](../scripts/pr-state.mjs) (87, 113) ·
[we:scripts/review-ledger-check.mjs](../scripts/review-ledger-check.mjs) (181) ·
[we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs) (482, 701, 1044) ·
[we:scripts/review-runner.mjs](../scripts/review-runner.mjs) (199, 208, 221) ·
[we:scripts/lane-drain.mjs](../scripts/lane-drain.mjs) (309, 340, 916, 936) ·
[we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) (2406, 3814, 3865, 3968) ·
[we:scripts/lib/jury-ledger.mjs](../scripts/lib/jury-ledger.mjs) (535, 555, 563) ·
[we:scripts/lib/verdict-ledger.mjs](../scripts/lib/verdict-ledger.mjs) (796) ·
[we:scripts/lib/micro-decision-surface.mjs](../scripts/lib/micro-decision-surface.mjs) (413, 417, 427, 433) ·
[we:scripts/check-statute.mjs](../scripts/check-statute.mjs) (33).

**Latent but load-bearing** — [we:scripts/conveyor/tick-core.mjs](../scripts/conveyor/tick-core.mjs) (991) measures
789 bytes on an idle queue, but its payload grows with queue depth **and its caller parses it**:
[we:skills-src/conveyor/runner.mjs](../skills-src/conveyor/runner.mjs) does `execFileSync(…)` then
`JSON.parse(out)` in the resident runner's core loop, so a truncated tick throws rather than degrading.
[we:scripts/conveyor/jury-tree.mjs](../scripts/conveyor/jury-tree.mjs) (142) is already at **7 437 of 8 192 bytes**
on today's tree — 91 % of the floor.

**Measured clean, listed so they are not re-swept** —
[we:scripts/readiness/couple-plan.mjs](../scripts/readiness/couple-plan.mjs) (135 B) ·
[we:scripts/readiness/test-selection.mjs](../scripts/readiness/test-selection.mjs) (276 B) ·
[we:scripts/conveyor/status-board.mjs](../scripts/conveyor/status-board.mjs) (158 B idle — but it grows with lanes,
see above) · [we:scripts/conveyor/queue.mjs](../scripts/conveyor/queue.mjs) (73 B) ·
[we:scripts/design-refs.mjs](../scripts/design-refs.mjs) (1 236 B) ·
[we:scripts/check-app-conformance.mjs](../scripts/check-app-conformance.mjs) (1 705 B) ·
[we:skills-src/closing-session/session-cost.mjs](../skills-src/closing-session/session-cost.mjs) (193 B) ·
[we:skills-src/batch-backlog-items/workflow-progress.mjs](../skills-src/batch-backlog-items/workflow-progress.mjs)
(756 B).

**Not a bug — `process.stderr.write` is synchronous in Node**, so an exit after one is safe. That rules out the
stderr emits in [we:scripts/converge-cli.mjs](../scripts/converge-cli.mjs),
[we:scripts/backlog-guard.mjs](../scripts/backlog-guard.mjs),
[we:scripts/lint-locus-prefix.mjs](../scripts/lint-locus-prefix.mjs) and
[we:skills-src/conveyor/runner.mjs](../skills-src/conveyor/runner.mjs). Don't churn them.

## The regression-test shape — a test that writes to a file or a tty proves nothing

This is the part that matters, because the obvious test does not work. #1150's guard is in
[we:skills-src/jury/tests/panel-fanout.test.mjs](../skills-src/jury/__tests__/panel-fanout.test.mjs) and reads the
payload back through a **genuine `execFileSync` pipe**:

```js
const out = execFileSync('node', [ROSTER, '--subject=pr-diff', '--care-level=low', …, '--json'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
expect(out.length).toBeGreaterThan(8192);       // past the pipe buffer that used to swallow it
const parsed = JSON.parse(out);                  // …and still parseable, which truncation never is
```

Four properties are load-bearing:

1. **Spawn a real child.** An in-process call to the module's `main()` never touches a pipe and always passes.
2. **Capture stdout — do not inherit or redirect it.** Redirect-to-file delivered 979 732 bytes where the pipe
   delivered 8 192; a file-based assertion always passes.
3. **Assert `length > 8192` *and* that it parses.** Length alone is useless — truncated JSON is long too.
4. **Use `execFileSync`, not a shell pipe.** A shell pipe to a fast reader carried 65 536 bytes of the same
   payload, so a shell-based test can pass on a payload that `execFileSync` truncates.

A sibling test already exists for remedy **b**:
[we:scripts/readiness/tests/conveyor-state.test.mjs](../scripts/readiness/__tests__/conveyor-state.test.mjs)
round-trips the CLI's `--json` through `execFileSync` and asserts the trailing `}` survived. There is **no** such
test for [we:scripts/backlog.mjs](../scripts/backlog.mjs), despite it carrying the same fix.

The source-grep companion in the #1150 test — *"neither shim calls `process.exit` after writing its result"* — is a
cheap static backstop, not a substitute. A repo-wide version must allow the `writeAllSync` form, or it will reject
remedy **b**.

## Adjacent, distinct, already filed

[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs)'s `readJsonInput` (line 295) uses
`readFileSync(0, 'utf8')`, which throws `EAGAIN` on a large payload piped in via `execFileSync`'s `input` option —
so the CLI is breakable at **both** ends of the pipe. That is the **input** side, a different bug, and **#2961**
already names that exact instance. Do not fold it in here; just don't be surprised by it while testing.

## Acceptance

- Each of the eight measured instances is fixed with remedy **a** or **b** — whichever its control flow needs — and
  re-measured through `execFileSync` at its full byte count, parseable.
- Every statically-flagged site is either fixed or recorded as measured-clean with its byte count.
- `writeAllSync` lives once, in `we:scripts/lib/write-all-sync.mjs`, and every user imports it.
- A `check:standards` rule flags a `process.exit(` that follows a stdout write in the same function unless the
  write went through `writeAllSync` — so the sixth local comment is never needed.
- Regression tests of the shape above cover at minimum
  [we:scripts/check-standards.mjs](../scripts/check-standards.mjs),
  [we:scripts/lane-review.mjs](../scripts/lane-review.mjs) and
  [we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs).
