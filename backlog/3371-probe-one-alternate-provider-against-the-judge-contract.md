---
bornAs: x356hzs
kind: story
size: 5
parent: "3369"
status: active
blockedBy: ["3370"]
scope: ["we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-08-27"
dateStarted: "2026-09-09"
tags: [operations, multi-provider, probe]
---

# Probe one alternate provider against the judge contract

`#3369` researched two candidates from public documentation — Codex CLI and Gemini CLI — and found both
plausible for a headless, schema-constrained judge role. Neither has been spawned against by this repo.
Mirroring `#3331`'s method: one search result is not evidence, and a design built on the search table would
repeat the exact mistake that card exists to correct. This item spawns a real process and records what
actually happens.

## Which candidate, and why this is a choice made HERE, not deferred again

Pick **one** — do not probe both in parallel; a half-probed second candidate is a worse record than a fully
probed first one. Recommendation: **Codex CLI**, on two facts from the epic's research, not preference —
`--output-schema` constrains the final response the same way `--json-schema` does today (closest shape match
of the two candidates), and its session-continuity model (`codex exec resume $SESSION`, id issued BY the
CLI) sidesteps the exact minted-vs-real-id trap `#3331` found in Claude's `--session-id`. If the probe finds
Codex CLI unavailable or unusable (no account, blocked signup, licensing issue), fall back to Gemini CLI and
say why in this card rather than silently substituting.

## What "probed" means — run it, don't read about it

1. **Install and authenticate** the chosen CLI against a real subscription account (not an API key — the
   whole point per `#3369` goal 2 is subscription-included usage).
2. **Spawn it headless with a schema-constrained ask**, using a JSON Schema of comparable shape to what
   `we:scripts/lib/judge-spawn.mjs`'s `shape` parameter carries today. Record the exact command and the raw
   stdout.
3. **Break it on purpose.** At minimum: an ask the schema cannot satisfy (does it refuse cleanly or emit
   invalid JSON?), a deliberately huge/slow request (what does a timeout look like?), and — if a way to
   simulate it exists — a quota-exhausted response (what does the CLI say, and does it resemble the
   `"Not logged in · Please run /login"` failure shape the judge-spawn module already handles for Claude?).
4. **Compare the parsing discipline.** Could `parseJudgeOutcome`'s approach — fail loud, fail with the
   spawn's own words — be satisfied by this CLI's stdout, or does it need materially different handling?

## Done when

1. **Executable** — this item's own card carries the exact commands run, the CLI version, and the raw
   (trimmed) output for each of the three probes above, the same evidentiary bar `#3331` set for itself.
   Reading the card must be enough to know whether the schema constraint held, without re-running anything.
2. **A written verdict**: is this candidate buildable as a second judge implementation of the port
   `#3370` extracts? If yes, what the port-conforming wrapper has to translate (argv shape, output
   parsing, failure-mode mapping) is listed concretely enough that `#3369` step 3 can be scoped without
   re-deriving it. If no, say what blocked it and whether the fallback candidate should be tried instead.
3. **Nothing is wired into the judge panel yet.** This item produces evidence and a verdict, not running
   code — wiring is `#3369` step 3, deliberately separated so a probe that fails does not leave half-built
   integration code behind.

## Deliberately NOT in scope

- **Wiring the result into the judge panel module.** That is the epic's step 3, and depends on this item's
  verdict being a clean yes.
- **The dispatcher/panelist spawn sites.** Same reasoning as `#3370` — judges first.

## The probe, as run — Codex CLI, 2026-09-09

**Candidate: Codex CLI**, as recommended above. No fallback to Gemini CLI was needed: the binary was present
and authenticated **on a ChatGPT subscription, not an API key**, so the `#3369` goal-2 condition holds for
every run recorded here. `gemini` is not installed on this machine (`command not found`), which is a second,
weaker reason the recommended candidate was the right one to spend the probe on.

```
$ codex --version
codex-cli 0.153.4

$ codex login status
Logged in using ChatGPT
```

Unless a probe says otherwise, every run below used this base argv, with the judged material on **stdin**
(`-`) — mirroring the stdin discipline the judge-spawn module already uses, and for the same reason:

```bash
codex exec --json --ephemeral --skip-git-repo-check --ignore-user-config \
  --sandbox read-only -C "$P" --output-schema "$P/shape-strict.json" \
  -o "$P/last.json" - < "$P/input.txt"
```

The judged material was a small real-looking diff (a `parsePort` validator weakened from `Number` +
range-check to a bare `parseInt`), and the mandate was prepended to it on stdin.

### Probe 1 — the schema constraint. IT HOLDS, but only after the shape is rewritten.

**The first attempt failed, and the failure is the most important single fact in this card.** The schema
handed to `--output-schema` was a faithful reduction of `REVIEW_JUDGE_SHAPE`
(`we:scripts/operations/review-pr.mjs`) — same `additionalProperties: false`, same
`required: ['findings', 'summary']` at the root, same partially-required finding object. Exit 1 in 2.8s,
before any model work:

```
{"type":"thread.started","thread_id":"01a086e5-493b-7653-835a-725748ffd2f4"}
{"type":"turn.started"}
{"type":"turn.failed","error":{"message":"{\n  \"type\": \"error\",\n  \"error\": {\n    \"type\": \"invalid_request_error\",\n    \"code\": \"invalid_json_schema\",\n    \"message\": \"Invalid schema for response_format 'codex_output_schema': In context=('properties', 'findings', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'file'.\",\n    \"param\": \"text.format.schema\"\n  },\n  \"status\": 400\n}"}}
```

`--output-schema` is OpenAI **strict** structured output: at every object level, `required` must list
*every* key in `properties`. This repo's judge shapes do not, by design — optionality is how a finding says
"I have no line number for this". Re-run with the same shape strictified (all keys required; `file`/`line`
widened to `["string","null"]`/`["number","null"]`), and the constraint held on the first try, exit 0 in
11.8s:

```
{"summary":"The change weakens port validation and accepts invalid inputs.","findings":[{"summary":"Removing the integer and upper-bound checks allows NaN (from inputs such as 'abc' or '') and ports above 65535 to be returned instead of throwing.","file":"src/parse.mjs","line":3,"verdict":"CONFIRMED"},{"summary":"parseInt silently accepts malformed or fractional inputs such as '80abc' and '80.5' as port 80; both previously threw.","file":"src/parse.mjs","line":2,"verdict":"CONFIRMED"}]}
```

**This is not a one-shape problem.** `JUROR_SHAPE` (`we:skills-src/jury/panel-fanout.mjs`) was measured the
same way and is worse: 1 of 3 root keys and **12 of 13** finding keys are absent from `required`. Any
Codex-backed provider needs a mechanical strictifier over the declared shape, not a hand-rewrite per caller.

### Probe 2 — break it: an ask the schema cannot satisfy. IT DOES NOT REFUSE, AND IT DOES NOT EMIT INVALID JSON.

The card asked which of the two happens. **Neither.** Schema `{capital: enum["Berlin","Madrid"]}`, ask *"What
is the capital of France? Answer honestly; do not guess."* — exit **0**, no error event, valid output:

```
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"{\"capital\":\"Berlin\"}"}}
{"type":"turn.completed","usage":{"input_tokens":14786,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":73,"reasoning_output_tokens":56}}
```

A grammar-constrained decoder cannot emit "none of these", so an unsatisfiable ask returns a **conforming
falsehood with a success exit code**. No parser can catch this, because nothing about the output is wrong.

**A control run says this is parity, not a Codex regression** — and running it is the only reason this card
can say so. The same schema and the same question through today's incumbent argv (`claude -p
--output-format json --safe-mode --tools '' --json-schema …`) behaved identically:

```
is_error: false, stop_reason: "tool_use", structured_output: {"capital": "Madrid"}
```

Different wrong city, same shape of failure. So this is a property of forced-tool-call/strict-schema
decoding in general, and it is a pre-existing risk in the judge contract that `#3371` merely documented —
not a reason to reject the candidate.

### Probe 3 — break it: the wall. NO CLI TIMEOUT EXISTS, AND THERE IS NOTHING PARTIAL TO SALVAGE.

`codex exec` has no timeout flag; the wall has to be the caller's `SIGKILL`, exactly as today. A deliberately
huge/slow ask (a 4000-line input with an instruction to enumerate twenty findings per line, six times over)
finished on its own in 9.7s at a 15s wall. Re-run at a 4s wall, the kill fires — and this is the whole
finding:

```
killed: true  code: null  signal: SIGKILL  wallMs: 4017  stdoutBytes: 101  stderrBytes: 0

{"type":"thread.started","thread_id":"01a086e6-f36e-7f90-966d-a2b8170d787b"}
{"type":"turn.started"}
```

Two well-formed JSONL lines and no answer. The final message arrives as **one atomic `item.completed`
line**, so a killed Codex juror never leaves a partially-written answer behind. The judge module's
"a killed juror is TRIED, not discarded" partial-parse recovery would be dead code against this provider.

**What replaces it is strictly better, though.** The `thread_id` survives on the partial stream, and
`codex exec resume <id>` genuinely continues that thread — verified separately: a first turn answered
`{"summary":"first turn","findings":[]}`, and the resumed turn quoted it back verbatim with
`cached_input_tokens: 15232` proving real continuity rather than a re-primed guess. The id is issued **by**
the CLI and echoed on resume, so the minted-vs-real trap `#3331` found in the Claude `--session-id` flag has
no analogue here.

### Probe 4 — break it: auth failure and quota exhaustion.

**Not-logged-in** (`CODEX_HOME` pointed at an empty directory) — exit 1, and the CLI's own words do reach
stdout, but only after **eleven** retry events across two transports spanning ~9.1s:

```
{"type":"error","message":"Reconnecting... 2/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: wss://api.openai.com/v1/responses, …)"}
… 3/5, 4/5, 5/5 …
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Falling back from WebSockets to HTTPS transport. unexpected status 401 Unauthorized: …"}}
{"type":"error","message":"Reconnecting... 1/5 (unexpected status 401 Unauthorized: … url: https://api.openai.com/v1/responses …)"}
… 2/5 … 5/5 …
{"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses, …"}}
```

This does resemble the `"Not logged in · Please run /login"` shape the judge module already handles — same
"the transport told us why, verbatim" character — except it costs ~9s and ten noisy events to get there.

**Quota exhaustion IS simulable**, and the result is the ugly one. A local stub on `127.0.0.1:8731`
returning `429` with a full OpenAI rate-limit body (`"Rate limit reached … Limit 500, Used 500"`, plus
`retry-after: 60`), reached via a stub provider override:

```bash
FAKE_KEY=sk-stub codex exec --json --ephemeral --skip-git-repo-check --ignore-user-config \
  --sandbox read-only -C "$P" \
  -c 'model_providers.stub={name="stub",base_url="http://127.0.0.1:8731/v1",wire_api="responses",env_key="FAKE_KEY",request_max_retries=1,stream_max_retries=1}' \
  -c model_provider=stub -c model=gpt-5 --output-schema "$P/shape-strict.json" -
```

```
{"type":"error","message":"exceeded retry limit, last status: 429 Too Many Requests"}
{"type":"turn.failed","error":{"message":"exceeded retry limit, last status: 429 Too Many Requests"}}
```

Exit 1. **The server's own error text is discarded** — the rate-limit message, the limit numbers and the
`retry-after` header are all thrown away and replaced with the CLI's own eight-word summary. This is the one
place Codex fails the "fail with the spawn's own words" discipline outright, and it is the failure mode an
operator most needs the words for.

### Probe 5 — the parsing discipline, compared.

`parseJudgeOutcome`'s approach survives, but not unchanged. Four concrete differences, each observed:

1. **JSONL, not one object.** Output is an event stream; `JSON.parse(stdout)` is wrong on every run.
2. **`item.completed` is not always the answer.** Observed item types across these probes:
   `agent_message`, `command_execution`, and `error`. A parser keying on `item.completed` alone reads a
   shell transcript as a verdict.
3. **There can be more than one `agent_message`, and the first is prose.** When the model narrates before
   answering, `item_0` is `"I'll list the working directory, including hidden files.\n"` and `item_1` is the
   schema-conforming JSON. The answer is the **last** `agent_message`, not the only one.
4. **The answer is a STRING, not a parsed object.** Where Claude hands back `structured_output` already
   parsed, Codex hands back `item.text` that must be `JSON.parse`d a second time.

`-o <file>` sidesteps 1–4 entirely: it was verified to write exactly the last agent message, and on the
two-message run it wrote the JSON rather than the prose. **Read the answer from that file; use the JSONL
stream only for the thread id, the usage block, and `turn.failed`.**

### Also found, because a probe finds what it finds

- **There is no tool-free mode.** No `--tools ''` analogue exists. Under `--sandbox read-only` the agent
  still executes arbitrary shell — asked to, it ran `/bin/bash -lc 'ls -a'` and returned the listing. Writes
  *are* genuinely blocked by the OS sandbox rather than by the model's cooperation (`touch …/WROTE.txt` →
  `Operation not permitted`, and the file did not appear). So the judge module's guarantee 1 splits in two
  against this provider: "cannot write" survives and is arguably stronger; "cannot act at all" does not
  exist.
- **`-c` overrides are silently unvalidated.** `-c totally_bogus_key_xyz=1` was accepted with no error at
  all. Anything configured this way must be verified by observing behaviour, never by the command exiting 0.
- **The mandate has no verified system-prompt channel.** `-c base_instructions=…` was accepted and had no
  observable effect (an instruction to prefix every summary with a literal token was not honoured) — and per
  the previous bullet, "accepted" means nothing. Every probe here delivered the mandate by prepending it to
  the stdin prompt, and that worked. `--append-system-prompt` has no equivalent.
- **No cost is reported anywhere.** `turn.completed.usage` carries `input_tokens`, `cached_input_tokens`,
  `cache_write_input_tokens`, `output_tokens` and `reasoning_output_tokens`. There is no `total_cost_usd`
  and no `--max-budget-usd`.
- **`--ephemeral` and `codex exec resume` are mutually exclusive** — the isolation flag is what destroys the
  thread the resume path needs.
- **`codex exec resume` takes a narrower flag set than `codex exec`**: it keeps `--output-schema`,
  `--json`, `-o`, `-m`, `--ephemeral` and `--ignore-user-config`, but has **no `--sandbox` and no `-C`** (it
  inherits the original thread's). A resume wrapper cannot re-assert the sandbox it started under.

## Verdict — YES, buildable, with one unresolved blocker for panel callers

**Codex CLI 0.153.4 can satisfy the `JudgeProvider` port** (`we:scripts/operations/cli-adapter.mjs`). The
port's request fields all have a translation, the outcome shape can be filled, and nothing about the
contract's *shape* fights this CLI. `#3369` step 3 can be scoped from the list below without re-deriving
any of it.

**Argv translation** — what a port-conforming wrapper builds:

| port field | Claude today | Codex |
| --- | --- | --- |
| `shape` | `--json-schema <json string>` | `--output-schema <FILE>` — **strictified**, written to a temp file |
| `mandate` | `--append-system-prompt` | prepend to the stdin prompt (no verified flag) |
| `input` | stdin | stdin, as `-` |
| `model` | `--model` | `-m/--model` |
| `effort` | `--effort` | `-c model_reasoning_effort=…`, unvalidated — must be behaviour-checked |
| `budget` | `--max-budget-usd` | **no equivalent** |
| `runId`+`lens` | `--session-id <derived uuid>` | **no equivalent** — read `thread_id` off `thread.started` |
| `allowedTools` | `--tools ''` / `--allowedTools` | **no equivalent** — only `--sandbox read-only\|workspace-write` |
| `cwd` | spawn cwd | `-C <DIR>` (and spawn cwd) |
| isolation | `--no-session-persistence` | `--ephemeral` + `--ignore-user-config` + `--ignore-rules` |

**Output parsing** — read `-o <file>` for the answer and `JSON.parse` it; scan the JSONL for `thread.started`
(actor id), `turn.completed.usage` (tokens; **`costUsd` has no source and must be reported as unknown, not
0**), and `turn.failed`. Never `JSON.parse` the whole of stdout, and never trust the first `agent_message`.

**Failure-mode mapping** — `turn.failed.error.message` is the analogue of `is_error` + `result`, and
verbatim passthrough is right for it in the 400 and 401 cases. It is **wrong for 429**, where the wrapper
must say "the CLI discarded the provider's words" rather than imply those eight words are all that was
said. `JudgeTimeoutError` maps to a caller `SIGKILL` as today, minus the partial-parse salvage.
`JudgeBudgetError` has **no counterpart and cannot be raised** — see the blocker.

**THE ONE BLOCKER, and it is a design question rather than a CLI defect.** `we:scripts/lib/judge-panel.mjs`
inherits `DEFAULT_BUDGET_USD` per seat and feeds it to `assertPanelBudget`, which refuses any
non-positive-finite per-juror budget because an aggregate ceiling cannot be computed over a roster of
`null`s. A Codex seat can neither accept a ceiling nor report a spend, so **a mixed-provider panel has no
aggregate budget at all** — and today's per-seat accounting quietly assumes every seat is priced in dollars.
Nothing in this probe resolves that; `#3369` step 3 must decide whether a subscription-metered seat is
budget-exempt, or whether the panel switches to a token-based ceiling that both providers can report.
That decision should be made before any wiring, not discovered during it.

**Nothing was wired.** Per Done-when 3, this item produced evidence and a verdict only; no module changed.

## Progress

- Probed **Codex CLI 0.153.4** on a ChatGPT subscription — the recommended candidate, no fallback needed.
  All five probe classes the card asked for were run for real, and the raw output is above.
- The headline result is a **yes with a rewrite**: `--output-schema` enforces OpenAI strict mode, so this
  repo's judge shapes are rejected as written and need a mechanical strictifier. Once strictified, the
  constraint held first try.
- The schema-cannot-satisfy probe returned a **conforming falsehood at exit 0**. A control run proved the
  incumbent does exactly the same, so this is a pre-existing contract risk, not a candidate defect.
- Quota exhaustion was simulated against a local 429 stub. It is the one place Codex **discards the
  provider's own error text**, which is a real conflict with `parseJudgeOutcome`'s discipline.
- Recorded one blocker for `#3369` step 3: per-seat USD budgeting has no Codex counterpart, and
  `assertPanelBudget` cannot form an aggregate ceiling over a roster that mixes the two.
- No code changed — Done-when 3 is deliberate, and honoured.

## Lineage

Second decomposition step of `#3369` (multi-provider agent dispatch), filed 2026-08-27. Candidate research
— Codex headless/JSON: [openai/codex issue #4219](https://github.com/openai/codex/issues/4219); Codex
subscriptions: [Inventive HQ](https://inventivehq.com/blog/codex-subscription-options-guide); Gemini CLI
headless docs: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md).
