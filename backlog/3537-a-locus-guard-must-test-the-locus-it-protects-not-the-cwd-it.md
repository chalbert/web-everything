---
bornAs: ximp9d6
kind: story
size: 2
status: open
scope: ["we:scripts/check-standards.mjs"]
dateOpened: "2026-09-06"
tags: []
---

# A locus guard must test the locus it protects, not the cwd it was called from

Found by the round-4 juror on #1961, and CONFIRMED against the running code before it was fixed there.

`we:scripts/backlog.mjs`'s `number-stranded` refusal tested `process.cwd()`, while the repair it guards writes
to `ROOT` — the script's own checkout, resolved from `import.meta.url`. Those are the same thing under the
ordinary `cd <checkout> && node` + relative-path invocation of `we:scripts/backlog.mjs` and only then. Invoked by ABSOLUTE PATH from
an unrelated directory the guard passed and the verb went on to renumber the LANE's cards:

```
$ cd /tmp/notalane && node /…/.lanes/web-everything/lane-1/scripts/backlog.mjs number-stranded --dry-run
number-stranded (dry-run): would number 2 — 3538 → #3534, 3539 → #3535
```

That is exactly the half-applied rename the guard exists to prevent, walking straight through it. The inverse
mis-invocation — script in a primary checkout, cwd in a lane — FALSELY refused a legitimate run.

## Why it is a class, not one bug

The guard was modelled on `we:scripts/guard-lane.mjs`, whose locus question genuinely IS about cwd (it gates a
tool call made from somewhere). A CLI whose write target is its own `ROOT` asks a different question, and the
resemblance is close enough that copying the cwd form reads as correct. Two rounds of review passed over it —
both existing tests ran the script the ordinary way, so neither could tell cwd and ROOT apart.

## Done when

1. A `check:standards` rule (or a lint) flags a locus predicate in a CLI script that is applied to
   `process.cwd()` when the script's own writes go through a `ROOT`-like constant — or states, with reasons,
   that the shape is not machine-detectable and what is done instead.
2. The existing locus guards are swept against the rule and any second instance is fixed.
3. The rule's own test decouples cwd from the script path, as
   `we:scripts/__tests__/number-stranded-locus.test.mjs` now does (the #2274 throwaway-clone substrate planted
   at a chosen locus, run from elsewhere) — a test that only ever invokes the CLI by relative path from its own checkout
   structurally cannot catch this.

## Already fixed, and not owed here

The #1961 instance itself: the guard now tests `ROOT`, with a mutation-proven test covering both directions.
This card is the general rule only.
