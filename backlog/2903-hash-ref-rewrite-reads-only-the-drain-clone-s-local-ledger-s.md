---
bornAs: x0dk81c
kind: story
size: 3
status: open
dateOpened: "2026-08-03"
tags: [drain, jit-numbering, cross-clone, backlog-state]
relatedTo: ["2288", "2392", "2428"]
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/backlog/id.mjs
  - we:scripts/__tests__/lane-drain-numbering.test.mjs
---

# Hash-ref rewrite reads only the drain clone's local ledger, so a cross-clone reference dangles forever

`numberPendingHashes` repairs a pending hash cross-ref by blind-replacing every hash recorded in the
drain's LOCAL, gitignored hash ledger. `applyLedger` takes that ledger as its only input and never
consults `bornAs` on `origin/main`, even though `bornAs` exists precisely as the sole cross-clone
proof-of-land and `landedNumberFor` already reads it. So an item that lands carrying a
`blockedBy`/`parent`/`#ref` to a blocker numbered by a DIFFERENT drain clone finds no mapping and
keeps a permanently dangling hash — the exact dead link JIT numbering exists to prevent.

## The trace

`numberPendingHashes` (`we:scripts/lane-drain.mjs`) loads the ledger from disk, adds this pass's
assignments, and hands it to `applyLedger`:

```
let ledger = {};
try { ledger = JSON.parse(readFileSync(ledgerAbs, 'utf8')) || {}; } catch { ledger = {}; }
…
const { renames, rewrites, pathRenames } = applyLedger(files, ledger);
```

`applyLedger` (`we:scripts/backlog/id.mjs`) opens with `Object.entries(ledger)` and rewrites from
that alone. The ledger is the **only** hash→NNN source in the whole rewrite path.

And that ledger is explicitly local. Its own docblock says so: *"LOCAL-ONLY, gitignored drain state
(Rule #105, like the queued token): it persists in the drain's checkout across invocations but never
lands on main."*

## Why the append-only design does not cover this

The ledger is deliberately append-only, and the stated reason is this very case: *"a still-in-flight
lane may reference a hash long before it is queued, so a queue-empty reset would drop a mapping a
dependent still needs."*

That is correct **within one clone**. It does nothing across clones. The mapping a dependent needs
lives in whichever checkout happened to run the drain pass that numbered the blocker.

## The failing sequence

1. Clone A drains the couple that lands blocker `xB`, numbering it `#2905`. `xB → 2905` is written
   to clone A's ledger and stamped as `bornAs: xB` on the landed item.
2. A dependent item is still in flight in some lane, carrying `blockedBy: ["xB"]`.
3. Clone B runs the next drain pass and lands the dependent. Clone B's ledger has no `xB` entry, so
   `applyLedger` does not rewrite the ref.
4. The dependent is now on `main` with `blockedBy: ["xB"]` pointing at nothing. No later pass repairs
   it: the repair is driven by hashes in the ledger, and `xB` will never enter clone B's ledger
   because clone B will never number it — it is already numbered.

A **fresh** clone is the same case at full strength: an empty ledger means every pre-existing hash
mapping is unknown, so any pending ref it lands dangles.

## Why the fix is small

The durable, cross-clone answer already exists and is already read elsewhere.
`landedNumberFor(hash, CWD)` (`we:scripts/lane-drain.mjs`) resolves a birth hash to its landed NNN by
reading the `bornAs` record off `origin/main`, and its docblock names exactly this role: *"the sole
cross-clone proof-of-land … so any clone can ask 'did hash X land, and as what number?'"*

It is imported by `we:scripts/merge-ai-prs.mjs` for the #2387 coordination gate — but never called by
the rewrite path. The gap is a missing lookup, not a missing mechanism.

Note the docblock at the `applyLedger` call site asserts the ledger and `bornAs` "cannot diverge"
because both derive from the same ledger. That is true of **writing** and does not hold for
**reading**: a clone cannot read what another clone's ledger wrote, even though `bornAs` on `main`
holds the answer.

## Definition of done

- **A1 — resolve unknown hashes off `main`.** When a hash ref does not resolve in the local ledger,
  fall back to `landedNumberFor` (the `bornAs` record on `origin/main`) before leaving it alone.
- **A2 — a genuinely unresolvable ref is reported, not silently kept.** A hash that resolves in
  neither the ledger nor `bornAs` is either still in flight (fine, leave it) or dead (surface it).
  Those two must be distinguishable rather than both reading as "no change".
- **A3 — regression.** A test with TWO clone fixtures: clone A numbers a blocker; clone B, with an
  empty ledger, lands a dependent referencing it by hash and must still rewrite the ref. Today's
  suite exercises ledger persistence *within* one clone, which is why this survives.
- **A4 — audit the existing corpus.** Sweep `backlog/` and `docs/agent/` on `main` for hash refs whose
  hash has a `bornAs` record (i.e. already landed and numbered) and repair them. The sweep MUST
  distinguish a live cross-reference from a hash deliberately quoted as prose — see below; a naive
  rewrite of the quoted cases is the #2826 failure repeated.

## Audit already run (2026-08-03)

Against `main`: **479** landed hashes carry a `bornAs` record; **4** references to them survive
un-rewritten. Classified by hand rather than by count, because the raw number overstates the damage:

| where | ref | verdict |
| --- | --- | --- |
| `we:backlog/2692-…md:245` | `#xvwmwkx` → landed as #2685 | **genuine dangling ref** — a live pointer ("the convergence loop's own mechanization is …") that resolves to nothing |
| `we:backlog/2431-…md:7` | `#x1vw9g7` → landed as #2431 | **borderline** — inside a `resolutionNote` quoting a real commit title, so it is a faithful quote, but a reader cannot resolve it |
| `we:backlog/2428-…md:15` | `#2421` → landed as #2421 | **not damage** — a deliberately quoted example demonstrating this very bug class |
| `we:backlog/2899-…md:31` | `xo75zon` → landed as #2450 | **not damage** — a `bornAs` value quoted as prose in a table |

So the live blast radius today is small (one, maybe two refs), which is why this is filed as a
correctness gap rather than an incident. The value is that it is unbounded going forward: nothing
repairs these, and every future cross-clone land can add one.

**A5 — the quoted-prose hazard is real and adjacent.** The same audit shows the rewriter has ALREADY
mangled quoted prose: `we:backlog/2899-…md:30` was authored with a `bornAs` hash in a table cell and now
reads `` `2880` ``, which is meaningless as a birth hash. That is #2826's class, live in an item filed
the same day. Any A4 repair must not widen it.

## Boundary

Not a change to when numbering happens (#2288 stands) nor to `bornAs` (#2392 stands). This makes the
rewrite path consult the cross-clone record that already exists.

## Provenance

Surfaced by a red-team of a rejected proposal to reserve numbers early (the red team correctly killed
that proposal; this gap was found while tracing why it was unnecessary). Not yet observed in the wild
— filed from the code path, so A4's audit is what would confirm or clear real damage.

## Design

### The insertion point is one line above `applyLedger`

In `numberPendingHashes` (`we:scripts/lane-drain.mjs`, ~L578) the sequence is: gather `files` → order the
pending hashes topologically → assign `max+1` into `ledger` → `applyLedger(files, ledger)` (~L670) → write
`ledgerAbs` (~L730) → stage + commit. The fix goes between the assignment and the `applyLedger` call:

```
// A hash the LOCAL ledger cannot resolve may still have LANDED — under another clone's numbering pass.
// bornAs on origin/main is the cross-clone record; landedNumberFor already reads it.
const unresolved = /* every x-hash token in `files` that is not a key of `ledger` */;
const crossClone = Object.fromEntries(
  [...unresolved].map((h) => [h, landedNumberFor(h, CWD)]).filter(([, nnn]) => nnn),
);
const { renames, rewrites, pathRenames } = applyLedger(files, { ...ledger, ...crossClone });
```

**Pass the MERGED map to `applyLedger`; keep `crossClone` out of the persisted ledger.** The ledger's own
docblock (~L724–730) states the invariant that the ledger (`we:.claude/skills/batch-backlog-items/id-ledger.json`, `LEDGER_REL` ~L556) and `bornAs`-on-main "cannot diverge" because
both are minted from the same assignment. Writing a foreign clone's resolutions into it would break that
statement for no gain — `applyLedger` takes the map as a parameter, so the merge can be local to the call.

**Why this is safe against a spurious rename.** `applyLedger` (`we:scripts/backlog/id.mjs`, ~L144) pushes a
`rename` only when `idFromName(name)` is itself a key of the map (~L175). A cross-clone-resolved hash is by
definition already landed and numbered elsewhere, so no file in `files` carries it as its leading id token —
but assert this rather than assume it: guard the rename branch on `ledger` (the local assignment map), not on
the merged map, so a resolution can rewrite refs and can never rename a file.

**The scan scope is already the whole corpus.** `files` (~L624) is *every* backlog stem (`stems`, ~L583 —
all `.md`, not just the pending ones) plus every tracked `docs/agent/*.md` (#2428) plus every tracked
`agent-memory-src/*.md` (#3100). So the moment cross-clone resolution exists, **A4's corpus repair is not a
separate sweep** — the next drain pass that numbers anything repairs every resolvable stale hash in all three
trees automatically. Design A4 as "prove the existing pass does it", not as a new script.

### The A5 hazard scales with this change, and that is the main risk

`applyLedger` rewrites with a **blind whole-token swap** (`swapHashes` per line, ~L157), guarded only against
a `bornAs:` value line (`BORN_AS_RE`). Widening the map from "the handful of hashes this pass assigned" to
"every landed hash the corpus mentions" multiplies the surface for the #2826 failure the card already
documents live: `we:backlog/2899-…md:37` was authored with a `bornAs` hash in a table cell and now reads
`` `2880` ``, which is meaningless as a birth hash. The adjacent row, `` `xo75zon` `` for #2450, is still
intact only because that hash was never in this clone's ledger — i.e. it survives for exactly the reason this
item is about to remove. **A quoted-prose exclusion is not optional follow-up work here; it is a precondition
for widening the map.** The `bornAs:`-line guard is a frontmatter guard and does nothing for a table cell.

### The audit's four cases, re-verified on this tree

| ref | resolves to | verdict |
|---|---|---|
| `we:backlog/2692-…md:245` `#xvwmwkx` | `bornAs: xvwmwkx` on `origin/main` → #2685 | genuine dangling ref — repair |
| `we:backlog/2431-…md:7` `#x1vw9g7` | #2431 | borderline — a faithful quote of a commit title |
| `we:backlog/2428-…md:15` `#2421` | #2421 | not damage — a deliberately quoted example |
| `we:backlog/2899-…md:36` `xo75zon` | #2450 | not damage — a `bornAs` value quoted as prose in a table |

Rows 2–4 are the exclusion set the A5 guard must leave alone; row 1 is the one A1 must repair.

## Done when

The five criteria below are the proof-shaped form of A1–A5 above; A1–A5 stay as the prose spec.

1. `npx vitest run lane-drain-numbering` fails before and passes after, with the A3 two-clone fixture:
   clone A numbers a blocker and stamps its `bornAs` on its `origin/main`; clone B, ledger **empty**, lands a
   dependent whose `blockedBy` names that hash, and the ref is rewritten to the number. Today's suite
   (`we:scripts/__tests__/lane-drain-numbering.test.mjs`) has 20+ cases and none of them uses two clones —
   `resolves a dependent that references an already-numbered blocker via a pre-seeded ledger` (~L117) is the
   nearest, and it pre-seeds the ledger, which is precisely the input clone B does not have. (Tier 1.)
2. A quoted-prose exclusion case in the same file, asserting **both** directions on the real shapes: a live
   `#<hash>` cross-ref IS rewritten, and a hash sitting in a table cell as a quoted `bornAs` value (the
   `we:backlog/2899-…md:36` shape) is NOT. This must go red if the exclusion is dropped, which is what stops
   this change from widening #2826. (Tier 1.)
3. A case for A2: a hash that resolves in neither the ledger nor `bornAs` is reported distinguishably — the
   return value of `numberPendingHashes` carries it as a named field, so "still in flight" and "dead" do not
   both read as "no change". Assert the field, not a log line. (Tier 1.)
4. On this tree, `we:backlog/2692-…md:245` no longer cites `#xvwmwkx`; one `grep` of that file shows `#2685`.
   The other three audit rows are unchanged — one `grep` each. (Tier 2.)
5. The rename branch in `applyLedger` (`we:scripts/backlog/id.mjs` ~L175) keys on the local assignment map,
   not the merged resolution map, so a cross-clone resolution can never rename a file. (Tier 3 — read that
   branch's condition and the parameter it is passed.)
