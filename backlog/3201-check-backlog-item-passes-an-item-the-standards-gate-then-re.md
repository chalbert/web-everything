---
bornAs: x2t6cr5
kind: task
status: resolved
dateOpened: "2026-08-19"
dateStarted: "2026-08-20"
dateResolved: "2026-08-20"
tags: []
---

# check-backlog-item passes an item the standards gate then rejects

`we:scripts/check-backlog-item.mjs` does not run the #883 locus-prefix scan; only `npm run check:standards` does. An author who validates a card with the per-item checker — the tool whose whole purpose is 'is this card correct' — gets a clean bill and a red CI. It cost two cycles on 2026-08-19 (PRs #1479, #1480), same signature both times: the scaffold validates the DIGEST at creation, and the body appended afterwards is scanned by nothing the author runs. Either run the scan inside the per-item checker, or have it name the gates it does not cover.

## Why this is a seam and not carelessness

The failure has a shape, and the shape repeats:

1. `we:scripts/backlog.mjs` scaffold validates the **digest** at creation and refuses a bare ref there. So the digest is
   always right, and the author learns the rule.
2. The author then appends the body and the Done-when section — the part with all the file references.
3. `check-backlog-item <id>` reports **clean**, because it does not run the locus scan.
4. `check:standards` rejects it, minutes later, in CI.

Every step behaves as designed. The gap is that the tool named "check this backlog item" checks *less* than
the gate the item must pass, and nothing says so. An author reaching for the obvious tool gets a false
all-clear at exactly the moment they most need a true one.

## Two ways to close it, and the trade

- **Run the scan inside the per-item checker.** Strictly better for the author; costs the checker a dependency
  on the locus scanner and makes it slower.
- **Have the checker NAME what it does not cover.** Cheap, honest, and leaves the false all-clear in place —
  a reader who does not read the caveat is exactly the reader who hits this.

The first is the real fix. The second is worth doing anyway if the first is deferred, because a checker that
overstates its coverage is worse than one that admits its limits.

## Done when

1. **Executable** — a card carrying a bare code-path reference in its BODY (not its digest) is rejected by
   `we:scripts/check-backlog-item.mjs`. It passes today.
2. A card that is genuinely clean still passes, so the check does not become a wall.
3. If the scan is deliberately left out, the checker's own output states which gates it does not run — silence
   is what made this cost two cycles.

## How it was closed

The per-item checker now runs the #883 locus-prefix scan — the SAME `scanRepoLocusPrefixes` the other two
callers use, never a second copy. A per-item check that could DISAGREE with the gate would be worse than one
that merely omitted it.

Worth naming precisely where the scan already ran, because the shape of the gap is the lesson: at CLI WRITE
time in `we:scripts/backlog/guarded-write.mjs` (which is why the scaffold's digest is always right and the
author learns the rule there), and in CI. Neither is a place an author reaches while writing the body — and
the body, appended after the scaffold, is the part carrying all the file references.

Both closures from the fork were taken, not one. The scan runs (the first), AND a clean run now states which
gates it did not run (the second): the cross-entity checks — graduatedTo/relatedProject resolution, the
blockedBy cycle walk, duplicate ids — that a single-file pass structurally cannot see. The card argued the
second was worth doing anyway if the first was deferred; it is worth doing regardless, because "clean" from a
tool that checks less than the gate is the thing that misled in the first place.

## Verified

Live, not only in fixtures: appending an unprefixed backticked path (the drain's own module, written without its `we:`) to a real card's body makes
`check-backlog-item` exit 1 and name the fix; removing it returns to exit 0.

The new test drives the CLI as a subprocess, because the rules it composes are already unit-tested where they
live and what had no test was which of them this CLI RUNS — a missing wire is invisible to every rule-level
test in the repo. Mutation-checked: removing the scan wiring reddens 1, dropping the coverage note reddens 1.
