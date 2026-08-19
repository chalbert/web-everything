---
kind: task
status: open
dateOpened: "2026-08-19"
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
