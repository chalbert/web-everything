---
bornAs: xn7yaiz
kind: decision
parent: "3383"
status: resolved
scope: ["we:scripts/lane-drain.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs"]
relatedTo: ["3570", "3567", "3478"]
dateOpened: "2026-09-07"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates"
preparedDate: "2026-09-15"
tags: []
---

# JIT-renumbering never re-keys the conveyor queue sidecar, so a cleared item silently falls out of dispatch under its stale hash

**Prepared** (2026-09-15). The survey of prior art is published as
[conveyor queue sidecar id drift across JIT-renumbering](/research/conveyor-queue-sidecar-id-drift-across-jit-renumbering/).
The original capture leaned toward Fork B. This pass confirmed that lean with evidence, corrected two claims in
the capture (one about which file holds the code, one about how hard write-time re-keying would be), found a
second sidecar reader the capture missed, and split out a second real fork: whether anything should write the
corrected id back into the sidecar.

## Ruling — RATIFIED 2026-09-21 (operator, in conversation)

- **Fork 1: (b)** — resolve through `bornAs` at the consumers, through one pure `canonicalizeQueue` step in
  `we:scripts/conveyor/queue-store.mjs` applied once per IO shell. (a) and (c) are not taken: the drain never
  writes the conveyor sidecar.
- **Fork 2: (a)** — readers translate in memory only; the two operator CLIs translate before `add`/`remove` and
  write the corrected file. (b) read-repair is rejected. (c) an explicit sweep verb is not built.
- **Two build-shape points ratified with it** (both already in this card's own text, stated firmly at the
  decision): `list` prints `#NNN (cleared as <hash>)` — required, not optional; and the build's touch set widens
  to add `we:scripts/readiness/conveyor-state.mjs` and `we:scripts/conveyor/queue-work.mjs`.
- **Ratify-time attack** (classification, merit-basis, statute-overlap, citation-scope; the prep's per-fork
  `Skeptic:` verdicts were re-read as the confirmation): the attack fails and the defaults stand. One citation
  note: Fork 1 (a)'s Against cites #2501 (`#drain-daemon-self-hosting-boundary`) for "the drain must not write
  outside its own clone". That anchor governs the daemon's own source, reload and review, not which files it may
  write, so it is **supporting context, not authority**. (a)'s rejection stands on its other Against points
  (coverage gaps, second unsynchronized writer). No overlap with an existing statute; the rule composes with
  `#state-lives-where-its-nature-dictates`.
- **Codified** as a rider on
  [state-lives-where-its-nature-dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates).
  **Build:** [3786](/backlog/3786-translate-birth-hash-ids-to-current-numbers-when-the-conveyo/) (size 5,
  `parent: 3383`).

## What happened

On 2026-09-07 at least 16 entries in the conveyor's session-local cleared-set sidecar (`we:.conveyor/queue.json`)
were observed still keyed by pre-land birth hashes. Each item's card had already been renumbered by the drain's
`drain: JIT-number <hash>→#<NNN> at land` commit (`we:scripts/lane-drain.mjs:768`). Every sidecar reader matches
by `normNum` only, so a stale-hash entry matches no ready build-queue row. The item then never launches and
stays in the `cleared-but-not-ready` held bucket permanently. **This breaks dispatch; it is not cosmetic.**
#3567 was fixed by hand with `remove` followed by `add`, which is the workaround the CLI's own docblock
prescribes (`we:scripts/conveyor/queue.mjs:20-23`). Nothing corrects these entries automatically.

**Findings from preparation that change the picture:**

1. **Stale hash entries are the normal case, not a rare edge case.** New cards are filed under a birth hash.
   The `file-item` operation's queue sink clears the card for the conveyor at filing time
   (`we:scripts/operations/file-item-io.mjs:76-82`), so it stores the hash. Every card queued at filing goes
   stale the moment it lands.
2. **The capture missed a reader.** `we:scripts/readiness/conveyor-state.mjs:97` (`shapeQueue`'s `buildQueued`)
   and `we:scripts/readiness/conveyor-state.mjs:463` (`deriveClearedNotReady`) have the same gap, so the tick
   picture miscounts as well. The capture also placed `readinessOf` in `we:scripts/conveyor/queue-store.mjs`.
   It is actually `we:scripts/conveyor/queue.mjs:95`. `removeFromQueue`
   (`we:scripts/conveyor/queue-store.mjs:110`) has the gap too: `remove <NNN>` cannot remove an entry stored
   under the hash.
3. **Write-time re-keying is harder to rule out than the capture said, but it still falls short.** Since #3478,
   `we:scripts/conveyor/resolve-runner-checkout.mjs` can locate the live runner's checkout. Both
   `we:scripts/conveyor/queue-work.mjs:67` and `we:scripts/operations/file-item-io.mjs:71` already use it. So
   the renumbering step *could* find the sidecar that matters in the common case. It would still miss: no live
   runner at land time, an ambiguous runner lock, the entries that are already stale, and hashes an operator
   types after land.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 — where the hash→NNN translation happens | **(b) at the sidecar's consumers, via `bornAs`** | (c) consumers plus a best-effort write-time re-key | high |
| Fork 2 — who may write the corrected id back to the sidecar | **(a) only an operator add/remove that already rewrites the file** | (b) the dispatch tick writes back on every read | medium-high |

## Fork 1 — Where does the hash→NNN translation happen?

*Fork-existence justification:* picking (a) puts the fix in the drain and leaves every reader unchanged.
Picking (b) puts the fix in the conveyor readers and leaves the drain unchanged. These are different
subsystems with different coupling. (c) would couple the drain to conveyor internals, which neither (a) nor (b)
does.

**(a) Re-key the sidecar at JIT-number time.** `numberPendingHashes` already builds the exact `hash → NNN`
ledger (`we:scripts/lane-drain.mjs:704`). After committing, it would call `resolveRunnerCheckout()` and rewrite
matching entries in that checkout's `we:.conveyor/queue.json`.
- *For:* the sidecar ends up with the correct ids, so `queue list` shows real numbers and every reader stays
  as simple as it is today.
- *Against:*
  - It only reaches the sidecar of a runner that is live at the moment of land. `resolveRunnerCheckout`
    refuses on `no-live-lock` or `ambiguous` (`we:scripts/conveyor/queue-work.mjs:67-72`), and the file-item
    sink falls back to its own script-location sidecar in those cases
    (`we:scripts/operations/file-item-io.mjs:69-72`). Entries written that way are never re-keyed.
  - It does nothing for the 16 entries that are already stale, nor for a hash typed after land.
  - It makes the drain (`we:scripts/lane-drain.mjs`) import conveyor modules and write an untracked file
    outside its own dedicated clone, which is the separation
    `we:docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary` (#2501) sets up.
  - It adds a second, unsynchronized writer to a file whose store says outright that it is last-write-wins
    and relies on a single operator (`we:scripts/conveyor/queue-store.mjs:154-158`).

**(b) Resolve through `bornAs` at the consumers — RECOMMENDED.** Leave the stored id as it is. When an id
matches no current item number, readers map it through the `bornAs` values on the backlog they already load.
- *For:*
  - It works in whatever checkout the reader runs in, with no need to find other checkouts.
  - It fixes the existing stale entries and any future ones.
  - It follows three precedents already in the repo: `kindOf`'s `bornAs` fallback
    (`we:scripts/conveyor/queue.mjs:75-83`), `resolveParent`'s `landedNumberFor` mapping
    (`we:scripts/backlog.mjs:1214-1224`), and `matchLaneRef`, which accepts both forms of an id
    (`we:scripts/conveyor/lease-reaper.mjs:161`).
  - The data is already in memory: the loader spreads `...data` (`we:src/_data/backlog.js:357`), so `bornAs` is
    present on the items the dispatcher loads at `we:scripts/readiness/dispatch-plan.mjs:546-555`.
  - The build is local to the conveyor: move that load ahead of the matching at
    `we:scripts/readiness/dispatch-plan.mjs:542-545`.
- *Against:*
  - The sidecar keeps the stale spelling unless something rewrites it (that question is Fork 2).
  - It adds one alias-map build per tick. That is cheap, because the loader has already read every card.
  - If the loader fails (the `catch` at `we:scripts/readiness/dispatch-plan.mjs:553`), matching falls back to
    today's behaviour. That is a safe degradation, not a new failure.

**(c) Both: (b), plus (a) as a best-effort extra step.**
- *For:* when a runner is live at land time, `list` shows the real number sooner.
- *Against:* it carries all of (a)'s coupling and second-writer costs, for a benefit that is display only,
  because (b) already restores dispatch on its own.

**Skeptic:** the strongest case against (b) is that it treats the symptom indefinitely. The stale spelling
stays in the file, and one reader added later without the fallback brings the bug back. That objection
survives, and it shapes the build rather than overturning the default. The translation must live in **one**
function in the queue store that every reader calls (see *Build note* below), so a new reader gets it by
reusing the existing loader. Fork 2 settles whether the file itself is ever corrected. (a) still does not
replace (b), because it cannot reach the entries that already exist.

**Screen:** clear. (1) Not an implementation detail: the fork decides which subsystem owns backlog-identity
translation for conveyor state, and whether the drain may write conveyor sidecars. A builder should not settle
that cross-subsystem boundary alone. (2) Not a prioritization question: the bug breaks dispatch and #3567
already needed a hand fix, so whether to act is not in question. Even ignoring cost, (a) and (b) differ in
which failure cases they cover.

## Fork 2 — Who may write the corrected id back into the sidecar?

*Fork-existence justification:* picking (a) keeps the operator as the only writer of the sidecar, which is
the assumption `we:scripts/conveyor/queue-store.mjs:154-158` states. Picking (b) makes the dispatch tick a
periodic writer as well. Picking (c) adds a new CLI verb that neither (a) nor (b) needs. Each option excludes
the other two ownership models.

**(a) Only when an operator's add or remove already rewrites the file — RECOMMENDED.** Readers translate in
memory only. The two operator CLIs (`we:scripts/conveyor/queue.mjs`, `we:scripts/conveyor/queue-work.mjs`)
apply the same translation to the queue before `addToQueue`/`removeFromQueue` and write the result back. Any
operator action therefore stores correct ids, and `remove <NNN>` removes an entry stored under the hash.
- *For:*
  - The file's only writers stay the ones it has today.
  - It needs no new race window.
  - It fixes the "cannot remove by current number" problem (finding 2).
  - The dispatcher's `--backlog-dir` fixture mode (`we:scripts/readiness/dispatch-plan.mjs:536-539`) can never
    write fixture-derived ids into a live sidecar.
- *Against:* a sidecar nobody touches keeps stale spellings, so `list` shows hashes until the next add or
  remove. The cost is display only.

**(b) The dispatch tick writes back (read repair).** Whenever translation changes an entry, the dispatcher
writes the corrected queue.
- *For:* the file converges without anyone touching it.
- *Against:*
  - The tick becomes a second, unversioned writer. An operator `add` that lands between the tick's read and
    its write is silently lost, the exact outcome the store's "single-operator, last-write-wins" note accepts
    only because there is one writer.
  - Dynamo-style read repair is safe only because its writes carry versions (see the research topic), and
    this store's writes do not.
  - Under `--backlog-dir` the tick would translate against a fixture corpus and could write wrong ids into the
    real sidecar.

**(c) An explicit sweep verb** (`queue canonicalize`), run by hand or by the conveyor skill, in the same spirit
as #3570's sweep.
- *For:* the write happens deliberately and can be seen.
- *Against:* it is a new verb to document and remember, for a benefit (a clean `list`) that (a) mostly
  delivers anyway. It has the same race as (b) if the skill runs it automatically.

**Skeptic:** the strongest objection to (a) is that the operator reads `list`, sees an unfamiliar hash, and
removes it or adds a duplicate. A duplicate is harmless: after translation, deduplication by the translated key
collapses both entries into one (`parseQueue` already deduplicates by key,
`we:scripts/conveyor/queue-store.mjs:68-76`). A removal by hash still works, because it matches the stored
spelling. The objection points at a display fix, not a write-policy change: `list` should print
`#NNN (cleared as <hash>)` from the same translation. The default stands, with that display addition folded
into the build.

**Screen:** partially flagged. (1) Implementation detail? Mostly no. (a) versus (b) changes who writes an
operator-intent file, and the queue store states that as a design assumption. (c) versus (a) is closer to a
detail and could reasonably be left to the builder. (2) Prioritization? No. Even ignoring cost, (a) and (b)
differ in how they fail under concurrent writes. Recommendation: ratify the (a)-versus-(b) line, and treat (c)
as an optional later addition that needs no ruling.

## Build note — one translation step, not a fallback in each reader (collapsed; not a fork)

Screened as an implementation detail. Anyone building Fork 1(b) should put the translation in one place
rather than threading an alias map through `selectClearedRows`, `clearedNotReady`, `shapeQueue`,
`deriveClearedNotReady` and `readinessOf` separately. The single-step shape keeps every existing pure matcher
and its tests unchanged, and it follows the store's rule that one normalizer serves every consumer
(`we:scripts/conveyor/queue-store.mjs:38-53`).

```js
// REJECTED shape: an alias map in every matcher's signature (5+ call sites that can drift apart)
export function selectClearedRows(rows, clearedKeys, norm, aliasOf) {
  return rows.filter((r) => clearedKeys.has(norm(r.num)) || clearedKeys.has(aliasOf.get(norm(r.num))));
}

// PREFERRED shape: one pure translation step in queue-store.mjs, applied once per IO shell right after reading
/** Map each entry's id through birth-hash → current NNN; deduplicate by the translated key, keeping the first addedAt. */
export function canonicalizeQueue(queue, aliases /* Map<normNum(hash), NNN> */) {
  return parseQueue(JSON.stringify(
    queue.map((e) => ({ ...e, num: aliases.get(normNum(e.num)) ?? e.num })),
  ));
}

// dispatch-plan.mjs IO shell — load the backlog BEFORE matching (today it loads after, :546)
const aliases = new Map(items.filter((it) => it.bornAs).map((it) => [normNum(it.bornAs), String(it.num)]));
const sidecar = canonicalizeQueue(readQueueFile(resolveQueuePath()), aliases);
const rows = selectClearedRows(bqRows, new Set(sidecar.map((e) => normNum(e.num))), normNum); // unchanged
```

(Illustrative only. Printing `cleared as <hash>` in `list` needs the original spelling, which `parseQueue`
currently drops as an unknown field, so the real build either extends it or keeps a side map.) The same
`aliases` map feeds the tick picture (read at `we:scripts/readiness/conveyor-state.mjs:863`) and the CLI's
`add`/`remove`/`list`.

## What this does not settle

- #3570, which covers held items whose work already landed elsewhere, is a different population: those items
  are done, while these are ready but stored under the wrong key. Neither sweep replaces the other.
- Whether the item's `scope:` should add `we:scripts/readiness/conveyor-state.mjs` and
  `we:scripts/conveyor/queue-work.mjs` (finding 2). The build should widen its touch set to include both. This
  pass did not edit frontmatter.
- A backfill for the 16 entries that are already stale is not needed under Fork 1(b), because translation at
  read time covers them.

Links: #3567 (the instance fixed by hand) · #3570 (the separate already-done sweep) · #3478
(`resolveRunnerCheckout`, which changes the cost of option (a)) · #2501 (the drain self-hosting boundary) ·
#2392 (`bornAs` as proof of land) · #3383 (parent epic).
