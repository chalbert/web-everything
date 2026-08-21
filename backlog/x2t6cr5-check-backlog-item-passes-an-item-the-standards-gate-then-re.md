---
kind: task
status: resolved
dateOpened: "2026-08-19"
dateResolved: "2026-08-21"
tags: []
---

# check-backlog-item passes an item the standards gate then rejects

`we:scripts/check-backlog-item.mjs` does not run the #883 locus-prefix scan; only `npm run check:standards` does. An author who validates a card with the per-item checker — the tool whose whole purpose is 'is this card correct' — gets a clean bill and a red CI. It cost two cycles on 2026-08-19 (PRs #1479 and #1480, six bare refs between them), with the same signature both times: the scaffold tool validates the DIGEST at creation, so the prefixes are right there, and the body appended afterwards is never scanned by anything the author runs. Either run the locus scan inside the per-item checker, or have it state plainly which gates it does not cover.

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

## ALREADY FIXED — resolved 2026-08-21, unbuilt

**This card was stale when it was rescued, and the rescue nearly shipped a false claim.**
`we:scripts/check-backlog-item.mjs` DOES run the #883 locus scan on the body. **#3201** closed this gap,
citing the same evidence this card was filed on (four cycles across 2026-08-19, #1479/#1480), and it calls
`scanRepoLocusPrefixes` — deliberately *"the same function the other two callers use, never a second copy —
a per-item check that could DISAGREE with the gate would be worse than one that merely omitted it."*

Verified empirically before resolving, rather than read off the comment: scaffolded a throwaway card,
appended a bare `<repo>`-less path to its **body** (the half this card said was unscanned),
and ran the per-item checker:

```
error  Backlog item "…" has 1 bare code-path ref(s) lacking a <repo>: prefix (#883;
       e.g. the bare path → its we:-prefixed form)
✗ 1 error(s)
```

**The withdrawn "confirmation".** An earlier revision of this card claimed four fresh 2026-08-21
occurrences as evidence *for* it. The occurrences were real but they prove nothing here: every one came
from `scaffold`'s digest-time scan or from `check:standards` directly, and **`we:scripts/check-backlog-item.mjs` was
never run at any point**. It was evidence that the rule exists, restated as evidence that this tool omits
it — the tool under accusation was the one thing never tested. Recorded rather than deleted, because
reaching for nearby evidence that does not bear on the claim is the more useful failure to be able to
recognise later.

Also worth keeping: #3201 already documents what a clean per-item run does NOT mean (it sees one file, so
every cross-entity check is out of reach), which is the honest version of the concern this card raised.

