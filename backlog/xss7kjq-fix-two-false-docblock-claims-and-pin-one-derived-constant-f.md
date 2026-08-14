---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-14"
scope:
  - we:scripts/operations/__tests__/wake-cli.test.mjs
  - we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs
scopeRationale: "Both fixes are test-only: one corrects a false docblock claim and (optionally) bounds a synchronous child call in the waker CLI test; the other adds a single assertion pinning a derived constant. Neither touches production dispatch/waker logic."
tags: [plateau-loop, delivery, operations, conveyor, dispatch, testing]
crossRef: { url: /backlog/3037-declare-dispatch-the-effect-that-starts-rather-than-complete/, label: "#3037 — declare dispatch (the reviewed PR)" }
---

# Fix two false docblock claims and pin one derived constant found in the PR #1211 round-3 review

The round-3 independent review of PR #1211 (WE #3037, the `dispatch-lane` operation) **accepted** the PR but
carried three findings that are landable any time, because none needs a live agent run to fix or verify. This
item is those three, plus a standing note about the module's review history.

## H4 — leads, because it changes what a hang looks like on the required gate

**File:** [we:scripts/operations/__tests__/wake-cli.test.mjs](scripts/operations/__tests__/wake-cli.test.mjs).

The file's own docblock, directly above `const CHILD_PROCESS_TIMEOUT_MS = 60_000;` (currently line 133), says:

> *"Generous, because every case here spawns at least one real `node` child and vitest's default per-test bound
> is five seconds … It is a ceiling on a hang, not a value anything races."*

**That sentence is false, and it was proven, not just argued.** `runWakeCli` (currently lines 113-126) calls
`execFileSync(process.execPath, [WAKE_CLI, ...args], { encoding: 'utf8', stdio: [...], env: {...} })` with no
`timeout` option — a **synchronous** call. vitest's per-test timeout cannot interrupt a synchronous child process;
it can only fail the test *after* the call returns. The round-3 reviewer set the stub `claude` to sleep 90
seconds and the test **passed at 90.4s**, blowing straight through its own stated 60-second "ceiling." So today,
a real `claude` that wedges during the waker CLI test does not redden the required gate — it **hangs it**, which
is worse than a failure because nobody gets a signal at all.

**Fix (pick one, both are acceptable):**
- Correct the docblock to say what `CHILD_PROCESS_TIMEOUT_MS` actually is — a floor chosen to clear vitest's 5s
  default under a loaded shard, not a ceiling on anything — and stop implying a hang is bounded; or
- Pass an explicit `timeout` (and `killSignal: 'SIGKILL'`) option into the `execFileSync` call inside
  `runWakeCli` so a wedged stub really is bounded and the claim becomes true.

Either way, add a regression case: stub `claude` to sleep past whichever bound is chosen and assert the test
run terminates (rather than merely trusting the change by inspection).

## H3 — the "one source of truth" derivation is asserted by nothing

**File:** [we:scripts/operations/dispatch-lane-io.mjs:65](scripts/operations/dispatch-lane-io.mjs) —
`export const LISTING_GRACE_MS = DISPATCH_LISTING_GRACE_MINUTES * 60 * 1000;`

The docblock on this line states the constant is DERIVED rather than a second literal, specifically so that "two
numbers that must agree" cannot drift apart. Mutating it back to a bare literal —
`LISTING_GRACE_MS = 2 * 60 * 1000` — leaves all 495 `scripts/operations/__tests__/` tests green. Nothing checks
that the derivation is still in place. This is one line away from the fix for the identical defect class in round
2 (G5, `DISPATCH_HOLD_GRACE_MINUTES`), which round 3 confirmed **is** now pinned by a literal-boundary test at
[we:scripts/operations/__tests__/dispatch-lane.test.mjs:325](scripts/operations/__tests__/dispatch-lane.test.mjs)
("the CLOCK BACKSTOP boundary, pinned with LITERALS and not only with the constants").

**Fix:** add one assertion to
[we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs](scripts/operations/__tests__/dispatch-lane-defaults.test.mjs)
(which already covers the bounded-defaults class this constant belongs to):
`expect(LISTING_GRACE_MS).toBe(DISPATCH_LISTING_GRACE_MINUTES * 60_000)`, importing both from
`we:scripts/operations/dispatch-lane-io.mjs` / `we:scripts/operations/dispatch-lane.mjs`.

## H5 — advisory: a placeholder broken by an interior newline or brace is filled verbatim, unreported

**File:** [we:scripts/operations/dispatch-lane.mjs:126](scripts/operations/dispatch-lane.mjs) —
`export const BRIEF_TOKEN_RE = /\{\{\s*([^{}\n]*?)\s*\}\}/g;`.

`{{ITEM_\nNUM}}` and `{{ITEM{NUM}}` fill verbatim into the dispatched agent's prompt with `unknownTokens: []` —
neither substituted nor reported. This is **not** a claim wider than the code: the docblock at
we:scripts/operations/dispatch-lane.mjs's line 204 already names the limit honestly ("The one spelling still
outside it is a token carrying a BRACE or a NEWLINE"). The realistic trigger is a markdown reflow of a long brief
line. Because it is already honestly documented, the bar here is lower than H3/H4: add a test that pins the
*current* behavior (both example spellings fill verbatim with an empty `unknownTokens`) so a future change to
`BRIEF_TOKEN_RE` cannot silently alter this known gap without a test noticing — widening the regex to also catch
these two spellings is welcome but not required to close this item.

## Standing note — not an action item, record it as history

The round-3 review named a recurring pattern across all three rounds of PR #1211's review: **prose added in each
round claims something the code does not quite do.** Round 1 shipped an over-claimed `nextState` and a
bookkeeping-drop comment claiming both drops were conservative when only one was; round 2 shipped docblocks
asserting new behavior was "safe by construction" that a counter-example in the same module then broke; round 3
shipped the two false sentences fixed as H1 (of #3096) and H4 above. Each round the gap has narrowed, but three
rounds in it has not stopped. This is worth carrying as a standing caution on this module —
we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs and we:scripts/operations/wake.mjs
— for whoever next edits it, not as a defect to fix here.

## Done when

- `we:scripts/operations/__tests__/wake-cli.test.mjs`'s `CHILD_PROCESS_TIMEOUT_MS` docblock no longer claims to
  be a ceiling on a hang unless `runWakeCli`'s `execFileSync` call has been given an explicit `timeout` that makes
  that claim true, and a test with a stub `claude` sleeping past the chosen bound proves the run terminates.
- `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs` asserts
  `LISTING_GRACE_MS === DISPATCH_LISTING_GRACE_MINUTES * 60_000` with a test that reddens when
  `LISTING_GRACE_MS` is re-literalised.
- A test pins `fillBrief`'s current verbatim-fill, `unknownTokens: []` behavior for a token broken by an interior
  newline and one broken by an interior brace (e.g. `{{ITEM_\nNUM}}`, `{{ITEM{NUM}}`), so a future regex change
  to `we:scripts/operations/dispatch-lane.mjs`'s `BRIEF_TOKEN_RE` cannot silently change this documented gap
  without a test failing.
- `npm run test:unit` and `npm run check:standards` are green.
