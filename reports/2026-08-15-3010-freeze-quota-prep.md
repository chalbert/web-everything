# Report — #3010 prep: re-deriving the freeze/quota premise (2026-08-15)

Run in preparation of [#3010](/backlog/3010-adopt-a-repo-wide-process-work-freeze-and-a-product-quota/) (repo-wide
process-work freeze + product quota). No design survey applies here — this is an internal governance/process
call, not a greenfield web-standard artifact — so this report re-derives the item's own factual premise instead
of surveying prior art. Everything below is re-runnable; commands are in the appendix.

## 1. The founding "2026-08-08 delivery review" figures do not reproduce — again

#3012 (resolved, the output-mix metric this item cites as its enforcement instrument) already found that its
own quoted `+1,699 → +705 → +480 → +147` lines/week and the `38,852`-line machinery gap do not reproduce, and
that no report titled "2026-08-08 delivery review" exists anywhere under `we:reports/`. The same is true of the
two figures #3010 itself states: **"~70% of the open board (~305 of 430 items) is process work."** A repo-wide
grep of `reports/*.md` and `backlog/*.md` finds `305`, `430`, and `70% of the open board` in exactly one place —
`backlog/3010-*.md` itself. No script or report derives it. **Recorded as unreplicated; do not re-quote it.**

The board has also moved on: as of 2026-08-15 there are 476 `status: open` + 18 `status: active` = **494**
in-flight items (not 430), out of 3,091 tracked backlog files total. No script in this repo classifies backlog
*items* (as opposed to committed *lines*) as process vs. product — the only rigorous instrument is the
line-level output-mix classifier (below). A reader wanting an item-level process/product split would have to
build one; it does not exist today, so #3010 should ground its case in the output-mix numbers, not a
board-item head-count.

## 2. The output-mix metric, re-run today — the trend is worse, not better

`we:scripts/lib/output-mix.mjs` (`computeOutputMix`) is real, committed, and mechanically re-derivable. Run
fresh at `origin/main` `cedc9524` (2026-08-15):

| Week (Mon–Sun UTC) | Product | Machinery | Other | Ratio |
| --- | ---: | ---: | ---: | --- |
| 2026-07-13 | +1,909 | +13,671 | +965 | 7.2× |
| 2026-07-20 | +399 | +26,553 | +796 | 66.5× |
| 2026-07-27 | +627 | +36,373 | +731 | 58.0× |
| **2026-08-03 (now COMPLETE)** | **+0** | **+51,165** | +1,014 | no product at all |
| 2026-08-10 (partial, moving) | low tens | tens of thousands | — | hundreds-to-low-thousands× |

The 2026-08-03 week, which #3012 could only read as a *partial* +48,641 machinery / +0 product row, is now
**complete**: a full week with zero product lines and 51,165 machinery lines. **This completed-week figure is
the load-bearing number.** The current (partial) week is directionally in the same regime — a small handful of
product lines against tens of thousands of machinery lines — but, like every partial row in #3012's own
history, it moves with every commit: two re-runs minutes apart during this prep session produced different
exact figures for it (first read +15/+54,185; a later re-run read +141/+62,998). Cite the completed week only;
do not re-quote a precise partial-week number. **The drift #3010 responds to has not self-corrected in the week
since it was filed; by this metric it has gotten worse.**

## 3. Recent merged-PR census — corroborates the line-level number

Last 100 merged PRs (`gh pr list --state merged --limit 100`) span just **~21 hours**: 2026-08-14T20:06Z to
2026-08-15T17:26Z. Of those 100 titles:

- **63** are literally `prepare #NNN …` / `#NNN … not build-ready …` — backlog-readiness authoring (research +
  item-body edits), not shipped product code.
- **32** match `gate|review|drain|converge|conveyor|jury|juror|escalat|trust-chain|statute` — delivery-machinery
  hardening.
- **11** are `resolve …` / `backlog: …` / taxonomy/tooling bookkeeping.
- The remainder are real code fixes, but overwhelmingly to delivery machinery (`scripts/`), not `src/`/`blocks/`/
  `demos/`.

This is a census of PR *titles*, not committed lines — it corroborates the output-mix table's direction, it does
not replace it as evidence.

## 4. The named exception list (Fork A1) and the statute-lint tail, checked

| item | current status (2026-08-15) |
| --- | --- |
| #3007 verdict ledger | `open`, `kind: story` — unbuilt |
| #2979 content-pinned accepts | `active` — largely landed (PR #1086, #1119) |
| #2948 proportional review | `open`, `kind: epic` |
| #3001 named operations | `open`, `kind: decision` — **itself an unresolved decision** sitting on its own exception list |

`~25-item statute-lint tail`: a live grep of open/active items tagged `statute-lint` returns **11**, not ~25.
Recorded as a minor correction, same pattern as #1 above — the number that reproduces is smaller than the one
filed.

## 5. #3049 — the quota's landmine, not re-litigated here

[#3049](/backlog/3049-the-conveyor-as-a-shippable-product-not-machinery-and-what-t/) (open, capture-only) already
measured that the output-mix classifier — the very instrument #3010 names as its enforcement mechanism — scores
the conveyor, the review/jury engine, and the operation-declaration engine as `machinery`, while the operator's
own recorded framing (2026-08-09) calls the conveyor "itself a hugely valuable product." That finding is not
re-derived here; it is load-bearing for how #3010's Fork 2 (quota) should be shaped and is cited directly in the
item.

## Appendix — re-runnable

```bash
# output-mix re-run (table in §2)
node -e "import('./scripts/lib/output-mix.mjs').then(({computeOutputMix, ratioLabel}) => {
  const r = computeOutputMix({});
  for (const w of r.weeks) console.log(w.start, w.product, w.machinery, w.other, ratioLabel(w).text);
});"

# recent merged-PR census (§3)
gh pr list --repo chalbert/web-everything --state merged --limit 100 --json number,title,mergedAt \
  --jq '.[] | [.number,.mergedAt,.title] | @tsv' | sort -t$'\t' -k2

# open/active item count (§1)
grep -l '^status: open' backlog/*.md | wc -l
grep -l '^status: active' backlog/*.md | wc -l

# founding-figure grep (§1) — returns only backlog/3010-*.md
grep -rn '305\|~70% of the open board' backlog/*.md reports/*.md

# statute-lint tail (§4)
grep -l 'statute-lint' backlog/*.md | xargs grep -l '^status: open\|^status: active' | wc -l
```
