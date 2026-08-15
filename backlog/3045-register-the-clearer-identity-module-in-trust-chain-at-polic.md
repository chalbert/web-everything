---
bornAs: x1hptjt
kind: story
size: 2
status: open
dateOpened: "2026-08-09"
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
  - we:scripts/lib/__tests__/gate-invariants.test.mjs
  - we:scripts/lib/review-independence.mjs
tags: [gate, review, trust-chain, policy-tier, review-independence]
---

# Register the clearer-identity module in TRUST_CHAIN at policy tier — its cited blocker PR #1098 is closed

`we:scripts/lib/review-independence.mjs` decides **who may clear the review gate**, which is `policy` tier by
[we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs)'s own definition — yet it is absent from the
`TRUST_CHAIN` roster, so an edit to it escalates but does not force `review:human`. Its own header calls this
an owed follow-up and names the reason it was deferred: a concurrent change, PR #1098, held the roster.
**PR #1098 is CLOSED, not merged**, so that blocker no longer exists — see the re-verification below, which
also explains *why* it was safe to close rather than leaving a real gap.

## Decided design

Register `we:scripts/lib/review-independence.mjs` in `TRUST_CHAIN` as `{ role: 'clearer-identity', tier: 'policy', leash:
'spec', homes: ['we:scripts/lib/review-independence.mjs'] }`, and delete the now-stale "NOT YET TRUST-CHAIN
REGISTERED" paragraph from its header. `leash: 'spec'`, not `'code'`, is the load-bearing choice — see
"Why `leash: 'spec'`, argued independently" below. This is not a menu; the reasoning below rules out `'code'`
on the merits, not by preference.

## Re-verified state (live code + GitHub, 2026-08-15, in `lane-6` at `4148ec38`)

Every factual claim below was re-run against the live tree, not copied from the original capture card.

- **PR #1098**: `state: CLOSED`, `closedAt: 2026-08-08T14:40:00Z`, `mergedAt: null` (`gh pr view 1098`).
  Confirmed closed, confirmed not merged.
- **Why it was safe to close, not just "closed" — new finding this pass.** #1098's own body ("narrow
  review:human to the declarative leash… Arm A + Arm B") describes exactly the `leash: 'spec'/'code'` split
  that is live in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) today (`POLICY_LEASH`,
  `POLICY_SPEC_BASENAMES`, `RATIFIED_POLICY_SPEC_FLOOR`). `git log -S POLICY_LEASH -- we:scripts/lib/gate-config.mjs`
  finds it landed in commit `93f9fe7c`, titled *"narrow review:human to the declarative leash — Fork A only
  (#2785, #2573)"*. `gh api repos/chalbert/web-everything/commits/93f9fe7c/pulls` resolves that commit to **PR
  #1102** (`state: MERGED`, `mergedAt: 2026-08-08T14:38:20Z`, i.e. ~1m40s before #1098's `closedAt`
  `2026-08-08T14:40:00Z`). So
  #1098 was not abandoned mid-flight — its content shipped under **a different PR number** (a Fork-A-only
  resubmission), and #1098 was closed as superseded once #1102 landed. The roster #1098 was "holding" is the
  exact one this item edits, and it has been free since 2026-08-08.
- **#2844** (`we:backlog/2844-land-seam-refuses-a-self-cleared-verdict-and-an-invariant-an.md`): `status:
  resolved`, `dateResolved: "2026-08-08"`. Confirmed — the module this item registers exists because of #2844.
- **No open PR touches the roster today.** `gh pr list --state open` returns exactly 2 PRs (#1273, #1270);
  neither's file list includes `we:scripts/lib/gate-config.mjs`. No concurrency hazard.
- **The gap is live on the current tree, re-measured (not just cited from the card's prior run):**
  ```
  isPolicyCorePath('scripts/lib/review-independence.mjs')  → false
  isPolicySpecPath('scripts/lib/review-independence.mjs')  → false
  scoreEscalation({ changedFiles: ['scripts/lib/review-independence.mjs'], diffLines: 40 })
    → { escalate: true, humanRequired: false, careLevel: 'elevated',
        reasons: ['blast-radius (scripts/lib/review-independence.mjs)'] }
  ```
  (run via a throwaway script importing `we:scripts/lib/gate-config.mjs` / `we:scripts/lib/review-escalation.mjs`
  directly, then deleted — not committed).
- **The precedent mechanism was proven live, not just read.** `we:scripts/lib/review-runner-core.mjs` is the closest existing
  analog: a plain `.mjs` file, `tier: 'policy', leash: 'spec'`, registered under the same "no conformance
  backstop" argument this item makes (see below). Re-running the same probe against it today:
  ```
  isPolicySpecPath('scripts/lib/review-runner-core.mjs') → true
  scoreEscalation({ changedFiles: ['scripts/lib/review-runner-core.mjs'], diffLines: 10 })
    → { escalate: true, humanRequired: true, careLevel: 'high',
        reasons: ['blast-radius (…)', 'gate-self (…) — declarative leash, human review required'] }
  ```
  Confirms the exact registration shape this item proposes actually flips `humanRequired` in the live scorer,
  for a file structurally identical to the one this item registers (a `.mjs` module, not a JSON contract or a
  test file).
- **Baseline tests green before this change:** `we:scripts/lib/__tests__/gate-config.test.mjs` (8 tests),
  `we:scripts/lib/__tests__/gate-invariants.test.mjs` (39 tests), `we:scripts/lib/__tests__/review-independence.test.mjs`
  (23 tests) — 70/70 passing (`npx vitest run` on all three, 2026-08-15).

## What the module's header says

Read verbatim from [we:scripts/lib/review-independence.mjs](scripts/lib/review-independence.mjs) lines
54–60 on `main`:

```text
NOT YET TRUST-CHAIN REGISTERED, AND THAT IS AN OWED FOLLOW-UP, NOT A CHOICE. This module DECIDES what may
clear the gate, which is the textbook `policy` tier in `we:scripts/lib/gate-config.mjs`'s own words — an
edit here should force `review:human`, exactly as it does for the seam that calls it. It is absent from
`TRUST_CHAIN` only because #2844 landed while a concurrent change (PR #1098) held the roster, and editing
the leash classification from two lanes at once is the merge hazard the roster exists to prevent. Today an
edit here still ESCALATES (the `^scripts/` blast-radius rule) but does not force a human. Register it as
`{ role: 'clearer-identity', file: 'review-independence.mjs', tier: 'policy' }` in the next roster edit.
```

Every clause is true, and now-confirmed-safe to delete: "PR #1098 held the roster" is why the header still
exists unregistered, and #1098's replacement (#1102) landed the exact roster shape this item edits.

## Why `leash: 'spec'`, argued independently (not copied from the card)

`POLICY_SPEC_BASENAMES` is derived as `leash !== 'code'` — the safe default. Per
[we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs)'s own guidance: "is this file the *encoded
policy* (a contract, a roster, an invariant/conformance suite — `'spec'`), or code that *derives* the gate
from it (`'code'`)?" By artifact **kind**, `we:scripts/lib/review-independence.mjs` is CODE (an `.mjs` module of functions),
which would suggest `'code'` — but the #2771 **backstop** for putting derivation code on the committee route
is: *"any change that alters the gate's behaviour necessarily reddens conformance, which forces a contract
diff"* — i.e. an editor cannot silently weaken derivation code because a **protected** conformance suite
(itself `leash: 'spec'`) would catch it.

**That backstop does not hold for `we:scripts/lib/review-independence.mjs`.** Its only behavioural pin is
`we:scripts/lib/__tests__/review-independence.test.mjs` — an ordinary unit-test file, **not** registered in
`TRUST_CHAIN`. An editor could weaken `decideClearerIndependence`'s `SELF_CLEAR` refusal (e.g. silently
return `independent: true`) and edit `we:scripts/lib/__tests__/review-independence.test.mjs` in the same diff to match, and if this
file were `leash: 'code'` that combined diff would escalate to the independent committee, not a human — a
converged agent panel could clear an edit that lets an agent clear its own review. This is **exactly** the
gap the roster exists to close, and it is the identical reasoning `we:scripts/lib/gate-config.mjs`'s own header already
uses to justify `we:scripts/lib/review-runner-core.mjs` / `we:scripts/review-runner.mjs` staying `'spec'` ("that guarantee has no
conformance suite pinning it, so the #2771 backstop does NOT hold here"). Same shape, same conclusion:
`'spec'`, the fail-closed direction, per the roster's own written guidance ("if you cannot answer with
confidence, leave it `'spec'`").

## A real scope gap the capture card missed (consumer risk — checklist item 1)

The original card scoped three files. **`we:scripts/lib/__tests__/gate-invariants.test.mjs` is a real, missed
consumer.** It hand-maintains `DECLARATIVE_LEASH_FILES` (lines ~77–85) — an array that today lists **every
single** `leash: 'spec'` `TRUST_CHAIN` member by name (verified: cross-checked all 8 spec-tier basenames in
`we:scripts/lib/gate-config.mjs` against the array, 1:1 match, no gaps). That array drives real combinatorial coverage:
INVARIANT 1's "declarative leash ⇒ humanRequired across noise" test, its MIXED (leash+derivation) test, its
stacked-base (`#2390`) test, and INVARIANT 6's producer-label test. None of these is a static registration
check — they call `scoreEscalation` / `producerReviewLabel` directly over powerset'd noise combinations. If
`we:scripts/lib/review-independence.mjs` is added to `TRUST_CHAIN` but **not** to `DECLARATIVE_LEASH_FILES`, the new roster
entry passes the *generic* "every policy member declares a valid leash" check (INVARIANT 12, which iterates
`TRUST_CHAIN` directly) but gets **none** of the behavioural robustness coverage every sibling `spec` member
has. This scope is now added; task 3 below covers the fix (one array entry — no new test code, because the
existing `it(...)` blocks already iterate the array).

## Sibling card — read it, do not fold into this one

[#2960](/backlog/2960-register-the-review-label-cli-on-the-trust-chain-s-policy-ti/) (open) is the same shape
one file over: register [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs). It predates #2785
landing and still frames its leash choice as an open question — it needs its own re-verification pass, not a
silent fold-in here. Land them separately; each roster edit is independently `review:human`-gated regardless.

## An agent may BUILD this; only a human may CLEAR it

`we:scripts/lib/gate-config.mjs` is itself `tier: 'policy', leash: 'spec'` (the closure — editing the roster is itself a
trust-chain change), so this PR will carry `review:human` by construction the moment the diff lands, and only
an operator's `clear-human` ceremony can clear it. **That is the design working, not a stuck PR** — do not
mistake the required human clearance for a blocker. Authoring the entry, the header deletion, and the two
test edits is ordinary agent work.

## Interfaces / exact edit shape

**1. `we:scripts/lib/gate-config.mjs`** — insert one new `TRUST_CHAIN` entry, with its own header comment (matching
the style of the other dated clusters in the file), immediately after the `check-standards-rules` entry and
before `roster-config` (i.e. right before the file's closing two entries):

```js
{
  role: 'clearer-identity',
  file: 'review-independence.mjs',
  tier: 'policy',
  leash: 'spec',
  desc: 'decides WHO may clear a verdict (decideClearerIndependence) — refuses a clear whose reviewer id '
    + 'equals the PR author\'s id (#2844). It decides what may clear the gate, the textbook policy-tier '
    + 'reason, but no conformance suite backstops its behaviour the way review-policy.conformance.test.mjs '
    + 'backstops the escalation rubric — its own unit suite is an ordinary, non-gate-self test file an '
    + 'editor could weaken alongside it — so the #2771 backstop does not hold and the fail-closed leash is '
    + '`spec`, the same reasoning that keeps review-runner-core.mjs/review-runner.mjs on `spec` (#2830)',
  homes: ['scripts/lib/review-independence.mjs'],
},
```

**2. `we:scripts/lib/review-independence.mjs`** — delete lines 54–60 (the "NOT YET TRUST-CHAIN REGISTERED…"
paragraph) from the header comment. No code change; comment-only.

**3. `we:scripts/lib/__tests__/gate-invariants.test.mjs`** — add one entry to `DECLARATIVE_LEASH_FILES`
(~line 77–85):
```js
  'scripts/lib/review-independence.mjs', // #2844/#3045 — WHO may clear a verdict; no conformance backstop
```
No other edit needed in this file — every existing `it(...)` that iterates `DECLARATIVE_LEASH_FILES` now
covers the new member automatically.

**4. `we:scripts/lib/__tests__/gate-config.test.mjs`** — add one new test, modeled directly on the existing "the
check:standards contract + conformance suite join the leash by KIND, not by name (#2769)" test (lines
107–119) — this file joined the leash after #2771's original ratified table too, by the same kind of
independent argument, so it gets its own dedicated assertion rather than being folded into the historical
`RATIFIED` table (lines 77–89), which documents #2771's original table specifically:
```js
  it('the clearer-identity module joins the leash by its own argument, not #2771\'s original table (#2844/#3045)', () => {
    const entry = TRUST_CHAIN.find((m) => m.file === 'review-independence.mjs');
    expect(entry, 'TRUST_CHAIN entry for review-independence.mjs').toBeTruthy();
    expect(entry.tier).toBe('policy');
    expect(entry.leash).toBe(POLICY_LEASH.SPEC);
    expect(isPolicySpecPath('scripts/lib/review-independence.mjs')).toBe(true);
  });
```

No other file needs an edit. There is no runtime interface change (no new function signature, no new CLI
flag) — this is a pure config-table + comment change, and the "interface" that matters is the roster's own
shape, which the entry above matches field-for-field against every sibling `policy`/`spec` entry.

## Tasks (ordered)

1. Add the `TRUST_CHAIN` entry in `we:scripts/lib/gate-config.mjs` (Interfaces §1).
2. Delete the stale header paragraph in `we:scripts/lib/review-independence.mjs` (Interfaces §2).
3. Add the `DECLARATIVE_LEASH_FILES` entry in `we:scripts/lib/__tests__/gate-invariants.test.mjs` (Interfaces §3).
4. Add the new test in `we:scripts/lib/__tests__/gate-config.test.mjs` (Interfaces §4).
5. Run the three test files together (paths below the fence are literal, not locus-prefixed prose):
   ```
   npx vitest run scripts/lib/__tests__/gate-config.test.mjs scripts/lib/__tests__/gate-invariants.test.mjs scripts/lib/__tests__/review-independence.test.mjs
   ```
   Expect all pre-existing tests to still pass PLUS the new assertions, with the `DECLARATIVE_LEASH_FILES`-driven tests now exercising `we:scripts/lib/review-independence.mjs` across their noise/powerset/stacked-base cases.
6. Run `npm run check:standards` — expect 0 errors. Note: this file now joins the `leash: 'spec'` set that `we:scripts/check-standards.mjs:1194`'s provenance-citation gate (#3026) scopes against (`specHomes`); that gate is WARN-only and content-triggered (added-prose citation tokens), so it is expected to be a no-op here, but check the run's output for any new WARN naming this file and note it if present — do not silently assume clean.
7. Update this card's `status` per the normal resolve flow once the PR lands (not part of this prep).

## Done when (testable)

- Calling the predicate directly (literal call, not locus-prefixed prose):
  ```
  isPolicySpecPath('scripts/lib/review-independence.mjs') → true
  ```
  — not just `isPolicyCorePath`, which was already insufficient (see the original card's own acceptance note,
  preserved here).
- Calling the scorer directly:
  ```
  scoreEscalation({ changedFiles: ['scripts/lib/review-independence.mjs'] }).humanRequired → true
  ```
  with a `gate-self (…) — declarative leash, human review required` reason present.
- The "NOT YET TRUST-CHAIN REGISTERED" paragraph is absent from `we:scripts/lib/review-independence.mjs`.
- `we:scripts/lib/__tests__/gate-config.test.mjs`'s new test (Interfaces §4) passes.
- `we:scripts/lib/__tests__/gate-invariants.test.mjs`'s existing `DECLARATIVE_LEASH_FILES`-driven tests
  (INVARIANT 1's noise/MIXED/stacked-base cases, INVARIANT 6's producer-label case, INVARIANT 12's
  valid-leash case) all pass with `we:scripts/lib/review-independence.mjs` as a member — no new test code in this file,
  only the one array entry.
- `npm run check:standards` exits 0.
- The PR this produces is labeled `review:human` (self-probe expected, matching the "agent may build, only a
  human may clear" section above) — a build agent should treat that as confirmation the change registered
  correctly, not as a stall.

## Delivery shape

**One piece, cannot land incrementally.** A roster registration is atomic — there is no safe intermediate
state where the entry is "half in" `TRUST_CHAIN` — and the edit touches four small files with no behind-a-flag
surface to gate. No branch/feature-flag strategy is needed; it is a single small PR by construction. Because
`we:scripts/lib/gate-config.mjs` is itself the declarative leash, this PR is `review:human` from the moment it opens; land it
through the normal `clear-human` ceremony, same as every other roster edit (e.g. the #2960 sibling, or #2830's
original registration of `we:scripts/lib/review-runner-core.mjs`).

## Risk assessment (`backlog/3103-*.md` taxonomy)

- **premise** — re-verified, not assumed: #1098 closed/not-merged confirmed via `gh pr view`; the reason it
  was safe to close (superseded by merged #1102) is a *new* finding this pass, not present in the original
  card, and closes the "was it actually abandoned mid-fix?" question a skeptic would ask next.
- **consumer** — found and closed: `we:scripts/lib/__tests__/gate-invariants.test.mjs`'s `DECLARATIVE_LEASH_FILES` array was missing
  from the original card's `scope:`; added to scope and to the task list (see "A real scope gap" above).
- **blast-radius** — none introduced. This item adds one roster entry; it does not touch a rule, lint, or gate
  definition that could fire wider than intended.
- **interface** — none. Pure data-table addition; no function signature, CLI flag, or on-disk schema changes.
- **population / unmeasured-impact** — the gap is measured live on the current tree (re-run above, not just
  cited from the card), and the precedent mechanism (`we:scripts/lib/review-runner-core.mjs`) was independently re-probed to
  confirm the registration shape actually flips `humanRequired` in the live scorer today, not merely in the
  code's own comments.
- **decorative-guard** — ruled out by the same precedent probe: the mechanism is proven to fire (not a no-op)
  against a structurally identical existing entry, before this item asks anyone to add a new one.
- **legibility** — n/a; this is a config/roster change, not a runtime failure path with a silent-vs-surfaced
  question.

## Independent review — 2026-08-15 (checklist item 9, applied to this card)

Confidence: **High**. A fresh-context agent independently re-verified every claim above against the live
tree and GitHub (not this session's work): PR #1098/#1102 states, the live-gap measurement, the
`we:scripts/lib/review-runner-core.mjs` precedent probe, the `DECLARATIVE_LEASH_FILES` 1:1-match claim, the
proposed `TRUST_CHAIN`/test shapes against their neighbours, and the #2844/#2960 cross-references. Two small
factual errors were found and are corrected in the sections above: the cited `mergedAt` local-time conversion
for PR #1102 was off by two hours (now stated in UTC to remove the conversion step), and the spec-tier
basename count was misstated as 9 instead of the correct 8 — neither affected the card's conclusions. No
design, premise, or scope defect was found.
