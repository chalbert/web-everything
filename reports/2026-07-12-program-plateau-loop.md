# Program watch — Plateau Loop (#2445)

Living report for the [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)
program watch. One section per run.

---

## Run 1 — 2026-07-12 (completeness pass — the DoD's unfiled surfaces)

Focus: the epic shipped its phase-1 daemon (#2449) + dev-panel seed (#2454) and then stopped
decomposing. This run diffs the full Definition-of-Done goal-set against what's filed, and files the
residual — with the operator's emphasis on the operable UI.

### Front A — goal-set coverage (the completeness pass)

| Goal-set element (DoD Strategy + Extraction seams) | Child | In code? | Verdict |
|---|---|---|---|
| Resident merge-queue daemon (leases/order/labels/sole-writer) | #2449 (resolved) | ✓ `plateau:tools/drain-daemon/` | covered |
| Daemon dev-panel surface (status/history/controls) | #2454 (resolved) | ✓ `plateau:tools/dev-panel/drain-daemon.html` | covered — **seed only** |
| Gate-self re-anchor on extraction | #2448 (open) | — | filed |
| Daemon operating-evidence review | #2456 (open) | n/a | filed (calendar-gated) |
| Placement decision | #2446 (open, low) | n/a | filed (deferred) |
| Agent-runner *decision* | #2444 (open, low) | n/a | filed (deferred) |
| CI/PR transport parity across constellation | #2241 (open epic) | — | filed |
| Main-loop-as-coordinator / script the glue | #2418 (open epic) | — | filed |
| Lease-heartbeat correctness | #2453 (open) | — | filed |
| **Operable Loop UI — daemon lifecycle + queue/review/finish** | **#xwqsfbu (new)** + 6 slices | seed only | **residual → filed** |
| **Multi-project registry** | **#xsde084 (new)** | — | **residual → filed** |
| **Per-repo backlog files** (data-model prereq) | **#xxk0h1r (new)** | — | **residual → filed** |
| **Config-over-convention** | **#x8wagm6 (new)** | — | **residual → filed** |
| **Supervisor / crash-recovery / self-reload** | **#xgfj975 (new)** | partial | **residual → filed** |
| **Orchestrator as Node fan-out over runner** | **#xpqrhnk (new)** | — | **residual → filed** |
| **Agent-runner build** (gated on #2444) | **#x46a4zo (new)** | — | **residual → filed** |
| **Agent steering** (gated on #2444) | **#x16hn7n (new)** | — | **residual → filed** |
| **≥2-project end-to-end milestone** (DoD acceptance) | **#x05fzfp (new)** | — | **residual → filed** |

**Coverage before run: 9/17 filed, 2/17 done. After run: 17/17 filed.** The DoD was carrying an
almost-entirely-unfiled second half (UI, registry, config, supervisor, runner build, milestone).

### Front B — currency (Claude CLI / SDK landscape)

Light this run — the dominant finding is internal incompleteness, not external drift. The runner bet
(`-p --output-format stream-json`, hook-gate steering, kill+`--resume`, Agent-SDK-needs-API-key) is the
front-B lens; it feeds #2444 and is re-swept when that decision is prepared.

### Operator direction folded in (2026-07-12 session)

- **Daemon lifecycle is the first UI slice** — operate the daemon *process* (start/stop/restart/health/
  review) before the queue it drains.
- **The WE `/backlog/` UI morphs into the console** — built over, not copied; WE not deleted; end state is
  a multi-repo backlog + build-status + orchestration surface.
- **Per-repo backlog ownership** is the data-model prerequisite for multi-repo orchestration.
- **Plateau-app product separation** (menu too big) — filed as its own decision #xy4kshz (sibling to the
  Loop, candidate second product: the Explorer).

### Outcome

17 items filed: 1 UI sub-epic + 6 UI slices, a registry epic + per-repo-backlog child, config /
supervisor / orchestrator / milestone residuals, runner-build + steering under #2444, and the plateau-app
product-separation decision. Deferred residuals set `priority: low` (pickable, out of auto-select).

**Next run:** re-check after the UI console lands a slice or two; prepare #2444 (re-sweep the CLI runner
landscape) and #2446 once #2456's daemon evidence exists.
