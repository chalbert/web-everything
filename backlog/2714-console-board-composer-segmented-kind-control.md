---
bornAs: xpawa1p
kind: story
size: 2
parent: "2555"
status: resolved
dateOpened: "2026-07-27"
dateStarted: "2026-07-31"
dateResolved: "2026-07-31"
tags: [plateau-loop, console, console-board, composer, new-work, canonical-2554, slice-2555]
---

# Console board new-work composer conforms to the canonical §6/#2554 face

**Reversed 2026-07-28.** The original story chased the v68 mock and proposed *removing* the very controls the
canonical §6/#2554 composer ratifies — replacing the `KIND` dropdown with a segmented toggle and moving `size`
off the composer face. The committee found the direction inverted: the canonical composer **keeps** the KIND
`<select>` dropdown (default "story") and shows a two-up `size + blockedBy #` row. So the reworked build's
dropdown + size is *canon-correct*; this story now conforms the composer to canon rather than regressing it.

## Canonical composer face (the target)
- Hint line: **"files a born-open item"**.
- **`KIND` dropdown** (`<select>`, default "story") — **not** a segmented toggle (`composer-fields`).
- **Title** field — "short, reviewable".
- **Two-up row: `size` + `blockedBy #`** — both visible in the first-glance face (`composer-fields`).
- **Create draft** button.
- Footer: **"files via lane → PR · never writes main"** (`composer-lane-pr-foot`).

## Scope
- Assert the composer renders the canonical face above (dropdown default "story", in-face size + blockedBy
  two-up, the hint + footer strings).
- Keep the lane→PR filing wiring intact (never writes main) and verify the footer copy is present.
- **If the segmented story/epic/decision toggle is still genuinely wanted**, refile it as a NEW decision to
  amend the canonical `composer-fields` spec — it changes the ratified grammar, so it is not a convergence
  bugfix.

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` new-work composer render.

## Acceptance
The composer's first-glance face matches the **ratified** §6/#2554 composer grammar (the `composer-fields` +
`composer-lane-pr-foot` specKeys): KIND dropdown (default "story"), Title, two-up size + blockedBy, Create
draft, the "files a born-open item" hint and "files via lane → PR · never writes main" footer. This is a
structural/spec assertion against the ratified grammar (not a pixel diff against v68
`plateau-app:tests/visual/baselines/board.png`), so it is checkable now and does not wait on the [#2796]
baseline flip. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.

## Delivered
STEP 0 audit found the KIND control was already the ratified `<select>` dropdown (default "story") — no
segmented toggle was ever built, so nothing to revert there. The genuine gap: the in-face two-up row paired
`parent` + `blockedBy` instead of `size` + `blockedBy #`. Fixed in `plateau-app:src/backlog-view/composer.ts`
(moved `size` into the two-up row, demoted `parent` to its own row below) + a new structural assertion test in
`plateau-app:src/backlog-view/composer.test.ts` locking the canonical face in place. Verified both themes on a
scratch dev port screenshot (never touched the running :4000 server). `plateau-app` PR #120.
