---
bornAs: xo1m764
kind: story
size: 8
parent: "2612"
status: resolved
scope: ["we:scripts/readiness/", "we:.github/workflows/ci.yml", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Diff-driven test selection with deny-by-default shrink allow-list and red-main remediation

Shrink per-item CI by running only the tests a PR's **actual diff** affects — soundly. The design jury killed the
original scope→path-glob idea (a map keyed on *declared/predicted* `scope:` is blind to reverse dependencies,
cross-cutting tests, and diff-drift). This redesign selects off the real `git diff` via vitest's own module-graph
(`--changed`/`related`, sound-by-construction), gates the shrink behind a **deny-by-default allow-list** evaluated
on the **actual changed set**, and specifies the **red-main remediation** the shrink makes necessary. Highest-risk
lever: flag-gated, sequenced **after** sharding (#2682), and only defaulted once #2680's false-green
instrumentation shows the risk is acceptable — it may collapse to "vitest related + shard" with no bespoke map.

## What to build (the jury's four required properties)

1. **Select off the diff, not scope.** Use vitest's module-graph selection keyed on the PR's actual
   `git diff --name-only` — correct-by-construction, no drift, no dependency on the authored `scope:`. (Lever A's
   `scope:` stays for dispatch-overlap arbitration only, tolerant of incompleteness via the #2560 breach detector;
   it is **not** a test-selection input.)
2. **Deny-by-default shrink allow-list**, evaluated on the **actual changed files**: only paths on an explicit
   shrinkable allow-list may shrink. Anything else forces the FULL suite **and** `review:human` — `we:scripts/`,
   `we:check-*`, statute (`we:docs/agent/platform-decisions.md`), standard/plug definitions, `we:.claude/` hooks +
   settings (MEMORY #43), `we:package.json`/lockfile (supply-chain), `we:*.config.*`, `we:.github/`. Deny-by-default
   so a new sensitive surface is safe until explicitly allow-listed. **Keyed on the diff, never the prediction** — a
   diff that exceeds its declared scope cannot evade the boundary.
3. **Red-main remediation** (the missing failure half): a post-land full-suite red under a sole writer is a
   **stop-the-line** event. Specify dispatch-freeze + revert authority — not just "the next item rebases."
4. **Keep the `push:[main]` full suite** as the post-land backstop.

## Round-2 review — acceptance criteria

Three sharpenings from the second design-jury round:

- **`--changed/related` is sound only over the STATIC import graph.** `import.meta.glob` / fs-read test→source
  edges (all-demos / registry snapshot tests that discover files by directory, not by import) are invisible to
  it — the same cross-cutting blindness the scope-glob had. Add a **glob-edge guard**: when a changed path falls
  under a glob-discovered fixture root, force the full suite. "Sound-by-construction" applies to the static graph
  only.
- **Pin the diff merge-base.** Compute the changed set as the **net two-dot diff vs `origin/main`** (robust to a
  stacked / rebased / squash-merged branch). A wrong base lets a statute/hook/lockfile edit made earlier in the
  branch fall outside the computed set and **evade the deny-by-default allow-list** — the gate-self hole reopens.
- **The false-green signal is produced HERE, not by #2680.** #2680 measures durations; a false-green
  (selected-green while full-suite-red) is a test-outcome fact. This slice owns a **shadow full-suite compare** in
  measure mode that records the false-green rate — the evidence its own default-on gate reads.

## Definition of done / invariants

- No configuration where a diff (computed on the pinned base) touching a gate/statute/hook/dependency path shrinks
  its CI or self-reviews (gate-self held **hard**, on the actual diff).
- Flag-gated; **not defaulted** until the measured false-green rate (this slice's shadow compare) is acceptable and
  a red-main recovery path exists. Re-justify the marginal win against **post-shard** (#2682) wall-clock first.
