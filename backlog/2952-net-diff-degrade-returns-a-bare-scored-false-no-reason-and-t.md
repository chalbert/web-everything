---
bornAs: x4vqdgd
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
relatedTo: ["2450", "2901", "2912", "2914", "2326"]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:skills-src/review/SKILL.md
  - we:.claude/skills/review/SKILL.md
tags: [review, net-diff, drain, gate]
---

# Net-diff degrade returns a bare scored:false — no reason, and the review skill never spells the exec contract

`computeNetDiffText` / `computeNetDiffPaths` degrade to `{ scored: false }` with **no reason code**, so no
caller can tell a *caller-side contract violation* (a wrong-shaped injected `exec`) from a *legitimately
absent ref* (a foreign clone). The first is a bug the caller can fix in seconds; the second is unfixable and
correctly falls back. Both look identical, so the fixable one silently ships the reviewer the inflated
three-dot `gh pr diff` that #2450/#2901 exist to prevent. Add a `reason` to the degrade and spell the
`exec(cmd, args, opts)` contract in the `/review` skill, which today shows the call but never its shape.

## The evidence — reproduced live

Hit in the human review of **WE PR #1063** (`/review`, 2026-08-06), on the very first call of the skill's
step 1. The skill (`we:skills-src/review/SKILL.md:37`) says:

> Then take the diff from **`computeNetDiffText({ exec, rev: <headRefName>, fetchExtraRefs: [<headRefName>] })`**

`exec` is named and never defined. The natural reading is a shell-exec — `(cmd, opts) => execSync(cmd, opts)`
— but `resolveNetDiffBasis` calls it as **`exec('git', [args...], opts)`** (execFileSync shape), so a
shell-exec receives an array where the options object belongs and throws inside the `try`. The result:

```
PATHS: {"paths": [], "base": null, "rev": null, "scored": false}
SCORED: false
```

Byte-identical to what a foreign clone with no head ref returns. Switching to
`(cmd, args, opts) => execFileSync(cmd, args, opts)` returned `scored: true` with the correct 2-file net set.

## Why the existing items don't cover this

- **#2914** (open) — the converge loop never *reads* `diffBasis`, so a degrade reaches a juror with no signal.
  That asks for the signal to be **carried**. This item is the precondition: the signal has **no reason to
  carry**. A `diffBasis: 'three-dot'` that cannot say *why* still cannot tell an operator it was a fixable bug.
- **#2912** (open) — `resolveNetDiffBasis` swallows its *fetch* error and falls through to a stale cached
  tracking ref (scored, but wrong tree); fix is an `expectOid` currency proof. Different failure: that one
  scores against the wrong tree, this one does not score at all and cannot say why.
- **#2901** (resolved) — put the net basis into the skill's step 1 in the first place. It added the call, not
  the `exec` contract, which is the hole this item closes.

## Proposed shape

1. `resolveNetDiffBasis` returns a `reason` on failure — at minimum `'exec-contract'` (the injected `exec`
   threw a TypeError / arity error) vs `'ref-unresolved'` (neither candidate resolved) vs `'diff-failed'`.
   `computeNetDiffText` / `computeNetDiffPaths` / `computeNetDiffChangedFiles` pass it through in their
   unscored return. Purely additive — every existing consumer that reads `scored` is untouched.
2. Consider making an `exec` that is not callable in the `(cmd, args, opts)` shape a **throw**, not a
   degrade: a contract violation is a programming error, and degrading to the known-inferior basis is the
   one outcome nobody wants. (Judgment call — the safe-degrade posture is deliberate; the reason code in
   (1) alone may be enough.)
3. `we:skills-src/review/SKILL.md` step 1 spells the shape inline, e.g.
   `const exec = (cmd, args, opts) => execFileSync(cmd, args, opts)`, and says explicitly that a
   `scored:false` whose reason is `exec-contract` is a **caller bug to fix**, not a licence to fall back.

## Verification

A unit test that injects a 2-arity `exec` and asserts `{ scored: false, reason: 'exec-contract' }`, alongside
the existing foreign-clone case asserting `reason: 'ref-unresolved'`.
