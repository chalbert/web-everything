---
bornAs: xdgei3q
kind: story
size: 2
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-11"
dateResolved: "2026-08-11"
tags: [gate, review, drain, review-escalation, conformance, constellation]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
---

# The drain's risk roster reaches no application source in the impl repos

The drain sweeps all three constellation repos under one review policy, but no blast-radius pattern reaches the
impl repos' application source trees — `plateau:packages/core/src/` and `fui:plugs/`. `plateau-app#137` merged
unreviewed through exactly that gap: 99 lines, under the 400-line trip, adding the conformance grader itself.
This registers the judge, the vectors and the bindings of all three repos as blast-radius.

## Why nothing fired

Two files, 99 added lines, 0 deleted: a new grader plus six lines of vitest alias config. Under the 400-line
size trip, no dismissed findings, not a cross-repo couple. And on no risk list.

**The gap is narrower than "the roster does not travel", and the narrower statement is what locates it.** An
earlier draft of this item said the roster matches nothing outside WE and called the gate decorative in the
other two repos. The independent review of PR #1162 measured both claims and both are false:

- The `we:scripts/` pattern matches **4** tracked frontierui files (including `fui:scripts/check-standards.mjs`)
  and **8** in plateau-app.
- The standards-definition pattern for `we:src/_data/blocks.json` and its siblings matches **2** frontierui
  files, despite the comment beside it calling that pattern "WE-permanent, never relocates". It fires in
  production: frontierui PRs #37/#38/#39 each escalated on the blocks definition, and #30 on that repo's own
  CI workflow. Those are **frontierui-local** escalations, which also refutes the follow-up guess that the
  impl repos only escalate by inheriting a cross-repo couple's verdict.

What no pattern reaches is the **application source trees** — the code those repos exist to hold. That is the
uncovered surface, and it is where #137 landed.

## Why the conformance surfaces are the right first entries

Not because they are important — plenty of files are. Because of a property the same PR proved:

> **A broken test goes red and stops the line. A broken judge goes green and certifies whatever it is handed.**

`plateau-app#137`'s grading run found that three of the five intl vectors passed a binding reporting
`['totally','wrong','sequence']`. The judge and the vector disagreed on the observation's shape, the mismatch
collapsed to `[].every(…)`, and that is unconditionally true. Two more vectors rejected a **correct** answer.
FUI's provider was materially right on all five; the harness could not say so in either direction.

None of that is visible from the outside. The suite was green.

## What landed

A `CONFORMANCE_GRADING_PATHS` set, spread into `BLAST_RADIUS`, by **two different mechanisms** — and keeping
them apart is what the first draft got wrong:

- **Four directory anchors.** WE's two vector homes, plateau-app's conformance-engine directory, and
  frontierui's per-plug conformance directory. Everything inside scores, whatever its extension.
- **One basename suffix** — a name ending in `Conformance` or `conformanceHarness`, in `.ts`, `.java` and
  `.cs` — so a binding keeps scoring when it relocates.

**Consumers outside a registered directory are excluded; consumers inside one are not.** The first draft
claimed the exclusion held "by construction", which is true of the basename pattern and false of the directory
anchors: **13 of the 65** newly-escalating files are consumer tests and **4** are data/doc files, all swept by a
directory. That is accepted — a directory whose whole job is grading is worth reviewing as a unit — but it is
not what was written, and the review was right to refuse the wording.

**The dot in the basename pattern is load-bearing.** Renaming a judge so its name is dotted rather than
camel-cased used to drop it from the gate silently, and the old wording ("a consumer is dotted") invited exactly
that rename. Allowing a dot inside the name closes it; a consumer's `.test.ts` ending still cannot match.

**Measured on `origin/main`, after `plateau-app#137` merged:** 65 newly-escalating tracked files — 31 WE, 12
frontierui, 22 plateau-app — leaving the blast-radius share at 13.0% / 1.4% / 4.6%. An earlier plateau figure of
21 / 4.5% was read from a checkout one merge behind, which is the very merge this item is about. One accepted
over-escalation, [we:demos/reveal-nav-conformance.ts](../demos/reveal-nav-conformance.ts), is a demo ending in
the binding suffix; it is left un-special-cased on purpose.

**Clearance is unchanged in the drain's rubric** — the existing `blast-radius` token, ratified clearance
**agent** (#2445 two-tier flip). No new reason token, so
[we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) is untouched.

**But `isBlastRadiusPath` has a second consumer**, and there the effect differs.
[we:scripts/readiness/test-selection.mjs](../scripts/readiness/test-selection.mjs) folds it into
`isSensitivePath`, and sensitive maps to `humanRequired: true`. **The same 31** WE paths flip there, 6 of them
previously shrinkable. No live impact — that selection sits behind a CI job that is off-by-default and
`continue-on-error` and gates nothing — and the direction is safe. Recorded because "clearance is unchanged" is
true of the drain and not of every caller.

**"The same 31" replaces a second count, because a second count is what went wrong.** The first revision said
27 here, measured before the `wrapper-conformance/` anchor was added and never redone, while the paragraph
above already said 31.

**And the obvious justification for "the same" is itself wrong** — a second review caught that too. The law is
`isSensitivePath ⊇ isBlastRadiusPath`, giving *escalating ⇒ sensitive*. It does **not** give *newly escalating
⇒ newly sensitive*: flipping also requires the path to have been un-sensitive before, and `isSensitivePath` has
a second source in `EXTRA_DENY` (lockfiles, build/test config, the `.claude/` surface, `check-*` scripts). The
guarantee is an inequality — `flip-count ≤ newly-escalating-count` — and today's equality is a **measured
fact** (zero of the 65 overlap `EXTRA_DENY`), not a theorem. A single vitest config file added inside a grading
directory breaks it: 32 escalating, 31 flipping. Both the law and that divergence condition are now pinned by
test, the second because the first assertion stays green on exactly the file that would diverge.

## Known gaps inside this set's own scope

Named rather than left for the next reader:

- [fui:plugs/webdirectives/ssr/python/harness.py](../../frontierui/plugs/webdirectives/ssr/python/harness.py) —
  the third of three cross-language SSR reference harnesses. Its two siblings carry `Conformance` in the name
  and travel by basename; this one does not, and `harness` is far too generic to register.
- [plateau:tools/explorer/oracles/](../../plateau-app/tools/explorer/oracles/) — its intent-conformance oracle
  scores by name; the five sibling judges beside it do not, and they carry the same silent-green property.
  Registering that directory is a real widening and belongs to its own decision.

## What this deliberately does NOT do

It fixes the conformance surfaces, **not** the general shape. The roster is still hand-authored, and nothing
prevents the next impl-repo surface from being risky and unlisted. Making the roster per-repo and repo-owned
was considered and **rejected**: a repo that can edit its own risk list can lower its own gate. The roster
stays in WE, where changing it is itself gated.

## Done when

- [x] The judge, vectors and bindings of all three repos score `blast-radius`.
- [x] A consumer OUTSIDE a registered directory does not score — and the test says which qualifier it relies on.
- [x] A consumer INSIDE one does score, asserted explicitly, so the comment and the tests cannot disagree.
- [x] The basename pattern has a control that turns red if it is deleted.
- [x] A dotted judge name scores; a dotted consumer name does not.
- [x] The superset law with `isSensitivePath` is pinned by test, one sample per pattern.
- [x] The condition under which the two counts CAN still diverge is pinned by its own test, because the
      superset assertion stays green on exactly the file that would diverge.
- [x] `plateau-app#137`'s exact two files and its real 99-line size escalate, with a negative control proving
      the non-conformance file still scores nothing on its own.
- [x] Every fixture is a real tracked path from `git ls-files`, not an invented shape.
