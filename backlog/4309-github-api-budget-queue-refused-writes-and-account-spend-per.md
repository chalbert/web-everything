---
bornAs: x68bm8e
kind: story
size: 3
priority: high
tier: pinned
parent: "4075"
status: resolved
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-write-queue.mjs", "we:scripts/conveyor/gh-write-replay.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-app-shim.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/ci-heal-escalation-mark.mjs", "we:scripts/conveyor/advisory-fix-mark.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/gh-graphql-budget.mjs", "we:scripts/conveyor/health-smells/gh-write-queue.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/com.we.conveyor-pass-daemon.gh-write-replay.plist.example", "we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/lib/__tests__/gh-write-queue.test.mjs", "we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs", "we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs", "we:scripts/lib/__tests__/gh-app-shim.test.mjs", "we:scripts/conveyor/__tests__/gh-write-replay.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs", "we:scripts/conveyor/__tests__/advisory-fix-mark.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs", "we:scripts/conveyor/health-smells/__tests__/gh-write-queue.test.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "787f3988a8e5eeed78bd8d994ad9d513d489423b"
tags: []
---

# GitHub API budget: measure and report GraphQL spend per caller

Live 2026-09-27 22:15-22:20Z the fleet spent the shared GraphQL bucket and `we:scripts/lib/gh-throttle.mjs` refused every GraphQL call until the reset (#gh-graphql-budget). **Rescoped 2026-09-28 (operator decision): this card is now SPEND ACCOUNTING ONLY** — read GitHub's own cost-free `X-Ratelimit-*` response headers via the throttle's gh App shim passthrough, attribute GraphQL points per caller, roll them up per hour, and name the top spenders in the existing budget health smell when remaining is low. No write queue, no replay — see "Superseded design" below for why, and the two new cards filed alongside this rescope for where those pieces now live.

## Evidence (read-only investigation, 2026-09-27 ~18:20–18:45 ET)

- **The refusal.** `ci-heal-2821` ran `we:scripts/conveyor/ci-heal-mark.mjs 2821 --repo=chalbert/web-everything --reason=red-ci`. Its bare `gh pr comment` went through the gh App shim into the throttle CLI and came back: `gh-throttle: GitHub graphql API rate limit exceeded for this identity — shared backoff until 2026-09-27T22:20:40.000Z, call not sent (#gh-graphql-budget)`. The CLI exited 1 (`could not post CI-heal comment`), nothing retried it, and the heal agent's own result reported `headSha: null`. Source: the dispatch transcript `~/.claude/projects/-Users-nicolasgilbert-workspace--operations-dispatch-9bca6db5-…/37b92a1f-….jsonl` (grepped, bounded). **This specific gap — the dropped write not being retried — is now the new "important GitHub writes retry themselves" card's job, not this card's.**
- **Why the comment matters.** That comment is not decoration. It is the durable CI-heal attempt counter: `we:scripts/conveyor/ci-heal-mark.mjs#countCiHealComments` (line 61) rebuilds the heal cap from those comments after a restart. A dropped comment means the cap under-counts, so a broken PR can be healed more times than the cap allows.
- **The block record** (the `budget-block-app-graphql` record in the host lock root, `~/workspace/.lanes/.admission/gh`): `detectedAt 22:15:37.801Z`, `until 22:20:40Z`, `source: probe`, `op: "pr list"`, `caller: "unknown"`. The caller that tripped it is not even named — this is the attribution gap this card's spend accounting closes.
- **Last hour of `calls.jsonl`** (21:20Z → 22:24Z, same host folder): 1144 real calls, 697 snapshot hits, 88 `budget_blocked`, 1 `budget_exhausted`. Two of the blocked calls were writes (`unknown | pr comment`, `unknown | pr edit`).
- **Attribution gap.** `unknown` is the caller on every call that comes through the gh App shim from an agent session (48 `pr view`, 18 `pr comment`, 11 `pr edit`, 16 `auth token` in that hour). Reason: `we:scripts/lib/gh-throttle.mjs#deriveGhCaller` (line 326) falls back to `process.argv[1]`, which in the CLI path is always the throttle module itself, and the generated shim never sets `WE_GH_THROTTLE_CALLER`. Daemons are named because `we:skills-src/conveyor/pass-daemon.mjs:261` sets `GH_CALLER`.
- **What cost data is cheaply available (probed live, gh 2.95.0).** `GH_DEBUG=api gh pr view 2828 --json number` prints, for the GraphQL response: `X-Ratelimit-Limit: 5000`, `X-Ratelimit-Remaining: 4790`, `X-Ratelimit-Used: 210`, `X-Ratelimit-Resource: graphql`, `X-Ratelimit-Reset`. So every GraphQL response already carries the bucket's `used` counter. Reading it costs **zero** API points. A `pr list --limit 30` probe showed the debug stream shape: `* Request at …`, `* Request to …`, `> ` request headers, the request body (the GraphQL query), `< HTTP/2.0 200`, `< ` response headers, `* Request took …`. It does **not** include the response body (6.4 KB stderr vs 1.9 KB stdout). The existing parser `we:scripts/lib/gh-throttle.mjs#parseGhDebugResponseHeaders` (line 482) already reads that exact format.
- **What already exists (so this card extends, never re-builds).** The shared block and fail-fast: `we:scripts/lib/gh-throttle.mjs` lines 747–870, wired at 952–961 (`runGhSync`) and 1107–1114 (`runGhCliPassthrough`). The host-shared lock root (`ghThrottleLockRoot`, line 385). The write classifier `classifyGhWrite` (line 291) and resource classifier `classifyGhResource` (line 770) — read-only signal, not touched by this card. The budget smell `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`, which already breaches below 20% remaining and names top callers, but only by a guessed per-op estimate (`estimateGraphqlPoints`). Its probes are `probeGhCalls` / `probeGraphqlBudget` in `we:scripts/conveyor/health-watch.mjs` (lines 331, 349). Per-daemon gh call counts already exist in telemetry (#4071, resolved).

## How the passthrough works today (why header capture is free)

Every `gh` call on this host reaches GitHub through one of two functions in `we:scripts/lib/gh-throttle.mjs`: `runGhSync` (line 920, the daemon-side writers' import path) and `runGhCliPassthrough` (line 1082, the CLI the generated gh App shim runs for every bare `gh` command — agent sessions, and scripts that still call `execFileSync('gh', …)`). **Only `runGhCliPassthrough` is in this card's scope now** — it is the path every agent session's `gh` takes, and it already captures the child's stderr with `spawnSync` (needed for byte-for-byte parity — `execFileSync` silently drops a successful call's stderr). Turning on `GH_DEBUG=api` there, then stripping the debug trace back out before relaying stderr to the caller, is a change to one well-isolated function with a kill switch. `runGhSync`'s own `execFileSync` exec is **not** touched (unchanged from today) — capturing there would need a `spawnSync` re-implementation of `execFileSync`'s whole contract, which is exactly the risk the original design's follow-up F8 named and deferred; daemon calls through `runGhSync` keep getting an **estimated** cost (request count × a learned per-op average, falling back to today's static estimate), labelled `estimated` in every report so it's never confused with a real measurement.

## Design (decided)

**Cost source: GitHub's own `X-Ratelimit-*` response headers, captured through `GH_DEBUG=api` in the throttle CLI passthrough only.** Free (no API points). `runGhCliPassthrough` sets `GH_DEBUG=api` on the child unless the caller already set `GH_DEBUG` — then the caller's debug output is left untouched and relayed as is. It parses every response block's headers (before any stripping, so the existing calibration read at line 1146 still sees them), then **strips only its own debug blocks** before relaying stderr.

**The strip function**, pure: `stripGhDebug(text) → {stderr, responses: [{status, headers}]}`. A block starts at a `* Request at ` line and ends at its `* Request took ` line. An unclosed block (gh died mid-request) is stripped only through its last `< ` header line plus one blank line; the rest is kept. Golden fixtures come from the pinned real binary (the shim's own `REAL_GH` absolute path, never `gh` on `PATH`, so the test cannot compare the shim with itself): success, a 404, a rate-limit error, a paginated `pr list`, a multi-request `pr create`, a spawn error, a signal kill, and a buffer overflow. **Kill switch:** `WE_GH_THROTTLE_COST_HEADERS=0` — capture reverts to off and the rollup falls back to estimates, no code path change needed.

**What is logged.** Every `call` line in `calls.jsonl` (both entry points) gains `id` (the `ghAuthIdentity` label) and `inv` (an invocation id). `runGhSync` passes its `inv` down as `WE_GH_THROTTLE_OUTER_INV`; an inner passthrough line that sees it records `outer: <inv>`, so a nested call (the shim wrapping a `runGhSync` caller) is one invocation with two records, correlated, not double-counted. Passthrough lines also gain `rl: [{used, rem, limit, reset, res}]`, one element per GraphQL HTTP response. About 80 bytes per response.

**Three counts, never mixed.**

- **Invocations** — one per logical gh command: outer records, plus inner records with no `outer`. Exact.
- **HTTP responses** — the `rl` elements. Exact for everything that went through the passthrough; zero for the rest.
- **Points** — from the headers, ONLY for a window that has at least one real header observation. Within one `(identity, res, reset)` window with ≥2 observations, they are sorted by `used`; a response's attributed cost = its `used` minus the previous observation's `used`, capped at 50 per response. The window's **residual** = the bucket's `used` change over the window minus the attributed sum. Invocations with no `rl` (daemon calls straight through `runGhSync`, or capture OFF) get **estimated** points = count × the per-op average learned from measured calls in the last 24 h (else today's static estimate) — allocated **inside the residual, scaled down if they exceed it, never added on top**. Whatever residual is left is `unattributed`. So attributed + estimated + unattributed = the bucket's `used` change, ALWAYS **— but only for a window where a `used` change is actually observable.** A window with ZERO header observations (a historical `calls.jsonl` line predating this card, or any window while `WE_GH_THROTTLE_COST_HEADERS=0`) has no observed bucket delta to allocate against at all: the report labels these rows `unknown` (a fourth, explicit state, never silently coerced to `estimated` or `unattributed`=0) — an unknown total is not the same claim as a known-zero one. The FIRST observation in a freshly-started window (nothing to diff against yet) and a window that straddles an hourly persistence boundary (this card's own hourly-rollup boundary, not GitHub's rolling reset) are both resolved the same way: carry the running `used` baseline across from the prior window/observation rather than treating either edge as a fresh start with an implicit zero.
- **Codex review finding (round 1 — folded 2026-09-28):** the naive per-window delta can misattribute BYPASS traffic (calls that never go through the throttle at all — see below) ONTO a logged caller, not just leave it in `unattributed`: if the bucket's `used` jumps by 10 between two shim-observed responses because 9 points were spent by an unlogged daemon call and 1 by the shim's own call, the delta-based formula above assigns the WHOLE 10 to the shim's observed response (the 50-point cap does not catch this, since 10 < 50). The attributed number is therefore not just "an estimate under overlap" (the original wording) but can specifically OVER-attribute to a caller that spent far less — stated here so nobody reads "attributed" as a hard ceiling on what a named caller actually spent, only as the best delta-based reconstruction available from header observations alone. Closing this precisely needs an INDEPENDENT bypass-traffic signal (not scoped to this card — see Follow-ups); until then, the report labels the attributed column "estimate (delta-based, can include bypass traffic)" rather than implying precision the header stream cannot support alone.

**Populations the accounting cannot see, stated so no one over-reads the numbers.** Calls that bypass the throttle entirely — `we:scripts/merge-ai-prs.mjs` (bare `execFileSync('gh')`, line 3606, in a daemon without the shim), and the shim's own deliberate fallback to a direct, unthrottled gh (`we:scripts/lib/gh-app-shim.mjs`, line 323) — do NOT reliably show up only inside `unattributed` (see the misattribution finding above); they land in `unattributed` ONLY when they fall inside a window with no other logged observation to misattribute onto. Moving them onto the throttle is a separate, later slice.

**Attribution: name the shim's callers.** `we:scripts/lib/gh-app-shim.mjs#renderGhShimScript` (line 253) sets `WE_GH_THROTTLE_CALLER` on the throttle CLI child, in this order: an existing `GH_CALLER`; else the basename of the parent process's script (`ps -o command= -p <ppid>`, first script token; local, no API); else `session:<first 8 chars of CLAUDE_CODE_SESSION_ID>`; else the parent's command name. After the change, `unknown` must be under 5% of shim calls. The shim is re-rendered on the next shim rebuild; the builder confirms whether that is automatic and, if not, names the rebuild command in the PR.

**Hourly rollup.** New module `we:scripts/lib/gh-spend.mjs`:

- pure `rollupSpend(entries, {hourMs}) → [{hour, identity, resource, bucketUsed, attributed, unattributed, estimated, requests, byCaller, byOp}]` (the `queuedWrites`/`blockedWrites` fields from the original design are dropped — no queue exists any more; a blocked-writes count can still come straight from `calls.jsonl`'s existing `budget_blocked`/`w:true` lines if wanted later, not new machinery);
- CLI `report [--hours=24] [--by=caller|op|caller+op] [--json]`, reading `calls.jsonl` by bounded tail (17.8 MB, unrotated) plus the persisted hours;
- persistence: each health-watch tick appends each fully closed hour once to a `spend-hourly.jsonl` file in the lock root, keyed by `hour+identity+resource`, together with a cursor (last byte offset read), so hours survive log rotation and a bounded tail never loses a window it already rolled up. **Codex review finding (folded 2026-09-28): this needs an explicit integration point, not just a promise.** `we:scripts/conveyor/health-watch.mjs`'s existing `probeGhCalls` (line 331) reads only the last 2 MB of `calls.jsonl` on every tick — it does not track a cursor today. This card adds `we:scripts/conveyor/health-watch.mjs` to its own direct-edit scope (below) to wire the new cursor-based persistence call INTO that same tick, alongside (not replacing) `probeGhCalls`'s existing 2 MB tail read, which stays as the live-budget probe's own data source; the persisted-hours cursor is `we:scripts/lib/gh-spend.mjs`'s own separate read, advancing independently.

**The health smell.** Extend `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`: `summarizeGraphqlSpend` uses attributed points where a line carries `rl`, the learned estimate otherwise; `measure` gains `attributed`, `unattributed`, `estimated`, `topOps` (top 5 caller+op). Threshold unchanged: `minRemainingFraction: 0.2`. The breach text names the top 3 callers with points (and which are estimates) and request counts. **No write-queue smell** — dropped with the queue.

## Interfaces

- `we:scripts/lib/gh-throttle.mjs`: new capture flag scoped to the passthrough only; env `WE_GH_THROTTLE_COST_HEADERS` (default on). New pure export `stripGhDebug(text)`. Passthrough `call` lines gain optional `id`, `inv`, `outer`, and `rl`.
- `we:scripts/lib/gh-spend.mjs` (new): as above.
- `we:scripts/lib/gh-app-shim.mjs#renderGhShimScript`: sets `WE_GH_THROTTLE_CALLER` per the precedence above.
- Data migration: none. New fields appear on first use; old `calls.jsonl` lines without `rl` fall back to the estimate.

## Scope and consumers

Direct edits: `we:scripts/lib/gh-throttle.mjs` (the strip function + passthrough capture + `id`/`inv`/`rl` log fields), `we:scripts/lib/gh-spend.mjs` (new), `we:scripts/lib/gh-app-shim.mjs` (shim caller attribution), `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs` (spend-aware breach text), `we:scripts/conveyor/health-watch.mjs` (wires the hourly persistence call into its existing tick, alongside `probeGhCalls` — see the "Hourly rollup" note above), plus their tests (`we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`, a new `we:scripts/lib/__tests__/gh-spend.test.mjs`, `we:scripts/lib/__tests__/gh-app-shim.test.mjs`, `we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs`, `we:scripts/conveyor/__tests__/health-watch.test.mjs`). No change to `we:scripts/conveyor/ci-heal-mark.mjs`, `we:scripts/conveyor/ci-heal-escalation-mark.mjs`, `we:scripts/conveyor/advisory-fix-mark.mjs`, `we:scripts/lib/review-label-provider.mjs`, or any write-side call site — those belong to the new writes-retry card now, not this one.

- **Live blast radius.** Every agent's `gh` goes through the shim, and the installed shim bakes in the primary checkout's `we:scripts/lib/gh-throttle.mjs`. The strip is the only change on that path that affects calls that did not opt in; it has the kill switch.
- Readers of `calls.jsonl`: `we:scripts/conveyor/health-smells/gh-call-failures.mjs` (counts only `call`, line 33; unaffected — no new outcome values are introduced without a queue), `we:scripts/conveyor/health-smells/drain-failing-repeatedly.mjs`, `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`, `we:scripts/lib/telemetry.mjs` (#4071). New fields (`id`/`inv`/`rl`) are additive.

## Risks

- **The strip corrupts a caller's stderr.** Only the passthrough strips; caller-set `GH_DEBUG` is never stripped; fixtures come from the pinned real binary, with success/404/rate-limit/pagination/multi-request/spawn-error/signal-kill/buffer-overflow edge cases. Kill switch. Fallback acceptance: if the fixtures show a debug shape the strip cannot handle, this card ships with capture OFF by default and the rollup runs on estimates — the PR must say so, and Done-when item 2 is then met by the estimated columns alone.
- **Double-counting.** Invocations, HTTP responses and points are three separate counts, never mixed (the original design's second-review finding 6, folded here too). Estimates are allocated inside the residual, never added on top.
- **Not every call is intercepted.** Calls that bypass the throttle (a daemon's bare `execFileSync`, the shim's own unthrottled fallback) land only in `unattributed` — named, not hidden.
- **Accounting spends budget.** Header capture costs nothing (reading a response header is free). No new API calls of any kind are introduced by this card.
- **Shim rebuild.** The attribution fix only reaches live traffic once the shim is re-rendered; the PR states whether that is automatic.

## Test plan (each fails before the fix)

1. `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`: existing assertions pass with capture ON; `stripGhDebug` over the golden fixtures from the pinned real binary; caller-set `GH_DEBUG` relayed untouched.
2. `we:scripts/lib/__tests__/gh-spend.test.mjs` (new): attributed + estimated + unattributed = the bucket's `used` change for a window, including a delta-of-10-with-9-daemon-1-shim case that must never become 10 + 9; estimates scaled into the residual; a nested call counts as one invocation; invocations and responses reported separately; hourly persistence idempotent and cursor-safe.
3. `we:scripts/lib/__tests__/gh-app-shim.test.mjs`: the rendered shim sets `WE_GH_THROTTLE_CALLER` from `GH_CALLER`, else the parent script, else the session id.
4. `we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs`: attributed beats estimate; `topOps`, `unattributed` present; breach text names top callers.
5. `we:scripts/conveyor/__tests__/health-watch.test.mjs`: the hourly-persistence call is wired into the tick alongside the unchanged `probeGhCalls`; a window with zero header observations rolls up as `unknown`, never silently as `estimated` or a zero `unattributed`; the running baseline carries across an hourly-persistence boundary and across the very first observation in a fresh window (no implicit zero at either edge).

## Tasks

1. `stripGhDebug` and capture in the passthrough (`runGhCliPassthrough` only); `id`/`inv`/`rl` on log lines. Test 1.
2. Shim caller attribution. Test 3.
3. `we:scripts/lib/gh-spend.mjs`; the budget smell upgrade. Tests 2 and 4.
4. Wire hourly persistence into `we:scripts/conveyor/health-watch.mjs`'s tick. Test 5.
5. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Progress

- **Tasks 1–4 built (2026-09-28, conveyor-4309).** Task 5 (gate, PR, live proof) is the wrapper's job.
- **Strip + capture (task 1).** `stripGhDebug` and cost-header capture are in `runGhCliPassthrough` only. `runGhSync`'s exec is unchanged apart from passing `WE_GH_THROTTLE_OUTER_INV` down, and only when it uses the real exec (an injected exec still sees its options unchanged). Both entry points log `id`, `inv` and `resource`; passthrough lines also carry `rl` and, when nested, `outer`. Kill switch: `WE_GH_THROTTLE_COST_HEADERS=0`. Capture ships ON: every fixture shape stripped cleanly, so the Risks fallback was not needed.
- **Evidence correction from the fixtures.** On the real gh 2.95.0, `GH_DEBUG=api` DOES print the response body (pretty-printed JSON) inside each block, and it also prints `[git …]` lines for repo resolution. So the strip removes whole `* Request at` … `* Request took` blocks plus those git lines. Rate-limit and budget classification now run on the STRIPPED text, so a response body quoting "API rate limit exceeded" can never trigger a retry or a block.
- **Fixtures.** Captured from `/opt/homebrew/bin/gh` into `we:scripts/lib/__tests__/fixtures/gh-debug/`, with Authorization and request-id redacted: success, 404 (plus its no-debug stderr as the oracle), paginated `pr list`, REST, and git-resolving. The rate-limit, multi-request, signal-kill and buffer-overflow shapes are derived from those real traces, because running them live would spend or mutate the account.
- **`rl` scope.** `rl` holds one record per response that carries rate-limit headers, for every resource (`core` too, not only GraphQL). The rollup keys on `res`, so each bucket gets its own row.
- **Attribution (task 2).** The rendered shim sets `WE_GH_THROTTLE_CALLER` from, in order: `GH_CALLER`; the parent process's script (local `ps`); `session:<8>`; the parent's command name. A shell's `-c` line is never read as a script, so the agent Bash tool's shell-snapshot script is not the caller. **Shim rebuild is automatic:** `buildGhShimSettingsEnv` → `ensureGhShim` re-renders the per-checkout shim on every dispatch.
- **Rollup (task 3).** `we:scripts/lib/gh-spend.mjs` builds the three counts as designed. Refinements:
  - The learned per-op average is taken only from "clean" gaps, meaning no other logged call fell between the two observations. A gap shared with other traffic over-attributes to the response that closes it, and learning from it inflated every estimate.
  - Estimates only fill gaps in the same hour. A gap that straddles an hour boundary counts its earlier-hour calls as `unknown`.
  - A window's first observation is a bare baseline: its own cost is unknown and it is not charged `used`.
  - The report prints `—`, not `0`, for a caller whose calls are all unknown.
- **Smell (task 3).** `gh-graphql-budget` uses attributed points where `rl` is present and the learned or static estimate otherwise. `measure` gains `attributed`/`estimated`/`unattributed`/`unknownInvocations`/`topOps`. The breach text names the top 3 callers as `name [~]points pts/requests req`, where `~` marks an estimate.
- **Health-watch (task 4).** `tick` calls `persistGhSpend`, which wraps `persistSpendHours`, alongside the unchanged `probeGhCalls`. That writes the hourly rows plus their byte cursor next to `calls.jsonl`, and the tick summary gains `ghSpend`.
- **Verified locally.**
  - The in-scope suites plus all health smells pass: 381 passed. The 6 skipped are the live-`gh` fidelity cases, which need an authenticated `gh` and the test sandbox has none.
  - End to end through the throttle CLI with the real binary: a failing `api graphql` call's stderr is byte-identical to raw `gh`, `rl` is logged, and the spend report shows the parts adding up to the bucket change.
  - `npm run check:standards` was NOT run here (delivery agents are blocked from it); it is left to the gate.

## Delivery shape

One card, **one PR** (the write-queue half that used to make this two PRs is dropped — see "Superseded design"). Basis: one pure strip function on an already-captured stream, `id`/`inv`/`rl` fields, one new rollup module, and a smell change — the same basis the original design gave its own "PR B ≈ 3". **Size 3.**

## Proof plan (live, before/after)

- **Before (this incident):** the refused comment in the `ci-heal-2821` transcript; `budget_blocked` lines with `w: true` in `calls.jsonl` for 22:15–22:20Z; the block record naming `caller: "unknown"`; no `rl` on any line; the smell's spend line built from the static estimate. (The refusal itself is the writes-retry card's proof, not re-proven here — this card's proof is about visibility, not recovery.)
- **After (live):** one hour after deploy, `we:scripts/lib/gh-spend.mjs report --hours=1` prints per caller and per op: attributed, estimated and unattributed points, and exact request counts, with real numbers from live headers (not synthetic); for that hour (having at least one real header observation, per the fresh-deploy assumption) attributed + estimated + unattributed equals the bucket's `used` change by construction, and the report shows each part and the invocation and response counts separately; `unknown` (the caller attribution field) is under 5% of shim calls; the health-watch `gh-graphql-budget` line names top spenders with their points when remaining is under 20%, labelled as delta-based estimates per the misattribution finding above.

## Done when

1. **Executable** — `npx vitest run` over every suite in `scope:` that still applies to this design (`we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`, `we:scripts/lib/__tests__/gh-spend.test.mjs`, `we:scripts/lib/__tests__/gh-app-shim.test.mjs`, `we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs`, `we:scripts/conveyor/__tests__/health-watch.test.mjs`) fails on `main` today (new tests and cases) and passes after this lands, and `npm run check:standards` passes.
2. **Observable** — `we:scripts/lib/gh-spend.mjs report --hours=1` shows, per caller and per op, attributed / estimated / unattributed / unknown points and exact request counts, with the conservation equation holding for any window that has at least one header observation (and `unknown` reported honestly, never coerced, for one that doesn't); the `gh-graphql-budget` smell names the top spenders with points when remaining is under 20%. If the strip's golden fixtures show a debug shape the strip cannot handle (the Risks section's fallback), this item is instead met by the `unknown`/estimated columns alone, stated as such in the PR.

## Follow-ups (out of scope — listed so they are not lost)

- **Move the heaviest GraphQL calls to REST**, guided by this card's own spend data (`we:scripts/lib/gh-spend.mjs report --by=caller+op` over a few busy hours). Filed as its own card, blocked by this one.
- **The PR ledger, #4281–#4284** (webhook-fed local PR state) — cuts reads; unrelated to this card's write-side history but still the eventual fix for the read volume this card measures.
- **Per-daemon GitHub identities** (a separate bucket per daemon). Blocked on the open credential decision.
- **`calls.jsonl` rotation** (17.8 MB, unrotated). This card's persisted hours and cursor make rotation safe to add.
- **Exact cost capture for daemon calls** (a `spawnSync` exec for `runGhSync`), only if the learned estimates prove too coarse.
- **Refused writes not being retried** — now its own card ("important GitHub writes retry themselves on the next cycle, idempotently"), a narrower, per-caller "owed + retry on next cycle" design rather than a shared queue/replay daemon.

## Superseded design (dropped 2026-09-28, operator)

**Note on this card's `scope:` frontmatter (Codex review, folded 2026-09-28):** the frontmatter array above still lists every file the DROPPED write-queue design touched (`we:scripts/lib/gh-write-queue.mjs`, `we:scripts/conveyor/gh-write-replay.mjs`, the plist example, the clone-registry seed, and their tests). This is deliberate, not an oversight: this repo's sanctioned backlog CLIs have no verb for editing an existing item's `scope:` field (only `scaffold` sets it, at creation), and frontmatter is never hand-edited outside those CLIs. The PROSE "Direct edits" list in "Scope and consumers" above is the authoritative, current touch-set for the kept design; the frontmatter array is a superset left over from the pre-rescope card and is safe to leave over-broad (it only makes the dispatcher's overlap prediction more conservative, never wrong in the unsafe direction).

The original design covered TWO parts: (1) a durable, opt-in write queue that replayed a budget-refused `gh` write exactly once after the reset, and (2) the spend-accounting half kept above. Part 1 went through three rounds of independent Codex plan review (recorded verbatim below, unedited) — each pass folded the prior blockers and then surfaced a **new** one: pass 1 found 10 findings (4 blockers) in the first draft; pass 2, re-reviewing the fix, found 3 NEW blockers (advisory-fix-mark's marker semantics, the #2811 re-arm's non-atomicity, and the nested outer/inner queued-result gap); pass 3, re-reviewing THAT fix, confirmed all three were resolved and then found yet another blocker (a stall-BEFORE-the-child-spawns race that lets a worker whose claim was reclaimed still emit a duplicate write, undermining the "exactly once" guarantee the whole design rested on). Operator decision, 2026-09-28 ~11:20 AM ET: after this pattern — a genuinely hard distributed-exactly-once problem that kept producing a new concurrency blocker every time the previous one was fixed, on a mechanism (durable cross-process replay with claims, leases and op-id dedupe) far more complex than the actual incident volume warranted (2 blocked writes in the whole incident hour, 1 from an opted-in caller) — Part 1 is DROPPED rather than pursued to a 4th round. In its place: the new "important GitHub writes retry themselves" card gives the FEW writes that matter a much smaller "the caller itself records it owed and retries on its own next cycle, guarded by an existing marker so it never double-posts" shape, with no shared queue and no cross-process replay, and a "move heaviest reads to REST" card uses this card's own spend data to move the heaviest reads off GraphQL entirely — a more leveraged fix than replaying refused writes indefinitely. The complexity Part 1 kept fighting (claims, leases, op-id search, head provenance) simply does not exist in the new shape, because there is nothing shared to coordinate.

**What follows is preserved for the record, so the same design is not re-proposed cold.**

### Part 1 — queue refused writes, replay after the reset (DROPPED)

**Queueing is opt-in per call, not automatic for every write.** A first draft queued every allowlisted write automatically. Independent review showed why that is wrong: most daemon writers already re-derive and retry on their next tick (for example `we:scripts/review-set-label.mjs` posts its verdict comment unconditionally, line 1307, and the review daemon re-runs), so an automatic replay plus the caller's own retry would double-apply. And some writes belong to a procedure that has already given up by the time a replay would run: open PR #2821's fix-procedure module releases its fix claim when `pr ready --undo` fails, so a later replayed `--undo` would draft a PR whose procedure already aborted; the draft-promotion dispatch re-checks CI before `pr ready`, which a blind replay would skip. So:

- A write is queued only when its caller says so: `throttle.queueOnBlock: true` in-process, or `WE_GH_QUEUE_ON_BLOCK=1` in the environment. `runGhSync` also sets that variable (and the op id below) on its child's environment, so a nested shim-plus-throttle layer makes the same decision about the same write.
- Callers that opt in, in this design: the two agent-run CLIs that post a durable CI-heal counter comment and have no retry path of their own — `we:scripts/conveyor/ci-heal-mark.mjs` (the incident) and `we:scripts/conveyor/ci-heal-escalation-mark.mjs` (line 172). Each switches its bare `execFileSync('gh', …)` post to an in-process `runGhSync` call with `queueOnBlock: true`, so it no longer depends on the shim being on `PATH`.
- `we:scripts/conveyor/advisory-fix-mark.mjs` does NOT opt in (second review, finding 1): its marker is not a pure history counter. `we:scripts/conveyor/advisory-fix-mark.mjs` (line 242) treats the latest advisory finding as addressed whenever a trusted fix marker appears AFTER it, so a delayed replay posted after a newer advisory note would wrongly mark that newer note addressed.
- Every other writer is unchanged: still refused, still its own retry.

**What can be queued.** New pure function `queueableWrite(argv, {cwd}) → {kind, target, repo, number, argv} | {queueable:false, reason}` in a new module `we:scripts/lib/gh-write-queue.mjs`:

| kind | argv shape | head check at replay |
|---|---|---|
| `comment` | `pr comment <n> --body <text>` / `--body-file <path>`; `issue comment <n> …` | only if the body does NOT start with a registered counter marker |
| `label` | `pr edit <n>` whose only flags are `--add-label`, `--remove-label`, `--repo`/`-R` | yes, against the caller-supplied head |

`pr ready` / `pr ready --undo` deliberately NOT queueable. Also refused: stdin, bodies over 64 KB, `pr create`, `pr merge`, `pr edit --body/--title`, `label create`, `pr review`, every `gh api` mutation.

**Registered counter markers, exactly-once via op id, head provenance from the caller, the queue's lock/claim/lease shape, the replay pass's algorithm, and the nested inner/outer result handoff** — the full mechanism, unedited from the last reviewed revision:

A new module `we:scripts/lib/gh-write-queue.mjs`: pure `queueableWrite(argv, {cwd})`, `enqueue(store, entry, nowMs) → {store, opId, dedup, refused?}`, `claimNext(store, {nowMs, activeBlocks, identity, maxEntries}) → {store, groups}`, `decideReplay(entry, liveState) → 'apply'|'stale'|'obsolete'|'already-applied'|'expired'`, `recordResult(store, opId, claimedBy, outcome, nowMs)`, `parseQueue(text)` / `serializeQueue(store)`, `COUNTER_MARKERS`, `OP_MARKER(opId)`, `parseQueuedLine(stderr) → {opId, until, resource} | null`. IO: `queuePath(lockRoot)`, `mutateQueue(path, fn)`, `tryQueueRefusedWrite(...)`. A new CLI, `we:scripts/conveyor/gh-write-replay.mjs replay [--apply] [--json]`, as a host-wide pass-daemon entry (key + plist example + clone-registry seed), one replayer lease plus per-entry claims (`pending → applying → done/dead`), FIFO per `(repo, target, number)`, at most 20 entries per pass, op-id search before posting, live label-set tracking between entries, bounds (500 pending, 6h expiry, 100 dead, 7-day dead retention).

An operation id fixed before any layer can refuse (`WE_GH_WRITE_OPID`), a machine-readable `gh-throttle-queued:` stderr line so a nested outer `runGhSync` recognises an inner refusal before its own retry classification, and a `primaryExhaustedResource` fix so the outer layer books the block against the right bucket (`graphql`, not `core`).

**The #2811 re-arm was NOT made replayable** (second review, finding 2): `we:scripts/review-set-label.mjs` (line 327) re-arms from a live verdict without proving it predates the heal, and its comment+label pair is not atomic, so a delayed replay could erase a fresh acceptance or duplicate the counter. Under a block, `ci-heal-mark` would have reported `rearmed: "deferred-budget"` and skipped the re-arm — filed as its own follow-up, superseded along with everything else here.

### Independent plan review (Codex, 2026-09-27, read-only) — Round 1

Run through the codex direct-task tool against the first draft. Codex confidence in its critique: High.

1. [blocker] Replay re-enters the queue through the shim; `noQueue` does not cross the process boundary. **Accepted:** all controls travel as environment variables; replay sets `WE_GH_QUEUE_ON_BLOCK=0`.
2. [blocker] "Exactly once" not established (caller retries, two replayers, partial posts before `enqueuedAt`). **Accepted:** opt-in for callers without their own retry; op id in the body; paginated op-id search; one replayer lease plus claims.
3. [blocker] Head read at enqueue can bless an obsolete decision; label order with one snapshot. **Accepted:** caller-supplied head only; head in the entry; label set tracked between entries.
4. [blocker] Semantic conflict with #2821 (`pr ready --undo`) and draft promotion's CI re-check. **Accepted:** `ready` is not queueable; neither caller opts in.
5. [major] ci-heal-mark's re-arm still fails before any label could queue. **Accepted in pass 1** as a replayable `procedure`; **superseded in pass 2** — the re-arm is deferred under a block.
6. [blocker] Cumulative-counter deltas cannot back the accounting claims. **Accepted:** identity and every response logged; attribution labelled an estimate with a cap and an explicit `unattributed`.
7. [major] Queue concurrency and retention undecided. **Accepted:** short lock-only mutations, lease + claims, crash recovery, dead retention, expiry independent of blocks.
8. [major] Missing target and auth context. **Accepted:** `target`, explicit `--repo`, identity-matched replay, op-id matching.
9. [major] Stderr fidelity lacks an independent oracle. **Accepted:** fixtures from the pinned real binary; caller debug never stripped.
10. [major] Rollout, size and Done-when. **Accepted:** the queue smell moves to Part 1; opt-in removes the fleet-wide default; size basis given per PR.

### Independent plan review (Codex) — Round 2 (re-review of the revision)

Codex confirmed the revision resolved blanket queueing, head provenance, label ordering and the `execFileSyncCompat` risk, and that dropping `pr ready` removes the #2821 conflict. New findings:

1. [blocker] A delayed advisory-fix marker can mark a newer advisory finding addressed. **Accepted:** advisory-fix-mark does not opt in.
2. [blocker] A replayed re-arm can erase a fresh acceptance and is not atomic. **Accepted:** the procedure kind is removed; the re-arm is deferred under a block.
3. [blocker] The inner queued result does not reach the outer `runGhSync`, and `primaryExhaustedResource` misreads the throttle's own message as `core`. **Accepted:** op id fixed before any refusal, a machine-readable queued-status stderr line, outer recognition before retry classification, the resource fix.
4. [major] Comment + procedure pair not atomic. **Resolved by 2** (no pair any more).
5. [major] Lease key and claims not exclusive. **Accepted:** the pass-daemon lease key reused; ownership-checked completion; 2-minute killed children against 10-minute claims.
6. [major] Part 2 double-counts (attributed + estimate on top) and overclaims request counts. **Accepted:** invocations, responses and points kept separate; nested records correlated by an invocation id.
7. [major] Not every call is intercepted. **Accepted:** the bypassing populations are named and land in `unattributed`.
8. [minor] Size and Done-when. **Accepted:** size basis restated per PR.

**Status after round 2:** blockers folded above but NOT yet re-reviewed.

### Independent plan review (Codex) — Round 3 (light re-review, 2026-09-27, read-only)

Ran a targeted re-review at the three round-2 blockers plus a fresh scan. Codex confidence: High.

1. Round-2 blocker 1 (advisory-fix-mark excluded from queueing): **RESOLVED**.
2. Round-2 blocker 2 (#2811 re-arm not made replayable): **RESOLVED** — deferred under a block.
3. Round-2 blocker 3 (nested queued result reaching the outer caller): **RESOLVED**.

**New blocker found, not resolved:** [blocker] **Claim takeover does not stop a worker that stalls BEFORE spawning its network child from posting a duplicate later.** The design's 2-minute hard child timeout only bounds a replay worker's `gh` subprocess once that subprocess has actually started — nothing bounds the time between claiming an entry and reaching the point where that subprocess is spawned. If the whole replay-worker process stalls in that window (host sleep, scheduling, a long GC pause), its claim becomes reclaimable after 10 minutes; a second worker reclaims it, finds nothing via op-id search (the first worker hasn't posted yet), and posts successfully. The first worker can then resume and — because ownership is only re-checked at RECORD time, after its own network call completes, never immediately before the call is made — spawn its child and post the same comment a second time. This breaks "exactly once." **This is the finding that, combined with rounds 1–2's pattern, led directly to the operator's 2026-09-28 decision to drop Part 1 above rather than pursue a round-4 fix.**
