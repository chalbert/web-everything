---
bornAs: xfc0tcf
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/backlog/scaffold.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/backlog/__tests__/scaffold.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "cd16b4fa0c7372840c6813a868b005fcb54ed834"
tags: []
---

# Prevention — Add a card-template Must line for any change that tightens a verdict on an externally sourced set. It s… (from chalbert/web-everything#3424 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4958-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md:28` — Add a card-template Must line for any change that tightens a verdict on an externally sourced set. It should require one test per provenance value (`live`/`cache`/`stale-cache`/`fallback`). A lens check that greps for `source:` handling would also catch it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3424@641b380b6bbe21000b084ea18581cf9f60ca3b17

## Progress

Preparation, 2026-10-03, against `origin/main` cd16b4fa.

- **Premise check:** not delivered. `git log -S 4810` finds nothing. No rule in `we:scripts/check-standards-rules.mjs` or `we:scripts/backlog/scaffold.mjs` mentions provenance or `stale-cache`; the only repo hit for the four values is the `source` union in `we:scripts/lib/required-status-checks.mjs:122` (plus its consumers), which is the set the guard protects.
- **Old scope / citation:** the card's scope pointed at the *cited* card `4958` (resolved, so no longer a place to land work), and the citation `4958…md:28` is a line in that card, not in the code. **Corrected scope:** the card-authoring lint and scaffold hint, where the sibling guard #4409 already lives (`we:scripts/check-standards-rules.mjs:964-989`, `we:scripts/backlog/scaffold.mjs:16-17`), plus their two test files. Goal unchanged.
- **Template reality:** there is no separate card-template file. The "template" is `renderItem`'s `## Done when` skeleton (`we:scripts/backlog/scaffold.mjs:113`) and the warning-only prose lint wired in `lintBacklogItemRendering` (`we:scripts/check-standards-rules.mjs:1228-1236`). The #4409 guard is the exact precedent: hint line in the skeleton + `findGuardRelaxationGaps` + a WARNING.

## Design

Mirror #4409 one-for-one.

1. **Lint (`we:scripts/check-standards-rules.mjs`, next to `findGuardRelaxationGaps` at :972).** Add `findProvenanceVerdictGaps(body)`. It scans the same region (card top, before `## Design`/`## Test plan`/`## Progress`, outside fences, scaffold hints stripped) and triggers when one sentence holds a tightening word (`tighten*`, `stricter`, `harden*`) AND an external-set word (`externally sourced`, `cache`, `fetched`, `provenance`, `required checks`). When triggered it returns one `{ kind: 'missing-provenance-case', detail }` per provenance value (`live`, `cache`, `stale-cache`, `fallback`) not named as a word in the region. Warning only, open/active cards only, as for #4409 (the resolved corpus predates the rule).
2. **Wiring.** Call it in `lintBacklogItemRendering` beside the #4409 block (:1228) and push one WARNING that names the missing values and says: add a Must line requiring one test per provenance value.
3. **Template line.** Export `PROVENANCE_VERDICT_HINT` from `we:scripts/backlog/scaffold.mjs` and emit it under `## Done when` after `GUARD_RELAXATION_HINT` (:113). The lint strips this exact line before scanning, so a hint left in place can neither trigger nor satisfy it.
3a. **Matcher and region (review findings).** Each value is matched with `(?<![\w-])value(?![\w-])`, so `stale-cache` does NOT satisfy `cache` (a plain `\bcache\b` would, since `-` is a boundary). The scanned region ends at `## Design`/`## Test plan`/`## Progress`, as in #4409, so the required Must line must sit in the card top, digest or `## Done when`, not under `## MVP` after a `## Design`; this is a known limitation shared with #4409, accepted for the MVP. The trigger words `cache`/`fetched` are broad ("tighten the cache TTL" triggers); that noise is accepted because the rule only warns.
4. **Value set.** The four values come from the card's own ask. `declared` and `unavailable` also exist in the union at `we:scripts/lib/required-status-checks.mjs:122`; they are left to a Follow-up so the MVP stays the operator's stated rule.

## MVP

**Must**

1. `findProvenanceVerdictGaps` in `we:scripts/check-standards-rules.mjs`, with the trigger and per-value gaps above.
2. WARNING wired in `lintBacklogItemRendering` for open/active cards only.
3. `PROVENANCE_VERDICT_HINT` emitted in the `renderItem` skeleton and stripped by the lint.

**Out of scope (see Follow-ups):** deriving the value set from the module's union, a review-lens line, auto-checking that the named tests exist, retro-warning resolved cards.

## Test plan

All in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` unless noted; each fails RED before the change because the function and warning do not exist (import error / no warning).

- **capability — triggering card names no values:** "Tighten the verdict on the cached required-check set." returns four `missing-provenance-case` gaps.
- **capability — partial coverage:** the same card with a Must naming `live` and `cache` returns exactly `stale-cache` and `fallback`. (`cache` must not be satisfied by `stale-cache` alone; word-boundary matching is asserted.)
- **capability — full coverage:** all four named in a Must line returns `[]`.
- **preservation — non-tightening card:** "Add a retry loop to the fetcher." returns `[]` (green on the base too: no function) — mutation proof: dropping the trigger-word requirement makes this fail.
- **preservation — Design/Progress prose not scanned, fenced text neither triggers nor satisfies:** mirrors the #4409 fence cases. Mutation proof: removing the `## Design` break or the fence skip makes the Design-prose and fenced-value cases fail.
- **preservation — dogfood:** this card's own top region returns `[]` (it names all four values); mutation proof: loosening the matcher to `\bcache\b` is covered by the partial-coverage case, and deleting the four values from this card's top makes it fail.
- All new `describe`/`it` names include `4810` so `npx vitest run -t 4810` selects them.
- **capability — fresh scaffold:** a scaffolded tightening card warns; a scaffolded non-tightening card does not (hint line stripped; `we:scripts/backlog/__tests__/scaffold.test.mjs` also pins the hint text verbatim).
- **capability — `lintBacklogItemRendering`:** warns for `status: open`, silent for `resolved`.

## Proof plan

1. Before: on `origin/main`, run `npx vitest run -t 4810` — the new cases fail (import/undefined). Record the output in `## Progress`.
2. After: same command passes; `npm run check:standards` exits 0 (warning-only rule, no new errors).
3. Live probe on a real surface: run the lint over the current body of card `4958` and over this card via a one-line `node -e` calling `findProvenanceVerdictGaps` on each body; show that a tightening card lacking the four values warns and one naming them does not. Report before/after counts of the new warning across `backlog/` open cards from `npm run check:standards`, so noise is visible.

## Follow-ups

- Derive the value set from an exported constant for the `source` union in `we:scripts/lib/required-status-checks.mjs`, adding `declared`/`unavailable`, so the lint cannot drift from the code.
- A review-lens checklist line for "greps for `source:` handling" (the card's second suggested guard).
- Check that a Must's named tests exist in the Test plan, one per value.

## Done when

1. **Executable** — `npx vitest run -t 4810` fails before this lands and passes after (Musts 1-3), and `npm run check:standards` exits 0.
2. **Must on error** — Musts 1-2: the lint is warning-only and pure; unparseable or empty body returns no gaps rather than throwing, and never turns a card red.
3. **Must for every change kind** — Must 1: the trigger applies to any card prose regardless of whether it changes source, docs, config or data; no kind-based exemption.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
