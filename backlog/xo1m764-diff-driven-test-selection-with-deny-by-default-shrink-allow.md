---
kind: story
size: 8
parent: "2612"
status: open
scope: ["we:scripts/readiness/", "we:.github/workflows/ci.yml", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-07-26"
tags: []
---

# Diff-driven test selection with deny-by-default shrink allow-list and red-main remediation

Shrink per-item CI by running only the tests a PR's **actual diff** affects — soundly. The design jury killed the
original scope→path-glob idea (a map keyed on *declared/predicted* `scope:` is blind to reverse dependencies,
cross-cutting tests, and diff-drift). This redesign selects off the real `git diff` via vitest's own module-graph
(`--changed`/`related`, sound-by-construction), gates the shrink behind a **deny-by-default allow-list** evaluated
on the **actual changed set**, and specifies the **red-main remediation** the shrink makes necessary. Highest-risk
lever: flag-gated, sequenced **after** sharding (#xsfplfp), and only defaulted once #xfgacpz's false-green
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
4. **Keep the `push:[main]` full suite** as the post-land backstop, and record its false-green rate via #xfgacpz.

## Definition of done / invariants

- No configuration where a diff touching a gate/statute/hook/dependency path shrinks its CI or self-reviews
  (gate-self held **hard**, on the actual diff).
- Flag-gated; **not defaulted** until the measured false-green rate (#xfgacpz) is acceptable and a red-main
  recovery path exists. Re-justify the marginal win against **post-shard** (#xsfplfp) wall-clock before defaulting.
