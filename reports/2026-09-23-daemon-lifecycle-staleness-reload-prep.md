# 2026-09-23 — Prep for #3681: resident-daemon lifecycle, code-staleness detection, reload

Session: prep-3681 (lane-31). Item: #3681 (`we:backlog/3681-mechanize-long-running-daemon-lifecycle-health-check-stalene.md`).
Research topic: `/research/resident-daemon-staleness-and-reload/`.

Grounded on `origin/main` `e43f2b12d` and the prototype branch `origin/lane/mechanical-dispatcher` `600acc14f`
(cited "(proto)"), plus the live process table and launchd plists on the laptop host.

## 1. What runs, and how long it lives

| Daemon | Launched / respawned by | Exits on its own? | Code frozen at boot? |
|---|---|---|---|
| `we:skills-src/conveyor/runner.mjs` | by hand, or child of the supervisor | yes — idle-stop, max-ticks, lease loss | yes (in-process imports); its passes are fresh child processes |
| `we:skills-src/conveyor/supervisor.mjs` | by hand (plist example is inert) | no | yes |
| `we:skills-src/conveyor/pass-daemon.mjs` ×15 | launchd KeepAlive (`com.we.lane-pool-health-watch-*`) | no | the daemon shell yes; each pass run is a fresh child |
| `we:skills-src/conveyor/review-daemon.mjs` | launchd KeepAlive | only on lease loss | yes — imports its pass modules in-process (`:49-53`) |
| `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` | launchd KeepAlive | only on lease loss | yes |
| `we:skills-src/conveyor/verify-daemon.mjs` | nothing installed | only on lease loss | yes |
| `we:scripts/conveyor/driver-watchdog.mjs` | (proto) 5-min timer in the supervisor | one-shot | n/a (fresh each run) |
| `plateau:tools/drain-daemon/daemon.mjs` | launchd KeepAlive | no — signal only (`:268-278`) | yes — up since 2026-09-01 (~22 days) |

## 2. Where in-flight state lives

- Leases: one lock file per key under `~/.claude/conveyor-runner-locks/` (`we:skills-src/conveyor/runner-lock.mjs:51`), 15-min TTL.
- Agents are **out of process**: started with `claude --bg`, tracked through `claude agents`; (proto) spawned
  `detached:true` + `unref()` (`we:scripts/operations/detached-dispatch.mjs:96-110` (proto)).
- Runner bookkeeping is in memory on main; (proto) persisted to a `tick-bookkeeping` JSON file under the
  coordination root.
- Drain: GitHub is the source of truth; `.drain-daemon/` is observability.
- Known restart loss windows: (i) the runner on main has no SIGTERM handler, so the lease leaks for its TTL (fixed
  on proto, `we:skills-src/conveyor/runner.mjs:1276-1300` (proto)); (ii) a build agent spawned < 60 s ago may be
  unlisted — (proto) `restart-runner` refuses in that window; (iii) `we:skills-src/conveyor/pass-daemon.mjs:148-155`
  exits on SIGTERM without killing its in-flight child; (iv) review dispatch has no durable claim, only a
  liveness read with a known lag race.

## 3. Staleness today

- **Nothing records the commit a process booted from, and nothing compares it to HEAD.** No `bootSha`-style field
  on either branch; the driver-mode marker holds `{mode, startedAt, pid, maxTicks}`.
- `assertMainNotStale` (`we:scripts/lib/main-staleness.mjs:141`) fast-forwards a *checkout*, never the loaded
  code. The (proto) main-ref-sync pass (`we:scripts/conveyor/main-ref-sync.mjs`, proto-only) moves a *ref*,
  never the working tree.
- The driver-watchdog's last-known-good marker is a rollback target, not a staleness signal; its `stale` verdict
  means "no progress for 20 min", a liveness notion.
- No file watchers or cache-busting imports anywhere.

## 4. Checkouts

- review / fix-dispatch / pass daemons: dedicated `wev-review-daemon` checkout, updated by an unknown external
  `merge origin/main` (reflog), after which the daemons were restarted 4 s later — the manual pattern this item
  wants mechanized.
- Live driver: the primary checkout, detached HEAD 26 behind main.
- Drain daemon: plateau-app primary. The ratified #2501 dedicated-clone + exit(0)/KeepAlive reload is **unbuilt**.

## 5. Prior art (external)

- **Erlang/OTP hot code loading** — the one mature in-place reload. It needs two module versions resident,
  explicit `code_change/3` state migration per process, and purges old code by killing processes still in it.
  The runtime was designed for it; Node was not.
- **Node.js ESM** — no module unload. Cache-busting `import('x?t=…')` loads a second copy of the module graph and
  never frees the first; old timers, listeners and closures keep running old code; module-level singletons (a
  lease handle) duplicate. Node's own `--watch` restarts the process, it does not hot-swap.
- **nodemon / `node --watch` / pm2 `watch`** — file watch → full process restart. **pm2 `reload`** — graceful
  zero-downtime only by starting a new worker before killing the old (cluster mode), i.e. restart, not swap.
- **nginx / Unicorn** — `HUP`/`USR2` re-exec: new master, old workers finish in-flight requests then exit —
  drain-then-replace.
- **systemd / launchd** — `ExecReload` convention (SIGHUP), `Restart=always` / `KeepAlive` relaunch. The daemon
  exits cleanly; the supervisor brings it back.
- **Kubernetes rolling update** — `preStop` + `terminationGracePeriodSeconds`: stop taking work, finish, exit;
  new pod starts. State lives outside the pod.
- **GitOps drift detection (Argo CD / Flux)** — compare *live* revision against *desired* revision; "OutOfSync"
  is a first-class, displayable status. Prometheus `build_info{revision=…}` is the same idea for a running
  binary: the process publishes the revision it is running.
- **File watchers** — `fs.watch` on macOS (FSEvents) coalesces/duplicates events; a `git checkout`/`reset`
  writes many files non-atomically, so a watcher fires mid-update and every tool (watchexec, nodemon) adds a
  debounce. A watcher also cannot see "origin moved but nobody pulled".

**Convergence:** every production system except Erlang reloads by *stop at a safe point → supervisor relaunches
fresh code*, with state held outside the process. Staleness is detected by publishing the running revision and
comparing it to the desired one. This matches the ratified #2501 drain-daemon ruling exactly.

## 6. How the forks reshaped

- Original Fork 2 (hot-reload vs drain-then-restart) → ratify-by-precedent (#drain-daemon-self-hosting-boundary
  clause 2); hot-reload is broken in Node, and the in-flight state the operator feared losing is already out of
  process.
- Original Fork 1 (detection) split into two: *what is compared* (any commit vs the daemon's loaded closure) and
  *what triggers the check* (poll at the safe point vs a watcher).
- New fork: who updates the checkout — detect-only, or a dedicated clone each daemon fast-forwards itself
  (extends clause 1).
- Original Fork 3 (uniform vs per-daemon) dissolved to support-by-default: one mechanism, per-daemon parameters.
- Lifecycle tooling (ask 1) is supported-by-default: a status/restart/promote operation generalizing the (proto)
  `restart-runner`, extending `runner-activity`, over `DAEMON_MANIFEST` extended with lifecycle fields.

## 7. Skeptic and screen outcomes

- **Screen** flagged "poll vs watcher" as an implementation detail → dissolved to a builder default with an
  acceptance bar.
- **Skeptic (Opus)** — Fork 1 survived with amendments: `classifyExit`
  (`we:skills-src/conveyor/supervisor.mjs:94-101`) has no `reload` reason and treats exits under 3 s as crashes; nothing
  relaunches the conveyor supervisor. Fork 2 survived with amendments: a static import closure misses the runner's
  lazy imports (`we:skills-src/conveyor/runner.mjs:369-370`) and the drain's cross-repo dynamic import
  (`plateau:tools/drain-daemon/daemon.mjs:176-183`) → runtime loader hook, per-repo boot shas, age backstop.
  Fork 4 **refuted** ("every daemon self-updates its own clone"): the (proto) queue root is found by script location
  (`we:scripts/conveyor/queue-store.mjs:124-134`), so a cloned runner ignores the operator's queue
  (#state-lives-where-its-nature-dictates clause 1); self-fast-forward undoes the driver-watchdog's last-known-good
  rollback; the runner tracks a POC branch whose landings skip review (#poc-branch-declared-delivery-mode), so it
  would self-apply unreviewed code (the #2501 clause 3 / #3649-rider hole); and citing #2501 clause 1 to choose
  self-update is circular. Flipped to read-only detection + per-daemon opt-in under four conditions.
- Codification changed from "amend the drain anchor" to "mint a new resident-daemon anchor that cites it".
- The draft's "second registry" was dropped: `we:skills-src/conveyor/supervisor-launcher.mjs:4-7` already treats
  `DAEMON_MANIFEST` as the resident-daemon list.

---

## Addendum — 2026-09-23 evening re-prep (supersedes the fork recommendations above)


Session: reprep-3681 (lane-999999). Item: `we:backlog/3681-mechanize-long-running-daemon-lifecycle-health-check-stalene.md`.
Supersedes the fork recommendations in the sections above (morning,
against `fcc756b2c`); that report's prior-art survey and loss-window analysis still stand.

Grounded on WE `origin/main` `051f2fcb3`, plateau-app `origin/main` `701ea85`, and read-only inspection of the live
host at about 18:45 ET (launchd labels, process table, daemon-clone reflogs and logs). Nothing was changed on the
host.

### 1. Why the morning prep went stale

Within hours of the morning prep, a narrow slice of #3681 shipped (#3954, bornAs xv6fciw), and the operator gave
direction that settles two forks:

- "This has to happen automatically" (daemon staleness)
- "no manual fixes, improve the daemon if needed"
- "I'd thought we would first fix the deamon in protoytpe to go quick and then graduat to main once perfect"
- "restart daemonn from lane as soon as the fix is ready"

The morning prep recommended "restart only when a loaded file changed" (Fork 2 b) and "detect drift, never
self-update by default" (Fork 4 a). What now runs is the opposite of both.

### 2. What runs (who self-syncs, and how)

| Daemon | Clone | Self-sync | Guards | Floor |
|---|---|---|---|---|
| review daemon | `wev-review-daemon` (shared) | always on | on `main`, clean tree | none |
| fix-dispatch daemon | `wev-review-daemon` (shared) | always on | on `main`, clean tree | none |
| six pass-daemon watchers | `wev-review-daemon` (shared) | none (in flight, with POC mode) | — | — |
| `merge-orphan-sweep` pass | `wev-merge-daemon` | none | — | — |
| dispatcher (`we:skills-src/conveyor/runner.mjs`) | plist staged, not loaded | opt-in `--self-sync` | the flag only | none |
| drain daemon (plateau) | `plateau-drain-daemon` (alone) | opt-in env | primary-root guard | 5 min |

Helper: `we:scripts/lib/daemon-self-sync.mjs` — fetch, `git merge origin/main` (abort on failure), restart only
the process that merged. Every git call has a 60 s timeout (#2533). No lock, no test gate, no rollback.

### 3. Evidence gathered

- **Restarts work for the merging process.** 33 self-sync merges in `wev-review-daemon` between 10:28 and 18:30;
  the drain clone fast-forwarded at 14:06 and 14:52 with matching restart log lines.
- **The other daemons in the clone do not restart.** At 18:45 the fix daemon (up since ~18:10) was older than
  the clone's 18:21 and 18:30 merges; the six watchers had been up ~5 h across 30+ merges.
- **Launch-from-lane hang.** Hand merge of unreviewed `38b8b0ab9` (PR #2542, open) at 18:20 added an
  O(lanes×heads) `git cherry` to `we:scripts/lane-pool.mjs`; the fix daemon's WE tick hung > 5 min; hand revert at
  18:40 (`fff012906`); a `list` child from ~18:22 still ran at 18:45.
- **Force-kill leaves a stale lease** (#3952), caused by `kickstart -k` landing mid-tick while the tick is inside
  synchronous `execFileSync`. This contradicts #2501 clause 2's premise that `kickstart -k`'s SIGTERM runs the
  clean handler.
- **Clone drift.** `wev-review-daemon` is 54 commits ahead of `origin/main`; earlier hand merges of lane commits at
  08:25, 09:22, 09:30, 17:51.
- **Primary protected by accident.** WE's helper has no primary guard; the primary is skipped only because it sits
  on a detached HEAD (`head-failed`).
- **Tracked runtime state.** `we:scripts/conveyor/run-scorecard-store.mjs:50` writes a tracked JSON file found by
  script location, and `we:scripts/review-set-label.mjs:491` commits it locally — a reset-based sync must not wipe it.

### 4. How the forks moved

- **Fork 1 (reload primitive)** — dissolved into "supported by default": exit at the safe point plus relaunch is
  forced by Node and is what runs.
- **Fork 2 (what counts as stale)** — flipped to "any new commit", re-worded after the skeptic: a daemon is stale
  when the input heads its clone was built from (`main`, and a POC head if any) moved since it booted, checked by
  every daemon each tick. 5-minute floor for every daemon.
- **Fork 4 (who moves the clone)** — flipped to "automatic, by the daemons", gated by a coded primary guard, a
  per-clone reader/writer lock, a fixed state root, and the floor. New sub-fork: rebuild the clone from its input
  heads (#2501 clause 1's form), not merge on top; refuse and alert if the tree is dirty or carries foreign commits.
- **Fork 5 (new: code not yet on `main`)** — per-clone opt-in POC branch, off by default, never in a clone that
  reviews, labels or lands PRs, behind a test gate and an outside rollback, and only after amending
  #poc-branch-declared-delivery-mode clause 4(a).

### 5. Red-team record

- Skeptic round 1 (Opus): Fork 2 REFUTED as first worded (shared clone); Fork 4 SURVIVES-WITH-AMENDMENT (lock,
  guard rollout order, merge-vs-reset statute conflict); Fork 5 REFUTED as a plain default (clause 4(a) collision,
  self-approval, rollback inside new code).
- Screen round 1 (fresh Sonnet): Fork 1 flagged(impl) → dissolved; Fork 5 flagged(impl) → timeout and pin details
  moved to the build slice.
- Skeptic round 2 (Opus) on the rewrite: all three SURVIVES-WITH-AMENDMENT (input-head comparison instead of HEAD;
  reader/writer lock and refuse-on-dirty; capability-based exclusion naming `merge-orphan-sweep`).
- Screen round 2 (fresh Sonnet): all clear; no live choice left in prose.
