---
bornAs: xdr4sk0
kind: story
size: 3
status: open
scope: ["we:src/_data/backlog.js", "we:scripts/check-standards.mjs", "we:src/_data/__tests__/backlog-malformed-determinism.test.ts"]
dateOpened: "2026-08-26"
tags: []
---

# A malformed backlog card loads differently on every load, so no gate result over that tree is evidence

One unparseable card makes the loader's answer depend on who parsed the file first in that process, not on
what is on disk. Load it twice and you get two different backlogs — 3308 items, then 3309, the second
carrying a ghost with no status, kind, tier or size. `gray-matter` caches the file before it parses it, so
the throw leaves a poisoned entry behind and every later reader is handed it. Make one malformed card
produce the same result on every load, and make the gate say so out loud.

## The mechanism

`we:node_modules/gray-matter/index.js:47` writes `matter.cache[file.content] = file` **before**
`we:node_modules/gray-matter/index.js:50` calls `parseMatter`. When the YAML throws, that cache entry is
never removed. The next `matter()` call on the same content hits
`we:node_modules/gray-matter/index.js:38-42`, returns the cached object early, and never parses at all — so
it does not throw. `we:node_modules/gray-matter/lib/to-file.js:17-19` had already set `data = {}` and left
`content` as the **raw file text, frontmatter delimiters and all**.

The loader calls it with no options at `we:src/_data/backlog.js:333`, inside the `#430` try/catch
(`:331-338`) that skips a bad card and reports it at `:369-375`. So:

- **first** parse of that content in the process → throws → card skipped, warning printed;
- **every later** parse → cached, silent, card **accepted** as a ghost item.

Verified on this tree (3309 files on disk after adding one duplicate-key card):

```
$ node -e 'const load=require("./src/_data/backlog.js"); console.log(load().length, load().length)'
3308 3309          # same process, same directory, two calls
```

The order is not a property of the data. Have anything else parse the file first and the **first** load is
already wrong:

```
$ node -e 'try{require("gray-matter")(fs.readFileSync(bad,"utf8"))}catch{}; console.log(load().length)'
3309             # ghost present on load 1
```

The ghost, as the loader emits it: `{ num: "x9malfm", batchable: false, title: "…" }` — no `status`, no
`kind`, no `tier`, no `size`, and `details` rendering the raw frontmatter as an `<h2>`. Anything reading
`item.status === 'open'` or `item.tier` sees a card that is neither open nor closed.

Second parsers of the same files already exist in the same processes: `we:scripts/check-standards.mjs:737`
(the `scope:` shape scan, `catch { continue }`), plus `we:scripts/backlog.mjs`,
`we:scripts/operations/resolve-io.mjs` and `we:scripts/operations/review-prep-io.mjs`. Which of them runs
first decides what the loader returns.

## What I could and could not reproduce

- **Reproduced**: two loads in one process disagree (3308 → 3309), and a prior unrelated parse flips even
  the first load. Both shown above.
- **Reproduced**: `we:src/_data/__tests__/backlog-leverage.test.ts:72` catches it — with the malformed card
  in `backlog/`, that test fails — the ghost's leverage signature is present in the second load and absent
  from the first. 1 failed / 6 passed.
- **Not reproduced**: run-to-run variation in `check:standards` itself. Three runs on the clean tree gave
  `0 error(s), 1436 warning(s) … 3308 backlog items` identically. Two runs with the malformed card gave
  **the same line again** — `0 error(s) … 3308 backlog items`, exit 0, both times. `check:standards` calls
  the loader exactly once (`:170`) and no earlier import parses the card, so within that one script the
  card is consistently skipped. I could not make it flip; a report of `3 errors, then 0` from an unchanged
  tree is not explained by this mechanism and needs its own capture.

That negative result **sharpens** the point rather than softening it. With a malformed card present,
`check:standards` prints `3308 backlog items` while `ls backlog/*.md | wc -l` says **3309**, prints
`0 error(s)`, and exits **0**. The card is gone from the board, gone from every per-item rule, and nothing
in the gate output says a card went missing. The `#453` unquoted-colon scan at `:705-712` was built for
exactly this and errors only on that one YAML shape; a duplicate key — what a bad automatic merge writes —
sails straight through.

## Why it matters

Two different failure modes, one root cause. In a single-load consumer the card silently vanishes and the
gate says clean. In a double-load consumer (Eleventy re-runs, the tests, any tool that loads then re-loads)
the card silently reappears as a typeless ghost. Neither is chosen; both follow from parse order. So the
honest reading of a green gate over such a tree is "the gate ran over a backlog I cannot name", which is
not evidence of anything.

## Which determinism is correct

**Consistently skipped in the loader, consistently fatal in the gate.**

Making the loader itself throw would take the whole site build down over one bad card, which is the thing
`#430` deliberately fixed and that call still holds — a typo in one card must not 404 `/backlog/`. But
"skip and warn" is what lets `0 error(s)` mean nothing, because a warning on stderr is not a gate result.
Splitting it puts each half where it belongs: the renderer degrades, the gate refuses.

The loader fix is one argument: pass an options object to `matter()`, which bypasses the cache in both
directions (`we:node_modules/gray-matter/index.js:37`). Measured over the real 3308 cards, that is **60 ms
vs 108 ms** — bypassing the cache is *faster*, because the loader never parses the same content twice
within a load and the cache only ever pays for its map writes. There is no performance case for keeping it.

## Not in scope

- Repairing any specific broken card — `#1584`'s job, done.
- Widening `findUnquotedColonScalars` to detect more YAML typos by pattern. The gate should key on **the
  loader reported this file malformed**, not on guessing which shapes are malformed.
- Changing what a *well-formed* card loads as. This item must be a no-op on a clean tree: same 3308 items,
  same `1436` warnings.
- Upgrading or patching `gray-matter` itself.

## Done when

1. **Executable, fails today** — a test that writes one duplicate-key card into a scratch backlog tree,
   loads it twice in one process, and asserts the two loads return **identical** item id sets. It must also
   assert the malformed card is absent from **both** — determinism alone is satisfied by consistently
   admitting the ghost, which is the wrong fixed point.
2. **Order-independent** — the same test, with an unrelated `matter()` parse of that file performed
   *before* the first load, returns the same result as without it.
3. **Mutation** — reverting the loader to a cache-using `matter()` call reddens criterion 1 by name; if it
   stays green, the test is decorative and does not count. Likewise, deleting the new gate rule must redden
   criterion 4.
4. **The gate refuses it** — `npm run check:standards` over a tree containing one malformed card exits
   **non-zero** with an error naming the file, instead of today's `0 error(s)` / exit 0. Assert both the
   exit code and that the reported backlog-item count equals `ls backlog/*.md | wc -l`.
5. **No-op on a clean tree** — `npm run check:standards` on `main` still reports `0 error(s)` and the same
   item count it does today (3308 at the time of filing).
6. `npm run test:unit` green.
