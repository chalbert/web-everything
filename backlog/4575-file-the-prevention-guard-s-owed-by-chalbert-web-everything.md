---
bornAs: x9ivdxj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lane-whois.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "8e5fb6fb4f2f1f8c0820e715522eb3e236efa0ad"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3048's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lane-whois.mjs:55-68` — Add a contract test that pins a recorded `claude agents --json` fixture covering every state and status value, and fails when an unclassified value appears. Or classify unknown non-terminal states as running, with a deny-list for idle only.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3048@ac8e791290bee8e970a330059ec7b8421d89b50a

## Progress

Preparation premise check (2026-10-02): the original scope named
`we:scripts/lane-whois.mjs` and `we:scripts/__tests__/lane-whois.test.mjs`, and the
review offered either a recorded vocabulary contract or unknown-as-running behavior.
The source has not moved; the old line-60 citation is now corrected to the complete
classifier at `we:scripts/lane-whois.mjs:55-68`. Commit `ac8e79129` delivered the
underlying classifier, not this prevention guard.

Corrected premise: `isRunningAgent` accepts `state: working` or `status: busy`, then
checks optional numeric activity timestamps. Unknown/absent values return false.
`we:scripts/__tests__/lane-whois.test.mjs:245-281` already tests working, busy, idle,
stale and unknown/absent synthetic entries, but has no recorded-vocabulary guard.
The explicit unknown-is-not-running design in
`we:backlog/4544-lane-worker-without-lease-reads-finished-sessions-as-live-wo.md`
and the alert-polarity comment at `we:scripts/lane-whois.mjs:422-425` settle the
apparent alternative: preserve that behavior and add the contract-test option.
Reclaim liveness remains a separate signal.

Read-only observation: `claude agents --json` on this host returned an array of 22
entries, all with `state: working` and no `status`. This confirms only that observed
shape; it is not evidence of an exhaustive CLI vocabulary. Busy/idle recording still
needs representative sessions during implementation. Scope remains the original
source and its existing matching test file; keep the sanitized recording embedded
in that test file, with capture provenance, rather than adding an unscoped fixture.

## Design

Add a recorded-listing contract suite in `we:scripts/__tests__/lane-whois.test.mjs`
that exercises `liveAgentSessions` and `isRunningAgent` from
`we:scripts/lane-whois.mjs`. Record representative background-working,
interactive-busy, interactive-idle and any observable terminal entries using
`claude agents --json`. Preserve state/status values and field absence exactly;
sanitize identities, working directories and unrelated session content. Document
CLI version, capture date and which session conditions each recording represents.
Do not fabricate terminal values or claim that one host sample covers all possible
versions/states. Synthetic boundary cases must be labelled separately.

Maintain an explicit expected classification for every distinct state and status
value in the recordings. Validate each field independently before applying the
production classifier: an unknown status must fail the contract even if a known
working state makes the production OR expression true (and vice versa). Report the
field and offending value. Missing fields are a separate supported shape, not an
unknown string. Reject unexpected field types in the contract.

The contract checks vocabulary coverage as well as each recorded entry's expected
running result. Keep unknown-as-not-running, the OR rule and optional recency in
production unchanged. A new recorded value requires explicit review of its meaning;
do not automatically bless the value from the classifier's current result. A pinned
fixture detects drift when refreshed, not unseen changes in a future installed CLI.

## MVP

1. Embed sanitized recordings and their provenance in
   `we:scripts/__tests__/lane-whois.test.mjs`; obtain real busy and idle samples
   before calling the recorded coverage complete.
2. Add a test-local vocabulary validator and explicit expected outcomes, then pass
   recordings through the injectable `exec` seam of `liveAgentSessions` and the
   exported `isRunningAgent` in `we:scripts/lane-whois.mjs`.
3. Add mutation cases proving a new state or status is rejected with a useful
   diagnostic, including mixed known/unknown fields. No runtime policy change or
   new live-CLI dependency in normal CI is needed.

## Test plan

All added tests live in `we:scripts/__tests__/lane-whois.test.mjs` and use the title
prefix `agent vocabulary contract` for targeted execution.

- Recorded working/busy entries classify true; recorded idle entries classify
  false. Validate every recorded state and status against the explicit vocabulary.
- Inject an unseen state, an unseen status, and each alongside a known running
  value in the other field; each must fail vocabulary validation.
- Missing fields remain supported; malformed field types fail validation. Retain
  the existing synthetic unknown-state test to pin production false behavior.
- Use a fixed clock for synthetic recency cases: the exact active-window boundary,
  one millisecond older, and no timestamp. Do not let old capture timestamps make
  the vocabulary assertions depend on wall-clock time.
- Replay the sanitized array through `liveAgentSessions` with injected command
  output, and keep the existing CLI integration cases for `liveOwner`/`liveWorker`
  green to show that the test addition preserves the separate signals.

## Proof plan

Run the targeted `agent vocabulary contract` tests, then the full
`we:scripts/__tests__/lane-whois.test.mjs` suite with Vitest. Record real capture
provenance and observed vocabulary without exposing session identifiers.

Demonstrate sensitivity on a temporary copy: add a new state/status to a recorded
entry without adding an explicit classification; the contract must turn red naming
that field/value. Separately remove `working` or `busy` from the production running
sets in `we:scripts/lane-whois.mjs`; recorded expectations must fail. Restore each
mutation and show green. A test run with zero matching tests is not a red/green
proof. Run `npm run check:standards` during delivery; preparation itself leaves
stamping and checks to the runner.

## Done when

The recorded-vocabulary contract exists, rejects unclassified values in either
field, and passes for the documented captures; mutation evidence demonstrates the
guard rather than merely replaying synthetic happy paths. From the WE checkout, run `npx vitest run` targeting
`we:scripts/__tests__/lane-whois.test.mjs` (using its repository-relative path),
with `-t "agent vocabulary contract"`. The full matching test suite remains green
with production classification unchanged.

## Follow-ups

- Refresh the recordings when upgrading the CLI; explicitly review newly observed
  vocabulary. A frozen fixture alone cannot detect upstream values it never sees.
- Sharing vocabulary with other liveness consumers or changing unknown-state
  policy remains separate work; this guard must not alter reclaim safety semantics.
