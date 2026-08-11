---
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

# The drain's risk roster is spelled for one repo, so two of the three it sweeps have no gate

The drain sweeps all three constellation repos under one review policy, but every blast-radius path pattern is
spelled for web-everything's layout, so in frontierui and plateau-app the risk roster matches nothing and a PR
can only escalate on raw size. `plateau-app#137` merged unreviewed on exactly that hole — 99 lines, under the
400-line trip, adding the conformance grader itself. This registers the judge, the vectors and the bindings of
all three repos as blast-radius, and excludes their consumers by construction.

## Why nothing fired

Two files, 99 added lines, 0 deleted: a new grader plus six lines of vitest alias config. Under the 400-line
size trip, no dismissed findings, not a cross-repo couple. And **not on any risk list** — because every
blast-radius pattern in [we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) is spelled
for **web-everything's** file layout: `we:scripts/`, `we:docs/agent/`, `we:src/_data/`, plus a basename roster
of WE delivery-engine scripts.

The drain sweeps all three constellation repos under **one** policy (#2257/#2287). That policy travelled. Its
**roster of what counts as risky did not**.

This is a gate that reads as enforced and is, for two-thirds of the constellation, decorative.

## Why the conformance surfaces are the right first entries

Not because they are important — plenty of files are. Because of a property the same PR proved:

> **A broken test goes red and stops the line. A broken judge goes green and certifies whatever it is handed.**

`plateau-app#137`'s grading run found that three of the five intl vectors passed a binding reporting
`['totally','wrong','sequence']`. The judge and the vector disagreed on the observation's shape, the mismatch
collapsed to `[].every(…)`, and that is unconditionally true. Two more vectors rejected a **correct** answer.
FUI's provider was materially right on all five; the harness could not say so in either direction.

None of that is visible from the outside. The suite was green.

## What landed

A `CONFORMANCE_GRADING_PATHS` set, spread into `BLAST_RADIUS`, covering the judge, the vectors, and the
bindings in all three repos' real spellings — WE's vector home, plateau-app's conformance-engine directory,
frontierui's per-plug conformance directory, and the binding basenames `<name>Conformance` /
`conformanceHarness` in `.ts`, `.java` and `.cs`, so the reference harnesses travel too.

**Consumers are deliberately excluded.** Every conformance *test* invokes the judge and goes red on its own, so
it carries none of the silent-green property. So does frontierui's webdocs conformance panel (UI) and a demo's
conformance fixture JSON. The `.ts`/`.java`/`.cs` extension anchor excludes all three **by construction**
rather than by an exclusion list that could drift.

**Measured, so the cost is on the record:** 60 newly-escalating tracked files — 27 WE, 12 frontierui, 21
plateau-app — leaving the blast-radius share at 13.0% / 1.4% / 4.5%. One accepted over-escalation,
[we:demos/reveal-nav-conformance.ts](../demos/reveal-nav-conformance.ts), is a demo ending in the binding
suffix; it is left un-special-cased on purpose, because a carve-out would be a second rule to keep true for one
file against a cost of one review.

**Clearance is unchanged.** These carry the existing `blast-radius` token, whose ratified clearance is **agent**
(#2445 two-tier flip). No new reason token, so
[we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) is untouched and the
policy conformance suite is unaffected. Promotion to the declarative leash would be a separate call, and should
be made on evidence — a graded-nothing judge surviving an agent panel — not on this argument.

## What this deliberately does NOT do

It fixes the conformance hole, **not** the general shape of the problem. The roster is still hand-authored, and
nothing prevents the next plateau-app or frontierui surface from being risky and unlisted. Making the roster
per-repo and repo-owned was considered and **rejected**: a repo that can edit its own risk list can lower its
own gate. The roster stays in WE, where changing it is itself gated.

## Done when

- [x] The judge, vectors and bindings of all three repos score `blast-radius`.
- [x] Consumers, UI and fixture data do not.
- [x] `plateau-app#137`'s exact two files and its real 99-line size escalate, with a negative control proving
      the non-conformance file still scores nothing on its own.
- [x] Every fixture is a real tracked path from `git ls-files`, not an invented shape.
