---
bornAs: xggecwt
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/lane-drain.mjs", "we:scripts/lib/open-pr-items.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "12dd24e0e934a05a442335426480f6ef7e8e880b"
relatedTo: ["3816", "3779", "3441", "3473"]
tags: []
---

# Decision: how the drain stops resolving a multi-slice card when one slice lands (#3816)

Rule how the drain avoids setting `status: resolved` on a whole card when a PR for only one of its slices lands. Story #3816 (filed as `3816`) lists the options and says: do not build until the operator picks. The operator reviews decisions only in decision cards (operator rule 9, 2026-09-21), so the choice moves here; #3816 stays the build card and is blocked by this one. **The options, the evidence and the proposed default are copied from #3816; nothing was re-researched and the default was not changed.**

## FOUND (from #3816, re-checked there against main `a4ff83ea6`)

- PR #2392, head `lane/3779-handoff-location`, title "#3779 slice A: the handoff's tracked home on ops/handoff (path, pull, push)", merged 2026-09-21T17:45:51Z. Main commit `313177faf` ("drain: resolve #3779 on land (#2748)") set `status: resolved` on #3779, whose four Done-when items and design points 1, 2, 3 and 5 were unbuilt. PR #2399 has since reopened #3779 and retyped it to an epic.
- **Which signal fired: the ref lead-segment rule** at `we:scripts/lib/open-pr-items.mjs:191` (`/^(\d{2,5})[a-z]?$/i` on the first segment after `lane/`), on `lane/3779-handoff-location`. `deliveredItemNumsFromPr` (we:scripts/lib/open-pr-items.mjs:131) returns `['3779']` for the ref alone, and `[]` for the title alone (the title rule, :243, needs a colon right after the id). Guards 6, 7 and 8 (:253, :136, :141) did not fire.
- The path: `landedIdsForCandidate` (we:scripts/merge-ai-prs.mjs:1420) feeds `resolveLandedItem` (defined at we:scripts/lane-drain.mjs:956, called from we:scripts/merge-ai-prs.mjs:4734 and we:scripts/lane-drain.mjs:457), which runs the `resolve` verb and commits `drain: resolve #<num> on land (#2748)` (:975).
- Nothing on the card side is checked: the `resolve` verb refuses only an epic with open children (#658, we:scripts/backlog.mjs:305) and an undeclared presentation surface (#2803). #3779 is an epic now but no item names it as `parent:` yet, so #658 would not stop a second resolve either.
- Only three cards on main carry a `## Slice ` heading today (#100, #2387, #3779), so a fix keyed to that heading protects a narrow set.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — how the drain knows a card is not fully built | **(B) card-side refusal: a card with a `## Slice` section is never auto-resolved; (A) later as a backstop** | (A) alone first: old PRs carry no marker, and it needs three emitters changed |
| 2 — the marker under (B) | **(a) the `## Slice ` heading only** | (b) also a frontmatter field: a second marker to keep in step |

## Fork 1 — How the drain knows a card is not fully built

*Fork-existence:* today the drain credits any `lane/<NNN>-…` ref with item NNN and resolves it. The fix must read one signal that says "not done yet": a marker on the PR, a marker on the card, the card's Done-when, or more PR-text guards. They put the truth in different places and fail differently.

- **(a) (A) Explicit marker.** A slice PR says `Refs #N` and only `Resolves #N` resolves. Needs the brief, `/pr` and `open-pr` to emit the marker. Old PRs would not carry it, so the stranded-item sweep has to catch them. Rejected as the first fix (kept as a later backstop): it needs a convention change in three emitters, and until then every PR without the marker is unprotected.
- **(b) (B) Card-side refusal — recommended** (#3816's proposed default). A card that holds a `## Slice <label>` section (or another declared marker) is never auto-resolved by the drain. The drain reports `deferred: multi-slice card` and the card is resolved deliberately. Reads the one thing that knows whether the card is fully built. Weak spot: it only works if the marker exists. In #3779's case the marker was written BY the slice PR itself (commit `b50927b78` added `## Slice A: location`), so this rule would have caught it, but a first slice PR that does not add the heading is not protected. #3816's reason: it needs no convention change, it reads the card, and it fails in the safe direction: a false skip strands an item that the stranded sweep finds, while a false resolve silently closes unbuilt work. (A) is added later as an additive backstop.
- **(c) (C) Run the card's Done-when at land time.** Rejected: not feasible today: the items are prose, not runnable commands, and are not checkbox-marked, so "unchecked Done-when" has no machine-readable form.
- **(d) (D) More lexical guards on the PR title and body** (`slice A`, "stays open"). Rejected: eight rounds of this already went into #3441 and #3473 and each catches the last miss only. Fragile.

**Skeptic:** not run as a separate pass on #3816. The weak spot of (B) is stated by #3816 itself (a first slice PR that adds no heading is not protected); Fork 2 is the question it raises.

## Fork 2 — The marker under (B)

*Fork-existence:* #3816's open sub-question under (B): is the `## Slice ` heading the only marker, or does the card also need a frontmatter field so a slice PR cannot forget it? #3816 states no default.

- **(a) The `## Slice ` heading only — recommended** (the least invasive: it exists today on three cards and on #3779, and needs no schema change). A first slice PR that adds no heading stays unprotected; (A), the later backstop, covers that case.
- **(b) Also a frontmatter field** (for example a declared slice list). Rejected as the default: a second marker must be kept in step with the headings, and it needs a schema change and a check before it protects anything.

**Skeptic:** not run as a separate pass; #3816 raises the question without a verdict.

## Not in this decision

The build and its executable Done-when (written for (B)) stay on #3816. The extractor rules themselves (#3441, #3473) are not changed under (B): #3816's Done-when item 2 pins that the extractor still returns `['3779']` for PR #2392.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*how-the-drain-stops-resolving-a-multi-slice*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the two forks).
2. #3816's `## Done when` is rewritten if the ruling picks other than (B), and #3816's `blockedBy` entry on this card is cleared when the ruling lands.
