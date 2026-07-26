# Cutting per-item wall-clock in the conveyor (design record, 2026-07-26)

**Status:** proposed. Reviewed by a high-care design jury (`decision-prose`, verdict **changes**, 52 findings /
6 lenses); this is the revised (v2) design with the jury's changes folded in. Parent: delivery-throughput program
#2606 / conveyor epic #2612. Slices: #xfgacpz · #xuasox4 · #xxj54sw · #xsfplfp · #xo1m764 (+ prioritize #2619).

**Invariants held (non-negotiable):** the final landed diff is signed off by an agent that did **not** author it;
the drain daemon stays the sole writer to `main`; gate-self / statute edits stay `review:human`, human-only;
deterministic-core / thin-judgment.

## 1. Where per-item wall-clock goes today

Per item, in PR cycles (a cycle ≈ CI-green ~2.0 min + daemon land-gap ~0.5 min):

- **Unscoped leaf** (dominant pre-#2619): held `unshaped-no-scope` by `we:scripts/readiness/dispatch-plan.mjs` →
  a **prepare-scope PR lands** → next tick the build PR lands = **2 cycles** (tax **a**, the two-hop).
- **Cross-locus couple:** impl PR lands → the WE half goes `BEHIND` → the drain
  (`we:scripts/merge-ai-prs.mjs`) rebase-drops it → the WE half **re-runs CI** → lands = **~2 cycles**
  (tax **b**, the couple re-CI).
- **Every PR:** full ~2.0 min gate + up to **60 s** daemon re-sweep
  (`plateau:tools/drain-daemon` `DEFAULTS.intervalSec=60`) = tax **c**.

**What this model omits (the jury's deepest finding).** It counts only PR *transport*. It ignores (i) **agent
authoring time** (LLM producing the diff — likely the dominant term), and (ii) whether #2606 **throughput** is even
*bound* by per-item latency: items run in parallel lanes, CI on separate runners, but **all** lands funnel through
one serial daemon + a fixed lane-pool width. If land-serialization or authoring binds, shrinking already-parallel
CI moves latency, not throughput. **So we measure first (Lever 0), then commit levers on evidence.**

## 2. The levers (post-jury)

- **Lever 0 — instrument first** (#xfgacpz). A pure breakdown of authoring / first-CI / poll-gap /
  land-serialization wait / pool saturation, per-item and aggregate, from lane-board + `gh` timestamps. Tells us
  which term binds and gives Lever D its false-green signal. No new state store.

- **Lever A — author `scope:` at readiness** (land #2619). Kills the two-hop: removes a whole PR **and a whole
  land off the serial writer** per unscoped item — helps throughput, not just latency. Scope here is for
  **dispatch-overlap arbitration only**, tolerant of incompleteness via the observed-scope breach detector
  (#2560). **Not a test-selection input** (see D).

- **Lever C — event-driven land** (#xuasox4). Fire the fast-drain on a `we:scripts/conveyor/pr-watch.mjs`
  green-exit instead of waiting up to 60 s — the one lever on the serial land path. It is **the daemon's own land
  path scoped to one PR**: it runs `planLabelDrain` ordering, re-derives the full pre-land gate server-side
  (`we:scripts/lib/pr-merge-gate.mjs`), and adds per-PR idempotency + verified mutual exclusion vs a concurrent
  daemon sweep (today `--only` bypasses the whole-process lease and leans only on the numbering mutex,
  `we:scripts/readiness/drain-lock.mjs`).

- **Lever B — couple concurrency** (#xxj54sw). Robust: open both PRs so their first CIs overlap. Conditional:
  skip the WE re-CI **only when** landed-impl-SHA == the overlap-stack base (#2393) **and** main hasn't advanced;
  otherwise fall back to today's rebase + re-CI. Handles squash-merge and impl `review:changes` bounces. The
  −48% figure is withdrawn (best-case, not steady-state).

- **Lever E — shard the full vitest run** (#xsfplfp). `vitest --shard`, zero-soundness-risk, zero maintenance.
  Land before D and re-measure; it may capture most of tax (c).

- **Lever D — diff-driven test selection** (#xo1m764). Select off the actual `git diff` via vitest's module-graph
  (not a scope→glob map — the jury showed that is blind to reverse-deps / cross-cutting tests / diff-drift). Gate
  the shrink behind a **deny-by-default allow-list** on the actual changed set; define **red-main remediation**
  (dispatch-freeze + revert); keep the `push:[main]` full suite as backstop. Flag-gated, sequenced after E,
  defaulted only on measured evidence.

- ~~Card-only fast-CI lane~~ — **dropped**: tail-optimization of the path A makes rare, and unsound (the
  `/backlog/` page renders from `backlog/*.md`, so a card change can break the render — exactly what the skipped
  smoke/interaction tests catch; and a card's `scope:`/`status`/`priority` are trusted control inputs, not inert).

## 3. Savings, re-scoped honestly

The earlier −55%…−86% figures were **% of transport only** and conflated latency with throughput. Revised:
**A** removes one full PR cycle + one serial land per unscoped item (helps both). **C** removes avg ~30 s serial
land-gap per item (the throughput lever). **B / E / D** shrink already-parallel CI *latency* — real for lane
turnover and time-to-first-delivery, but their **throughput** impact is conditional on Lever 0 showing the
conveyor is latency-bound. No aggregate headline % until measured.

## 4. Sequencing

**0 → A → C → B → E → D.** Every slice reuses an existing seam (`scope:` #2609/#2619, `--only`/lease #2290/#2449,
`stackParents` #2393, `planLabelDrain` + `pr-merge-gate` ordering & gate, the lane board) — no new state store,
no new landing authority.
</content>
