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
