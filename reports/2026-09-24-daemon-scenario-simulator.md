# Daemon scenario simulator — design + coverage matrix

**Date**: 2026-09-24
**Point**: run the REAL daemon code (review, fix-dispatch, conflict watch, reconcile, lane-pool, session and
lease reapers, drain, self-sync + live smoke) together over many ticks, against a stateful fake GitHub, real
git in a temp dir, and scripted fake agent sessions — so every live incident of epic #3383 becomes a
replayable regression scenario instead of a one-off unit test of one function.
**Plan file**: none (operator-directed, 2026-09-24: "Do we have integration test for daemon that test the full
flow for plenty of cases but fake GitHub and git")
**Epic**: #3383 (card filed with this report)

---

## Why unit tests were not enough

Every incident below had green unit tests. Each one broke at a SEAM: two daemons sharing a clone, a label one
daemon wrote and another read, a lane count that went stale between a scan and an acquire, an 8KB pipe
buffer, GitHub closing a PR when its base branch was deleted. A unit test fakes the other side of the seam, so
it cannot see the seam. The simulator keeps both sides real and fakes only the outside world (GitHub, the
`claude` CLI, the clock).

## Architecture (five parts)

1. **World** (`we:scripts/conveyor/__tests__/sim/world.mjs`). One `mkdtemp` root per scenario holding:
   a fake `HOME` (so `~/.claude/*` — runner locks, drain locks, transcripts, app-token cache, smoke
   reject-cache — all land in the temp dir), a bare `origin` repo per constellation repo, the daemon's own
   clone of it, a lane pool (`LANE_POOL_ROOT`), a completions dir (`OPERATION_COMPLETIONS_DIR`), a backlog
   fixture (`WE_BACKLOG_DIR`), and the fake GitHub store. The daemon code runs FROM the temp clone, because
   `REPO_ROOT`, `COMPLETIONS_ROOT` and the session reaper's `allowedCwd` all resolve from the script's own
   location. The clone's content is the CURRENT working tree's `we:scripts/`, `we:skills-src/` and
   `we:package.json` (a template origin is built once per test file and cloned per scenario; `node_modules`
   is symlinked). So reverting a fix in the working tree reverts it in the simulator — that is how the RED
   run is made.
2. **Fake GitHub** (`we:scripts/conveyor/__tests__/helpers/fake-gh.mjs`, extended). A `gh` executable on
   `PATH` backed by a JSON store (one file, guarded by an atomic `mkdir` lock, written with tmp+rename).
   It is a state machine, not a canned reply (model below). Branch and merge facts come from the REAL bare
   origin: `mergeable` is computed with `git merge-tree`, `headRefOid` with `rev-parse`, `pr merge` does a
   real merge commit on origin. Never `process.exit()` after a write (the 8KB lesson). Unknown verbs fail
   loudly as a fixture gap.
3. **Fake agent sessions** (`we:scripts/operations/__tests__/helpers/fake-claude.mjs`, extended). `claude
   --bg` registers a session in the store with its name, cwd, the env it was spawned with (so a stale
   `GH_TOKEN` is visible), a pid, and a state. The session's BEHAVIOUR is a script the scenario attaches by
   name pattern (`review-*`, `fix-*`). Between ticks the runner steps each live session one action:
   succeed, post a verdict (by running the REAL `we:scripts/review-set-label.mjs`,
   `we:scripts/conveyor/rearm-review.mjs` and `we:scripts/conveyor/stand-down.mjs` CLIs against the fake
   `gh`), push a fix (real git commit + push to origin), fail with 401, fail with no-lane, hang (stop
   touching its transcript), stand down, exit without writing its completion record, inherit a stale token.
   `claude agents --json [--all]` and `claude stop <id>` read and write the same store.
4. **Daemon hosts** (`we:scripts/conveyor/__tests__/sim/daemon-host.mjs`). Each daemon is a LONG-LIVED
   child process, like under launchd. It imports its real module once at boot (so it holds its code in
   memory exactly like production), builds the real effects (`buildCliDaemonEffects` →
   `withGithubAppAuth` → `withSelfSync`), and runs ONE `tickOnce` per `tick` message over IPC, replying with
   the tick result. `onRestart` makes the host exit; the runner respawns it on the next tick (launchd
   KeepAlive). Pass scripts (conflict watch, lease reaper, lane-pool health watch, the merge sweep) run as
   real child processes, exactly as `we:skills-src/conveyor/pass-daemon.mjs` spawns them. The real
   `runDaemonLoop` sleep is not used: the runner is the scheduler.
5. **Clock** (`we:scripts/conveyor/__tests__/sim/fake-clock-preload.mjs`). Loaded into every node process
   via `NODE_OPTIONS=--import=…`. It replaces `Date.now()` and `new Date()` with `real now + offset`, the
   offset read from `SIM_CLOCK_FILE` at process start (hosts re-read it per tick). Time keeps flowing, so no
   `while (Date.now() < deadline)` loop can spin forever; the runner jumps it with `advance('31m')`. Files
   whose MTIME a decision reads (transcripts, lease markers) are written by the simulator with
   `utimesSync(simNow)` so file age agrees with the fake clock.

**Runner + DSL** (`we:scripts/conveyor/__tests__/sim/scenario.mjs`). A scenario is data plus two hooks:

```js
export default scenario('approved-pr-conflict-grace-fixer', {
  repos: ['we'],
  daemons: ['conflict-watch', 'fix-dispatch'],
  lanes: 3,
  setup(w) {
    const pr = w.gh.openPr({ repo: 'we', branch: 'lane/x1-thing', labels: ['review:accepted'],
                             commit: { 'a.txt': 'pr side\n' } });
    w.git.commitToMain('we', { 'a.txt': 'main side\n' });          // real conflict on origin
    w.agents.script('fix-*', [w.act.resolveConflictAndPush(), w.act.markConflictFixed(), w.act.exit('done')]);
    return { pr };
  },
  play: ['tick conflict-watch', 'advance 31m', 'tick conflict-watch', 'tick fix-dispatch',
         'agents', 'tick conflict-watch'],
  expect(s, { pr }) {
    expect(s.pr(pr).labels).not.toContain('merge-status:conflicting');
    expect(s.sessions('fix-*')).toHaveLength(1);
  },
});
```

`runScenario(def)` returns a SNAPSHOT: every PR (state, labels, merged, head, comment markers), every
session (name, state, env token id, stopped?), every lane lease, lane dirs, completion records, daemon
restarts, and the per-tick trace of each daemon's result plus every `gh`/`claude` call. `expect` runs on the
snapshot, so a scenario asserts WHERE EVERY PR ENDS UP, not what one function returned.

## Fake GitHub state model

```
repo      { slug, defaultBranch, deleteBranchOnMerge, labels{name→{color,desc}}, originPath }
pr        { number, repo, title, body, author, headRefName, baseRefName, isDraft,
            state: OPEN|CLOSED|MERGED, mergedAt, closedAt, labels[], comments[{id, author, body,
            createdAt, viewerDidAuthor}], checks[{name, status, conclusion, __typename, createdAt}],
            events[{event:'labeled'|'unlabeled'|'closed'|'reopened'|'merged'|'head_ref_force_pushed',
            label?, actor, createdAt}] }
derived   headRefOid, mergeable (MERGEABLE|CONFLICTING|UNKNOWN), mergeStateStatus (CLEAN|DIRTY|BEHIND|
          BLOCKED|UNSTABLE), files — always recomputed from the real origin at read time
tokens    { valid: [ids], revoked: [ids] } — a call whose GH_TOKEN is revoked gets a 401 "Bad credentials"
faults    per-verb injectable failures: rate-limit, 5xx, timeout, truncated-output
```

Transitions GitHub itself performs (the ones that bit us): merge with `--delete-branch` deletes the head
branch; a PR whose BASE branch is deleted through the refs API is CLOSED (not retargeted); with the repo's
auto-delete setting it is RETARGETED to the merged PR's base. A push to a PR head recomputes
`mergeable`/`files` and adds a `head_ref_force_pushed` event when it is not a fast-forward. Label add/remove
records `labeled`/`unlabeled` events with the fake clock's time (the conflict-grace timer reads these).

Supported surface (from the IO inventory, union of every call site): `pr list|view|edit|comment|diff|merge`,
`label create`, `api` for `repos/{r}`, `pulls/{n}`, `pulls/{n}/files`, `issues/{n}/events|timeline|comments`,
`compare/{a}...{b}`, `contents/{path}?ref=`, `--paginate`, `--jq` (piped through the real `jq`), and
`api graphql` for pr list/view. Payloads over 8KB are a first-class test input.

## Isolation guarantees (hard, asserted by the harness itself)

- `PATH` puts fake `gh` and `claude` first; the harness asserts `command -v gh|claude` resolve to the fakes
  before the first tick (the existing `assertWins` pattern), and refuses to run otherwise.
- `HOME`, `LANE_POOL_ROOT`, `OPERATION_COMPLETIONS_DIR`, `WE_BACKLOG_DIR`, `WE_DAEMON_SMOKE_STATE_DIR` all
  point inside the scenario root; `WE_GITHUB_APP_*` are unset (App mint is then a documented no-op); every
  origin is a local bare repo, never a URL; `GH_TOKEN` is a fake id.
- After the run the harness checks that nothing was written under the real `~/.claude`, the real lane pool,
  or the invoking checkout (mtime scan of the known roots).

## Build plan (slices)

1. Stateful fake GitHub + its own unit tests (store, lock, state transitions, >8KB payloads).
2. World: template origin from the working tree, per-scenario clone, lane pool provisioning without `npm ci`,
   fake HOME, clock preload.
3. Fake sessions: scripted behaviours, transcripts, completion records, pids.
4. Daemon hosts + runner + DSL + snapshot + isolation check.
5. First three scenarios (below), each proven RED with its fix reverted and GREEN with it in place.
6. The rest of the matrix, one card per group.

## First three scenarios (built in step 1)

Chosen because each crosses the most daemons and each fix is on `main` (so RED/GREEN is provable):

| # | Incident | Daemons crossing | Fix reverted for RED |
|---|---|---|---|
| A | Sibling daemon self-synced first; the fix daemon never reloaded + stale main mid-tick (#3383 bugs 1-2) | review host + fix host sharing one clone, origin advancing | `ee1bbd861` (boot-HEAD drift restart) |
| B | Approved PR drifts into a conflict → 30 min grace → fixer dispatched → resolved | conflict watch + fix-dispatch + fake fix session + real git conflict + clock | `77d560101` (queued-conflict target) |
| C | Lane starvation: more reviews owed than acquirable lanes | review host + real lane pool + fake review sessions | `1723ea4d3` (dispatch capped by acquirable lanes) |

## Coverage matrix

Legend — **Pts**: decision points from the catalog (R- review side, F- fix, C- conflict, L- lanes/leases,
M- merge, S- stuck watch, D- daemon/self-sync). **Status**: `built` (this PR), `card` (filed), `gap` (the
simulator is expected to FAIL today — no fix exists yet).

### Seeded from today's real incidents

| ID | Scenario (plain) | Daemons | Pts | End state asserted | Status |
|---|---|---|---|---|---|
| I-01 | A session that finished or blocked keeps its completion record at `started` and stays bound as a live process | review, reaper | R-17, R-20, R-22, R-76 | PR re-dispatched once the session is provably done; session stopped | card (fix `581e3e6be` not on main yet) |
| I-02 | A `working` session hangs (no transcript writes for hours) | review, reaper | R-43, R-80, hung axis | hung session stopped; PR freed; no second session while the first is truly live | card (same) |
| I-03 | Stacked PR B on A; A merges with `--delete-branch`; GitHub closes B | drain, review, fix | M-02, M-10, F-06 | B is retargeted/re-opened or never closed; B's work not lost | **gap** (no fix found) |
| I-04 | Advisory-fix loop: fixer can't reproduce an already-fixed finding → stands down | review, fix | F-05, R-27, R-55 | stand-down is non-terminal; PR returns to review, loop ends | card (fix `bd44da55c` not on main) |
| I-05 | Cap exhaustion counted from comments that predate the round markers | fix | F-05, F-10, R-52, R-53 | cap follows order (fix after latest note), not raw counts | card (same) |
| I-06 | Statute-tier conflict on a `review:human` PR, hunks do not overlap main | conflict, fix | C-04, C-05, C-06 | routed to fixer, not stood down forever; overlap → stand-down | card |
| I-07 | Approved PR conflicts → 30 min grace → fixer | conflict, fix | C-02, C-03, C-07, F-09 | label added at once; bounce after grace; fixer dispatched; label cleared when resolved | **built (B)** |
| I-08 | Card filed inside its own PR → fixer refused `no-scope` | fix | F-11, F-12 | fix dispatched with scope read from the card at PR head | card |
| I-09 | Lane starvation + a lane scan slower than the acquire wait | review, lane-pool | R-03, R-11, L-05, L-18, L-19 | dispatches ≤ acquirable lanes; the rest stay owed and go next tick; no `no-lane` failures | **built (C)** |
| I-10 | `trim` deletes a lane that was acquired after trim's stale scan | lane-pool | L-13, L-14, L-15 | re-leased lane kept; work intact | card |
| I-11 | Remote probe fails under load → pool grows in a burst | lane-pool | L-06, L-07 | no growth on probe failure; per-call cap honoured | card |
| I-12 | Dispatched sessions inherit a stale `GH_TOKEN` | review, fix | R-39, R-106–R-111 | session env carries no ambient token; its `gh` calls go through the refreshing shim; zero 401s | card |
| I-13 | `gh` output over 8KB truncated by write-then-exit | all | shim | >8KB `pr list` parses; reconcile sees every PR | card (fake-gh unit test covers the fake itself in step 1) |
| I-14 | Manual overlay load conflicts with main; clone left mid-merge | self-sync | R-98–R-100 | merge aborted; clone clean on its home branch; daemon keeps ticking | card |
| I-15 | Review daemon self-syncs first; fix daemon (same clone) never reloads | review, fix | R-88, D-boot-sha | fix host restarts on HEAD drift within one tick | **built (A)** |
| I-16 | `review:human` + `review:pending` both live after a rearm | fix session, review | R-47, R-60 | rearm adds nothing on a human hold; sweep removes stray pending | card |
| I-17 | `advisory:*` label survives `clear-human` | review | R-48, R-65 | clear-human strips advisory; sweep removes older strays | card |
| I-18 | origin/main moves mid multi-repo tick → stale-main refusal | review, fix | R-10, R-89, R-105 | immediate re-sync + restart, not a full-interval wait | **built (A)** |

### New cases (brainstormed, not yet hit live)

| ID | Scenario (plain) | Daemons | Pts | End state asserted | Status |
|---|---|---|---|---|---|
| N-01 | GitHub rate limit / secondary rate limit mid-tick | all | gh throttle | retried with backoff; no half-applied label pair | card |
| N-02 | One repo's `gh pr list` fails; other repos continue | review, fix | R-08, R-09 | other repos dispatched; failure reported once | card |
| N-03 | `claude agents --json` fails (ENOENT, timeout) | review, reaper, lease-reaper | R-02, R-82 | no dispatch, no reap, no lease reap that tick | card |
| N-04 | Agents listing comes back EMPTY (glitch) | lease-reaper, reaper | L-12 | nobody mass-reaped | card |
| N-05 | New session not yet listed right after `--bg` (listing lag) | review, fix | R-24, L-11 | no double dispatch next tick; lease not reaped inside grace | card |
| N-06 | Finished session's pid recycled (still alive) | review | R-22 | `done` beats pid; PR re-dispatchable | card |
| N-07 | Session waiting on a permission prompt | review, stuck | R-19, S-03 | refused `awaiting-permission`, surfaced; not reaped | card |
| N-08 | Human force-pushes the PR while a fixer works | fix, review | R-50, F-13 | stale advisory removed; fixer's push rejected → stand-down `lane-ref-gone`/retry | card |
| N-09 | Human closes the PR while its review session runs | reaper, lease-reaper | R-77, L-10 | session stopped; lane lease reaped | card |
| N-10 | Drain merges a PR while its fix session still runs | drain, reaper, lease-reaper | M-11, L-08 | session stopped; lease freed; no fix pushed to a merged branch | card |
| N-11 | Review and fix daemons decide on the same PR in the same instant | review, fix | F-02, R-24 | at most one session per PR | card |
| N-12 | Reviewer's verdict lands after the head moved | review, drain | R-66, R-67 | stale acceptance not honoured; re-review owed | card |
| N-13 | Human supersedes a terminal stand-down | fix | R-55, F-01 | fixer dispatched again; caps still counted | card |
| N-14 | CI red → ci-heal ×3 → cap | fix | F-04 | exactly 3 heals, then `cap-exhausted` | card |
| N-15 | Superseded CANCELLED check then SUCCESS | drain | M-03 | merged | card |
| N-16 | `ready-to-merge` + `review:changes` together | drain | M-02 | not merged | card |
| N-17 | PR with empty body | drain | M-02 | not merged | card |
| N-18 | Stacked PR base merged via auto-delete setting (retarget, not close) | drain, review | M-07 | B retargeted to main, reviewed, merged in order | card |
| N-19 | WE half of a couple merged, impl half open | drain | M-06, M-08 | descendants wait; nothing merged out of order | card |
| N-20 | Lane lease TTL (4h) expires while its session is still working | lane-pool, lease-reaper | L-03, L-10 | a live session's lane is not handed to another agent | card |
| N-21 | Origin unreachable (fetch fails) | self-sync, review | R-85, R-105 | no restart; dispatch refuses stale; recovers when reachable | card |
| N-22 | Merged main is broken; live smoke rejects it | self-sync | R-92–R-97 | rolled back; reject cache stops re-testing the same sha; adopts the next good sha | card |
| N-23 | Daemon's runner lease lost mid-run | any host | R-13 | loop stops; a second instance takes over; no double tick | card |
| N-24 | Daemon crashes between label write and dispatch | review, fix | R-04–R-06 | next tick converges; no duplicate round tag | card |
| N-25 | Fixer pushes, CI goes red | fix | F-04 | ci-heal path, not review | card |
| N-26 | plateau-app / frontierui PR owed review / fix | review, fix | R-35, F-16 | review uses that repo's pool; fix recorded `unsupported-repo` | card |
| N-27 | Statute conflict on a PR with >100 files | conflict | C-10 | paginated re-fetch; fail cautious on fetch error | card |
| N-28 | More than 200 open PRs (`--limit 200`) | all list callers | discovery | PRs past 200 still seen, or truncation surfaced | card (likely **gap**) |
| N-29 | A PR with more comments than `gh` returns in one page | fix, review | F-10, R-32 | markers past the page still counted → cap still fires | card (likely **gap**) |
| N-30 | Laptop sleep: clock jumps hours at once | all | TTLs, grace, idle | timers fire once, in order; no mass reap of live work | card |
| N-31 | `claude stop` fails ("No job matching") | reaper | R-84 | retried 3×; counted; retried next tick | card |
| N-32 | `claude --bg` spawn hangs past its 60s timeout | review, fix | R-05, F-15 | failed entry; no lane leaked | card |
| N-33 | Session acquires a lane, then dies before opening a PR | lease-reaper | L-10, L-11 | lease reaped after the 10 min grace, not before | card |
| N-34 | Label does not exist yet in the repo | taggers | ensureLabel | label created once; write succeeds | card |
| N-35 | PR closed then reopened | review, fix | classifyPr | treated as fresh; old caps still counted | card |
| N-36 | Lane's branch deleted on origin under a live fixer | fix | R-57 | stand-down `lane-ref-gone`, not a crash loop | card |
| N-37 | Two drains (bare sweep + labelled drain) at once | drain | M-13 | one lease holder; no double merge | card |
| N-38 | Merged PR's lane still leased (session ended cleanly) | lease-reaper, lane-pool | L-08 | lane reclaimed on next acquire | card |

## Findings from the adversarial coverage review

A separate Opus reviewer got ONLY the matrix above plus the daemon code, with a mandate to find missed
decision paths, failure modes and races. Round 1 found 24 missed cases (11 high risk) and 7 rows whose
expected end state was wrong. All are folded in below. Evidence is `file:line` into `we:` code.

### Round 1 — new rows

| ID | Scenario (plain) | Daemons | Evidence | End state asserted | Risk |
|---|---|---|---|---|---|
| G-01 | The lease reaper reads fix session `fix-N` (N = a PR number) as item N. When item N's own PR merges, it releases the live fixer's lane | lease-reaper, fix | `we:scripts/conveyor/lease-reaper.mjs:137-141,606-608,244-245` | fix-N keeps its lane while PR N is open | high |
| G-02 | An item is sent out again after its old PR closed. The periodic reaper kills the new lease because the OLD PR is closed; it has no time-limit guard | lease-reaper, lane-pool | `we:scripts/conveyor/lease-reaper.mjs:244-245` vs `we:scripts/lane-pool.mjs:1359-1363` | a young lease for a re-sent item survives | high |
| G-03 | The lease reaper reads leases, makes slow calls, then force-releases without checking the holder is still the same | lease-reaper, any acquirer | `we:scripts/conveyor/lease-reaper.mjs:595-600,553` | a lane re-taken in between is never released | high |
| G-04 | Two agents get the same lane: the lease file is created before its content is written, and the stale-reclaim (delete then create) races | lane-pool | `we:scripts/lane-pool.mjs:1263,1276-1283,626-636` | N parallel acquires on k lanes give min(N,k) distinct holders | high |
| G-05 | Drain merges a head nobody reviewed: the merge is not pinned to the checked head, and a push lands in between | drain, fixer, human | `we:scripts/lib/pr-merge-gate.mjs:28-29`, `we:scripts/merge-ai-prs.mjs:4594-4596` | not merged at the new head | high |
| G-06 | The old runner still runs the session reaper in loose mode (any cwd, reaps working sessions) beside the review daemon's strict one | runner, review | `we:skills-src/conveyor/runner.mjs:327`, `we:scripts/conveyor/session-reaper.mjs:640-643` | no working session stopped by either | high |
| G-07 | Sibling daemon restarts onto HEAD that the other daemon's live smoke later rejects (drift restart has no smoke gate) | review + fix, shared clone | `we:scripts/lib/daemon-self-sync.mjs:404-407` | no daemon ever runs a rejected commit; no restart loop | high |
| G-08 | The same pass runs twice (runner inline + pass daemon) and double-posts | runner, pass-daemon | `we:skills-src/conveyor/daemon-manifest.mjs:77-80` | one comment/label per event | med |
| G-09 | Review and fix daemons race the non-atomic write of the clone's settings file; a session starts with no gh shim | review, fix | `we:scripts/lib/gh-app-shim.mjs:270-285` | every session's gh goes through the shim | med |
| G-10 | Per-repo stuck watches each count inspections separately → global cap exceeded | stuck watch | `we:scripts/conveyor/stuck-pr-watch.mjs:39-41` | never over the global cap | low |
| G-11 | The re-sync after a stale-main refusal adopts new main with NO live smoke | any self-syncing daemon | `we:scripts/lib/daemon-self-sync.mjs:423-428` | broken main rejected on this path too | high |
| G-12 | A passing blip (pool full, gh 5xx) during smoke rejects a GOOD main, and the reject cache makes it sticky | self-sync, lane-pool | `we:scripts/lib/daemon-live-smoke.mjs:114-121,300-320` | transient failure retried, not recorded as rejected | high |
| G-13 | A new round's session is reaped at once on the PREVIOUS round's `done` record (same session name; the reaper ignores which round a record belongs to) | reapers | `we:scripts/conveyor/session-reaper.mjs:247-249,430` vs `we:scripts/conveyor/reconcile-core.mjs:433` | new session not stopped on an old record | high |
| G-14 | A half-written verdict: comment posted but label failed, or the reverse | review session, drain | `we:scripts/review-set-label.mjs:1102-1143` | not merged; re-run completes it | med |
| G-15 | The drain's numbering commit is rejected on push (main moved) and stays only in the daemon clone; self-sync then merges on top of it | drain, self-sync | `we:scripts/merge-ai-prs.mjs:2893-2927` | commit reaches origin later; clone not left ahead | med |
| G-16 | A pass child hangs; the pass daemon waits forever while its heartbeat keeps the lease | pass-daemon | `we:skills-src/conveyor/pass-daemon.mjs:160-170` | killed after a time limit, re-run | med |
| G-17 | App mint fails after earlier success; the daemon keeps the expiring App token; a 401 in a session deletes the shared cache | all | `we:scripts/lib/github-app-auth-env.mjs:259-262`, `we:scripts/lib/gh-app-shim.mjs:218` | calls fall back cleanly; one re-mint | med |
| G-18 | Statute recheck posts its finding, the supersede note fails, next sweep re-posts — every sweep | conflict watch | `we:scripts/conveyor/parked-pr-conflict-watch.mjs:983-1000` | one finding per episode | med |
| G-19 | Stuck watch counts other bots' activity as progress, so a bot-to-bot loop is never flagged | stuck watch | `we:scripts/conveyor/stuck-pr-watch-core.mjs:171-172` | bot-only activity past the limit → one inspection | med |
| G-20 | The 30 min grace timer restarts on every re-label, so a flapping conflict is never bounced | conflict watch | `we:scripts/conveyor/parked-pr-conflict-watch.mjs:148-160,1022` | bounce 30 min after FIRST conflict | med |
| G-21 | The shim's settings file is ignored only by the operator's global gitignore; on a fresh box (or a fake HOME) the clone reads dirty forever and self-sync never merges | self-sync, smoke | `we:scripts/lib/gh-app-shim.mjs:275-283`, `we:scripts/lib/daemon-self-sync.mjs:88` | clone stays clean after sessions start | med |
| G-22 | GitHub answers `mergeable=UNKNOWN` right after main moves | conflict watch, drain, review | `we:scripts/conveyor/parked-pr-conflict-watch.mjs:45,118-119`, `we:scripts/merge-ai-prs.mjs:3591` | on UNKNOWN nothing is removed, bounced or merged | high |
| G-23 | `claude agents --json --all` grows forever; the read has an 8MB buffer | reapers | `we:scripts/operations/dispatch-lane-io.mjs:1873-1877` | over 8MB: reaper axis off, surfaced loudly | med |
| G-24 | Lease PR-state lookups read one page of 400 PRs; older merged PRs look unknown | lease-reaper, lane-pool | `we:scripts/conveyor/lease-reaper.mjs:512` | old lease still reclaimed (by TTL) + warning | low |

### Round 1 — rows corrected

- **N-20** → **gap**: there is no lease heartbeat; lease age runs from acquire time, and the reaper reaps an
  expired lease even when its session is confirmed alive (`we:scripts/lib/lane-lease.mjs:49-52`,
  `we:scripts/conveyor/lease-reaper.mjs:248-252`).
- **N-10** → the review daemon's reaper never stops a WORKING session; the asserted end state must name which
  reapers run.
- **N-07** → "not reaped" holds only for 6h: the idle rule counts from session START, not last activity.
- **N-28** → the drain lists `--limit 100` per repo with no truncation check; lease lookups use 400. Test at
  100/200/400 and assert the oldest approved PR does not starve silently.
- **N-37** → assert "no double merge; the second is a no-op" — the `--only` drain bypasses the lease.
- **I-12** → assert "no failed gh call", not "zero 401s" (the shim retries on personal auth after a 401).
- **I-15 / scenario A** → also covers G-07 as a follow-up.

### Round 2 — new rows

A fresh Opus reviewer got the matrix with round 1 already folded in and was pointed at the areas round 1
covered least: the supervisor and runner, gh-throttle, multi-repo iteration, the completion-record schema,
clock windows, and places where the fake might lie. It found 18 more (5 high risk). New high-risk finds fell
from 11 to 5, so the review is converging. A third round is filed as a card, not run here.

| ID | Scenario (plain) | Daemons | Evidence | End state asserted | Risk |
|---|---|---|---|---|---|
| G-25 | Smoke rejects a merge and rolls back. In the SAME tick, dispatch's main-staleness guard fast-forwards the clean clone onto the rejected commit, so a session runs rejected code | review, fix, smoke | `we:scripts/lib/main-staleness.mjs:146-160`, `we:scripts/lib/daemon-self-sync.mjs:393-406` | clone stays at the pre-merge sha across the next dispatch | high |
| G-26 | Review sessions auto-pick lanes; fix sessions pin `--lane=N` with no wait. A review takes lane N first | review, fix, lane-pool | `we:scripts/conveyor/reconcile-fix-dispatch.mjs:854,888`, `we:skills-src/conveyor/fix-agent-brief.md:86` | sessions across BOTH daemons ≤ lanes; a pinned fix never loses its lane | med |
| G-27 | Two relaunches reclaim the same dead runner/drain lease: each deletes then creates the dir, so both "hold" it | all lease holders | `we:scripts/readiness/file-locks.mjs:264-271` | exactly one winner | med |
| G-28 | The drain lease is keyed per checkout repo, so the WE-clone bare sweep and a plateau-app drain sweep the same PRs | drain | `we:scripts/merge-ai-prs.mjs:4877-4879` | one lander per repo | med |
| G-29 | The unsupported-repo file has three unlocked writers; rows are lost or never cleared | runner, fix, ci-heal | `we:scripts/conveyor/unsupported-repo.mjs:17-28` | every producer's latest rows present | low |
| G-30 | A session ends `failed` and its pid is recycled. Reconcile treats only `done` as finished, so the PR stays bound `live-process` forever | review, fix, reapers | `we:scripts/conveyor/reconcile-core.mjs:472,492-495` | PR re-dispatched after a failed session | high |
| G-31 | A corrupt or different-version completion record under `review-<pr>` makes every later write throw; the slug is reused every round | sessions, reapers | `we:scripts/operations/completion-cli.mjs:73-87` | next `started` replaces or quarantines it | high |
| G-32 | The gh points budget is exceeded at peak: waiters give up together and fire unrecorded; one call can block about 20 min | all | `we:scripts/lib/gh-throttle.mjs:358-381,466-467` | spend ≤ budget; no tick outlives its lease | med |
| G-33 | Reconcile waits 15 min on a `blocked-on-infra` record; the reaper treats it as done at once. The PR is re-dispatched into the same starved pool | review, fix, reaper | `we:scripts/conveyor/reconcile-core.mjs:403,434` vs `we:scripts/conveyor/session-reaper.mjs:429-431` | no re-dispatch within the 15 min cooloff | med |
| G-34 | A runner pass hangs past its 15 min lease; another runner takes over; the old one wakes and still dispatches | runner | `we:skills-src/conveyor/runner.mjs:312-316` | nothing dispatched after the lease is lost | med |
| G-35 | A pass daemon killed by SIGTERM leaves its child running; launchd starts a second copy beside it | pass-daemon | `we:skills-src/conveyor/pass-daemon.mjs:162,210` | at most one child per pass | med |
| G-36 | The hostname changes between a crash and the relaunch, so the fast dead-lease reclaim refuses for 15 min | all lease holders | `we:skills-src/conveyor/runner-lock.mjs:76,104-105` | relaunch within one tick | low |
| G-37 | The fix daemon's "two copies are safe" relies on an action-store ledger that does not exist; the runner's own fix pass still runs beside it | fix daemon, runner | `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:10-21` | one `fix-N` session when both tick in the same minute | high |
| G-38 | The supervisor parses runner stdout, but the runner writes to stderr: idle-stop busy-loops and a polite stand-down alerts as a crash loop | supervisor | `we:skills-src/conveyor/supervisor.mjs:94-100,379-387` | idle backs off; stand-down never alerts | med |
| G-39 | After a fast-forward, dispatch fills the NEW brief from the OLD in-memory placeholder list; an unfilled `{{TOKEN}}` ships | review, fix | `we:scripts/operations/review-dispatch.mjs:398-400,469` | refuse or restart on an unfilled placeholder | med |
| G-40 | Old and new daemons disagree on the app-token cache version and re-mint every tick | all | `we:scripts/lib/github-app-auth-env.mjs:136-149` | at most one mint per hour per version | low |
| G-41 | HARNESS FIDELITY: the fake clock moves `Date` but not the mtimes of lock files the DAEMONS write, so `advance 31m` makes live locks look stale | all | `we:scripts/readiness/file-locks.mjs:234-262` | a live lock survives `advance`; lock ages follow sim time | high |
| G-42 | The meaning of `cwd` in `claude agents --json` (spawn dir or current dir; `/var` or `/private/var`) is unpinned, and the reaper matches it byte for byte | reapers, reconcile | `we:scripts/conveyor/session-reaper.mjs:162-164` | pinned by a live probe; both variants behave | med |

### Round 2 — rows corrected

- **N-26**: all three repos have `fix:true` now (`we:scripts/lib/repo-profile.mjs:58-62`). Assert the fix is
  dispatched into that repo's own pool.
- **N-22**: also assert that the clone HEAD stays at the pre-merge sha across the NEXT dispatch (G-25).
- **I-12, G-09, G-17, G-21, G-40**: unreachable until the harness has a fake App-mint endpoint. The mint is
  a `fetch`, not `gh`. This is filed under the harness-fidelity card.
- **N-01**: gh-throttle sleeps use real time. Shrink the `WE_GH_THROTTLE_*` values and assert the budget
  state.
- **I-09**: over-subscription also happens ACROSS daemons (G-26). The built scenario C covers the review side
  only.
- **N-05, N-11**: there is no ledger. Run the "runner pass + fix daemon" pair concurrently (G-37).

### Honest limits of the three built scenarios

- **A2**: the mid-tick advance must leave the clone DIVERGED, not just behind. `assertMainNotStale` in its
  clean-only mode fast-forwards a behind-only clone on its own, so a plain push to main does not reproduce the
  refusal any more. The fake exposes `fault({kind:'push-to-main-diverge'})` for this.
- **B**: needs one extra `tick fix-dispatch`, because the first tick after `setup()` moves main and the host
  self-syncs and restarts. That is real daemon behaviour, not a harness quirk.
- **C**: `LANE_POOL_ACQUIRE_GROWTH_MAX_NEW=0` pins the pool growth off, so that the dispatch cap is the thing
  under test.
- The live smoke gate runs for real in every scenario. None of them sets `WE_DAEMON_SMOKE_DISABLE`.

**Matrix size**: 18 incident rows + 38 brainstormed rows + 42 rows from the adversarial review = **98
scenarios**. 4 of them are built in step 1 (I-07, I-09, I-15, I-18), in 3 test files.

The simulator also hit three fake-world gaps while it was being built. Each is fixed in the harness, not
worked around: `.gitignore` missing from the template made every lane look dirty; macOS `/var` →
`/private/var` made every CLI's `IS_CLI` self-check silently no-op; and the isolation check had to ignore
the operator's own live daemons writing to the real `~/.claude`. Building the scenarios found two more:
`we:src/_data/backlog.js` was missing from the template, so every PR read as having no item; and the fake's
`issues/{n}/events` route rejected the `?per_page=100` suffix, so the 30 min grace timer silently never
fired.
