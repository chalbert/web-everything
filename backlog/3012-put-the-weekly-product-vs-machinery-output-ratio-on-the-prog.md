---
bornAs: xzgt6zd
kind: story
size: 2
status: resolved
dateOpened: "2026-08-08"
dateResolved: "2026-08-09"
graduatedTo: "we:scripts/lib/output-mix.mjs"
relatedTo: ["2606", "1855", "3010"]
tags: [progress-board, metrics, throughput, governance]
---

# Put the weekly product-vs-machinery output ratio on the progress board

Add one standing number to the progress board: lines added this week to product code versus lines added to
delivery machinery and backlog bookkeeping, with the last four weeks beside it. The 2026-08-08 delivery
review measured the slide at product +1,699 → +705 → +480 → +147 lines/week while machinery grew to
+38,000/week — a month-long trend nothing on the board surfaced. This metric makes the drift visible the
week it starts, so it costs one glance instead of an audit.

## The measurement

Derivable from git alone, so the board generator can compute it mechanically:

- **Product** = lines added under `we:src/`, `we:blocks/`, `we:demos/`, `we:tests/`.
- **Machinery + bookkeeping** = lines added under `we:scripts/`, `we:tools/`, `we:.claude/`,
  `we:docs/agent/`, plus `we:backlog/`.
- A small "other" remainder is excluded from both.

Render the current week's two numbers and a four-week mini-trend on the board (the generator the
progress-board item 3022 builds, in flight as PR #1101). No new data store — `git log --numstat` over
the merged history is the source.

## What was built, and what the number actually is

The classifier is `we:scripts/lib/output-mix-paths.json` — an ordered, first-match-wins path-pattern list
where every rule carries a one-line `why`, so disagreeing with the number means editing one rule, never
patching a script. The derivation is `we:scripts/lib/output-mix.mjs`; the board renders it as its *Output
mix* section. Weeks are ISO weeks (Monday 00:00 **UTC**), and commit days are read on the same UTC clock, so
the four completed weeks have frozen boundaries and re-run identically for anyone on the same commits.

Extensions beyond the list above, each because it is the same machinery under a different name:
`we:skills-src/` (`.claude/skills` is a symlink to it), `we:agent-memory-src/`, `we:.github/`,
`we:.githooks/`. Stated treatments: test lines count **with the thing they test** (`scripts/__tests__/` is
machinery, `tests/` is product); generated files, lockfiles and vendored code are **`other`**, never product
or machinery, since nobody authored those lines; `we:reports/` is `other` by an explicit rule rather than by
omission. The `other` remainder is **rendered**, so a reader can see how much of the tree the two headline
numbers do not cover. A follow-up on 2026-08-09 widened **product** past the four directories asked for
above, to the standard's own declarations as well — see *The product number is STILL a LOWER BOUND* below;
the current table is the first one under this heading.

**CURRENT — measured 2026-08-09 at `7c3dbb83`** with the classifier as it stands after the follow-up that
ruled the standard's own declarations `product` (see the LOWER BOUND section below). This is the table to
quote:

| Week from | Product | Machinery | Other | Ratio |
| --- | --- | --- | --- | --- |
| 2026-07-06 | +1,510 | +29,901 | +2,493 | 19.8× |
| 2026-07-13 | +1,909 | +13,671 | +965 | 7.2× |
| 2026-07-20 | +399 | +26,553 | +796 | 66.5× |
| 2026-07-27 | +627 | +36,373 | +731 | 58.0× |
| 2026-08-03 (partial) | **+0** | **+48,641** | +1,014 | no product at all |

**SUPERSEDED — measured 2026-08-09 at `cf6730a3`** (product → machinery, added lines/week), by the rule list
AS FIRST COMMITTED — before the `we:docs/**` and `we:.lane-manifest.json` rules added in review (so the
machinery column understates by +1,144 / +1,033 / +26) and before the declaration rules above (so the
product column understates by +404 / +26 / +193 / +0 / +0). Kept for the audit trail:

| Week from | Product | Machinery | Other |
| --- | --- | --- | --- |
| 2026-07-06 | +1,106 | +28,757 | +4,041 |
| 2026-07-13 | +1,883 | +12,638 | +2,024 |
| 2026-07-20 | +206 | +26,553 | +989 |
| 2026-07-27 | +627 | +36,347 | +757 |
| 2026-08-03 (partial) | **+0** | **+47,023** | +1,014 |

The four completed rows re-derive exactly under an independent pipeline (human-readable `--numstat`, own
rename parse, own transcription of the rules). The partial row is the one that moves: it was published as
`+47,014`, 9 lines short of what the committed script yields at the stated SHA, and it grows with every
commit — at `72b93534` the same script reads `+47,902`. Read the completed weeks, not the partial one.

**The quoted `+1,699 → +705 → +480 → +147` did NOT reproduce, and is recorded here as unreplicated.** No
`2026-08-08 delivery review` exists under `we:reports/`; the figure appears only in this card and in #3010,
with no derivation behind it. Re-derivation was attempted across the natural variants — ISO weeks and
rolling 7-day windows, author date and committer date, all-commits and `--first-parent`, anchored at
2026-08-07/08/09 — and none produced the quartet. The classifier was deliberately **not** tuned toward it.
What *does* reproduce is the review's claim: product output has collapsed (roughly +1,100–1,900/week a month
ago to **zero** so far this week) while machinery climbed past +47,000/week, above the quoted +38,000.

Product in this repo is **real but small**, not empty: `we:src/` (the spec data plus the 11ty site that
renders it), `we:blocks/`, `we:demos/`, `we:tests/`. Per constellation rule 1 WE holds zero standard
*implementation*, so the product surface here is definitions and the site over them — which is why it can
credibly sit at +0 for a week while the machinery does not.

## The product number is STILL a LOWER BOUND — but a much smaller one now

**Ruled 2026-08-09** on the operator's direction — *"for WE contracts and similar are the main product, but
the website is in some ways a product too."* The website already counted; the standard's own **declarations**
did not. They do now. The test the rule list encodes (`conventions.productScope`) is *does it cross the
seam?* — is it part of what WE ships to Frontier UI and to any other implementor.

Ruled `product` in that follow-up, **44 directories**: the four real `@webeverything/*` packages
(`we:contracts/` with its **35** subpath exports and publish workflow, `we:capability-manifest/`,
`we:webcases/`, `we:validation-generation/`); the capability + conformance substrate (`we:capabilities/`,
`we:conformance-vectors/`, `we:conformance-evidence/`, `we:wrapper-conformance/`); and the **36 per-domain
declaration trees** (`we:intl/`, `we:guard/`, `we:webtheme/`, `we:permissions/`, `we:positioning/`,
`we:realtime/`, …). Plus three **declaration-shape** rules — `we:**/contract.ts`, `we:**/*-contract.ts`,
`we:**/*.vectors.ts` — so a NEW domain's contract counts from the day it is written, not the day someone
remembers to add a directory rule. That is 21,425 tracked lines moved from `other` to `product`, and
+404 / +26 / +193 / +0 / +0 added lines across the five measured weeks.

**Be exact about the evidence for those 36**, because it is the load-bearing claim and an earlier draft
overstated it. 31 of the 36 hold a file of the `we:**/contract.ts` or `we:**/*-contract.ts` shape; **18**
carry the sentence "can become the `@webeverything/contracts/<x>` entry that FUI depends on (the FUI→WE
arrow), superseding byte-replication" verbatim. The other 18 do not say it, and five —
`we:error-summary/`, `we:interaction-state/`, `we:module-resolution/`, `we:source-resolution/`,
`we:webtraits/` — hold no contract file at all. They are dependency-free models and resolvers ruled on the
seam test itself, and #1294 (open) argues WE-resident logic of exactly that kind should relocate to FUI.
Reasonable to call `product`; not evidenced by a self-description, so an operator reversing any of those
five is disagreeing with a judgement, not a fact.

**The earlier projection was close but high.** It gave +1,591 → +1,909 → +427 → +627 → +0 for a *fully*
widened definition; the measured result is **+1,510 → +1,909 → +399 → +627 → +0**, the difference being
exactly the 81 and 28 lines in directories left unruled below. **The headline finding survives:** machinery
is still 19.8× / 7.2× / 66.5× / 58.0× product across the completed weeks — above 20× in three of the four,
and 7.2× in the week of 2026-07-13, which was already the outlier under the published numbers (it read 7.3×
there, so the corrected classifier does not change that week's story) — and the current week is still **+0
product**.

**Eight directories remain unmatched** and still fall to `other`: `we:audits/`, `we:config/`,
`we:design-refs/`, `we:design-systems/`, `we:eleventy/`, `we:functions/`, `we:site/`, `we:test-pages/` —
5,245 tracked text lines, and 81 / 0 / 28 / 0 / 0 added lines over the five weeks. So `product` is still a
lower bound and the ratio still an upper bound, by tens of lines a week rather than hundreds. (The 38,852
figure quoted for the old gap counted newline bytes in binary screenshot assets under `we:design-refs/` —
8,644 such bytes. The comparable text-line figure is 26,670, which reproduces exactly; the crude
newline-byte count over that same old scope comes to 38,953, so 38,852 does not reproduce precisely either
way and should not be re-quoted.)

**The shape rules do not protect what has no rule.** Ordering them below the machinery block and
`we:reports/**` defends every tree that HAS a rule — but not the eight below. `we:eleventy/x/contract.ts`
would score `product` today even though the rule list's own `productScope` calls 11ty build config
machinery. The exposure is currently **empty** — zero tracked files and zero paths in the five measured
weeks are classified by a shape rule — and it is now pinned by two tests (`pins where the shape rules still
reach` and `keeps that exposure empty`), so it cannot start counting without a visible diff.

**Two of the eight are live questions, not settled `other`,** and both would be `product` under the stated
test — left unruled deliberately for the operator:
- `we:config/` is **not build config**. `we:config/resolverContract.ts` says "WE keeps the interface +
  vectors; FUI keeps the runtime", and `we:config/defineConfig.ts` is the `webeverything.config` author
  surface (#1702, ratifying #1662). It escaped the shape rules only because its filename is camelCased
  rather than hyphenated. 417 tracked lines.
- `we:design-systems/` describes itself as "WE-owned data, not scorer code" (#871/#747/#2113) — the flavor
  manifests, token sets and grammar checklists the FUI-side scorer grades against. 641 tracked lines.

The other six read delivery-side or stale: `we:audits/` (write-ups, like `we:reports/`), `we:design-refs/`
(brand reference screenshots for the mark loop), `we:eleventy/` (11ty build config), `we:functions/` (the
Cloudflare deploy gate, #1137), `we:site/` (a README), `we:test-pages/` (E2E pages importing the deleted
vendored `we:plugs/`).

## The bias is no longer purely one-way — the biggest open call is inside `we:src/`

Recorded in review of the widening. Everything above makes `product` a **lower** bound. There is now a
counter-bias of larger size running the other way, and it predates this revision:
`we:src/_includes/research-descriptions/` is `product` via the `we:src/**` rule, but it holds write-ups
**about the delivery loop** — per-lane ownership signals, delivery-coordinator placement, the headless agent
runner contract, review gating — published as `/research/` pages. That is the same genre as `we:reports/`,
which is explicitly `other`.

| | 07-06 | 07-13 | 07-20 | 07-27 | 08-03 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `we:src/_includes/research-descriptions/` | +506 | +808 | +72 | +369 | +0 |
| everything this revision added | +404 | +26 | +193 | +0 | +0 |
| total `product` | +1,510 | +1,909 | +399 | +627 | +0 |

39% of every `product` line in the window, and **42% of the 2026-07-13 week that reads 7.2×** — the one week
the headline nearly clears the bar. Classing it `other` (as `we:reports/` is) would take that week to roughly
12.4×, i.e. the "above 20× in three of four" story becomes "above 10× in four of four". **Operator call, not
taken here:** is a write-up about the loop still `product` because the product site renders it? Whichever
way it goes, the figure should not be quoted for #3010 without this paragraph.

`rule-list coverage over the real tree` in `we:scripts/lib/__tests__/output-mix.test.mjs` pins that
eight-directory list **and** requires `conventions.knownGap` to name every entry, so a new uncovered
directory fails loudly and any further ruling must shrink both in the same diff. Also still left to the
operator: whether `we:reports/` is `other` (as committed) or machinery — reports are written by the delivery
loop about the delivery loop, and moving them adds ~+1,000/week to machinery.

## Why on the board and not a report

The board is the one surface the operator already reads daily. #2606 (the throughput program) tracks
latency; this is the missing *output-mix* axis. It is also the enforcement instrument for the process-work
freeze / product-quota decision (#3010): a quota nobody can see is a quota nobody keeps.
