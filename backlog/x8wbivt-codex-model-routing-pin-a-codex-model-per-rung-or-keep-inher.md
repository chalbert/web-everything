---
kind: decision
parent: "3369"
status: resolved
scope: ["we:scripts/lib/codex-judge-spawn.mjs", "we:scripts/codex-direct-task.mjs", "we:docs/agent/backlog-workflow.md", "we:agent-memory-src/always-set-subagent-model-explicitly.md"]
dateOpened: "2026-09-11"
preparedDate: "2026-09-11"
dateResolved: "2026-09-11"
codifiedIn: "docs/agent/backlog-workflow.md#codex-model-routing"
tags: [operations, dispatch, multi-provider, model-routing, cost]
---

# Codex model routing — pin a Codex model per rung, or keep inheriting the CLI default

we:agent-memory-src/always-set-subagent-model-explicitly.md makes an explicit, right-sized model mandatory on
every Claude spawn, but the Codex provider (we:scripts/lib/codex-judge-spawn.mjs, in flight on
`origin/lane/xqa9ttq-review-pr-codex-advisory-seat`, not yet on `main`) pushes `-m` only `if (model !==
undefined)` and no caller supplies one — so every Codex run today silently inherits the CLI default, measured
live as `gpt-6-astra`, the top rung. This decides whether Codex gets its own pinned ladder and what maps to
what, on measured evidence rather than name similarity. **Headline finding: the Claude-style three-rung
ladder does not reproduce on the Codex side. Across four probes and 89 logged runs, six of the seven
current-generation models scored identically; the only separation found was by model *generation*, not by
marketing tier.**

## What is actually selectable (ChatGPT-subscription auth, not an API key)

Auth is a ChatGPT subscription, not a metered OpenAI API key — Codex's own stored-credentials file carries
`"auth_mode": "chatgpt"` and `"OPENAI_API_KEY": null`; `codex doctor` reports `stored auth mode chatgpt`,
`stored API key false`, and an inference endpoint of `https://chatgpt.com/backend-api/…`, never
`api.openai.com`. So public API pricing and tier documentation does **not** apply verbatim here, and the
selectable set is whatever the subscription is entitled to — enumerated from the CLI's own server-fetched
catalogue (its cached model list, `fetched_at 2026-09-11T20:05:23Z`, `client_version 0.153.4`), then
confirmed one-by-one with a live `codex exec -m <slug>` ping. All eight answered:

| slug | display name | catalogue `visibility` | reasoning efforts offered | catalogue description |
|---|---|---|---|---|
| `gpt-6-astra` | GPT-6-Astra | list (priority 1) | low·medium·high·xhigh·max·ultra | "Our most capable model for complex, demanding work." |
| `gpt-reserve` | GPT-Reserve | **hide** (3) | low·medium·high·xhigh·max | "Fast and affordable agentic coding model." |
| `gpt-5.6-sol` | GPT-5.6-Sol | list (6) | low·medium·high·xhigh·max·ultra | "Reliable agentic workhorse for everyday tasks." |
| `gpt-5.6-terra` | GPT-5.6-Terra | list (7) | low·medium·high·xhigh·max·ultra | "Balanced agentic coding model for everyday work." |
| `gpt-5.6-luna` | GPT-5.6-Luna | list (8) | low·medium·high·xhigh·max | "Fast and affordable agentic coding model." |
| `gpt-5.5` | GPT-5.5 | list (12) | low·medium·high·xhigh | "Proven previous-generation model for coding and general work." |
| `gpt-5.3-codex-spark` | GPT-5.3-Codex-Spark | list (26) | low·medium·high·xhigh | "Ultra-fast coding model." |
| `codex-auto-review` | Codex Auto Review | **hide** (43) | low·medium·high·xhigh·max | "Automatic approval review model for Codex." |

**Guessing a name is a hard failure, not a soft fallback.** `-m o3`, `-m gpt-5.1-codex-max` and
`-m not-a-real-model` each emit `Model metadata for 'X' not found. Defaulting to fallback metadata` and then
die on a 400: `"The 'not-a-real-model' model is not supported when using Codex with a ChatGPT account."` The
entitlement, not the public model list, is the authority.

**The current default is the top rung.** `codex doctor` reports `model <default> · openai` — nothing is
pinned in Codex's user config. A non-ephemeral run with no `-m` writes `"model": "gpt-6-astra"` into its
rollout's `turn_context`, so the un-pinned Codex judge is running on the most capable model available, at its
`default_reasoning_level` of `medium`.

## The probes — four tasks, 89 logged runs, ground truth established by execution

Each task was run through `codex exec --json --skip-git-repo-check --ephemeral -s <sandbox> -C <fixture> -m
<model>`, with wall latency and the `turn.completed` usage block recorded per run.

- **A — quick verifiable lookup (the Haiku shape).** A frozen copy of this repo's we:backlog/ tree (3604
  files); "count the .md files whose frontmatter has a line that is exactly `status: active`". Ground truth
  **34**, computed independently with `grep -lE '^status: active$' | wc -l`. **n=8 per model.**
- **B — execution against a decided spec (the Sonnet shape).** A written spec for a `parseDurationMs`
  duration parser with 8 rules and 5 explicitly-resolved ambiguities; graded by a hidden 38-assertion suite
  that the author's own reference implementation passes 38/38.
- **C — judgment on an ambiguous artefact (the Opus shape).** A concurrency-limited work queue whose
  slot-release sits after the `await` instead of in a `finally`, surrounded by plausible non-defects. The
  hang is **proven by execution**, not asserted: the repro settles to
  `{"hung":true,"stats":{"active":2,"waiting":2,"done":0}}`.
- **D — restraint under a leading question.** The same file with the `finally` restored (repro settles
  cleanly: `{"settled":{"ok":6,"failed":6},"stats":{"active":0,"waiting":0,"done":6}}`), asked whether it can
  still hang.

### Results

| model | A: correct (n=8) | A: median latency | A: median input tok | A: median output tok | B (38 assertions) | C | D |
|---|---|---|---|---|---|---|---|
| `gpt-6-astra` | **8/8** | 16.3 s | 44 944 | 292 | 38/38 | correct | see below |
| `gpt-5.6-sol` | **8/8** | 13.5 s | 27 972 | **194** | 38/38 | correct | see below |
| `gpt-5.6-terra` | **8/8** | 13.3 s | 35 096 | 294 | 38/38 | correct | see below |
| `gpt-reserve` | **8/8** | 18.5 s | 32 064 | 379 | 38/38 | correct | see below |
| `gpt-5.3-codex-spark` | 7/8 (once `3604`) | 13.0 s | 22 553 | 1182 | 38/38 | correct | see below |
| `gpt-5.6-luna` | 7/8 (once `0`) | 18.6 s | 31 493 | 386 | 38/38 | correct | see below |
| `gpt-5.5` | **4/8** (`0`,`0`,`0`,`3579`) | 11.2 s | 32 779 | 281 | 38/38 | correct | see below |

**Task B did not separate anything.** All seven wrote a module passing all 38 assertions, and none wrote a
stray file despite the spec's "write ONLY the file". They differed only in verbosity (45 lines for
`gpt-6-astra`, 103 for `gpt-5.3-codex-spark`) and in cost: 13.0 s / 38.8k input tokens for
`gpt-5.3-codex-spark` against 85.5 s / 147.3k for `gpt-5.6-luna`.

**Task C did not separate anything either.** All seven identified the missing `finally` and all seven named
the right consequence ("runAll hangs forever without an error"). Six pointed at line 47, one at line 48 — the
two halves of the same statement pair.

**Task D refuted its own answer key, unanimously.** All seven answered `hangDefect: true`, citing not the
planted bug (which was fixed) but an unguarded `limit: 0` in the constructor. That is **correct** —
constructing the queue with a limit of zero reproduces as
`{"hung":true,"stats":{"active":0,"waiting":1,"done":0}}`. The Opus session that authored the fixture missed
the hole; every Codex model, including the cheapest, found it. Recorded because it cuts against this item's
own thesis: on the judgment-shaped probes there was no visible ceiling to hit.

### Effort moved correctness where the model did not

| run | correct |
|---|---|
| `gpt-5.5` @ default (`medium`) | 4/8 |
| `gpt-5.5` @ `high` | **4/4** |
| `gpt-5.3-codex-spark` @ default | 7/8 |
| `gpt-5.3-codex-spark` @ `high` | 3/4 |
| `gpt-6-astra` @ default (`medium`) | 8/8 |
| `gpt-6-astra` @ `low` | **4/4** |

The one measured correctness rescue came from raising *effort* on the weakest model, not from changing model;
and dropping the strongest model to `low` effort cost nothing on this task. This lines up with
we:docs/agent/backlog-workflow.md § *Effort routing* treating effort as a genuinely separate axis — on the
Codex side it looks like the **load-bearing** one.

## Cost: no dollars exist, but a real budget signal does — and it is currently thrown away

The provider module's header is right that no USD figure exists anywhere in Codex's output — nothing in
`codex exec --json` stdout carries one, and the event stream is exactly four types (`thread.started`,
`turn.started`, `item.completed`, `turn.completed`) with token counts only. But a real
**quota-consumption** signal does exist, in the *persisted rollout*, as an `event_msg` of type `token_count`:

```
"rate_limits":{"limit_id":"codex","primary":{"used_percent":23,"window_minutes":300,"resets_at":1789175180},
 "secondary":{"used_percent":10,"window_minutes":10080,"resets_at":1789761980},
 "plan_type":"prolite","rate_limit_reached_type":null}
```

Two facts follow, both load-bearing for this decision:

1. **`--ephemeral` destroys it.** `buildCodexJudgeArgv` hardcodes `--ephemeral`, so the Codex judge discards
   the only budget telemetry the subscription path offers. The signal is not absent; it is being deleted.
2. **The models do not share one bucket, and the "cheap" one drains faster.** Measured by identical
   back-to-back runs with a sample before and after:

   | model | bucket reported | 7 identical runs moved it |
   |---|---|---|
   | `gpt-6-astra` | one 10080-min window, `resets_at 1789561908` | 5% → 5% (no movement at 1-point resolution) |
   | `gpt-5.6-sol` | one 10080-min window, `resets_at 1789561907` | 5% → 5% (no movement) |
   | `gpt-5.3-codex-spark` | a 300-min primary **plus** a 10080-min secondary at a **different** `resets_at 1789761980` | 5 h: 23% → 28%; weekly: 10% → 12% |

   `gpt-5.3-codex-spark` reports against a separate, visibly tighter allowance. **Choosing the "ultra-fast"
   model to conserve budget is not supported by measurement** — on this plan (`plan_type: "prolite"`) it
   spends a different, scarcer pool. Honest limit: these are percentages of undisclosed denominators, so this
   establishes *bucket separation and relative drain rate*, never an absolute cost.

## The equivalence table — an honest partial non-finding

**A Claude-tier to Codex-model mapping cannot be established on capability from this evidence.** Three of the
four probes produced identical, perfect scores across every selectable model; the fourth separated by
generation, not tier. What the evidence *does* support:

| Claude rung (we:agent-memory-src/always-set-subagent-model-explicitly.md) | Codex equivalent | Grounds |
|---|---|---|
| **Haiku** — pointer verifiable in seconds | **No cheap-rung equivalent was found.** Any current-generation model at `low`/`medium` effort. | Task A's 18% aggregate error rate is spread across *all* tiers, not concentrated in the cheap ones; `gpt-6-astra` @ `low` scored 4/4. The cheap models are not cheaper on quota (bucket table above). |
| **Sonnet** — execution against a decided spec | **Any current-generation model.** | Task B: 38/38 for all seven, no stray files, no instruction-following gap. |
| **Opus** — judgment, not cheaply verifiable | **Not distinguishable from the Sonnet rung on these probes.** | Tasks C and D: 7/7 and 7/7, including the model catalogued as "Ultra-fast coding model". |
| **Never Fable** — premium pool, never for execution | **`gpt-5.5` is the disqualification, for the opposite reason.** | 4/8 on a lookup whose answer a `grep` settles. A previous-generation model, not a premium one. |

Limits of this, stated rather than hidden: four task shapes, one repo, one plan tier, one CLI version
(0.153.4), n=8 on the only probe that separated anything and n=1 on the other three. A harder
execute-to-spec probe than a 60-line parser, or a judgment probe with a genuinely subtle answer, might yet
find a ceiling — **this establishes that the obvious ladder is absent, not that no ladder exists.**

## Fork 1 — pin a model on the Codex path, or keep inheriting the CLI default?

- **(a) Keep inheriting.** Zero work; tracks whatever OpenAI promotes.
- **(b) Pin explicitly at every Codex call site.** *(recommended)*

**Default: (b) pin.** The Claude-side rule exists because inheritance — not downgrading — is the historical
bug (we:agent-memory-src/always-set-subagent-model-explicitly.md: it "killed 24 lanes"). The Codex path has the identical hole
and today resolves silently to the top rung, which nobody chose and nothing records. Pinning also freezes the
run against a server-side catalogue change: the model list is fetched, cached, and carries a `priority`
ordering the CLI can re-rank without a release. The cost of (a) is not over-spend — it is that the tier never
appears in the transcript, so a bad routing call is invisible.

## Fork 2 — a three-rung Codex ladder mirroring Claude's, or one model for every Codex role?

- **(a) Three rungs** (e.g. `gpt-5.3-codex-spark` / `gpt-5.6-terra` / `gpt-6-astra`) mirroring Haiku/Sonnet/Opus.
- **(b) One model for every Codex role, with `effort` as the only dial.** *(recommended)*

**Default: (b) one model.** A three-rung ladder is exactly the name-similarity mapping this item was opened to
avoid, and the measurement refuses it twice over: no probe separated `gpt-5.3-codex-spark` from `gpt-6-astra`
on correctness, and the cheap rung is *not* cheaper on this plan (it draws a separate, faster-draining
bucket). Building a ladder anyway would encode an unmeasured assumption as doctrine. The axis that did move
correctness — effort — is already a first-class knob the provider maps through `CODEX_EFFORT_MAP`.

## Fork 3 — which single model?

- **(a) `gpt-6-astra`** — today's implicit default; 8/8 on A, lowest reasoning-token burn; shares its weekly
  bucket with the operator's own interactive Codex use. *(recommended)*
- **(b) `gpt-5.6-sol`** — 8/8 on A with the lowest median output tokens of any model (194), same bucket.
- **(c) `gpt-5.6-terra`** — 8/8, lowest median latency among the perfect scorers.

**Default: (a) `gpt-6-astra`.** It changes *which model runs* not at all — it only converts an inheritance
into a recorded choice, which is the whole point of Fork 1. Every alternative is a behaviour change bought
with no measured correctness gain. Revisit if Fork 4's telemetry shows the shared weekly bucket contending
with interactive use.

## Fork 4 — surface the quota signal, or keep reporting `costUsd: 0`?

- **(a) Keep `costUsd: 0`** and report nothing further.
- **(b) Stop hardcoding `--ephemeral` on the Codex judge path and surface
  `rate_limits.primary.used_percent` + `plan_type` as the budget field.** *(recommended)*

**Default: (b) surface it.** The provider header's claim (no USD figure exists) is true and stays true; what
is not true is that *no* budget signal exists. It exists, it is per-plan, it is windowed, and `--ephemeral`
currently deletes it. Honest framing on the field: 1-point resolution means it is a **trend** signal across
many runs, never a per-run cost — 7 back-to-back `gpt-6-astra` runs moved it by 0. Note the real tradeoff:
dropping `--ephemeral` re-introduces session persistence to disk, which is the very thing the flag was chosen
for (the `--no-session-persistence` analogue) — so (b) likely means "write the rollout, read the one record,
delete the file", not "persist sessions".

**Skeptic:** the strongest case against pinning anything is that this measurement has a short shelf life — a
CLI that fetches its model catalogue from the server will keep changing what `<default>` means, and a pin is
a claim that must be re-measured. That is real, and it is the argument for re-running these probes on a CLI
upgrade rather than for leaving the choice implicit: an unpinned default also changes, it just changes
without anyone noticing.

## Ratified (all 4 forks) — 2026-09-11

**Ratified 2026-09-11 by the operator (Nicolas Gilbert).**

**Fork 1 — (b) pin, taken as ruled.** Every Codex invocation names its model explicitly — never the CLI's own
implicit default (measured live as silently resolving to the top rung, `gpt-6-astra`, today).

**Fork 2 — (b) one model, AMENDED at ratification.** The card's own recommended default — one model for every
Codex role, with effort as the only dial — is taken, but with the routing vocabulary made concrete rather
than left as "effort is already a knob": the Claude-side three-rung ladder (Haiku/Sonnet/Opus-equivalent,
we:agent-memory-src/always-set-subagent-model-explicitly.md) is **kept as a routing category**, not
collapsed to one undifferentiated tier — but for NOW all three categories resolve to the SAME real Codex
model. The card's own measurement forecloses a model-based split (three of four probes scored identically
across six of seven current-generation models; the one real separation found was by model *generation*, not
marketing tier), so building a three-model ladder anyway would encode an unmeasured assumption as doctrine.
What the evidence DOES support differentiating on is reasoning **effort**: the card's own "Effort moved
correctness where the model did not" table shows raising a weak model's `model_reasoning_effort` from its
default (`medium`) to `high` rescued it from 4/8 to 4/4 on the same probe, and dropping the strongest model to
`low` cost nothing. So the three rungs differentiate on effort, not model: `haiku → low`, `sonnet → medium`
(Codex's own measured default — unchanged, just made explicit), `opus → high`. This preserves the routing
interface/semantics for when real per-model capability evidence exists later, without inventing a tier split
today's data doesn't support. See we:docs/agent/backlog-workflow.md § Codex model routing for the codified
rule and we:scripts/codex-direct-task.mjs (`CODEX_TIER_EFFORT`/`resolveCodexEffort`) for the implementation.

**Fork 3 — (a) `gpt-6-astra`, taken as ruled.** Top score on every probe (8/8), lowest reasoning-token burn
among the perfect scorers, a named/stable catalogue entry (not `gpt-reserve`/`codex-auto-review`, the two
hidden/undocumented models that could disappear without notice), and it shares its weekly quota bucket with
the operator's own interactive Codex use — directly relevant given the operator is usage-conscious after a
real token-exhaustion incident (7 identical back-to-back runs moved that shared bucket by 0, versus
`gpt-5.3-codex-spark`'s measurably separate, faster-draining bucket).

**Fork 4 — (b) surface the quota signal, taken as ruled, with the card's own suggested fix.** Stop treating
`costUsd: 0` as the whole story: a real per-plan `rate_limits` signal (`used_percent`/`window_minutes`/
`resets_at`/`plan_type`) exists in a non-`--ephemeral` run's persisted rollout, and this matters directly for
the operator's stated priority (avoiding another unexpected usage exhaustion). Resolved via the card's own
suggested fix: write the rollout normally (drop `--ephemeral`), read the one quota record from it, then
explicitly delete the rollout file afterward — same net cleanliness as `--ephemeral`, but the signal gets read
first. Implemented as `collectAndClearRolloutQuota` in we:scripts/codex-direct-task.mjs.

**Implementation note (scope discrepancy, recorded rather than silently resolved).** This card's `scope`
names we:scripts/lib/codex-judge-spawn.mjs as the file whose `-m`/`--ephemeral` handling motivated this
decision — that file is real (`#xqa9ttq`, its own header explicitly discusses hardcoding `--ephemeral` and a
local `CODEX_EFFORT_MAP` copy) but lives only on the unmerged `origin/lane/xqa9ttq-review-pr-codex-advisory-
seat` branch as of this ratification's landing, not on `main` or this lane. The ratified constants
(`CODEX_MODEL`, `CODEX_TIER_EFFORT`, `resolveCodexEffort`) and the quota mechanism
(`collectAndClearRolloutQuota`/`readRolloutQuota`/`findRolloutFile`/`parseRolloutQuota`) are implemented on
we:scripts/codex-direct-task.mjs instead — the only real, currently-merged Codex CLI invocation in this
codebase — with the general rule codified in we:docs/agent/backlog-workflow.md § Codex model routing so it
applies uniformly once we:scripts/lib/codex-judge-spawn.mjs lands. One deliberate DIVERGENCE from the
literal Fork-4 fix text ("drop `--ephemeral`... delete the rollout file") for THIS specific call site:
we:scripts/codex-direct-task.mjs already does not pass `--ephemeral` by default, for a real, documented,
pre-existing reason (`codex exec resume <thread-id>` — a human resuming a task that stopped short). Deleting
the rollout after every run would silently remove that feature, which the fire-and-forget judge role Fork 4
was written against does not have. So `codexDirectTask` reads the quota signal WITHOUT deleting by default
(`readRolloutQuota`), and exposes the literal ratified read-then-delete shape (`collectAndClearRolloutQuota`)
behind an explicit opt-in (`clearRolloutAfterRun: true`) for a caller with no resume need — including the
future we:scripts/lib/codex-judge-spawn.mjs, whose fire-and-forget shape is exactly what Fork 4 was scoped
against. **Follow-up, not done here:** when we:scripts/lib/codex-judge-spawn.mjs lands, it should import
these same constants/functions (or their equivalent) rather than keeping its own separate `CODEX_EFFORT_MAP`
copy, and should call `collectAndClearRolloutQuota` unconditionally (it has no resume feature to protect).

## Done when

1. **Executable** — `npm run check:standards` passes with each fork above either resolved in place or
   delegated to a named child item, and the ruling promoted to we:docs/agent/backlog-workflow.md § *Model
   routing* (the `codifiedIn` target this item's resolve gate requires), so a future Codex call site cites
   the rule instead of re-deriving it.
2. The equivalence table above is either ratified as-is (including its non-finding) or superseded by a harder
   probe set, with lineage.
