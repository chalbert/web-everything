---
bornAs: xw7fsys
kind: story
size: 1
status: resolved
scope: ["we:scripts/lib/probation-launcher.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# probation-launcher frontmatterBlock: accept CRLF line endings

Advisory follow-up from PR #2867 (WE #4291): we:scripts/lib/probation-launcher.mjs's `frontmatterBlock` regex
matches LF only, so a CRLF card fails open (cited by symbol, not line — this same PR shifts the line number by
adding doc comments above it). MVP: accept \r?\n. Must: test with a CRLF fixture.

**Scope correction (prepare pass, 2026-09-29):** the card's original `scope:` named
`we:scripts/operations/probation-launcher.mjs`, which has never existed. The real file is
`we:scripts/lib/probation-launcher.mjs` (the `frontmatterBlock` symbol lives there). Same file the bug report
describes, same single-function fix — corrected in place rather than treated as a not-ready stop.
**Correction (converge round 1, red-team + panel, claim-accuracy lens):** `frontmatterBlock` is a
module-private, non-exported `function` — it is not itself imported anywhere. Its one caller,
`frontmatterTamperedBeyondClaim` (which IS exported), is what `we:scripts/operations/probation-heal-run.mjs`
and `we:scripts/operations/probation-build-run.mjs` actually import.

## Design

`frontmatterBlock(raw)` extracts a card's `---\n...\n---\n` frontmatter block with
`/^---\n([\s\S]*?)\n---\n/`. A card saved with CRLF (`\r\n`) line endings never matches this LF-only regex, so
the function silently returns `''` — and its one caller, `frontmatterTamperedBeyondClaim`, then treats BOTH
sides of the diff as having no frontmatter (`strip(before) === strip(after) === ''`), so it reports
"not tampered" even when a non-owned field (e.g. `scope:`) actually changed. A CRLF card's frontmatter is
therefore invisible to the tamper check — it "fails open" exactly as the card says. Fix: accept either line
ending in the same regex — `/^---\r?\n([\s\S]*?)\r?\n---\r?\n/` — so a CRLF-saved card's frontmatter block is
extracted identically to an LF one.

**Second bug, found by this PR's own converge round (security lens, red-team, predicted from the diff before any
code ran):** widening `frontmatterBlock` alone is not sufficient. `frontmatterTamperedBeyondClaim`'s own `strip`
helper splits the extracted block on `'\n'` alone, which leaves a trailing `\r` on every CRLF line except the
block's last — so adding or removing an *allowed* key's line (e.g. a `claim` stamping `dateStarted`) shifts
*which* line is last, and therefore which lines carry that stray `\r`. `strip(before) !== strip(after)` then
fires on the `\r` alone, flagging a legitimate CRLF claim/resolve as tamper (a false positive on the opposite
side of the same coin). Fixed by splitting on `/\r?\n/` instead of `'\n'`, so CRLF and LF line endings are
normalized out of the comparison the same way `frontmatterBlock` now normalizes them at extraction. A bare
lone-`\r` (old-Mac-style) line ending is a separate, pre-existing gap this fix does not touch — filed as its own
follow-up below.

## MVP

**Must (this PR):**
- Widen `frontmatterBlock`'s regex to accept `\r?\n` at both the opening and closing `---` delimiters (and after
  the closing one), so CRLF and LF frontmatter parse identically.
- Normalize `frontmatterTamperedBeyondClaim`'s internal `strip` to split on `/\r?\n/`, not `'\n'` — otherwise a
  CRLF card still false-positives on a legitimate allowed-key-only change (see Design).
- Reproduction tests that fail before each fix and pass after:
  - a CRLF-formatted before/after pair where a non-owned field (`scope:`) changes — pre-fix,
    `frontmatterTamperedBeyondClaim` wrongly reports `false` (fails open); post-fix it reports `true`.
  - a CRLF-formatted before/after pair where only an *allowed* field changes (adds `dateStarted`, matching a
    real `claim`) — pre-first-fix-only, it wrongly reports `true` (false positive from the stray `\r`);
    post-second-fix it reports `false`.

**Not in this MVP (out of scope):** any other CRLF-sensitivity elsewhere in the backlog toolchain (e.g.
`we:scripts/backlog/frontmatter.mjs`'s own parser) — untouched here; only the one function-pair this card names.

## Test plan

- Two new tests in `we:scripts/lib/__tests__/probation-launcher.test.mjs`, alongside the existing
  `frontmatterTamperedBeyondClaim` describe block, both CRLF-joined (`\r\n` throughout):
  1. a changed `scope:` line — **fails before the regex fix** (asserts `true`; the unfixed code returns
     `false` — verified live, see Proof plan) **passes after**.
  2. an added `dateStarted:` line only (an allowed key) — **fails before the `strip` normalization fix**
     (asserts `false`; the regex-only fix returns `true` — verified live, see Proof plan) **passes after**.

## Proof plan

Live before/after via the new tests, run directly with vitest (and by `node -e` calling the functions directly)
against the unfixed then fixed source for each of the two bugs above — not just inferred from a green gate —
reason and output trimmed into the PR body.

## Follow-ups

One filed: **we:backlog/4510** — a lone-CR (`\r`-only, old-Mac-style) line ending inside an allowed-key
line still slips past `frontmatterTamperedBeyondClaim` uncaught. Pre-existing (predates this PR; neither
introduced nor worsened by it — surfaced live by this PR's own converge red-team, security lens, carve-out
disposition), and out of this item's MVP (CRLF only). Everything else stays fully contained to
`frontmatterBlock` and its one exported caller.

## Done when

1. **Executable** — from the repo root:
   ```bash
   npx vitest run scripts/lib/__tests__/probation-launcher.test.mjs
   ```
   (`we:scripts/lib/__tests__/probation-launcher.test.mjs` is this repo's own alias for the same file — the
   `we:` prefix is a scope/citation notation, not a literal path; drop it to actually run the command.) Both new
   CRLF tests fail on unfixed `we:scripts/lib/probation-launcher.mjs` and pass once (a) the regex accepts
   `\r?\n` AND (b) `frontmatterTamperedBeyondClaim`'s `strip` splits on `/\r?\n/` — the regex fix alone leaves
   the second (allowed-key-only) test red.
