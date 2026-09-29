---
bornAs: x58f8u5
kind: story
size: 2
status: resolved
scope: ["we:scripts/lib/open-pr-items.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
tags: []
---

# Resolve-on-land misses items whose PR names the pre-number hash id

Twice on 2026-09-28/29 a delivered item stayed status active/open after its PR merged: #4391 (bornAs `4391`, PR #2885 titled `WE #4391: …`, flagged by the health daemon as stale-claim landed:4391) and #4464 (bornAs `4464`, PR #2924 titled `WE #4464: …` — still open, and the builder's dry-run then planned to BUILD it again). Both PRs name their card's pre-number HASH in the title (corrected round-1 review — both were misdescribed above by their eventual NNN, not the real title text); the drain JIT-numbers the card at land (e.g. commit 'drain: JIT-number 4464→#4464 …') and resolve-on-land looks for the number, not the bornAs. MVP: resolve-on-land in the drain (we:scripts/merge-ai-prs.mjs resolveOnLand step / we:scripts/lane-drain.mjs) matches a PR's delivered ref through bornAs as well as the number. Must: test with a hash-titled PR landing a JIT-numbered card; live proof: the next hash-titled delivery resolves on land.

## Design

Both real cases cited above share the identical shape: #4391's PR #2885 (`lane/gh-read-split-personal`,
title `WE #4391: route gh reads to the operator's personal identity, writes stay on the App`) and #4464's
PR #2924 are both a descriptive (non-hash) lane ref with the card's pre-number hash named only in the
title's lead position — round-1 review confirmed this by reading both PRs' real `headRefName`/`title`, not
just #2924's. One fix covers both.

Root cause traced to a real merged PR (#2924, card 4464/#4464): its ref is a plain descriptive slug
(`lane/builder-cap-own-builds`, no hash) and its title leads with the hash the numeric convention already
uses for numbers — `WE #4464: builder cap counts only its own builds` — but the PR's own diff never
touches the backlog card file at all (the producer never self-resolved it). `deliveredHashFromPr`
(`we:scripts/lib/open-pr-items.mjs`) only ever reads the hash from the REF's lead segment
(`/^x[0-9a-z]{6}$/.test(refLead)`); `deliveredItemNumsFromPr`'s own title-lead matcher
(`leadTitleMatch`) only matches digits (`\d{2,5}`), never the `x[0-9a-z]{6}` hash shape. So a PR that
names its card's pre-number hash in the TITLE's lead position, with an ordinary (non-hash) ref, is
invisible to every extractor: `base` (digits) is empty, `deliveredHashFromPr` returns null (ref has no
hash), and `declaredResolvedIdsFromPr`'s ride-along hash signal only reads a hash from a PARENTHESIZED
title group or a body bold/heading line — never a bare title-lead `#<hash>:` marker. The card never enters
`landedThisPass` and resolve-on-land silently skips it.

## MVP

Teach `deliveredHashFromPr` to also read a title-lead hash marker — `/^\s*(?:WE\s+)?#(x[0-9a-z]{6})\s*:/i`,
the exact hash-shaped mirror of `deliveredItemNumsFromPr`'s existing numeric `leadTitleMatch` — and use it
as the `lead` whenever the ref itself carries no hash (the ref-lead hash, when present, still wins —
unchanged pre-existing behaviour). Everything downstream (the `landedNumberFor`-first check, the
changed-file scaffold-refile fallback, `hashLed`/`landedIdsForCandidate`/`planResolveOnLand`'s hash→NNN
re-keying) is already correct and untouched — once `lead` resolves to the right hash, `landedNumberFor`
finds the `bornAs:` record on `origin/main` (already present for #4464) and returns the NNN directly,
never reaching the scaffold check. No caller-signature changes; no changes to `we:scripts/merge-ai-prs.mjs` or
`we:scripts/lane-drain.mjs` (scope corrected above to the one file this narrows to).

## Test plan

Unit test in `we:scripts/lib/__tests__/open-pr-items.test.mjs` (the existing suite `deliveredHashFromPr` is
already covered in — corrected path, round-1 review: `deliveredHashFromPr` lives under `scripts/lib/`, not
`scripts/`): a PR with `headRefName: 'lane/builder-cap-own-builds'` (no hash) and
`title: 'WE #4464: builder cap counts only its own builds'` — mirrors PR #2924 exactly. RED before the
fix: `deliveredHashFromPr(...)` returns `null`. GREEN after: returns the hash (or, with a
`landedNumberFor` stub returning a NNN, the numbered id) — matching the real PR's shape. Round-1 review also
added: an anchor test (a hash-shaped `#<hash>:` token NOT in the lead position must still return `null`) and
a whole-PR-guard test (a non-delivery all-`.md` diff must still return `null` even with a title-lead hash).

## Proof plan

Live replay: call `deliveredHashFromPr` (and the higher-level `landedIdsForCandidate`) with PR #2924's
REAL `headRefName`/`title`/`changedFiles` (fetched via `gh pr view 2924`) and the REAL `landedNumberFor`
(reads `origin/main`'s `bornAs: 4464` record on `we:backlog/4464-...md`, still present) — before the
fix: returns nothing (card not matched); after the fix: returns `4464` (matched). No mutation to `main` or
the card — a read-only scratch replay, not a real drain pass.

## Follow-ups

None filed — the ride-along signal (`declaredResolvedIdsFromPr`'s parenthesized/bold hash markers) and the
digit-lead title convention are unaffected and out of this MVP's scope.

## Done when

1. **Executable** — a unit test asserting `deliveredHashFromPr('lane/builder-cap-own-builds', 'WE #4464: builder cap counts only its own builds')` returns a non-null hash fails before this item lands and passes after.
