---
kind: story
size: 2
parent: "3029"
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, retry, observability]
scope:
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/operations/retry-health.mjs
  - we:scripts/operations/__tests__/retry-health.test.mjs
---

# Collect retry observations so #3083's default is chosen from data

[#3083] has to say how many times a failed effect may be re-attempted automatically. **There is no basis for
that number.** Nothing dispatches yet, so the corpus holds zero retry observations, and the existing ad-hoc
choices elsewhere in the repo record what someone picked rather than what worked.

Ruled by the operator: collect data, choose later. This is the collecting.

## Why it has to land before dispatches start

The data is unrecoverable in arrears. Every retry that happens before the counter exists is an observation
that never existed. That is the entire argument for building it now rather than alongside #3083.

## The trap it is built around

Two retries look identical in a naive count and mean opposite things:

| who re-entered | a success on attempt 2 means | what a budget would have done |
| --- | --- | --- |
| a timer | the failure was flaky | caught it — this is the population a default is FOR |
| a human | someone fixed the cause | nothing; no budget helps |

Pooling them yields a default that is too high, and too high is the expensive direction — the measured failure
mode was eleven dispatches over ten ticks at exit 0. One field, `attemptedBy`, separates them, and it is
unrecoverable if omitted.

## What it must refuse to do

Answer before it can. A thousand human observations and no automatic ones is not evidence, and must not read
as any. Same discipline as `we:scripts/lib/gate-health.mjs`, which refuses to conclude on a separated band it
cannot see.

## Watch for

- The run record is described as transient and session-local; **nothing deletes it**, so the store is already
  a durable corpus and no second log is needed. That prose is wider than the code — a claim to correct rather
  than to design around.
- `.operations/` is gitignored. The corpus is per-machine, which is fine for choosing a default and is not a
  shared dataset.
- An IN-FLIGHT entry has not settled. Counting it as a failure at attempt N reads a slow success as a
  permanent one — the same mistake the waker made three times over `overdue`.

## Done when

- [x] Every attempt is counted, with who made it, on a record that survives the process.
- [x] A reader answers "which attempt did eventual successes land on", per population.
- [x] It refuses to suggest a budget when the automatic population is too small.

## How it resolved

`attempts`, `lastAttemptAt` and `attemptedBy` are stamped on the effect entry at the same moment the attempt
is marked — the one write a crash cannot skip. The waker passes `attemptedBy: 'auto'`; everything else
defaults to `human`, because every caller that existed before the waker was one.

Nothing reads these to decide anything. They are instrumentation, and #3083 is still unruled — that
separation is deliberate and is stated at the write site, so the next reader does not mistake a counter for a
policy.

`we:scripts/operations/retry-health.mjs` answers the coverage question — *of effects that eventually
succeeded, which attempt did they land on* — and offers `wouldCatch[n]`, the fraction a budget of `n` would
have reached. No mean and no median appear anywhere in the file: the distribution is heavily skewed and the
question is coverage, not central tendency.

Its refusals are the load-bearing part, and the tests are mostly refusals:

- an empty corpus, which is exactly today;
- **a thousand human observations and no automatic ones** — a large useless corpus must not read as evidence;
- enough data saying retrying never once worked, which is a conclusion but not a licence to raise anything.

No second store was needed. The run record is described as transient and session-local, but nothing deletes
it, so the store is already the corpus.
