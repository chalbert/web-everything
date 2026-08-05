---
bornAs: x28ljus
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Gate the /pr exit-code table against pr-land's emit sites, both directions plus reachability

The `/pr` skill's Exit-codes section is a hand-maintained prose copy of a contract that lives in `we:scripts/pr-land.mjs`. Four review rounds on PR #1050 found drift in it — a missing exit code, a wrong recovery, an unreachable reason — each fixed by hand, each re-derived by hand. Make it deterministic: derive the reason/exit pairs from the `emit(...)` sites and assert the doc matches in BOTH directions, plus a reachability assertion, since enumerating emit sites cannot prove a listed reason is producible.

## The gap

Every finding across the PR #1050 review rounds was the same shape: prose that restates a script's contract,
drifting because nothing compares the two. Concretely, on `we:skills-src/pr/SKILL.md` alone:

- **exit 4 was absent entirely** — `blocked-on-infra` (#2659) had been in the script for weeks;
- **`reason:"enqueued"`** (the default, no-flag path) was documented as "merged", which since #2290 it never is;
- **`--fallback-git`** was offered as the generic exit-3 remedy, though only the `gh-error` path reads the flag;
- **`reason:"behind"`** is listed as a live exit-3 outcome but **cannot be produced from the CLI**.

The last one is the reason a naive gate is not enough. `pollVerdict` returns `'behind'` only when
`labelWhenGreen` is false; the sole call site passes `!!PLAN.labelWhenGreen`, and `planPrLand` sets
`waitForChecks: true` only for the land and `--label-on-green` modes, both of which set `labelWhenGreen: true`.
So the poll loop never sees `labelWhenGreen: false` and the `behind` emit is dead from the CLI. Its only test
forces `labelWhenGreen: false` — a shape the CLI never uses, which is the tell. **Enumerating `emit()` call
sites gives you "nothing is missing"; it does not give you "everything listed can happen."**

## Done when

- A check (a `check:standards` rule, or a unit test in
  [`we:scripts/lib/__tests__/`](scripts/lib/__tests__) — pick the cheaper durable guard) parses the
  `emit(<result>, <code>)` sites in [`we:scripts/pr-land.mjs`](scripts/pr-land.mjs) into a `{reason → exit}`
  map and compares it to the reasons documented in `we:skills-src/pr/SKILL.md`'s Exit-codes section.
- It fails in **both** directions: a reason in the script but not the doc, and a reason in the doc but not the
  script. Also assert the exit **code** agrees per reason, not just the reason's presence.
- **Reachability.** A reason may be emitted from a branch no CLI mode reaches. Assert that every documented
  reason is producible from some `planPrLand` mode — or, where that cannot be decided statically, require an
  explicit "not producible from the current CLI" annotation in the doc for exactly those reasons, and fail when
  an un-annotated reason turns out to be unreachable (or an annotated one becomes reachable again).
- The parse is honest about its own limits: if a reason cannot be extracted statically (a computed reason —
  the #2833 verify gate emits `gate.reason`), the rule names that gap loudly rather than silently passing.
- Decide whether the same guard should cover the conveyor briefs, which restate the same exit codes — the
  cheapest version is to make `we:skills-src/pr/SKILL.md` the single documented home and have the briefs point
  at it, which shrinks the surface the gate must watch. Record the call either way.
