# Library-adapter watch (#1451) — living report

The single living report for the [#1451](/backlog/1451-library-adapter-watch-keep-incumbent-lib-adapters-current/) program watch. One section
per run; append, never fork. Set on #1451 as `relatedReport`.

Program goal: a WE **adapter** for every kind of target library/framework — so a consumer using a popular
library (Floating UI, Mousetrap, TanStack, Zod, …) can drive it through the WE intent/block surface.

---

## Run 1 — 2026-07-01 (front-A goal-completeness pass)

First skill-run of the watch. Focus: the **front-A goal-completeness** pass — derive the finite goal-set
(the target-kinds an adapter should exist for) and diff against filed children + the live adapter registry.

### Front A — goal-set coverage (completeness pass)

**Finding: the goal-set was UNLISTED in the body** — the program had been running on whatever got filed,
never against a stated target-kind set. Reconstructed from the 2026-06-21 review-log candidate list +
`we:src/_data/adapters/` (`category:"lib"`, which held only 2 entries, both `status:concept`). The
goal-set is now recorded in the #1451 body (this run).

| Target-kind (lib → WE target) | Child | Adapter in code? | Verdict |
|---|---|---|---|
| Floating UI → positioning (behind #149 seam) | — | `status:concept` (stub) | residual → #2034 |
| Mousetrap → Keyboard-Shortcuts block | — | `status:concept` (stub) | residual → #2035 |
| focus-trap → Focus-Containment intent | — | — (no entry) | residual → #2036 |
| TanStack-Virtual → Windowed-Collection intent | — | — | residual → #2037 |
| Zod / TanStack-Form → Validation intent | — | — | residual → #2038 |
| TanStack-Query-persistence → Storage protocol | — | — | pending (Storage protocol still `concept` — not yet owed) |
| Front-A compat table | #1450, #1487 resolved | ✓ `we:src/_data/capabilityMatrix.json` live | covered |
| TanStack-Query server-state (#1419), TanStack-Table (#1411) | — | — | blocked (protocol unratified — correctly pending) |

**Coverage: 1/7 owed elements live** — only the front-A compat table. **Zero** adapter-build children had
ever been filed; both registered `lib` adapters are concept stubs.

### Front B — currency

Not run this round. **Next run:** sweep the tracked libraries' latest majors for API churn (Floating UI,
TanStack v-next, Zod v4, …) once the build backlog is non-empty.

### Outcome

- **Goal-set recorded** in the #1451 body (the enumeration finding).
- **5 build stories filed** (locus frontierui): **#2034** Floating UI · **#2035** Mousetrap · **#2036**
  focus-trap · **#2037** TanStack-Virtual · **#2038** Zod/TanStack-Form validation.
- **Held (not filed):** TanStack-Query-persistence adapter — gated on the Storage protocol being ratified
  first (correctly pending, not a residual yet).

**Next run:** build the 5 filed adapters (concept→implemented); revisit the Storage-gated one once its
protocol ratifies; then start a front-B library-churn sweep.
