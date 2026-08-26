---
bornAs: x5df5nm
kind: story
size: 3
status: open
parent: "3029"
relatedTo: ["3233", "3035"]
dateOpened: "2026-08-26"
tags: [operations, epic-3029, prevention]
scope:
  - we:scripts/check-standards.mjs
  - we:scripts/operations/registry.mjs
---

# A step body reading `view.<path>` without declaring it in `reads` has no gate

Refuse, at registration or in `check:standards`, a declared step whose body reads `view.input.<leaf>` /
`view.findings.<leaf>` for a path its own `reads` array does not name. The engine already refuses the inverse;
this direction is silently `undefined`, so a feature can be fully wired, fully tested and completely dead.

## The class, and why care has not been enough

`projectReads` (`we:scripts/operations/engine.mjs`) builds a step's view from its declared `reads` and nothing
else — *"An undeclared path is absent, so the declaration is the actual boundary rather than a description of
one."* That is the right design. The hole is that it fails **silently**: an undeclared read is `undefined`, not
a throw. `op()` (`we:scripts/operations/registry.mjs`) already refuses the opposite mistake — a `reads` entry
naming an input field the schema does not declare — so the asymmetry is the whole bug.

Three recorded instances, none caught by a test:

| where | the read | what shipped |
| --- | --- | --- |
| `3233` | `view.input.land` in the step that acts on it | recorded by hand in that card's *Not in `reduce`* note |
| PR #1572 r1 | `view.input.reason` in `review-pr`'s `record` | the `--reason` guard threw even when a reason WAS given |
| PR #1572 r2 | the same read, same step | unchanged by the round that claimed to fix it |

In the #1572 case the value was parsed correctly, validated correctly, merged onto the run record correctly,
and then discarded by `projectReads` — so every unit test passed, `--help` was silent, and the feature was
dead on every real run. Two independent reviewers each had to reproduce it by executing `projectReads` by hand.
That is the case for a gate rather than more care.

## The check

Statically match each step's `view.input.<name>` / `view.findings.<name>` property accesses, inside its own
`fn` / `request` / `effects` / `asks` / `of` body, against that step's declared `reads`, and report a leaf that
is read but not declared.

Prefer the **registration-time** refusal if the step function's source is reachable there
(`Function.prototype.toString` on the declared fn, matched against `step.reads`) — it puts the refusal in the
same place as every other structural claim about a declaration, and it covers a declaration built in a test or
a sibling repo that `check:standards` never scans. A `check:standards` pass over `scripts/operations/*.mjs` is
the fallback if the source-reading proves too brittle; it is strictly weaker (it sees only this tree) but it
catches all three instances above.

An **error**, not a warning: unlike a half-applied prose correction, this one is exactly decidable and its
failure mode is a silently dead feature.

## Not in scope

A read through an alias or a destructure (`const { input } = view; input.reason`). A regex over property
accesses will not see it. Report what is decidable and say so in the check's own message — a check that
claims completeness it does not have is worse than one whose limit is stated.

Bare-root reads (`reads: ['input']`, which `projectReads` and `op()` both allow, projecting the WHOLE input).
A step that declares the bare root has declared every leaf, so nothing under it can be undeclared. Whether the
bare root should itself be discouraged — it dodges the boundary this item is defending — is a separate call and
is not decided here.

## Done when

1. **Executable** — a check that reddens on `we:scripts/operations/review-pr.mjs` at commit `a9f799fe`, whose
   `record` step reads `view.input.reason` while its `reads` names `input.pr`, `input.repo`, `input.actor`,
   `verdict`, `findings.read`, `findings.confirm` and nothing else; and passes on the commit that adds
   `'input.reason'` to that array.
2. **Mutation** — deleting `'input.reason'` from that `reads` array in the post-fix tree reddens the check
   again; deleting the `view.input.reason` read as well silences it.
3. It names the STEP, the LEAF and the declaring line, so the fix is one edit away from the message.
4. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.

Owed as prevention by two independent correctness reviews of PR #1572 (#3035), each of which reproduced the
defect by execution and each of which noted that no gate exists. This is its second recurrence after `3233`.
