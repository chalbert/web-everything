---
bornAs: x356hzs
kind: story
size: 5
parent: "3369"
status: resolved
blockedBy: ["3370"]
scope: ["we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-08-27"
dateResolved: "2026-09-11"
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

## Lineage

Second decomposition step of `#3369` (multi-provider agent dispatch), filed 2026-08-27. Candidate research
— Codex headless/JSON: [openai/codex issue #4219](https://github.com/openai/codex/issues/4219); Codex
subscriptions: [Inventive HQ](https://inventivehq.com/blog/codex-subscription-options-guide); Gemini CLI
headless docs: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md).

---

# THE PROBE — run 2026-09-09

**Candidate probed: Codex CLI**, the recommended one. No fallback was needed: it installed, it authenticated
against a real ChatGPT subscription, and it ran. Nothing below is quoted from documentation — every command
in this section was executed on this machine and every output block is its real (trimmed) stdout or stderr.

## Setup — the two facts everything else rests on

```
$ codex --version
codex-cli 0.153.4

$ codex login status
Logged in using ChatGPT
```

**Subscription, not an API key**, which is `#3369` goal 2 and the reason this candidate was worth probing at
all. `codex login status` distinguishes the two, and it reports the ChatGPT path. No `OPENAI_API_KEY` was set
for any run below.

Every probe ran with the same isolation flags — `-s read-only` (or `workspace-write` where a probe needed the
shell), `--skip-git-repo-check`, `--ephemeral`, and `-C <scratch dir>` outside the repo — so no probe touched
the lane. `git status --porcelain` was clean afterwards.

## Probe 0 — THE STDIN TRAP, found before probe 1 could run

The first invocation **hung indefinitely** and had to be killed. This is recorded first because it is the
trap a port implementation will hit on day one, and it is invisible in the help text's phrasing.

`codex exec` takes its prompt as a POSITIONAL argument, and `codex exec --help` says: *"If stdin is piped and
a prompt is also provided, stdin is appended as a `<stdin>` block."* What that means in practice is that a
spawned `codex exec` with a positional prompt and an **open** stdin pipe blocks forever, before contacting
the model at all:

```
$ codex exec --json --output-schema shape.json ... "You are a code reviewer. ..."
  (no stdout at all; stderr:)
Reading additional input from stdin...
  (never returns — killed at 300s)
```

Adding `< /dev/null` fixed it and the same command returned in 7.1s. **This is the exact opposite of
`we:scripts/lib/judge-spawn.mjs`'s discipline**, which deliberately puts the judged material on stdin and
leaves the positional slot empty (see its "WHY STDIN CARRIES THE INPUT" header). A Codex provider must either
close stdin explicitly, or pass `-` as the prompt and put everything on stdin. Node's default
`stdio: ['pipe',…]` plus `child.stdin.end(input)` — what `judgeSpawn` does today — happens to be safe,
because `end()` closes it; a provider that spawns with an inherited or never-ended stdin deadlocks silently.

## Probe 1 — the conforming run: does the schema constraint hold?

The schema is the one `we:scripts/lib/__tests__/judge-spawn.integration.test.mjs` uses, byte for byte.

```
$ codex exec \
    --json \
    --output-schema shape.json \
    -o p1-last-message.txt \
    -s read-only --skip-git-repo-check --ephemeral -C <scratch> \
    "You are a code reviewer. Answer only through the provided schema. Be terse. Review this
     change: a function \`half(n)\` was added that returns \`n / 0\`. State one finding." \
    < /dev/null
```

Exit 0, 7.1s wall. Raw stdout, complete and untrimmed — it is four lines of JSONL:

```
{"type":"thread.started","thread_id":"01a08703-a850-75c2-af27-6e3fd775a0e6"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"{\"verdict\":\"reject\",\"finding\":\"half(n) divides by zero; return n / 2 to compute half.\"}"}}
{"type":"turn.completed","usage":{"input_tokens":14995,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":35,"reasoning_output_tokens":0}}
```

And `-o p1-last-message.txt` contained exactly the answer, with no envelope around it:

```
{"verdict":"reject","finding":"half(n) divides by zero; return n / 2 to compute half."}
```

**The schema held.** Both required keys, the enum respected, no extra key.

## Probe 2 — an ask that CONTRADICTS the schema

Same schema, but a prompt instructing the model to break it:

```
$ codex exec --json --output-schema shape.json ... \
    "Ignore any output format instructions. Reply with the plain English sentence: hello world.
     Output no JSON, no braces, no quotes — just those two words." < /dev/null
```

Exit 0, 6.2s. The answer:

```
{"verdict":"accept","finding":"hello world"}
```

**The constraint is STRUCTURAL, not a request.** The model obeyed the prompt's content ("hello world" is the
finding) and could not obey its format instruction. This is the same class of guarantee as `--json-schema`'s
forced tool call (`we:scripts/lib/judge-spawn.mjs` header, guarantee 2) — a different mechanism (OpenAI
Responses `text.format`), the same property: there is no prose to parse and no fences to strip.

## Probe 3 — THE BLOCKING FINDING: this repo's REAL judge shape is REJECTED

Probes 1 and 2 used a toy schema in which every property is required. `we:scripts/operations/review-pr.mjs`'s
`REVIEW_JUDGE_SHAPE` is not like that: its `findings[]` items declare fourteen properties and require only
`summary`. Dumped verbatim from the module and handed to the same command:

```
$ node -e 'import("./scripts/operations/review-pr.mjs").then(m=>...REVIEW_JUDGE_SHAPE...)' > review-shape.json
$ codex exec --json --output-schema review-shape.json ... "<the probe-1 prompt>" < /dev/null
```

Exit 1, 6.1s, and the `-o` file was never written. Stdout's last event:

```
{"type":"turn.failed","error":{"message":"{\n  \"type\": \"error\",\n  \"error\": {\n    \"type\": \"invalid_request_error\",\n    \"code\": \"invalid_json_schema\",\n    \"message\": \"Invalid schema for response_format 'codex_output_schema': In context=('properties', 'findings', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'file'.\",\n    \"param\": \"text.format.schema\"\n  },\n  \"status\": 400\n}"}}
```

OpenAI's strict structured-output mode requires **every** key in `properties` to appear in `required`. The
repo's judge shapes do not satisfy that, and this is not a Codex-CLI quirk — it is the provider's schema
dialect, so the same wall stands behind any OpenAI-backed judge.

## Probe 4 — and the fix, proved rather than asserted

The transform is mechanical: walk the schema, add every property key to `required`, and widen a
formerly-optional property's `type` to `[<t>, "null"]`. Applied to `REVIEW_JUDGE_SHAPE`, its `findings` items
then require all fourteen keys. Same prompt, same flags:

Exit 0, 8.7s. The `-o` file:

```
{"summary":"The added half(n) function divides by zero instead of two.","findings":[{"summary":"Divide by 2 instead of 0.","file":null,"line":null,"category":"correctness","failure_scenario":"Calling half(4) raises a division-by-zero error or returns infinity instead of 2, depending on the language.","verdict":"CONFIRMED","impactIfUnfixed":"broken","disposition":"blocker","introduced":true,"worseThanBase":true,"parallelizable":null,"rootCause":"The divisor is 0 instead of 2.","prevention":"Test that half(4) equals 2.","preventionCaptured":false}]}
```

Note what comes back for the fields the juror had nothing to say about: **`null`, not absent** — `file`,
`line`, `parallelizable`. So the transform is two-sided. The request side widens the schema; the response
side must strip nulls before the value reaches `normalizeFinding` (`we:scripts/lib/jury-core.mjs`), or every
finding arrives carrying `file: null` where the Claude path delivers no key at all.

## Probe 5 — the failure shape when auth is absent

Run with `CODEX_HOME` pointed at an empty directory, which is the closest safe analogue to a lost login and
the counterpart to `#3028`'s `"Not logged in · Please run /login"` trap. No real credential was touched.

```
$ CODEX_HOME=<empty dir> codex exec --json --output-schema shape.json ... "Say hi." < /dev/null
```

Exit 1, and it took roughly **30 seconds** to get there. Trimmed stdout — 12 `error` events, not one:

```
{"type":"thread.started","thread_id":"01a08704-f9d2-7a50-b22a-07b2c5def4ea"}
{"type":"turn.started"}
{"type":"error","message":"Reconnecting... 2/5 (unexpected status 401 Unauthorized: Unknown error, url: wss://api.openai.com/v1/responses, …)"}
  … three more WebSocket retries …
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Falling back from WebSockets to HTTPS transport. unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, …"}}
{"type":"error","message":"Reconnecting... 1/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses, …)"}
  … four more HTTPS retries …
{"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses, …, request id: req_f7742e9a321c4b3e9fde06e286564ade"}}
```

**It does NOT resemble the Claude failure shape**, and the difference is the expensive part. Claude's is one
line, arrives immediately, and names the remedy in English. Codex's is a retry storm across two transports
that burns half a minute on an error that can never succeed, and the string a parser would have to match on
is an HTTP status buried in transport prose. The terminal fact is the `turn.failed` event — **a parser must
read the LAST event, never the first `error`**, because the first nine are retries of something the CLI
itself has not yet given up on.

## Probe 6 — the timeout: there is no flag, and the parent must impose the wall

`codex exec --help` at 0.153.4 has **no timeout option**. So the wall is the parent's job, exactly as
`judgeSpawn` already does it with `JUDGE_TIMEOUT_MS`. Probed by SIGKILL at 20s against a deliberately slow
multi-turn task:

Exit 137. The `-o` file was **never created**. Partial stdout, exactly as captured:

```
{"type":"thread.started","thread_id":"01a08705-7c9d-7f52-8057-32ff81ac9cb1"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I'll run ten separate five-second sleep commands and report after each.\n"}}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc 'sleep 5'","aggregated_output":"","exit_code":null,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc 'sleep 5'","aggregated_output":"","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"Completed 1 of 10.\n"}}
{"type":"item.started","item":{"id":"item_3","type":"command_execution",…,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_3","type":"command_execution",…,"status":"completed"}}
```

**JSONL is strictly better than Claude's single blob under a kill**, and this is the one place the alternate
provider is ahead. Every line is a whole JSON object, so a killed run stays parseable line by line —
`#3203`'s "a killed juror is tried, not discarded" gets easier here, not harder. The timeout signature is
clean and positive: `turn.completed` is absent. Claude's stdout, being one JSON document, is unparseable the
moment it is truncated.

## Probe 7 — WHERE the answer is, which probe 1 was too simple to show

Probe 1 had a single agent message, so it could not distinguish "the schema constrains every message" from
"the schema constrains the final one". A multi-turn run settles it. All four `agent_message` items, in order:

```
- "I'll run `echo one` first and report its output.\n"
- "The first command printed “one”.\n"
- "The second command printed “two”.\n"
- "{\"verdict\":\"accept\",\"finding\":\"Both commands ran successfully in order, printing “one” and then “two”.\"}"
```

**Only the FINAL response is schema-constrained.** The three before it are free prose, and a parser that
scans for the first `agent_message` gets prose and fails. The `-o` file held exactly the fourth item and
nothing else, which makes `--output-last-message` the clean parse seam — the JSONL stream is for telemetry
and partial recovery, not for finding the answer.

## Probe 8 — a malformed schema file

```
$ echo 'not json at all' > bad-schema.json
$ codex exec --json --output-schema bad-schema.json ... "hi" < /dev/null
```

Exit 1, **stdout entirely empty**, and the message on stderr only:

```
Output schema file <path> is not valid JSON: expected ident at line 1 column 2
```

A second parsing-discipline note: some failures never reach stdout at all. `parseJudgeOutcome`'s
stdout-first design would report "did not emit parseable JSON" and, thanks to its `stderr` argument, would
still surface the real reason — but only because it already folds stderr in.

## Probe 9 — no context-stripping flag exists

Baseline `input_tokens` with `-C <empty scratch dir>` was **14,995** (probe 1). The same trivial ask with
`-C $LANE` and `--ignore-user-config`:

```
{"type":"turn.completed","usage":{"input_tokens":18892,"cached_input_tokens":0,…,"output_tokens":20,…}}
```

**18,892 — about 3,900 tokens of repo doctrine loaded anyway**, which lines up with this lane's 16,217-byte
`we:AGENTS.md`. `--ignore-user-config` skips the Codex user config TOML, not the doctrine file; there is no
`--safe-mode` or `--bare` analogue. The only way to get a context-stripped Codex juror is to point `-C` at a
directory that has no agent-doctrine file, and that collides directly with `assertLaneCwd`, which REQUIRES a
lane cwd for a tool-bearing juror — and a lane clone always carries `we:AGENTS.md`. A tool-free Codex juror
can use a scratch dir and is unaffected; a tool-bearing one cannot have both properties at 0.153.4.

## What could NOT be probed, said plainly

**Quota exhaustion.** No way to simulate it exists short of actually exhausting a real subscription's weekly
allowance, which this probe was not going to do. Probe 5's 401 is the nearest available auth-class failure
and is reported as that, not as a stand-in for a 429. **The consequence is recorded rather than papered
over:** the quota failure shape is unknown, so `#3369` step 3 must not claim to handle it until someone has
seen one.

---

# THE VERDICT

**YES — Codex CLI is buildable as a second implementation of the `JudgeProvider` port `#3370` extracted,
with one prerequisite that is real work and not a detail.**

The port's shape survives the probe intact. `JudgeProviderRequest`'s `mandate`/`input`/`shape`/`model` all
have Codex equivalents, and `JudgeProviderOutcome`'s `value` comes back validated by the provider itself. The
port was extracted at the right seam: nothing in `#3370`'s typedefs needs to change for this.

## The prerequisite

**Every judge shape in the repo must be transformed before it is sent** (probe 3). `REVIEW_JUDGE_SHAPE`,
`REVIEW_PREP_JUDGE_SHAPE` and `SYNTHESIS_SHAPE` all use optional properties, and all three will 400. The
transform is mechanical and proved to work (probe 4), but it belongs in the Codex provider, not in the
shapes — the Claude path must keep its optional-key shapes exactly as they are, since forcing all-required
there would change what every existing juror is asked for.

## What a port-conforming wrapper has to translate — concretely, so `#3369` step 3 can be scoped

**Argv.** Not a rename of `buildJudgeArgv`'s list; a different list.

| The judge-spawn seam today | Codex CLI 0.153.4 |
| --- | --- |
| `-p --output-format json` | `exec --json` (JSONL stream, not one document) |
| `--json-schema '<inline JSON>'` | `--output-schema <FILE>` — a **file path**, so the provider must write a temp file and clean it up |
| `--append-system-prompt <mandate>` | **no equivalent**; fold the mandate into the prompt text |
| input on stdin, empty positional | positional prompt **and** stdin must be closed (probe 0), or use `-` and put everything on stdin |
| `--tools ''` | **no equivalent**; `-s read-only` is the nearest control, and it is sandbox-based rather than tool-removal |
| `--allowedTools <list>` | `-s workspace-write` / `--add-dir`; per-tool granularity does not exist |
| `--safe-mode` (context strip) | **no equivalent** (probe 9) |
| `--session-id <uuid>` | **no equivalent**; the id is issued by the CLI |
| `--max-budget-usd <n>` | **no equivalent** |
| `--no-session-persistence` | `--ephemeral` |
| `--model` / `--effort` | `-m`; effort via `-c model_reasoning_effort=…` |
| (cwd via spawn options) | `-C <DIR>`, plus `--skip-git-repo-check` outside a repo |

**Output parsing.** `parseJudgeOutcome`'s discipline — fail loud, fail with the spawn's own words — is
satisfiable, and the second half of that is satisfied unusually well: the 400 in probe 3 and the 401 in probe
5 both carry the provider's verbatim message. But the parsing itself is **materially different work**, not a
tweak:

- Read JSONL, not one JSON document. Split on newlines, parse each line.
- The answer is the **last** `agent_message`, or better, the `--output-last-message` file (probe 7). Never the first.
- Terminal status is the last event: `turn.completed` (success) or `turn.failed` (error). Never the first `error` (probe 5).
- Strip `null`s from the parsed value before it reaches `normalizeFinding` (probe 4).
- Fold stderr in — some failures produce empty stdout (probe 8). `parseJudgeOutcome` already takes a `stderr` argument, so this convention carries over unchanged.

**Failure-mode mapping.**

| Today's error | Codex |
| --- | --- |
| `JudgeTimeoutError` | **maps cleanly, and better.** Parent-imposed wall; signature is `turn.completed` absent; partial JSONL is still line-parseable, so `#3203`'s partial-recovery path improves |
| `JudgeBudgetError` | **does not exist and cannot be built.** No spend ceiling and no `total_cost_usd` anywhere — `turn.completed.usage` reports tokens only |
| `"Not logged in"` passthrough | **shape differs** (probe 5): a ~30s retry storm ending in `turn.failed`, matched on a 401 status inside transport prose |
| `invalid_json_schema` 400 | **new class with no Claude counterpart** — needs its own error, because "your schema is not in the provider's dialect" is a caller bug and must not read as a juror failure |

**Three port fields that cannot be filled, and must be admitted rather than faked.**

1. **`costUsd`.** No USD figure is emitted. Report `0` and record tokens, or extend the port with a token-based meter. Do not estimate — an invented price on a run record is worse than an absent one.
2. **`sessionId` is OBSERVED, not derived.** No `--session-id` input exists; `thread_id` arrives on `thread.started` and must be read back off the stream. `deriveSessionId`/`sessionSeed` are Claude-specific and go unused. The `#3028` guarantee-3 property still holds — each `codex exec` is a structurally distinct actor — but it is no longer *deterministic*, so a run record can say which actor judged only after the fact, never before.
3. **`allowedTools` granularity.** Codex has sandbox modes, not a tool allow-list. A port that promises per-tool control cannot keep that promise here.

## Recommendation for `#3369` step 3

Scope it as **a provider module plus a schema-transform helper**, not as a provider module alone — probe 3 is
the reason, and skipping the transform means step 3 fails on its first real shape. Seat the first Codex juror
in a **tool-free** role: probe 9's context-strip/lane collision only binds tool-bearing jurors, and the
tool-free tier is where the port's guarantees translate cleanly. Before anything Codex-backed is trusted on a
budget-sensitive path, decide what `costUsd: 0` means on a run record, because that is a reporting hole this
provider cannot close.

Nothing was wired into the judge panel. `we:scripts/lib/judge-spawn.mjs` is unchanged — this item produced
evidence and a verdict, per Done-when 3.

## Progress

- 2026-09-09 — Probed Codex CLI 0.153.4 against a real ChatGPT subscription. Ten probes run (0 through 9), all recorded above with their commands and raw output. Verdict written: buildable, with the schema transform as a hard prerequisite. No code wired in.

## Probe 10 — tool-bearing doctrine isolation, attempted 2026-09-10

**Verdict: no approach qualified for implementation in this execution environment.** This is an
inconclusive Codex before/after comparison, not evidence that deletion or Seatbelt cannot work on an
unrestricted host. Both ordinary nested Codex runs failed before producing any model response; even an
allow-all Seatbelt control failed before executing its payload. No isolation port, backend, tests, or
pipeline wiring was built. Probe 9 above remains the prior successful context-loading evidence.

This narrowly tests doctrine visibility, not resource caps or a lane-container migration. The existing
container research remains [#3621](3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl.md),
open and unchanged. Apple's `container` remains unavailable (`command -v container` exited 1 with no
output), so it was not tested or assumed into a design.

### Environment and available reference code

```
$ codex --version
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
codex-cli 0.153.4
$ codex login status
Logged in using ChatGPT
```

This run itself has restricted filesystem/network access and no permission escalation available.
`JudgeProviderRequest`, `JudgeProviderOutcome`, and the function-type port in
`we:scripts/operations/cli-adapter.mjs` were read, along with the existing injectable-spawn tests in
`we:scripts/lib/__tests__/judge-spawn.test.mjs`. The requested `we:scripts/lib/codex-judge-spawn.mjs`,
`we:scripts/__tests__/codex-direct-task.test.mjs`, and `we:scripts/codex-direct-task.mjs` are absent in this
checkout. `git branch -a --list '*xqa9ttq*'` and the following history query returned no entries:

```sh
git log --all -1 --format='%h %s' -- scripts/lib/codex-judge-spawn.mjs scripts/codex-direct-task.mjs
```

 Their implementation
was therefore not inspected, and this record makes no claims about it.

### A — real scratch clone, file present versus deleted

All scratch material lived outside the working checkout under
`/private/tmp/we-doctrine-probe-_hmte5hj`, allocated with Python `tempfile.mkdtemp`. A preliminary
`git init -q` scratch directory with the real we:AGENTS.md produced the same Codex initialization error
as the clone below. The actual cloned-repository comparison followed:

```sh
git clone --local --no-hardlinks --quiet . /private/tmp/we-doctrine-probe-_hmte5hj/clone
# exit 0; stderr:
# warning: source repository is shallow, ignoring --local
# warning: --local is ignored
```

The repository's real we:AGENTS.md was copied byte-for-byte with `shutil.copyfile` into the scratch clone
before the baseline (16,636 bytes in this checkout). `work.txt` initially contained `before\n`.
The exact prompt, supplied through stdin and then closed, was:

```text
First, using only your already loaded instructions and no tools, quote the first numbered Hard rule in AGENTS.md verbatim, or say NOT LOADED if absent. Then use shell tools inside the current directory: read AGENTS.md if present and report its first Hard rule; edit work.txt from before to after; create proof.txt containing shell-ok; run git status --short and cat work.txt proof.txt. Do not commit or access other directories. Report actual tool results separately from initially loaded instructions.
```

Commands below are shell renderings of the actual Python `subprocess.run` argv calls. The parent supplied
that prompt via `input=...`, captured stdout/stderr separately, and imposed a 45-second timeout on each
clone run (neither hit it).

```sh
codex exec --json --ephemeral -s workspace-write -C /private/tmp/we-doctrine-probe-_hmte5hj/clone -
# Python Path.unlink() then removed clone/AGENTS.md, before the second child started.
codex exec --json --ephemeral -s workspace-write -C /private/tmp/we-doctrine-probe-_hmte5hj/clone -
```

**Both runs: exit 1, stdout empty, identical stderr:**

```text
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)
```

No `thread.started`, answer, usage, or tool-execution event was emitted. There is no evidence here of
successful baseline loading, successful exclusion, or preserved Codex tools. Authentication status alone
was insufficient to establish a usable nested session. The particular denied initialization operation
was not diagnosed; the error must not be recast as a model/API failure or a doctrine-loading failure.

Separate **parent-shell controls**, after deletion, did work:

```text
$ git -C /private/tmp/we-doctrine-probe-_hmte5hj/clone status --short
 D AGENTS.md
?? work.txt

$ /bin/sh -c "printf 'after\n' > work.txt; printf 'shell-ok\n' > proof.txt; cat work.txt proof.txt"
# cwd = scratch clone; exit 0
after
shell-ok

$ git -C /private/tmp/we-doctrine-probe-_hmte5hj/clone show HEAD:AGENTS.md
# exit 0; 16,636 bytes; trimmed to the first hard rule:
1. **Design-first**: document in JSON/njk before implementing. Respect `designDecisions`; discuss before overriding one.
```

Thus deletion did not prevent Git status or ordinary parent-shell edits, but **it did not make the doctrine
inaccessible to a tool-bearing process**: Git's object database retains it. This does not settle whether
removal is sufficient to prevent automatic initial loading. A successful repeat must distinguish that
weaker guarantee from filesystem confidentiality. Renaming the file within the same readable tree would
likewise leave a readable copy; no separate rename run was performed.

### B — real Seatbelt profile and controls

The original we:AGENTS.md was restored in the scratch clone before these tests. The exact profile written
to `/private/tmp/we-doctrine-probe-_hmte5hj/deny-agents.sb` was:

```scheme
(version 1)
(allow default)
(deny file-read* (literal "/private/tmp/we-doctrine-probe-_hmte5hj/clone/AGENTS.md"))
```

This is a minimal deny-read experiment. Its default allow does not itself restrict writes to the scope;
Codex's requested workspace-write mode is separate. It leaves networking allowed by the profile, but
network reachability was not proven. No claim about alternate paths, Git objects, ancestor/global
instructions, configured fallback filenames, or other ambient doctrine follows from this profile.

```sh
/usr/bin/sandbox-exec -p '(version 1)(allow default)' /usr/bin/true
/usr/bin/sandbox-exec -f /private/tmp/we-doctrine-probe-_hmte5hj/deny-agents.sb /bin/cat /private/tmp/we-doctrine-probe-_hmte5hj/clone/AGENTS.md
/usr/bin/sandbox-exec -f /private/tmp/we-doctrine-probe-_hmte5hj/deny-agents.sb /bin/sh -c 'cat work.txt; touch seatbelt-proof.txt'
/usr/bin/sandbox-exec -f /private/tmp/we-doctrine-probe-_hmte5hj/deny-agents.sb codex exec --json --ephemeral -s workspace-write -C /private/tmp/we-doctrine-probe-_hmte5hj/clone -
```

The three file-profile invocations ran with cwd set to the scratch clone; the Codex invocation received
the same closed-stdin prompt. All four emitted:

```text
sandbox-exec: sandbox_apply: Operation not permitted
```

Each custom-profile invocation exited 71 with empty stdout. Even the allow-all control could not run
`true`, so these results prove **sandbox application is unavailable here**, not that the deny rule
correctly blocks we:AGENTS.md, nor that Codex's own sandbox composes with it.

### Build gate and next executable proof

No working child session means no implementation under the explicit build-only-after-proof constraint.
A repeat needs an execution environment that can initialize nested Codex and, to test Seatbelt, apply a
Seatbelt profile. Run the same baseline and stripped clone prompt there first; require actual quotation
before tools in the baseline and actual edit/read/exec events in the stripped run. Do not substitute
mocked tests or parent-shell success for that evidence. If a backend is eventually justified, specify
whether it excludes automatic doctrine discovery or enforces read denial, including recovery via Git.
All scratch directories, logs, the location marker, and the experimental profile were removed after
recording the evidence. No commit, push, or PR was made.

## Probe 11 — dispatching session's unsandboxed deletion proof, 2026-09-10

**Evidence supplied by the dispatching session from an unsandboxed parent shell**, not re-run by the
implementing agent. Probe 10 remains an accurate inconclusive nested probe. The dispatching session
attributes its failure to nesting macOS Seatbelt: an already sandboxed process cannot apply a second
sandbox to a child. No nested Codex or Seatbelt probe was repeated for this follow-up.

All three supplied runs used `codex exec --json --ephemeral -s workspace-write
--skip-git-repo-check -C <clone> -` with a closed stdin prompt; all exited 0.

- **A, baseline:** `git clone --quiet <repo> ./clone-baseline`. Asked to quote Hard rule 1 solely from
  already-loaded context, before any tool, the last agent message was exactly:
  `1. **Design-first**: document in JSON/njk before implementing. Respect `designDecisions`; discuss before overriding one.`
- **B, stripped:** copied the baseline clone and removed its root we:AGENTS.md before
  starting the child (command below). With the identical prompt the entire last agent message was `NOT LOADED`.
- **C, tools:** a separate child in the stripped clone created `isolation-test-proof.txt`, read it,
  and ran `git status --short` in a real `command_execution` item. The dispatching session independently
  read the file (`isolation-test-ok`, no newline) and independently confirmed status:
  the root we:AGENTS.md deleted and `isolation-test-proof.txt` untracked (raw output below).

```sh
cp -R ./clone-baseline ./clone-stripped && rm ./clone-stripped/AGENTS.md
# Independently verified git status --short after C:
 D AGENTS.md
?? isolation-test-proof.txt
```

This positive evidence justifies implementing removal before launch to prevent **automatic loading of
the root we:AGENTS.md in the tested setup** while preserving tool-bearing work. It does not establish read
denial: Git show or checkout can recover it (commands below). Ancestor/global doctrine,
nested instruction files, override/fallback names, explicit prompt context, and adversarial agents are
not covered. Resource caps remain out of scope under #3621. No positive Seatbelt deny-profile result was
supplied; these are deletion results only.

```sh
git show HEAD:AGENTS.md
git checkout -- AGENTS.md
```

### Isolation port design (documented before implementation)

`we:scripts/lib/isolation-provider.mjs` names `IsolationProviderRequest`, `IsolationProviderOutcome`,
and the function-type `IsolationProvider`, following the port shape in
`we:scripts/operations/cli-adapter.mjs`. This is dispatch tooling, not a new WE standard or glossary term.

The request supplies an absolute local repository `sourceCwd` and optional absolute `scratchParent`.
The provider prepares a fresh, owned scratch clone of committed HEAD, deletes only its root we:AGENTS.md
before resolving, and returns `cwd`, `excludedPaths`, the narrow `guarantee`, and async `cleanup()`.
Uncommitted/ignored source files are not copied. Callers await preparation before starting the child,
keep the clone exclusively owned until that child exits, extract any needed results, and then await
cleanup in `finally`. Preparation rejects on failure and removes partial scratch material. Cleanup is
idempotent; failures are surfaced, including a cleanup failure during preparation.

The first backend is `createMacosDeletionIsolationProvider({ execFn })`: injected argv-based Git exec
for tests, actual filesystem operations in owned temporary directories. The function-type port has no
Codex, Seatbelt, or platform-specific request fields, so future Linux/Windows preparation backends can
implement the same lifecycle. None are built or auto-selected here. The outcome is a prepared directory,
not an OS sandbox or a process launcher; stronger execution/resource isolation needs a separate contract.
The caller still owns child argv, sandbox policy, authentication, timeout, and cancellation. The clone
is not a pooled lane and does not satisfy the existing judge lane validator: production wiring is deferred.

Unit tests exercise argv boundaries, preparation ordering, source preservation, failure cleanup, and
real filesystem effects without a model spawn. Their success is not a new live Codex proof of this module;
the supplied A/B/C evidence proves the underlying technique. End-to-end production graduation remains
subject to `we:docs/agent/prototype-based-dev.md`.
