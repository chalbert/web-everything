---
bornAs: x5q4hpj
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
relatedTo: ["3319", "3335"]
scope:
  - we:scripts/lib/decision-routing.mjs
  - we:scripts/lib/__tests__/decision-routing.test.mjs
tags: [review, jury, operations]
---

# Route non-code PRs off the code reviewer

Planning and card-filing PRs cost 3.20 rounds and 20.6 KB of review text each against code at 1.19 and 4.3 KB, and 15 of 18 card findings were degraded or cosmetic. Ten planning PRs cost more review than fifty code PRs. Route them to a prose-shaped check instead of the correctness juror. Largest cost reduction available and it spends no new tokens.

## Why the gating must live in a caller, not in the operation

`#3319`'s write-up records the structural reason, and this card is its stated residual: *"The step list is fixed
at REGISTRATION, before any PR is read; the engine runs every declared step at its cursor … An input cannot gate
it either — an input changes what a step ASKS, never whether it RUNS. So a docs-only PR pays for a security
juror. Gating belongs to a caller that knows the touch-set before it starts the run."* A conditional declared
step is also forbidden outright by the four-kind operation statute (`#3031`). So the router is a PURE function a
caller runs BEFORE the run command is composed — never a branch inside a step.

It spends no new tokens because it picks between two **already-shipped** lens sets: the PR-review mandatory pair
(`MANDATORY_LENSES`, `we:scripts/lib/jury-core.mjs`) and the decision-prose set (`root-cause` + `completeness`,
`we:scripts/lib/decision-prose-adapter.mjs`, `#2657`). No new juror, no new taxonomy, no new score.

## The safety direction, stated once

Over-reviewing prose wastes tokens; under-reviewing code ships a defect. So the classifier is an **allow-list
that fails closed to `code`** on every ambiguity — an unreadable or empty touch-set, one non-prose file anywhere
in the set, an unknown extension, operative prose an agent executes (a skill source, agent memory, the Tier-0
docs router, the per-directory agent instruction files `we:AGENTS.md` / `we:CLAUDE.md`), or any path-kind
escalation signal. `prose` is reachable only when EVERY touched file is inert text and NOTHING escalated on path
kind.

`size` and `dismissedFindings` deliberately do **not** veto the prose route. Both are capacity dials (`#3320`) —
they say how hard to look, never at what. Vetoing on `size` would send exactly the long planning PR this item
exists to re-route straight back to the correctness juror, and the item would save nothing.

## Not in scope

- **Wiring the router into a caller.** `#3335` owns the caller half — a `we:scripts/review-core-cli.mjs` entry
  point, `read`-time refusal of a declared shape the PR contradicts, and the documented flow in
  `we:skills-src/review/SKILL.md`. That card derives **rigor** (how hard to look) from `scoreEscalation` +
  `panelRigorForCareLevel`; this card supplies the orthogonal axis it does not model — which **subject** is under
  review, and therefore which lens vocabulary the seats are drawn from. The two compose: `routeReviewShape`
  returns #3335's rigor numbers unchanged and swaps only the lens set. No file appears in both scopes.
- **Seating a second lens.** `#3319`.
- **Changing the care dial.** This router never dials rigor up or down.

## Done when

1. **Executable — a prose PR leaves the correctness juror, a code PR does not.**
   `npx vitest run decision-routing -t "#3309" | grep -qE "Tests +[0-9]+ passed"` — a bare test-name pattern, and
   the `grep` is load-bearing: `vitest -t` selecting **zero** tests exits **0**, so exit status alone proves
   nothing. Fails on `origin/main` (`Tests 53 skipped (53)`, no `passed` row); passes after.
2. **Executable — the code route is byte-for-byte the incumbent panel.** A named test sweeps a fixed list of
   code-shaped touch-sets — a `.mjs`, a `.ts`, a `.json`, the statute doc, a skill source, agent memory, the
   agent instruction file, an extension-less file, a mixed cards-plus-one-script PR, a skill source relocated
   into a sibling repo, and an empty set — and asserts every one routes `code` with `mandatoryLenses` deep-equal
   to `MANDATORY_LENSES`, `seatLens === 'correctness'` (what the review operation's `--lens` defaults to today),
   and `lenses` deep-equal to `panelRigorForCareLevel(careLevel).lenses`. A router that under-reviews code is
   worse than one that over-reviews docs, so this is the criterion that must not be weakened.
3. **Executable — the two gates are not redundant.** A named test uses a skill source relocated under a sibling
   repo directory: its path starts with none of the router's `^`-anchored operative prefixes, so the prefix list
   admits it, and `scoreEscalation`'s `(^|/)`-anchored blast-radius roster is what catches it. The test asserts
   both halves, so deleting either gate reddens.
4. **Mutation.** Drop `'humanRequired'` from the veto set and a named test reddens; drop the
   `if (codeFiles.length)` gate and the code-touch-set sweep reddens; add `'size'` to `PROSE_VETO_SIGNALS` and the
   capacity-signal test reddens.
5. **Observable.** `npm run check:standards` — 0 errors. `npx vitest run decision-routing` fully green.
