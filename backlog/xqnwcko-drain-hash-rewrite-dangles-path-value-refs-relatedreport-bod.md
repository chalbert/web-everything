---
kind: story
size: 3
parent: "2387"
status: open
dateOpened: "2026-07-10"
tags: [drain, numbering, bug]
---

# Drain hash-rewrite dangles path-value refs (relatedReport, body links) — exclude or rename the target

At land the drain's `applyLedger` (`we:scripts/backlog/id.mjs`, called from `we:scripts/lane-drain.mjs` numberPendingHashes) blind-rewrites a birth hash → its assigned `NNN` across **every** occurrence of the token — including hashes embedded in **path values**: a `relatedReport` value whose filename stem is the item's own hash, and body cross-links of the form `/backlog/<hash>/`. It rewrites the *reference* but never renames the *referenced file*, so the ref dangles.

## Real repro (this session)

Landing the overlap-stack epic numbered `x6yoscx → 2387`. `applyLedger` rewrote the item's `relatedReport` filename stem `-x6yoscx` → `-2387` but left the report file itself named with the `-x6yoscx` stem. Result on `main`: (1) `relatedReport does not exist`, and (2) the real report is now *hidden* (nothing references it) — **two `check:standards` errors → red main**, blocking the whole merge queue. Hotfixed by renaming the report (#357), but the root cause is live: any landing item whose `relatedReport` filename embeds its own hash reproduces it.

Same **blind-rewrite over-reach** class the red-team caught for `bornAs` (#2392, whose fix is a targeted `applyLedger` exclusion) — this is the sibling case for path-shaped values.

## Affected token classes

- The `relatedReport` filename stem (the confirmed break — dangles + hidden report).
- Body cross-links `/backlog/<hash>/` — rewriting these to `/backlog/<NNN>/` is actually *desired* (the URL should track the number), so path values are **not** uniformly "leave alone".
- Possible: `formerSlugs`, a `crossRef` url, `relatedReport` on a *pointer* item.

So the fix isn't a blanket "don't touch path values" — it must distinguish **a hash that names a file on disk** (rewrite ⇒ must also rename the file, else it dangles) from **a hash in a URL / backlog cross-ref** (rewrite is correct, no file to rename).

## Fork

- **Option A (recommended) — rewrite the ref AND rename the target.** When `applyLedger` rewrites a hash that appears in a `relatedReport` (or any on-disk path value), also `git mv` the referenced file from its `-<hash>` stem to the `-<NNN>` stem in the same land commit, and rewrite the report's internal self-refs. Keeps the report named by its item id (the convention) and never dangles; body `/backlog/<hash>/` links rewrite as today (no file). Cost: the drain gains a "rename co-referenced files" step in the numbering pass.
- **Option B — exclude on-disk path-value hashes from the rewrite.** Leave the `relatedReport` stem un-rewritten (report keeps its birth-hash name, ref still resolves). Simpler, but the report filename no longer matches the item number — a lasting cosmetic drift, and it splits "how a hash is treated" by context in a way that's easy to regress.

**Recommendation: A** — the consistent, no-drift fix, matching how the item file itself is renamed at land. Add a `check:standards` guard that a landing item's `relatedReport` resolves post-rewrite (fail the land, don't redden `main` after the fact).

## Tests

- Land a hash-keyed item whose `relatedReport` filename embeds its hash → the report is renamed to the `-<NNN>` stem, `relatedReport` resolves, no hidden-report error (the #2387 regression, locked).
- A body `/backlog/<hash>/` link rewrites to `/backlog/<NNN>/`.
- An item with no `relatedReport` is unaffected.
