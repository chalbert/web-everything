---
bornAs: x2a76pj
kind: story
size: 2
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: [drain, conveyor, gate, cross-repo, argv, tech-debt]
---

# A cross-repo argv guard must parse flags the way the receiving CLI parses them

A guard that inspects an argv it is about to hand to another repo's CLI must decide using that CLI's own flag semantics, not a hand-written string match. Today `childPassEnforcesHoldInvariant` in `plateau-app:tools/drain-daemon/lib.mjs` (#2832) tests `args.includes('--no-reconcile-labels')` and `x.startsWith('--label=')`, while `we:scripts/merge-ai-prs.mjs` parses `--name=value` into a flags object and tests truthiness. The two disagree on exactly the inputs the guard exists to reject, so the guard can pass an argv whose reconcile never runs.

## Where this came from

Filed out of the human review of **plateau-app PR #136** (the plateau-app half of #2832). The PR was accepted —
the diff changes no live behaviour — but the review found the new guard is weaker than the invariant it advertises.

## The two concrete divergences

`we:scripts/merge-ai-prs.mjs:133` parses argv as:

```js
for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }
```

and at `:1334` decides `const RECONCILE = label && !flags['no-reconcile-labels'];`. Against that:

1. **A valued negation slips through.** `--no-reconcile-labels=1` — and, perversely, `--no-reconcile-labels=false`
   — stores a non-empty *string*, which is truthy, so `RECONCILE` is false. The daemon's `args.includes('--no-reconcile-labels')`
   is `false` for both spellings, so `buildPassArgs` does not throw and the pass is spawned with the reconcile off.
   That is the plateau-app #134 shape the guard claims to make unbuildable.
2. **An empty label slips through.** `buildPassArgs({ owner, label: '' })` emits `--label=`, which satisfies
   `startsWith('--label=')`. In the child, `flags.label === ''` is falsy, so `RECONCILE` is false *and* the sweep is
   unscoped. `label` is a public parameter of `buildPassArgs`, so "the token is present" and "the value is
   meaningful" are not the same test. No caller passes an empty label today, so this is latent, not live.

## Why the guard's throw is currently unreachable

Both divergences matter more because of a third fact: `buildPassArgs` builds `argv` locally two lines above the
assert, and that argv always carries a `--label=` token and never carries `--no-reconcile-labels`. So with the
current construction the assert **cannot fire for any input**. Validating the caller-supplied `label` (divergence 2)
is what makes it reachable — and is the precondition for #2860 (a test whose title claims a refusal must
assert the throw) having a real `toThrow` case to assert.

## What to do

1. **Give the daemon the child's parse.** Either import a shared argv-parse helper that both repos use, or have
   `childPassEnforcesHoldInvariant` run the argv through the same `/^--([^=]+)(?:=(.*))?$/` reduction and then apply
   the child's own predicate (`label && !flags['no-reconcile-labels']`). One expression of the semantics, not two.
2. **Validate `label` in `buildPassArgs`** — a non-empty string after trim, throwing otherwise. This closes
   divergence 2 and makes the fail-closed assert reachable.
3. **Add a contract test** that feeds `buildPassArgs(...)` output through the WE sweep's real flag parser and
   asserts the resulting `RECONCILE` is true — so the two repos' semantics are pinned together by a test rather
   than by a comment.
4. **Consider the deterministic gate.** A `check:standards` rule that flags ad-hoc child-CLI flag inspection
   (`args.includes('--x')` / `.startsWith('--x=')`) outside a shared parse helper. Worth it only if a sweep finds
   more than this one site — check `buildReviewDetailArgs` / `buildSetLabelArgs` and the WE side first.

## Acceptance

- `childPassEnforcesHoldInvariant` returns `false` for a label-scoped argv carrying `--no-reconcile-labels=1`, and
  likewise for the `=true` / `=false` spellings.
- `buildPassArgs({ owner: 'o', label: '' })` throws; `buildPassArgs({ owner: 'o' })` still builds.
- A contract test asserts `buildPassArgs` output yields `RECONCILE === true` under the WE sweep's actual parser,
  and fails if either repo's flag semantics drift.
- The daemon expresses the reconcile predicate once, sourced from the child CLI's semantics — not restated as a
  string match.
