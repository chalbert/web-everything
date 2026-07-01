# Parity Loop (#1226) — living report

The single living report for the [#1226](/backlog/1226-reproduction-conformance-program-reproduce-incumbent-design-/) program watch. One section per run;
append, never fork. Set on #1226 as `relatedReport`.

Program goal: reproduce top design systems (shadcn → Material → Ant → Carbon → Fluent) pixel- and
behavior-perfect using ONLY WE intents + webtheme tokens over FUI primitives; the deliverable is the
**gap list** per target, each parity claim gated on a measured layered-oracle verdict.

---

## Run 1 — 2026-07-01 (front-A goal-completeness pass)

First review of the program. Focus: the **front-A goal-completeness** pass (the new /review-program step)
— enumerate the finite goal-set and diff it against filed children **and** live code. Front-B currency
(are the target design systems' latest releases still the ones we're reproducing?) was **not** run this
round — deferred to a future run.

### Front A — goal-set coverage (completeness pass)

Goal-set = the 5 target systems + the infra the body implies (thin verdict contract, manifest→component
loader, measurement harness). Verified against code (grounded by a subagent, 2026-07-01).

| Goal-set element | Child | In code? | Verdict |
|---|---|---|---|
| Thin verdict/gap contract | #1227 resolved | ✓ contract types registered | covered |
| Manifest → component loader (seam) | #2017 open (blockedBy #2026) | — hardcoded default theme; 0 ThemeSource consumers | residual (unbuilt keystone, filed) |
| Parity/compliance harness | #2024 open | — nothing renders or measures | residual (unbuilt keystone, filed) |
| **shadcn** flavor + gap list | #1243 **resolved** / #2022 open | **stub** — declarative scaffold only, nothing measured | **reopened-gap** → #2032 |
| **Material** flavor + gap list | #2023 open | stub — ~5-token `-like` workbench preset | residual (filed) |
| **Carbon** flavor + gap list | #2025 open | stub — ~5-token preset | residual (filed) |
| **Fluent** flavor + gap list | #2025 open | stub — ~5-token preset | residual (filed) |
| **Ant** flavor + gap list | **none** | — no child, no manifest, no preset | **residual (no child)** → #2031 |

**Coverage: 1/8 live.** The measured-parity thesis is unexercised end-to-end — every flavor route
dead-ends at a seam (#2017 loader) that no component consumes, itself dammed behind the `preparing`
decision #2026.

### Front B — currency

Not run this round (front-A completeness was the focus). **Next run:** sweep each target design system's
latest release vs the flavor we reproduce (shadcn/Material/Ant/Carbon/Fluent changelogs) for token/API
drift.

### Outcome

- **2 children filed** (the only goal-set gaps with no existing card):
  - **#2031** (`story`) — author a full **Ant** flavor + gap list (the only target with no child).
  - **#2032** (`task`) — reconcile **#1243** (resolved) against the real shadcn flavor #2022 so "resolved"
    doesn't mask a stub (reopen or formally supersede).
- The other residuals (loader #2017, harness #2024, Material #2023, Carbon/Fluent #2025) were already filed
  in the 2026-07-01 batch — 0 duplicate cards (idempotent).

**Next run:** unblock the loader chain (ratify #2026 → #2017 → #2024), then re-measure coverage as flavors
render; run the front-B target-release currency sweep.
