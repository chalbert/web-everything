---
kind: story
size: 8
priority: high
tier: pinned
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-write-queue.mjs", "we:scripts/conveyor/gh-write-replay.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-app-shim.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/ci-heal-escalation-mark.mjs", "we:scripts/conveyor/advisory-fix-mark.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/gh-graphql-budget.mjs", "we:scripts/conveyor/health-smells/gh-write-queue.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/com.we.conveyor-pass-daemon.gh-write-replay.plist.example", "we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/lib/__tests__/gh-write-queue.test.mjs", "we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs", "we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs", "we:scripts/lib/__tests__/gh-app-shim.test.mjs", "we:scripts/conveyor/__tests__/gh-write-replay.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs", "we:scripts/conveyor/__tests__/advisory-fix-mark.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs", "we:scripts/conveyor/health-smells/__tests__/gh-write-queue.test.mjs", "we:scripts/conveyor/health-smells/__tests__/gh-call-failures.test.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# GitHub API budget: queue refused writes and account spend per caller

Live 2026-09-27 22:15-22:20Z the fleet spent the shared GraphQL bucket (one identity for every daemon and agent). we:scripts/lib/gh-throttle.mjs then refused every GraphQL call until the reset (#gh-graphql-budget), writes included: ci-heal-2821's CI-heal comment (the durable heal-attempt counter of we:scripts/conveyor/ci-heal-mark.mjs) was dropped, not retried. The REST core bucket was nearly untouched. Fix, two parts: (1) let a write opt in to being queued durably when a budget block refuses it, and replay it after the reset from a daemon pass, exactly once and head-checked, with a clear queued result for the caller; (2) measure each gh call's GraphQL cost from GitHub's rate-limit headers, by caller, roll it up per hour, and make the budget smell name the top spenders by points.

## Evidence (read-only investigation, 2026-09-27 ~18:20–18:45 ET)

- **The refusal.** `ci-heal-2821` ran `we:scripts/conveyor/ci-heal-mark.mjs 2821 --repo=chalbert/web-everything --reason=red-ci`. Its bare `gh pr comment` went through the gh App shim into the throttle CLI and came back: `gh-throttle: GitHub graphql API rate limit exceeded for this identity — shared backoff until 2026-09-27T22:20:40.000Z, call not sent (#gh-graphql-budget)`. The CLI exited 1 (`could not post CI-heal comment`), nothing retried it, and the heal agent's own result reported `headSha: null`. Source: the dispatch transcript `~/.claude/projects/-Users-nicolasgilbert-workspace--operations-dispatch-9bca6db5-…/37b92a1f-….jsonl` (grepped, bounded).
- **Why the comment matters.** That comment is not decoration. It is the durable CI-heal attempt counter: `we:scripts/conveyor/ci-heal-mark.mjs#countCiHealComments` (line 61) rebuilds the heal cap from those comments after a restart. A dropped comment means the cap under-counts, so a broken PR can be healed more times than the cap allows.
- **The block record** (the `budget-block-app-graphql` record in the host lock root, `~/workspace/.lanes/.admission/gh`): `detectedAt 22:15:37.801Z`, `until 22:20:40Z`, `source: probe`, `op: "pr list"`, `caller: "unknown"`. The caller that tripped it is not even named.
- **Last hour of `calls.jsonl`** (21:20Z → 22:24Z, same host folder): 1144 real calls, 697 snapshot hits, 88 `budget_blocked`, 1 `budget_exhausted`. Two of the blocked calls were writes (`unknown | pr comment`, `unknown | pr edit`). So the queue this card adds is small in practice: a handful of writes per block, not hundreds.
- **Attribution gap.** `unknown` is the caller on every call that comes through the gh App shim from an agent session (48 `pr view`, 18 `pr comment`, 11 `pr edit`, 16 `auth token` in that hour). Reason: `we:scripts/lib/gh-throttle.mjs#deriveGhCaller` (line 326) falls back to `process.argv[1]`, which in the CLI path is always the throttle module itself, and the generated shim never sets `WE_GH_THROTTLE_CALLER`. Daemons are named because `we:skills-src/conveyor/pass-daemon.mjs:261` sets `GH_CALLER`.
- **What cost data is cheaply available (probed live, gh 2.95.0).** `GH_DEBUG=api gh pr view 2828 --json number` prints, for the GraphQL response: `X-Ratelimit-Limit: 5000`, `X-Ratelimit-Remaining: 4790`, `X-Ratelimit-Used: 210`, `X-Ratelimit-Resource: graphql`, `X-Ratelimit-Reset`. So every GraphQL response already carries the bucket's `used` counter. Reading it costs **zero** API points. A `pr list --limit 30` probe showed the debug stream shape: `* Request at …`, `* Request to …`, `> ` request headers, the request body (the GraphQL query), `< HTTP/2.0 200`, `< ` response headers, `* Request took …`. It does **not** include the response body (6.4 KB stderr vs 1.9 KB stdout). The existing parser `we:scripts/lib/gh-throttle.mjs#parseGhDebugResponseHeaders` (line 482) already reads that exact format.
- **What already exists (so this card extends, never re-builds).** The shared block and fail-fast: `we:scripts/lib/gh-throttle.mjs` lines 747–870, wired at 952–961 (`runGhSync`) and 1107–1114 (`runGhCliPassthrough`). The host-shared lock root (`ghThrottleLockRoot`, line 385). The write classifier `classifyGhWrite` (line 291) and resource classifier `classifyGhResource` (line 770). The budget smell `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`, which already breaches below 20% remaining and names top callers, but only by a guessed per-op estimate (`estimateGraphqlPoints`). Its probes are `probeGhCalls` / `probeGraphqlBudget` in `we:scripts/conveyor/health-watch.mjs` (lines 331, 349). The durable retry-store pattern (pure core + IO shell + lock + backoff + attempt cap) in `we:scripts/conveyor/infra-blocked.mjs`. Per-daemon gh call counts in telemetry (#4071, resolved).

## How writes flow today (the two choke points)

Every `gh` call on this host reaches GitHub through one of two functions in `we:scripts/lib/gh-throttle.mjs`. Both must queue, or the fix covers only half the writers.

1. **`runGhSync`** (line 920), imported directly (or via `execFileSyncThrottled`, line 1058) by the daemon-side writers: `we:scripts/lib/review-label-provider.mjs` (`pr edit --add-label/--remove-label`, line 78), `we:scripts/lib/forge-land-provider.mjs` (`pr edit --add-label ready-to-merge`, line 105; `--remove-label`, line 123; `--body`, line 122), `we:scripts/lib/draft-promote-provider.mjs` (`pr ready`, line 25), `we:scripts/review-set-label.mjs` (line 139). `we:scripts/pr-land.mjs` and `we:scripts/operations/promote-draft-pr-dispatch.mjs` reach GitHub through those providers.
2. **`runGhCliPassthrough`** (line 1082), the CLI the generated gh App shim (`~/.claude/github-app-token/gh-shim/gh`, rendered by `we:scripts/lib/gh-app-shim.mjs#renderGhShimScript`, line 253) runs for every bare `gh` command: agent sessions, and scripts that still call `execFileSync('gh', …)` such as `we:scripts/conveyor/ci-heal-mark.mjs` (line 151). This is where the incident's comment died.

On a shared block, both return before any network call (`budget_blocked`, attempt 0). On the call that itself hits exhaustion, both write the block and return the failure (lines 1007–1019 and 1145–1160). Neither keeps the write.

The two can nest. `runGhSync`'s default exec is a bare `gh` (line 934). Where the gh App shim is first on `PATH` (every dispatched agent session), that bare `gh` is the shim, which starts a second throttle process. Options passed in-process (`opts.throttle`) do not cross that boundary; only environment variables do. The launchd daemons do not put the shim on `PATH` (checked: no shim entry in the `PATH` of the review-daemon, fix-dispatch-daemon and merge-orphan-sweep plists), so there `runGhSync` calls the real `gh` directly.

## Design (decided)

### Part 1 — queue refused writes, replay after the reset

**Queueing is opt-in per call, not automatic for every write.** A first draft queued every allowlisted write automatically. Independent review showed why that is wrong: most daemon writers already re-derive and retry on their next tick (for example `we:scripts/review-set-label.mjs` posts its verdict comment unconditionally, line 1307, and the review daemon re-runs), so an automatic replay plus the caller's own retry would double-apply. And some writes belong to a procedure that has already given up by the time a replay would run: open PR #2821's `we:scripts/conveyor/fix-procedure.mjs` (line 436 on its branch) releases its fix claim when `pr ready --undo` fails, so a later replayed `--undo` would draft a PR whose procedure already aborted; `we:scripts/operations/promote-draft-pr-dispatch.mjs` (line 121) re-checks CI before `pr ready`, which a blind replay would skip. So:

- A write is queued only when its caller says so: `throttle.queueOnBlock: true` in-process, or `WE_GH_QUEUE_ON_BLOCK=1` in the environment. `runGhSync` also sets that variable (and the op id below) on its child's environment, so a nested shim-plus-throttle layer makes the same decision about the same write.
- Callers that opt in, in this card: the two agent-run CLIs that post a durable CI-heal counter comment and have no retry path of their own — `we:scripts/conveyor/ci-heal-mark.mjs` (the incident) and `we:scripts/conveyor/ci-heal-escalation-mark.mjs` (line 172). Each switches its bare `execFileSync('gh', …)` post to an in-process `runGhSync` call with `queueOnBlock: true`, so it no longer depends on the shim being on `PATH`.
- `we:scripts/conveyor/advisory-fix-mark.mjs` does NOT opt in (second review, finding 1): its marker is not a pure history counter. `we:scripts/conveyor/advisory-fix-mark.mjs` (line 242) treats the latest advisory finding as addressed whenever a trusted fix marker appears AFTER it, so a delayed replay posted after a newer advisory note would wrongly mark that newer note addressed. Its scope entries stay only for the regression test that pins it unchanged; opting it in needs an episode id on the marker (F7).
- Every other writer is unchanged: still refused, still its own retry. The refusal text gains one line, `gh-throttle: write not queued (caller did not opt in)` (or another reason), so the result is never silent. Which other writers should opt in is follow-up F7, one writer at a time, each with its own retry semantics checked.

**What can be queued (the shapes an opted-in call may use).** New pure function `queueableWrite(argv, {cwd}) → {kind, target, repo, number, argv} | {queueable:false, reason}` in the new module `we:scripts/lib/gh-write-queue.mjs`:

| kind | argv shape | head check at replay |
|---|---|---|
| `comment` | `pr comment <n> --body <text>` / `--body-file <path>`; `issue comment <n> …` | only if the body does NOT start with a registered counter marker |
| `label` | `pr edit <n>` whose only flags are `--add-label`, `--remove-label`, `--repo`/`-R` | yes, against the caller-supplied head |

`pr ready` / `pr ready --undo` are deliberately NOT queueable (the #2821 and draft-promotion reasons above). Also refused: stdin (`--body-file -`, `--input -`), bodies over 64 KB, `pr create`, `pr merge`, `pr edit --body/--title`, `label create`, `pr review`, every `gh api` mutation. A `--body-file <path>` is read at enqueue and stored inline as `--body <text>`. Argv without `--repo` is rewritten at enqueue to carry an explicit `--repo <owner/name>`, resolved from `git -C <cwd> remote get-url origin` (local, no API); unresolvable → not queued.

**Registered counter markers (head-independent comments).** A comment whose first line is one of these records an event that already happened, and the conveyor counts them, so it must land even if the head moved. The list is imported (never re-typed) from each owner, and in this card holds only the two markers whose readers are pure counts: `CI_HEAL_COMMENT_MARKER` (`we:scripts/conveyor/ci-heal-mark.mjs:47`, read by `countCiHealComments`) and `CI_HEAL_ESCALATION_MARKER` (`we:scripts/conveyor/ci-heal-escalation-mark.mjs:48`). A marker joins the list only after its readers are checked for "posted after X" logic (the advisory-fix trap above). Any other comment is head-bound.

**Head provenance comes from the caller, never from a read at enqueue.** A head read at enqueue time could see a NEWER head and bless an older decision. So a head-bound entry must carry `expectHead` from the caller (`throttle.expectHead` or `WE_GH_WRITE_EXPECT_HEAD`); a head-bound write without one is not queued (`reason: no-head`). The head is part of the entry and of its identity. No API call happens at enqueue at all.

**Exactly-once: an operation id on every queued write.** When a call opts in, `runGhSync` gives it an op id (`WE_GH_WRITE_OPID`, a UUID, or the caller's own). For a `comment`, the id is appended to the body as a last line, `<!-- we-gh-op:<id> -->`, BEFORE the first attempt — so the original post (if it partly went through before exhaustion) and any replay carry the same id. Counter matching reads only the first line, so it is unaffected. The queue's dedupe key is the op id. Before posting, replay searches the PR's comments (REST, all pages, `since` = the entry's `firstAttemptAt` minus 10 minutes) for that id; found → `already-applied`. Because opted-in callers have no retry of their own, "caller retries after replay" cannot happen for them. Labels are idempotent by nature (checked against the live label set, below).

**Where the queue lives, and its concurrency rules.** A `write-queue` JSON file in the throttle's lock root (`ghThrottleLockRoot`, line 385) — host-shared and cwd-independent, like the budget-block records. Every change is a short read-modify-write under `we:scripts/lib/atomic-json-file.mjs#withFileLock` (line 152) + `writeJsonAtomic`; **no network call ever runs while the lock is held** (the same rule `we:scripts/conveyor/infra-blocked.mjs` follows around line 620). Entry:

```
{ opId, kind, target: 'pr'|'issue', repo, number, argv, expectHead,
  identity, resource, caller, firstAttemptAt, enqueuedAt, blockUntil,
  state: 'pending'|'applying'|'dead', claimedBy, claimedAt, attempts, lastError }
```

- One replayer per host, two layers. Outer: the pass-daemon's own per-pass lease (`we:skills-src/conveyor/pass-daemon.mjs:70`, key `conveyor:pass-daemon:gh-write-replay-lease`); a hand-run `replay --apply` acquires that SAME key through the same helper, never a second key. Because `we:scripts/readiness/file-locks.mjs` (line 138) lets a lease be reclaimed by TTL even from a live owner, the lease alone is not trusted for exclusivity. Inner: per-entry claims, below.
- Replay claims an entry (`pending → applying`, `claimedBy = <pid>:<uuid>`, `claimedAt`) under the lock, releases the lock, does the network work, then records the result under the lock **only if `claimedBy` is still its own** (else it logs `replay_claim_lost` and records nothing). Every gh child replay starts runs with a hard timeout of 2 minutes and `SIGKILL` (`we:scripts/lib/bounded-child.mjs`), and a claim is reclaimable only after 10 minutes. So a stalled worker's post is killed long before anyone else can take its claim, and a taken-over entry is re-checked by the op-id search before any second post. Tests cover a stalled live worker, a takeover, and the old worker resuming.
- Bounds: at most 500 `pending`; an entry older than 6 hours is dropped as `expired` whether or not a block is active; at most 100 `dead`, and `dead` older than 7 days are pruned. Every drop is logged.

**Wiring into the throttle.** One helper, `tryQueueRefusedWrite({argv, cwd, env, lockRoot, identity, resource, block, caller, opId, expectHead, now})`, is called from the four refusal sites: the `budget_blocked` branch of `runGhSync` (line 955) and of `runGhCliPassthrough` (line 1110), and the `budget_exhausted` branch of each (lines 1015 and 1156). It acts only when the call opted in and `WE_GH_WRITE_QUEUE` is not `0`. It never throws; a queue failure falls back to today's refusal. When both layers of a nested call refuse the same write, they share the op id, so the second enqueue is a no-op.

**Nested calls: the inner result must reach the outer caller (second review, finding 3).** When `runGhSync` (outer) admits a call and the shim's throttle (inner) then refuses and queues it, the outer only sees a failed child. So:

- Both entry points initialise the op id and the comment's op-id line themselves if the call opted in and none is set, and pass both down in the environment — the id is fixed before any layer can refuse.
- The inner layer writes one machine-readable stderr line, `gh-throttle-queued: {"opId":…,"until":…,"resource":…}`, next to the human line.
- `runGhSync`, BEFORE its rate-limit classification (line 1001), checks the failure's stderr for that line and, if present, throws with `e.queued` rebuilt from it — no retry, no probe.
- The same check reads the inner layer's `budgetBlockedMessage` (line 848) by its `(#gh-graphql-budget)` tag and takes the resource from it. Today `primaryExhaustedResource` (line 787) looks for `GraphQL:` and the message says `GitHub graphql`, so an outer layer would record a block on the wrong bucket (`core`) and probe it. Fixed in the same change, with a test.
- Test: outer admitted, inner refuses and queues → the outer throws `e.queued` with the same op id and exactly one queue entry exists (pre-blocking both layers never exercises this path, so the test must not).

**What the caller sees.**

- `runGhSync` still throws (the write has not happened yet). The error gains `e.queued = {opId, until, dedup}`. `e.stderr` keeps the existing `budgetBlockedMessage` line (so `isRateLimitShaped` and every classifier read it as before) and adds `gh-throttle: write queued as <opId>; will replay after <until> (#gh-write-queue)`.
- `runGhCliPassthrough` returns **exit 75** (`EX_TEMPFAIL`) instead of 1 for a queued write. It can only happen for a call that opted in through the environment.
- `calls.jsonl` lines: `write_queued`, `write_not_queued` (with `reason`). The existing `call` lines are unchanged. `we:scripts/conveyor/health-smells/gh-call-failures.mjs` already counts only `call` lines (line 33), so the new outcomes cannot inflate it; a test pins that.

**Consumer change in the two opted-in CLIs.** On `e.queued`: print `{ok: true, pr, commented: "queued", opId}` and exit 0 — the heal (or escalation) succeeded and its counter comment will land.

**The #2811 re-arm is NOT replayed in this card (second review, finding 2).** A first revision queued `rearm-review` as a replayable "procedure". Review showed that is unsafe: `we:scripts/review-set-label.mjs` (line 327) re-arms from a live `review:changes` or `review:accepted` without proving that verdict predates the heal, so a late replay could erase a FRESH acceptance given after the heal; and its comment and label writes are not atomic (line 1346), so a partial replay can duplicate or lose its counter. Making it safe needs a head/verdict witness and resumable steps inside the re-arm itself — its own card (F9). So under a block, ci-heal-mark skips the re-arm and prints `rearmed: "deferred-budget"`, and the stale-acceptance risk is left exactly as it is today under a block (no worse). F9 names it. This also removes the comment-plus-procedure pair, so there is no compound operation to make atomic.

**Where replay runs: a new pass-daemon entry, `gh-write-replay`.** New CLI `we:scripts/conveyor/gh-write-replay.mjs replay [--apply] [--json]` (dry run by default). Registered in `we:skills-src/conveyor/daemon-manifest.mjs` `DAEMON_MANIFEST` (lines 130–174) as one host-wide entry, like `lease-reaper` (the queue is host-wide): key `'gh-write-replay'`, args `['replay', '--apply']`, `intervalMs: DEFAULT_PASS_INTERVAL_MS` (120 s). Launched like `merge-orphan-sweep`: a plist example `we:skills-src/conveyor/com.we.conveyor-pass-daemon.gh-write-replay.plist.example` and a seed row in `we:scripts/lib/daemon-clone-registry.mjs`. `we:skills-src/conveyor/pass-daemon.mjs` sets `GH_CALLER=gh-write-replay`. Rejected homes: `health-watch` (it only alerts; writes would change its role) and the fix-dispatch daemon (the heaviest GraphQL caller; replay would wait exactly when it is busiest).

Replay always runs its gh calls with `WE_GH_QUEUE_ON_BLOCK=0` in the child environment, so no layer (in-process or through a shim) can re-queue a replayed write. It uses the same auth as any daemon (the App token from `we:scripts/lib/github-app-auth-env.mjs`), and replays only entries whose `identity` equals `ghAuthIdentity` of its own environment; others are left for the smell to report.

One replay pass:

1. Read the queue (lock held only for the read). Empty → exit, no API call.
2. Skip entries whose identity+resource still has an active block (`readBudgetBlock`, a file read).
3. Group the rest by `(repo, target, number)`, oldest first; at most 20 entries per pass.
4. Per target: one REST read — `gh api repos/<repo>/pulls/<n>` for a PR (state, merged, head sha, labels), `gh api repos/<repo>/issues/<n>` for an issue. Closed or merged → all its entries `obsolete`. Then each entry in FIFO order:
   - head-bound and `expectHead` differs from the live head → `stale` (logged with both shas);
   - `comment` → op-id search first (all pages); found → `already-applied`; else post;
   - `label` → compare with the live label set, which replay updates in memory after each applied label entry and re-reads after any failure (so "add X, then remove X" applies both, in order);
   - before each head-bound entry after the first, re-read the head if the previous entry took longer than 30 s.
5. Success → remove the entry. A rate-limit or block → stop the whole pass; the claimed entry returns to `pending`. Any other failure → `attempts += 1`, `lastError`, and **the PR's later entries wait** (order preserved). At 5 attempts → `dead`.
6. Every outcome writes one `calls.jsonl` line (`replay_applied|replay_stale|replay_obsolete|replay_already_applied|replay_failed|replay_dead|replay_expired`) and one stdout line.

Remaining race, stated: a head can move between the head read and the label write (a second or two). The window is the same one every live label writer has today; closing it needs the PR ledger (F4).

REST cost of replay (core bucket): 1 read per target, plus 1 per comment-search page (100 comments a page), plus the write itself when it is a REST call. The write replays the stored gh argv, so a `pr comment` or `pr edit` still spends GraphQL points, after the reset.

### Part 2 — measure GraphQL spend per caller

**Cost source: GitHub's own `X-Ratelimit-*` response headers, captured through `GH_DEBUG=api` in the throttle CLI passthrough only.** Free (no API points). `runGhCliPassthrough` already captures stderr with `spawnSync`, and it is the path every agent session's `gh` takes. It sets `GH_DEBUG=api` on the child unless the caller already set `GH_DEBUG` — then the caller's debug output is left untouched and relayed as is. It parses every response block's headers (before any stripping, so the existing calibration read at line 1146 still sees them), then **strips only its own debug blocks** before relaying stderr.

`runGhSync`'s own exec is NOT changed in this card. Its default `execFileSync` discards stderr on success, so capturing there needs a `spawnSync` re-implementation of `execFileSync`'s whole contract — the riskiest idea in the first draft. Instead, daemon calls (which reach the real `gh` directly) get an **estimated** cost: request count × the per-op average learned from measured passthrough calls of the same op in the last 24 h, falling back to today's static `estimateGraphqlPoints`. The report labels these rows `estimated`. If that proves too coarse for the REST decision, exact daemon capture is follow-up F8.

**The strip function**, pure: `stripGhDebug(text) → {stderr, responses: [{status, headers}]}`. A block starts at a `* Request at ` line and ends at its `* Request took ` line. An unclosed block (gh died mid-request) is stripped only through its last `< ` header line plus one blank line; the rest is kept. Golden fixtures come from the pinned real binary (the shim's own `REAL_GH` absolute path, never `gh` on `PATH`, so the test cannot compare the shim with itself): success, a 404, a rate-limit error, a paginated `pr list`, a multi-request `pr create`, a spawn error, a signal kill, and a buffer overflow. **Kill switch:** `WE_GH_THROTTLE_COST_HEADERS=0`.

**What is logged.** EVERY `call` line (both entry points) gains `id` (the `ghAuthIdentity` label) and `inv` (an invocation id). `runGhSync` passes its `inv` down as `WE_GH_THROTTLE_OUTER_INV`; an inner passthrough line that sees it records `outer: <inv>`, so a nested call is one invocation with two records, correlated. Passthrough lines also gain `rl: [{used, rem, limit, reset, res}]`, one element per GraphQL HTTP response. About 80 bytes per response.

**Three counts, never mixed (second review, finding 6).**

- **Invocations** — one per logical gh command: outer records, plus inner records with no `outer`. Exact.
- **HTTP responses** — the `rl` elements. Exact for everything that went through the passthrough; zero for the rest.
- **Points** — from the headers. Within one `(identity, res, reset)` window, response observations are sorted by `used`; a response's attributed cost = its `used` minus the previous observation's `used`, capped at 50 per response. The window's **residual** = the bucket's `used` change over the window minus the attributed sum. Invocations with no `rl` (daemon calls straight to the real gh) get **estimated** points = count × the per-op average learned from measured calls in the last 24 h (else today's static estimate) — and these estimates are **allocated inside the residual, scaled down if they exceed it, never added on top**. Whatever residual is left is `unattributed`. So attributed + estimated + unattributed = the bucket's `used` change, always, and the report says which part is which. The attributed column is labelled an estimate too: under overlap, a delta can include a neighbour's points.

**Populations the accounting cannot see (second review, finding 7), stated so no one over-reads the numbers.** Calls that bypass the throttle entirely — `we:scripts/merge-ai-prs.mjs` (bare `execFileSync('gh')`, line 3606, in a daemon without the shim), and the shim's own deliberate fallback to a direct, unthrottled gh (`we:scripts/lib/gh-app-shim.mjs`, line 323) — show up only inside `unattributed`. Moving them onto the throttle is part of F3 or #3670, not this card.

**Attribution: name the shim's callers.** `we:scripts/lib/gh-app-shim.mjs#renderGhShimScript` (line 253) sets `WE_GH_THROTTLE_CALLER` on the throttle CLI child, in this order: an existing `GH_CALLER`; else the basename of the parent process's script (`ps -o command= -p <ppid>`, first script token; local, no API); else `session:<first 8 chars of CLAUDE_CODE_SESSION_ID>`; else the parent's command name. After the change, `unknown` must be under 5% of shim calls. The shim is re-rendered on the next shim rebuild; the builder confirms whether that is automatic and, if not, names the rebuild command in the PR.

**Hourly rollup.** New module `we:scripts/lib/gh-spend.mjs`:

- pure `rollupSpend(entries, {hourMs}) → [{hour, identity, resource, bucketUsed, attributed, unattributed, estimated, requests, byCaller, byOp, queuedWrites, blockedWrites}]`;
- CLI `report [--hours=24] [--by=caller|op|caller+op] [--json]`, reading `calls.jsonl` by bounded tail (17.8 MB, unrotated) plus the persisted hours;
- persistence: each health-watch tick appends each fully closed hour once to a `spend-hourly.jsonl` file in the lock root, keyed by `hour+identity+resource`, together with a cursor (last byte offset read), so hours survive log rotation and a bounded tail never loses a window it already rolled up.

**The health smell.** Extend `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`: `summarizeGraphqlSpend` uses attributed points where a line carries `rl`, the learned estimate otherwise; `measure` gains `attributed`, `unattributed`, `estimated`, `topOps` (top 5 caller+op), `queuedWrites`. Threshold unchanged: `minRemainingFraction: 0.2`. The breach text names the top 3 callers with points (and which are estimates) and request counts.

**Queue smell (ships with Part 1, not Part 2):** `we:scripts/conveyor/health-smells/gh-write-queue.mjs`, with probe `ghWriteQueue` in `we:scripts/conveyor/health-watch.mjs` next to line 540 (a file read, no API). Breaches when any entry is `dead`, the oldest `pending` entry is older than 2 h (replay not running or not installed), or `pending` > 100. Severity `high`, action `alert`.

## Interfaces

- `we:scripts/lib/gh-write-queue.mjs` (new): pure `queueableWrite(argv, {cwd})`, `enqueue(store, entry, nowMs) → {store, opId, dedup, refused?}`, `claimNext(store, {nowMs, activeBlocks, identity, maxEntries}) → {store, groups}`, `decideReplay(entry, liveState) → 'apply'|'stale'|'obsolete'|'already-applied'|'expired'`, `recordResult(store, opId, claimedBy, outcome, nowMs)` (refuses when the claim is no longer `claimedBy`), `parseQueue(text)` / `serializeQueue(store)`, `COUNTER_MARKERS`, `OP_MARKER(opId)`, `parseQueuedLine(stderr) → {opId, until, resource} | null`. IO: `queuePath(lockRoot)`, `mutateQueue(path, fn)` (lock held only inside `fn`, which must not do network), `tryQueueRefusedWrite(...)` (never throws; returns `{queued:true, opId, until, dedup} | {queued:false, reason}`).
- `we:scripts/lib/gh-throttle.mjs`: new options `throttle.queueOnBlock`, `throttle.expectHead`, `throttle.opId`; env `WE_GH_QUEUE_ON_BLOCK`, `WE_GH_WRITE_EXPECT_HEAD`, `WE_GH_WRITE_OPID`, `WE_GH_WRITE_QUEUE` (global off switch, default on), `WE_GH_THROTTLE_COST_HEADERS` (default on). `runGhSync`'s thrown error gains optional `queued`; `runGhCliPassthrough` may return `status: 75`. New pure export `stripGhDebug(text)`. Passthrough `call` lines gain optional `id` and `rl`.
- `we:scripts/conveyor/gh-write-replay.mjs` (new): CLI `replay [--apply] [--json]`; exit 0 on a completed pass (even with drops), non-zero only on a crash or a lease already held. `--json` → `{pass: {considered, applied, stale, obsolete, alreadyApplied, failed, dead, expired, skippedBlocked, skippedIdentity}}`.
- `we:scripts/lib/gh-spend.mjs` (new): as above.
- The two opted-in CLIs: stdout `commented: true | "queued"`, plus `opId`; ci-heal-mark also `rearmed: true | false | "deferred-budget"`.
- `we:scripts/lib/gh-throttle.mjs#primaryExhaustedResource`: also recognises the throttle's own `budgetBlockedMessage` and returns its resource.
- Data migration: none. New files appear on first use; old `calls.jsonl` lines without `rl` fall back to the estimate.

## Scope and consumers

Direct edits are in `scope:`. Consumers (import grep plus subprocess callers):

- **Live blast radius.** Every agent's `gh` goes through the shim, and the installed shim bakes in the primary checkout's `we:scripts/lib/gh-throttle.mjs` (a newer render prefers the `wev-control` clone, `we:scripts/lib/gh-app-shim.mjs#defaultGhThrottleCliPath`, line 128). So a change to that file reaches every agent as soon as that checkout syncs, not at a daemon rebuild. Part 2's strip is the only change on that path that affects calls that did not opt in; it has the kill switch.
- `runGhSync` importers: no behaviour change unless they opt in (none do in this card besides the two CLIs), except the `primaryExhaustedResource` fix, which makes an outer layer record the right bucket.
- `we:scripts/conveyor/advisory-fix-mark.mjs`: unchanged; a test pins that it does not queue.
- Readers of `calls.jsonl`: `we:scripts/conveyor/health-smells/gh-call-failures.mjs` (counts only `call`, line 33), `we:scripts/conveyor/health-smells/drain-failing-repeatedly.mjs`, `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs`, `we:scripts/lib/telemetry.mjs` (#4071). New outcomes are additive.
- `we:scripts/conveyor/infra-blocked.mjs` keeps owning `pr create` retry. Not changed.

## Risks

- **Replay double-applies.** Op id in the body (fixed before any layer can refuse) + op-id search before posting + dedupe by op id at enqueue + claims with ownership-checked completion + a 2-minute killed child against a 10-minute claim. Opted-in callers have no own retry.
- **A delayed marker changes live state.** Only pure-count markers are head-independent (the advisory-fix and re-arm traps are excluded and named).
- **Replay onto a moved head.** Head-bound entries carry the caller's head and are dropped as `stale` on mismatch; the residual label race is the same as today's live writers (stated above). Counter comments replay regardless, by design.
- **Queue growth.** Opt-in keeps volume tiny (2 blocked writes in the incident hour, only one of them from an opted-in CLI). Caps, TTL, dead retention and a smell that ships with Part 1.
- **Accounting spends budget.** Header capture costs nothing. Enqueue makes no API call. Replay spends REST core reads (per target, per comment page) and replays the write itself after the reset. The smell's existing 1-point probe is unchanged.
- **The strip corrupts a caller's stderr.** Only the passthrough strips; caller-set `GH_DEBUG` is never stripped; fixtures come from the pinned real binary, with the edge cases above; kill switch. Fallback acceptance: if the fixtures show a debug shape the strip cannot handle, Part 2 ships with capture OFF by default and the rollup runs on estimates, and Done-when item 3 is then met by the estimated columns — the PR must say so.
- **Rollout order.** Part 1's queueing only fires for the two opted-in CLIs, and its smell alerts within 2 h if the replay daemon is not installed. The PR's proof step installs the daemon right after landing.
- **Open PRs.** #2821 (`lane/fix-procedure`) has no file in this card's scope (`gh pr diff 2821 --name-only`). The semantic overlap Codex found (`pr ready --undo` in its fix procedure) is removed by design: `ready` is not queueable and fix-procedure does not opt in. #2827 touches only daemon-overlay/daemon-rebuild files. #2831 is cards only. #2824–#2826, #2828, #2829 are merged.
- **Daemon overlays.** Only `lane/fix-procedure` (#2821), on the review-daemon clone. No file overlap. The replay pass runs from its own new clone.

## Test plan (each fails before the fix)

1. `we:scripts/lib/__tests__/gh-write-queue.test.mjs`: the shape table (queueable and refused, with reasons, including `pr ready`, stdin, no-head); `--body-file` inlined; `--repo` added from cwd; op-id dedupe; claim → crash → reclaim after 10 min; caps, TTL independent of blocks, dead retention; `decideReplay` for stale / obsolete / already-applied / counter-marker-on-moved-head.
2. `we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs`: blocked + opted-in comment → `e.queued`, one entry, op marker in the body; passthrough with `WE_GH_QUEUE_ON_BLOCK=1` → status 75 and the `gh-throttle-queued:` line; not opted in → today's refusal plus the `not queued` line; a blocked read → unchanged; the exhausting call itself queues; `WE_GH_WRITE_QUEUE=0` → nothing queued; **nested chain, outer admitted**: `runGhSync` (no block yet) → a fake shim on `PATH` → the throttle CLI, which refuses and queues → the outer throws `e.queued` with the same op id, does not retry or probe, and exactly one entry exists; replay env `WE_GH_QUEUE_ON_BLOCK=0` through the same chain → no entry; `primaryExhaustedResource(budgetBlockedMessage({resource:'graphql', …}))` → `'graphql'`.
3. `we:scripts/conveyor/__tests__/gh-write-replay.test.mjs` (fake gh): block active → zero exec calls; lease held → exits without work; FIFO per target; a failure holds that target's later entries; head moved → label `stale`, CI-heal comment applied; add-then-remove the same label → both applied in order; closed PR → `obsolete`; op id already on the PR (second page) → `already-applied`; crash after post → next pass `already-applied`; stalled live worker → claim taken after 10 min → old worker's completion refused (`replay_claim_lost`) and exactly one comment; issue comment reads `/issues/<n>`; foreign identity → skipped; 5 failures → `dead`; a rate-limit mid-pass → stop, claim released.
4. `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`: existing assertions pass with capture ON; `stripGhDebug` over the golden fixtures from the pinned real binary; caller-set `GH_DEBUG` relayed untouched.
5. `we:scripts/lib/__tests__/gh-spend.test.mjs`: attributed + estimated + unattributed = the bucket's `used` change for a window, including the finding-6 case (a delta of 10 with 9 daemon points and 1 shim point never becomes 10 + 9); estimates scaled into the residual; a nested call counts as one invocation; invocations and responses reported separately; hourly persistence idempotent and cursor-safe.
6. `we:scripts/lib/__tests__/gh-app-shim.test.mjs`: the rendered shim sets `WE_GH_THROTTLE_CALLER` from `GH_CALLER`, else the parent script, else the session id.
7. `we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs`: attributed beats estimate; `topOps`, `unattributed` present; breach text names top callers. `we:scripts/conveyor/health-smells/__tests__/gh-write-queue.test.mjs`: breach on dead, oldest > 2 h, depth > 100; ok when empty. A `gh-call-failures` test: `write_queued`/`replay_*` lines do not count as failures.
8. `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`: queued comment → exit 0, `commented: "queued"`, `rearmed: "deferred-budget"`, no re-arm child spawned. The matching queued case in `we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs`. `we:scripts/conveyor/__tests__/advisory-fix-mark.test.mjs`: a blocked post is NOT queued (exit 1 as today).
9. `we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs`: the `gh-write-replay` entry exists, is host-wide and passes the path check. `we:scripts/conveyor/__tests__/health-watch.test.mjs`: the `ghWriteQueue` probe is wired.

## Tasks

**PR A (Part 1):**
1. `we:scripts/lib/gh-write-queue.mjs` pure core + IO. Test 1.
2. Opt-in wiring and the four refusal sites in `we:scripts/lib/gh-throttle.mjs`; env propagation to the child; switches. Test 2.
3. `we:scripts/conveyor/gh-write-replay.mjs`, the manifest entry, the plist example, the clone-registry seed. Tests 3 and 9.
4. The two opted-in CLIs and the pinned non-adoption of advisory-fix-mark. Test 8.
5. The queue smell and probe. Test 7 (queue half).
6. Gate with the `verify` operation; open with `open-pr`; install the `gh-write-replay` daemon from its plist; run the Part 1 proof.

**PR B (Part 2):**
7. Capture the golden fixtures from the pinned real `gh` (a throwaway PR; reads plus one comment). gh masks the `Authorization` line; assert that, and never store a token.
8. `stripGhDebug` and capture in the passthrough; `id` and `rl` on log lines. Test 4.
9. Shim caller attribution. Test 6.
10. `we:scripts/lib/gh-spend.mjs`; the budget smell upgrade. Tests 5 and 7.
11. Gate, open, and the Part 2 proof.

## Delivery shape

One card, **two PRs that each land alone on `main`**, A before B. They share only `we:scripts/lib/gh-throttle.mjs`, in different functions. **Size 8 = PR A ≈ 5 + PR B ≈ 3**, basis: A is one new pure module with a claim state machine, one new pass, the four refusal sites plus the nested-result handling in `we:scripts/lib/gh-throttle.mjs`, two CLI switches, and one smell; B is one pure strip function on an already-captured stream, `id`/`inv`/`rl` fields, one rollup module, and a smell change. The re-arm replay (the part that would have needed procedure orchestration) is out (F9), which is what keeps A at 5. If either PR outgrows its estimate, the seam between them is where this card splits. Each part has a default-on env switch for rollback without a revert.

## Proof plan (live, before/after)

- **Before (this incident):** the refused comment in the `ci-heal-2821` transcript; ci-heal-mark exit 1; `budget_blocked` lines with `w: true` in `calls.jsonl` for 22:15–22:20Z; the block record naming `caller: "unknown"`; no `rl` on any line; the smell's spend line built from the static estimate.
- **After, Part 1 (live, controlled and deterministic):** first confirm the `gh-write-replay` daemon is loaded (`launchctl list`). On a throwaway PR in `chalbert/web-everything`, in a quiet minute, write a **90-second** synthetic GraphQL block with `writeBudgetBlock` (it blocks the whole fleet's GraphQL for 90 s; the PR body says so). Then run `we:scripts/conveyor/ci-heal-mark.mjs <pr> --repo=chalbert/web-everything --reason=red-ci` → exit 0, `commented: "queued"`, `rearmed: "deferred-budget"`; the queue shows one comment entry. Push one commit to the PR while blocked. Also queue a head-bound label entry by hand through the CLI with the OLD head (`WE_GH_QUEUE_ON_BLOCK=1 WE_GH_WRITE_EXPECT_HEAD=<old sha> gh pr edit <pr> --add-label test-queue`). After the block clears, the daemon's next pass posts the CI-heal comment exactly once (with its op-id line) and drops the label as `stale` with both shas. Run `replay --apply` again: zero new actions. Show the `replay_*` lines and the PR's comment list (one CI-heal comment).
- **After, Part 1 (natural):** on the next real budget block, any opted-in write shows `write_queued` then `replay_applied` (or `stale`/`obsolete`) after the reset, with no manual step.
- **After, Part 2:** one hour after deploy, `we:scripts/lib/gh-spend.mjs report --hours=1` prints per caller and per op: attributed, estimated and unattributed points, and exact request counts; for that hour attributed + estimated + unattributed equals the bucket's `used` change by construction, and the report shows each part and the invocation and response counts separately; `unknown` is under 5% of shim calls; the health-watch `gh-graphql-budget` line names top spenders with their points.

## Follow-ups (out of scope — listed so they are not lost)

- **F3 — move the heaviest GraphQL calls to REST.** Waits for Part 2's data (`we:scripts/lib/gh-spend.mjs report --by=caller+op` over a few busy hours). Idea for then: replay could turn queued comments and labels into REST calls and drain during a GraphQL block.
- **F4 — the PR ledger, #4281–#4284** (webhook-fed local PR state). The operator is moving it up; it cuts reads, while this card protects writes. It also closes the head-read/label-write race.
- **F5 — per-daemon GitHub identities** (a separate bucket per daemon). Blocked on the open credential decision.
- **F6 — `calls.jsonl` rotation** (17.8 MB, unrotated). Part 2's persisted hours and cursor make rotation safe to add.
- **F7 — opt more writers in, one at a time** (for example the `ready-to-merge` label from `we:scripts/lib/forge-land-provider.mjs`), each after checking its own retry path.
- **F8 — exact cost capture for daemon calls** (a `spawnSync` exec for `runGhSync`), only if the learned estimates prove too coarse.
- **F9 — a replay-safe #2811 re-arm.** Give `we:scripts/conveyor/rearm-review.mjs` / `we:scripts/review-set-label.mjs` a head-and-verdict witness (re-arm only an acceptance given before the heal's head) and resumable comment+label steps, then let ci-heal-mark queue it. Until then a budget block defers the re-arm, as today.
- **F7 addendum — advisory-fix-mark** needs an episode id on its marker before it can opt in.
- **Not this card:** the heal agent's own `headSha: null` result comes from its reporting path, not the throttle. File separately if it recurs.

## Independent plan review (Codex, 2026-09-27, read-only)

Run through `we:scripts/codex-direct-task.mjs --review` against the first draft. Codex confidence in its critique: High. Findings and how they were folded:

1. [blocker] Replay re-enters the queue through the shim; `noQueue` does not cross the process boundary. **Accepted:** all controls travel as environment variables; replay sets `WE_GH_QUEUE_ON_BLOCK=0`; test 2 covers the nested chain.
2. [blocker] "Exactly once" not established (caller retries, two replayers, partial posts before `enqueuedAt`). **Accepted:** opt-in for callers without their own retry; op id in the body; paginated op-id search from before the first attempt; one replayer lease plus claims.
3. [blocker] Head read at enqueue can bless an obsolete decision; label order with one snapshot. **Accepted:** caller-supplied head only (no head → not queued); head in the entry; label set tracked between entries; the remaining race stated.
4. [blocker] Semantic conflict with #2821 (`pr ready --undo`) and draft promotion's CI re-check. **Accepted:** `ready` is not queueable; neither caller opts in.
5. [major] ci-heal-mark's re-arm still fails before any label could queue. **Accepted in pass 1** as a replayable `procedure`; **superseded in pass 2** (see below): the re-arm is deferred under a block, F9.
6. [blocker] Cumulative-counter deltas cannot back the accounting claims. **Accepted:** identity and every response logged; attribution labelled an estimate with a cap and an explicit `unattributed`; exact request counts beside it; the ±10% criterion replaced.
7. [major] Queue concurrency and retention undecided. **Accepted:** short lock-only mutations, lease + claims, crash recovery, dead retention, expiry independent of blocks.
8. [major] Missing target and auth context. **Accepted:** `target`, explicit `--repo` in the stored argv, identity-matched replay, op-id matching instead of author matching, REST cost stated per request and page.
9. [major] Stderr fidelity lacks an independent oracle. **Accepted:** fixtures from the pinned real binary; caller debug never stripped; headers parsed before stripping; the extra edge cases. The `runGhSync` exec change was dropped from this card (F8).
10. [major] Rollout, size and Done-when. **Accepted:** the queue smell moves to Part 1; opt-in removes the fleet-wide default; fallback acceptance for Part 2 written down; size basis given per PR. Confirmed by Codex: `gh-call-failures` already counts only `call` lines.

**Second pass (re-review of the revision).** Codex confirmed the revision resolved blanket queueing, head provenance, label ordering and the `execFileSyncCompat` risk, and that dropping `pr ready` removes the #2821 conflict. New findings, folded after the pass:

1. [blocker] A delayed advisory-fix marker can mark a newer advisory finding addressed (`we:scripts/conveyor/advisory-fix-mark.mjs:242`). **Accepted:** advisory-fix-mark does not opt in; the counter-marker list keeps only pure counts.
2. [blocker] A replayed re-arm can erase a fresh acceptance and is not atomic (`we:scripts/review-set-label.mjs:327`, `:1346`). **Accepted:** the procedure kind is removed; the re-arm is deferred under a block and becomes F9.
3. [blocker] The inner queued result does not reach the outer `runGhSync`, and `primaryExhaustedResource` misreads the throttle's own message as `core`. **Accepted:** op id fixed before any refusal, a machine-readable `gh-throttle-queued:` line, outer recognition before retry classification, the resource fix, and an outer-admitted/inner-refused test.
4. [major] Comment + procedure pair not atomic. **Resolved by 2** (no pair any more).
5. [major] Lease key and claims not exclusive. **Accepted:** the pass-daemon lease key reused; ownership-checked completion; 2-minute killed children against 10-minute claims; stalled-worker test.
6. [major] Part 2 double-counts (attributed + estimate on top) and overclaims request counts. **Accepted:** invocations, responses and points kept separate; nested records correlated by `inv`; estimates allocated inside the residual.
7. [major] Not every call is intercepted. **Accepted:** the bypassing populations are named and land in `unattributed`.
8. [minor] Size and Done-when. **Accepted:** size basis restated per PR; Done-when lists every suite and the standards gate.

**Status after the second pass:** the second pass found blockers; they are folded above but have NOT been re-reviewed. Per the prepared-fix rule (fold, re-review once, stamp only on a blocker-free final pass), this card is **not stamped prepared**. Next step: one more light review of this revision, then `prepare-stamp` if it is clean.

## Done when

1. **Executable** — `npx vitest run` over every suite in `scope:` (`we:scripts/lib/__tests__/gh-write-queue.test.mjs`, `we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs`, `we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`, `we:scripts/lib/__tests__/gh-spend.test.mjs`, `we:scripts/lib/__tests__/gh-app-shim.test.mjs`, `we:scripts/conveyor/__tests__/gh-write-replay.test.mjs`, `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`, `we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs`, `we:scripts/conveyor/__tests__/advisory-fix-mark.test.mjs`, `we:scripts/conveyor/__tests__/health-watch.test.mjs`, `we:scripts/conveyor/health-smells/__tests__/gh-graphql-budget.test.mjs`, `we:scripts/conveyor/health-smells/__tests__/gh-write-queue.test.mjs`, `we:scripts/conveyor/health-smells/__tests__/gh-call-failures.test.mjs`, `we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs`) fails on `main` today (new tests and cases) and passes after both PRs land, and `npm run check:standards` passes on each PR.
2. **Observable (Part 1)** — an opted-in write refused by a budget block returns a `queued` result (exit 75 / `e.queued`) and is applied exactly once by the `gh-write-replay` daemon after the block clears; a head-bound entry for an old head is dropped as `stale`; a second pass does nothing. Shown live per the proof plan.
3. **Observable (Part 2)** — `we:scripts/lib/gh-spend.mjs report --hours=1` shows, per caller and per op, attributed / estimated / unattributed points and exact request counts, and the `gh-graphql-budget` smell names the top spenders with points when remaining is under 20%.
