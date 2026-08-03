---
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
tags: [review, mandate, drain, jury]
relatedTo: ["2450", "2457", "2439"]
scope:
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:skills-src/jury/resolve-roster.mjs
---

# Thread the panel-mandate review context through the remaining mandate composers

`we:scripts/review-core-cli.mjs`'s `buildMandateText()` calls `buildPanelMandate({ lens })` with
neither #2450's `netChangedFiles` ground truth nor #2457's `crossRepoCouple` flag, so a reviewer
seeded through the CLI seam still false-positives on both classes the library already prevents: a
landed sibling-lane file read as scope creep, and a symbol the couple's other half adds read as
undefined. A fourth composer at `we:skills-src/jury/resolve-roster.mjs` is un-threaded the same way.
The library builders take both params and are additive, so this is pure plumbing plus the CLI flags
to carry them, and their tests.

## The composers

`buildMandate` has four composers on top of it. Two are threaded, two are not:

| composer | `netChangedFiles` | `crossRepoCouple` |
| --- | --- | --- |
| `buildPanelMandate` (`we:scripts/lib/review-core.mjs`) | ✅ #2450 | ✅ #2457 |
| `buildValidatorMandate` (`we:scripts/lib/review-core.mjs`) | ❌ | ✅ #2457 |
| `buildMandateText` (`we:scripts/review-core-cli.mjs`) | ❌ | ❌ |
| the roster seam (`we:skills-src/jury/resolve-roster.mjs`) | ❌ | ❌ |

`buildValidatorMandate` got `crossRepoCouple` in #2457 because it is the #2439 independent
joint-accept gate — blind to the negotiation, so without the flag it re-raises the very cross-repo
false positive the panel just resolved, as the finding that blocks the land. It still lacks
`netChangedFiles`, which is the same argument one gate over: the validator can report phantom scope
creep that no panel round ever saw.

## Why it was split out rather than folded in

#2450 and #2457 each threaded the composer that carried their own observed incident. Closing the
CLI seam for one param and not the other would be incoherent, and threading both at once is a
distinct, mechanical change with its own tests — so it is one item covering every remaining
composer rather than a trailing half of either.

## Definition of done

- `buildMandateText` accepts and forwards both params, with CLI flags to supply them
  (a repeatable `--net-changed-file`, or a JSON input, matching the seam's existing input style;
  a boolean `--cross-repo-couple`).
- `buildValidatorMandate` also forwards `netChangedFiles`.
- The `we:skills-src/jury/resolve-roster.mjs` seam forwards both.
- Additivity is preserved everywhere: omitting the params leaves each mandate byte-for-byte
  unchanged, asserted per composer.
- A drift oracle: a test that FAILS when a new composer on `buildMandate` forgets to forward them,
  so the next composer cannot silently repeat this.
