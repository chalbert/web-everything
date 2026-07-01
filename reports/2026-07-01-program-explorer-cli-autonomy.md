# Explorer CLI autonomy (#1522) — living report

The single living report for the [#1522](/backlog/1522-explorer-cli-autonomy-find-every-issue-unattended-from-the-c/)
program watch. One section per run; append, never fork. Set on #1522 as `relatedReport`. The 2026-06-22
plateau-app a11y audit that grounded the program is referenced from the item body.

Program goal: point the CLI at a real app and have it find **ALL** the issues on its own, unattended, with
no bespoke harness. Explorer code lives in `plateau:tools/explorer/` (moved per #1577/#1597).

---

## Run 1 — 2026-07-01 (front-A goal-completeness pass)

First skill-run of the watch. Focus: the **front-A goal-completeness** pass — decompose the "find EVERY
issue on ANY app" goal into two finite goal-sets (issue-classes + reach-classes) and diff each against
filed children + the live explorer oracles/driver.

### Front A — goal-set coverage (completeness pass)

Grounded against `plateau:tools/explorer/` (subagent, 2026-07-01). **30 goal-set elements enumerated
(20 issue-class + 10 reach-class); 20 covered.**

The **reach front is solid** — auth-gated (#1523), arbitrary base URL (#1524), route sweep + zero-config
discovery (#1550), SPA nav (#1547), multi-viewport (#1526), artifact bundle (#1525) all covered in code.
The **issue-class front is under-decomposed**: a general UI tester's keyboard, form-validation,
broken-link, perf/CLS, i18n/RTL, and hover classes were never filed, and the `noStuckFocus` oracle is a
stub (`tabbable ≤ 1` heuristic — misses real modal traps).

Residuals (filed this run):

| Goal-set element | Verdict | Card |
|---|---|---|
| Keyboard operability + trap | residual (driver fires click/scroll/drag only) | #2039 |
| Focus-trap oracle (real) | residual (stub: `tabbable ≤ 1`) | #2040 |
| Form-validation / bad-input states | residual (inputs clicked, never filled) | #2041 |
| Broken-link / 4xx | residual (collector records only 5xx) | #2042 |
| i18n / RTL sweep | residual (no RTL emulation) | #2043 |
| Hover-reveal states | residual (hover never fired) | #2044 |
| Href-less route discovery | reopened-gap (#1550 = sitemap + `a[href]` only) | #2045 |
| Perf / CLS signal | residual (no perf signal collected) | #2046 |

Legitimately deferred: **#1805** (a11y over-claim vs declared tier) is parked, maturity-gated on a
consumer emitting a tier — not a residual.

### Front B — currency

Not run this round. **Next run:** sweep new axe-core / Playwright / WCAG oracle capabilities and any new
issue-class taxonomy the field publishes.

### Outcome

- **8 children filed** under #1522 (locus plateau-app; charter: no app-specific hardcoding): **#2039–#2046**
  (7 stories + 1 perf `task`) — see table above.
- Coverage moves from 20/30 toward full once these land; the reach front stays the mature half.

**Next run:** build the issue-class residuals (keyboard/form/link/perf/RTL/hover first — highest
issue-yield), then re-measure against the 30-element goal-set.
