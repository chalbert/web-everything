---
bornAs: xoyz3pz
kind: story
size: 3
parent: "3369"
status: resolved
scope: ["we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-09-11"
dateResolved: "2026-09-11"
tags: [operations, multi-provider, probe]
---

# Probe Gemini CLI as a third judge provider

`#3371` probed Codex CLI against the judge contract and returned a "yes, with caveats". This item runs the
SAME probe battery against the epic's OTHER researched candidate, Gemini CLI, for the reason `#3369` goal 4
names: a single provider's usage window is a single point of failure. The immediate prompt was an incident —
an OAuth token revocation cut off several in-flight Claude agents at once — so the question is not "is a third
model interesting" but "is there a fallback that keeps working when the first one stops".

Everything below was executed on this machine on 2026-09-11. Nothing is quoted from memory. Where a probe
could not be run, it says so and says why, per `#3371` probe 10's precedent.

**Citation convention in this card:** every path inside a fenced block that starts with `bundle/` is a file
INSIDE the installed npm package (`@google/gemini-cli`), not a file in this repo. Repo paths carry the normal
`we:` locus.

## Setup — the tool is real, and it is NOT authenticated here

```
$ command -v gemini            # before: exit 1, no output
$ npm install -g @google/gemini-cli
added 7 packages in 3s
$ gemini --version
0.59.0
```

`brew search gemini` also offers a `gemini-cli` formula; npm was used. The package installs a 99 MB bundle
which **ships its own first-party docs** under `bundle/docs/` — those are cited below as source, not as web
recall.

**Auth state on this machine: NONE.** The user-level Gemini directory held only two stray temp files, and no
`GEMINI_API_KEY` / `GOOGLE_GENAI_USE_VERTEXAI` / `GOOGLE_GENAI_USE_GCA` was set. That is the single fact that
bounds this probe, and probe 6 below is about it rather than around it.

Every run used a Node spawn harness (wall-clock timeout, stdout/stderr captured separately, stdin closed) from
a scratch dir outside the repo, plus a few runs inside the lane clone where cwd mattered. `git status
--porcelain` was clean afterwards.

## Probe 1 — argv shape, and THE BLOCKING ABSENCE

`gemini --help` at 0.59.0 has `-p/--prompt` (headless), `-m/--model`, `-o/--output-format
text|json|stream-json`, `--session-id`, `--include-directories`, `--approval-mode`, `--allowed-tools`
(marked DEPRECATED), `-s/--sandbox`, `-y/--yolo`, `--skip-trust`.

It has **no schema flag at all**. And unlike Codex — whose plain `-c` keys are silently ignored, so `#3371`
probe 14h had to use `--strict-config` to tell "no effect" from "does not exist" — **Gemini validates argv
strictly**, which makes a negative result trustworthy:

```
$ gemini -p hi --output-schema /tmp/x.json
Unknown arguments: output-schema, outputSchema        (exit 1, 0.8s)
```

So the absence was enumerated rather than assumed. Each of these returned `Unknown arguments`:

```
--json-schema  --output-schema  --response-schema  --schema  --structured-output
--append-system-prompt  --system-prompt  --tools  --no-tools  --safe-mode  --bare
--no-context  --no-memory  --max-budget-usd  --effort  --timeout
```

**Sixteen flags absent, including every one the judge contract leans on.** By contrast the recipe in
`we:scripts/lib/judge-spawn.mjs` is `-p --output-format json --safe-mode --model --effort --max-budget-usd
--session-id --json-schema`.

## Probe 2 — schema conformance: there is no schema to conform to

This is the finding the verdict turns on, and it is settled three independent ways.

**(a) The CLI's own headless doc** defines the `-o json` envelope:

```
# bundle/docs/cli/headless.md:15-22
#### JSON output
- `response`: (string) The model's final answer.
- `stats`: (object) Token usage and API latency metrics.
- `error`: (object, optional) Error details if the request failed.
```

**The final answer is a STRING.** Not a validated object. The judge port requires
`JudgeProviderOutcome.value` = "the juror's answer, already validated against `shape`" — see the typedef in
`we:scripts/operations/cli-adapter.mjs`.

**(b) The formatter, from source.** `JsonFormatter` assembles exactly
`{session_id, response, stats, error, warnings}`, and `response` is passed through `stripAnsi` — i.e. treated
as text:

```js
// bundle/chunk-YSBB75DZ.js:379393
if (response !== void 0) { output.response = stripAnsi(response); }
```

**(c) `responseSchema` exists in the bundle but is NOT reachable by a caller.** All non-SDK uses are internal
features with hardcoded schemas — the edit corrector, the next-speaker checker, the loop detector, the context
snapshotter, the model routers/classifiers, and the Conseca security-policy generator — plus MCP
`outputSchema` tool plumbing. The settings surface confirms it: the whole `output` settings node has **one**
property:

```js
// bundle/chunk-LZ4UWPZ4.js:12679-12702
output: { type: "object", label: "Output", ... properties: {
    format: { type: "enum", default: "text",
      description: "The format of the CLI output. Can be `text` or `json`.",
      options: [{ value: "text" }, { value: "json" }] }
}},
```

There is no `output.schema`, no `responseSchema`, no `structuredOutput` key. User-defined subagents cannot
declare one either — their frontmatter zod schema is `.strict()` and admits only
`kind, name, description, display_name, tools, mcp_servers, model, temperature, max_turns, timeout_mins`.

**The one undocumented back door, recorded so nobody re-finds it and so nobody mistakes it for a feature.**
The chat request config is a verbatim spread of the resolved `generateContentConfig`, and its source is the
settings key `modelConfigs.customAliases`, declared as an opaque `type: "object"` with **no property schema**
and deep-merged with no whitelist:

```js
// bundle/chunk-YSBB75DZ.js:331140  — the request config is an unfiltered spread
const config2 = { ...currentGenerateContentConfig, systemInstruction, tools, abortSignal };
// bundle/chunk-YSBB75DZ.js:339494  — and the merge has no key whitelist
static merge(base, override) { return { model: …, generateContentConfig: deepMerge(…) }; }
```

So a `responseSchema` smuggled into `modelConfigs.customAliases.<alias>.modelConfig.generateContentConfig`
would reach the API. It is undocumented, unvalidated, untested here (no auth), and it would collide with
`tools:` on the same request. **Not a basis for a provider.**

**Contrast with Codex, which matters for the epic.** Codex's schema wall (`#3371` probe 3) was a *dialect*
problem — a real `--output-schema` that rejected this repo's optional-property shapes, fixed by a mechanical
all-keys-required transform (probe 4). Gemini's is a *capability* problem: there is nothing to transform. A
Gemini judge would have to ask for JSON in the prompt, then parse and validate the string itself — which is
precisely the "ask-and-validate loop" that guarantee 2 in `we:scripts/lib/judge-spawn.mjs` exists to not
build.

## Probe 3 — context/doctrine isolation: Gemini is CLEANER than Codex by default

`#3371` probe 13b found a tool-bearing Codex juror `cat`-ing this repo's `we:AGENTS.md` in 6/6 runs. Gemini's
equivalent question has a better answer, and one trap.

**The default context filename is `we:GEMINI.md`, and only that:**

```js
// bundle/chunk-YSBB75DZ.js:253361   (section: packages/core/dist/src/tools/memoryTool.js)
var DEFAULT_CONTEXT_FILENAME = "GEMINI.md";
```

**This repo's `we:AGENTS.md` is NEVER auto-loaded.** That filename occurs exactly **once** in the entire
installed package, in a doc, as an *example of a value you could configure*:

```json
// bundle/docs/cli/gemini-md.md:102-107
{ "context": { "fileName": ["AGENTS.md", "CONTEXT.md", "GEMINI.md"] } }
```

Zero occurrences in any JavaScript file in the package. And this repo has neither file — verified in the lane
clone:

```
$ ls -d .gemini GEMINI.md
ls: .gemini: No such file or directory
ls: GEMINI.md: No such file or directory
$ find . -name 'GEMINI.md' -not -path './node_modules/*'        # (empty)
```

**So a Gemini juror spawned in a lane clone auto-loads no repo doctrine at all** — the property Codex needed
a config flag *plus* clone surgery *plus* an undocumented permissions deny to approximate, and still never
fully got. That is a genuine advantage, and it is an advantage of this repo's *filename layout*, not of the
tool: the day someone adds a `we:GEMINI.md`, it evaporates.

**The trap, from source: the context-filename setting cannot REPLACE the default, only add to it.**
`setGeminiMdFilename` unions the new list with the current one:

```js
// bundle/chunk-YSBB75DZ.js:253364
const current = getAllGeminiMdFilenames();          // == ["GEMINI.md"] at startup
for (const filename of filenames) { next.add(normalized2); }
for (const filename of current) { next.add(filename); }   // <-- the default is re-added

// so:  "context": { "fileName": ["AGENTS.md"] }
//      effective list ⇒ ["AGENTS.md", "GEMINI.md"]
```

There is no supported way to get to zero filenames.

**Discovery, for the record.** Four sources — the global user-level context file, extension context files, an
upward walk from cwd ceilinged at the git root, and a per-project memory index:

```js
// bundle/chunk-YSBB75DZ.js:360750
const [global3, extension, project, userProjectMemory] = await Promise.all([
  getGlobalMemoryPaths(),
  getExtensionMemoryPaths(this.config.getExtensionLoader()),
  this.config.isTrustedFolder() ? getEnvironmentMemoryPaths(…) : Promise.resolve([]),
  getUserProjectMemoryPaths(this.config.storage.getProjectMemoryDir())
]);
```

Downward recursion is just-in-time on file access, not an eager sweep.

**There is no full off-switch** — no `--no-memory`/`--no-context` flag (probe 1), no env var, and the
`context.*` settings are `fileName, importFormat, includeDirectoryTree, discoveryMaxDirs,
memoryBoundaryMarkers, includeDirectories, loadMemoryFromIncludeDirectories, fileFiltering.*` — no
`project_doc_max_bytes` analogue. The closest real suppressor is **folder distrust**: an untrusted cwd drops
project memory entirely (`this.projectMemory = this.config.isTrustedFolder() ? projectMemoryWithMcp : ""`).
The global user-level context file still loads in that case. See probe 4 — distrust is not free.

**Mandate injection has a seam, and it is stronger than Claude's.** `GEMINI_SYSTEM_MD` points at a Markdown
file that **completely replaces** the built-in system prompt — "a full replacement, not a merge"
(`bundle/docs/cli/system-prompt` reference). Where Claude has `--append-system-prompt`, this is a wholesale
swap. It does **not** suppress memory: the final render runs on both branches.

## Probe 4 — tool permissions, and a silent downgrade that contradicts itself

Gemini has no `--tools ''`. Its controls are `--approval-mode default|auto_edit|yolo|plan` (`plan` is
read-only), the deprecated `--allowed-tools`, and a policy engine. Enum values ARE validated:

```
$ gemini -p hi --approval-mode bogus
Invalid values:
  Argument: approval-mode, Given: "bogus", Choices: "default", "auto_edit", "yolo", "plan"
```

**But the requested mode is silently overridden in an untrusted folder — and a lane clone is untrusted.**
Run inside this pool's `lane-16`, a real git clone of this repo:

```
$ gemini -p hi --approval-mode plan -o json
Approval mode overridden to "default" because the current folder is not trusted.
```

Worse, the two messages contradict each other when you ask for yolo:

```
$ gemini -p hi --approval-mode yolo -o json
YOLO mode is enabled. All tool calls will be automatically approved.
Approval mode overridden to "default" because the current folder is not trusted.
```

`--skip-trust` suppresses the override (verified: the line disappears). **So there is a direct conflict with
probe 3**: distrust is the only thing that drops project doctrine, and trust is what a caller needs for the
approval mode to stick. You cannot have context-suppression-by-distrust and a honoured read-only mode at the
same time — the same shape of collision `#3371` probe 9 found for Codex, arriving from the opposite direction.

And `default` means "prompt for approval", which in a headless spawn is a hang. See probe 6.

## Probe 5 — failure shapes: the one place Gemini clearly beats Codex

**Auth failure**, triggered non-destructively by simply having no credentials — no real account state was
touched:

```
$ gemini -p "Reply with exactly the word: ping" -o json        # exit 41, 0.8s
{
  "session_id": "540072b9-8c01-4e5b-b42f-f8dca6596010",
  "error": {
    "type": "Error",
    "message": "Please set an Auth method in your settings file or specify one of the following
                environment variables before running: GEMINI_API_KEY, GOOGLE_GENAI_USE_VERTEXAI,
                GOOGLE_GENAI_USE_GCA",
    "code": 41
  }
}
```

**Exit 41, in 0.8 seconds, one structured object naming the remedy.** Codex's counterpart (`#3371` probe 5)
was a ~30-second retry storm across two transports emitting twelve events. Confirmed in source:

```js
// bundle/chunk-YSBB75DZ.js:252572
var FatalAuthenticationError = class extends FatalError {
  constructor(message) { super(message, 41); … }
```

Siblings are 42 `FatalInputError`, 44 `FatalSandboxError`, 52 `FatalConfigError`, 53
`FatalTurnLimitedError`. Note 41 is **not** in the published exit-code list — the headless reference
documents only 0/1/42/53. Observed, not read.

**Two failure classes escape the JSON envelope, so a parser must fold stderr in** — the same conclusion
`#3371` probe 8 reached for Codex:

- Without `-o json`, the auth error is plain text on stderr. With `-o stream-json` it is **also plain text**,
  not a JSONL `error` event — the structured envelope is `-o json` only.
- A malformed project-level settings file fails before anything, ANSI-coloured, on stderr, with no envelope:

```
Error in <cwd>/.gemini/settings.json: Unexpected token 'o', "not json at all" is not valid JSON
Please fix the configuration file(s) and try again.
```

**Unknown settings keys are silently ignored** (a bogus key changed nothing, no warning) — so for the settings
file, unlike argv, "no effect observed" and "key does not exist" are indistinguishable. Argv is the
trustworthy surface; settings is not.

**Timeout:** no `--timeout` flag (probe 1), so the wall is the parent's job, exactly as `JUDGE_TIMEOUT_MS`
already does it. `-o stream-json` is JSONL (`init|message|tool_use|tool_result|error|result`), so a killed run
stays line-parseable — the same property `#3371` probe 6 credited Codex with. **Not verified live** (no auth).

**`--session-id` exists and is echoed back** — a real advantage over Codex, which has none and issues its own
id. It maps directly onto guarantee 3 in `we:scripts/lib/judge-spawn.mjs` (a deterministic, recordable actor
id). Both a UUID and the literal string `not-a-uuid` were accepted verbatim and appeared as `session_id` in
the output envelope, so it is **not validated**. Whether it genuinely keys the session, or is merely echoed,
is **untested** — and that is exactly `#3331`'s minted-vs-real-id trap, so it must be verified before being
relied on.

## Probe 6 — cost/quota, and THE FINDING THAT MATTERS MOST FOR THE STATED PURPOSE

**No cost signal exists.** `stats` carries token counts and latency only:

```js
// bundle/chunk-YSBB75DZ.js:379460  — the stream-json stats object, in full
{ total_tokens, input_tokens, output_tokens, cached, input, duration_ms, tool_calls, models }
```

A search for `cost_usd|totalCostUsd|costUsd|\busd\b` across the whole bundle returns only MIME-type table
rows. **So `JudgeProviderOutcome.costUsd` is unfillable here too** — the same hole `#3371` recorded for Codex,
for the same reason.

**Quota: there IS a signal, and there are THREE interactive prompts that will hang a headless fallback.**
This is the probe that speaks to the incident that prompted the item.

1. **Login is an interactive gate even with `-p`.** Proved live. With `GOOGLE_GENAI_USE_GCA=true` (the Google
   Code Assist / subscription path), stdin closed, `-p` set:

```
$ GOOGLE_GENAI_USE_GCA=true gemini -p "Reply with exactly the word: ping" -o json
Opening authentication page in your browser. Do you want to continue? [Y/n]:
    (no further output — killed at 45s)
```

   It hung until SIGKILL. A fallback provider that cannot re-authenticate headlessly is not a fallback for a
   token-revocation incident, which is the exact event that prompted this probe.

2. **The billing overage strategy defaults to `"ask"`** — "How to handle quota exhaustion when AI credits are
   available. 'ask' prompts each time, 'always' automatically uses credits, 'never' disables credit usage",
   default `"ask"` (`bundle/docs/reference/configuration` reference, the `billing.overageStrategy` key). In a
   headless spawn, "prompts each time" on quota exhaustion is a hang.

3. **Model-routing fallback prompts by default** — "If the currently selected model fails (for example, due
   to quota or server errors), the CLI will initiate the fallback process … the CLI may prompt you to switch
   to a fallback model (by default always prompts you)" (`bundle/docs/cli/model-routing` reference).

**All three fire on the quota/auth path — the one path provider redundancy exists to survive.** Two are
documented defaults; one is proved live. Any real Gemini provider must pin the overage strategy, pin the
routing policy, and pre-authenticate out of band.

The genuine positives, for balance: `/stats model` shows "token counts and quota information" (the commands
reference) — a readable quota signal Codex has no counterpart for, though it is a slash command and slash
commands are auth-gated headlessly (below), so **untested**. And a `RESOURCE_EXHAUSTED` status raises an
`error` event severity, which is a machine-readable 429 tell.

## What could NOT be probed, said plainly

**No live model call was made. Not one.** The auth gate is absolute and fires before everything — before
context loading, before the trust check, even before slash-command handling:

```
$ gemini -p "/memory show"           →  exit 41, the same auth error
$ gemini -p "hi" -d -o json          →  exit 41, no debug trace before it
```

So Codex's `codex debug prompt-input` trick (`#3371` probe 14h), which made ~40 config probes free and exact
with no API call, **has no counterpart here**. There is no reachable surface behind the auth gate.

**Consequently these are NOT tested, and no claim is made about them:** whether prompt-coerced JSON actually
comes back parseable; whether a Gemini juror performs `#3371` probe 13's mutation-probe discipline; judging
quality; latency; the `-o json` SUCCESS envelope in the field; whether `--session-id` really keys the session;
whether `/stats model` works headless; the real quota-exhaustion failure shape.

**Why no auth was obtained.** Both paths need the operator. The subscription path (`GOOGLE_GENAI_USE_GCA`,
Google Code Assist — the `#3369` goal-2 shape, subscription-included rather than metered) requires completing
a browser OAuth flow against a real Google account. The other path needs a `GEMINI_API_KEY` from AI Studio,
which is metered billing and is the thing goal 2 explicitly does not want. Neither is a subagent's call to
make.

**And the local-model escape hatch was deliberately declined.** `gemini gemma setup` offers auth-free local
routing; the LiteRT runtime was in fact downloaded (88.8 MB, exit 0), but the model pull stops on a legal
gate — `[Legal] … Do you accept these terms? (Y/N)` for the Gemma Terms of Use. **Accepting a licence on the
operator's behalf is not a probe step**, and the model on offer (`gemma3-1b-gpu-custom`, ~1 GB, 1 billion
parameters) could not answer any question that matters: a 1B local model is not "Gemini as a redundant
provider", and a schema or mutation-probe failure from it would be uninterpretable — indistinguishable from
the model simply being too small. Recording the non-test rather than banking a meaningless positive, per
`#3371` probe 10.

*Residual: the LiteRT binary is left on disk under the user-level Gemini directory. No model was pulled and
no settings file was created — `gemini gemma status` still reports the routing as not enabled.*

---

# THE VERDICT

**NO — Gemini CLI 0.59.0 is NOT buildable as an implementation of the `JudgeProvider` port `#3370`
extracted, and the blocker is a missing capability rather than a translation gap.**

This is a different answer from `#3371`'s, and the difference is not a matter of degree. Codex's walls were
all *translatable*: a schema dialect fixed by a mechanical transform, a different argv list, a different
stdout format, a stdin trap. Gemini's wall is that **the port's central guarantee has nothing to bind to**.
`JudgeProviderOutcome.value` must be "already validated against `shape`", and guarantee 2 in
`we:scripts/lib/judge-spawn.mjs` is that "the shape is enforced by the tool, not approximated". Gemini CLI
returns `response: (string)`. There is no CLI flag, no settings key, and no supported configuration that
constrains the final answer — only an unvalidated, undocumented spread of `modelConfigs.customAliases` into
the API request, which is not something to build a reviewer on.

**Building it anyway means re-introducing the ask-and-validate loop the judge seam was designed to delete** —
prompt for JSON, strip fences, parse, validate, retry on malformed. That is a provider that is a *different
kind of thing* from the other two, and its retries would be indistinguishable from genuine juror failures.

## What is genuinely better here, recorded so the epic can use it later

Three real advantages, none of which rescues the verdict:

1. **Doctrine isolation is free.** This repo's `we:AGENTS.md` is never auto-loaded (zero code occurrences in
   the package); the default is `we:GEMINI.md`, which this repo does not have. Codex needed a config flag
   *plus* clone surgery *plus* an undocumented permissions deny and still leaked through git history
   (`#3371` probe 14).
2. **The auth failure shape is excellent** — exit 41, 0.8s, one structured object naming the remedy, versus
   Codex's 30-second twelve-event retry storm.
3. **`--session-id` exists**, mapping onto guarantee 3 in `we:scripts/lib/judge-spawn.mjs`, where Codex has
   no equivalent. Echoed but unvalidated, and unverified as a real session key.

And one that is strictly better than Claude's: `GEMINI_SYSTEM_MD` **replaces** the system prompt outright,
where `--append-system-prompt` only appends.

## What blocks it, ranked

1. **No schema-constrained output.** Disqualifying on its own (probe 2).
2. **Three interactive prompts on the quota/auth path** (probe 6) — login, the `"ask"` overage strategy, and
   routing-fallback consent. Two are documented defaults; the login hang is proved. A fallback that blocks on
   a `[Y/n]` when the primary provider dies is not redundancy. Mitigable by pinning settings and
   pre-authenticating, but it must be done deliberately, and nothing in the CLI defaults does it for you.
3. **Trust/permission collision** (probe 4): an untrusted folder is the only thing that drops project
   doctrine, and it silently downgrades the requested approval mode — announcing "YOLO mode is enabled"
   immediately before disabling it. A lane clone is untrusted by default.
4. **`costUsd` is unfillable**, same as Codex (probe 6).

## Recommendation for `#3369`

**Stay with Codex as the second provider; do not scope a Gemini provider module.** `#3371`'s verdict is the
one to build on, and `#3369` step 3 is unaffected by this item.

**Re-probe Gemini when, and only when, `gemini --help` grows a schema flag.** That single check is the whole
gate — it is one command, and the rest of this card's evidence stays valid until it changes.

**Separately, and worth more than the provider question:** the incident that prompted this probe was an
*auth* failure, not a *quota* failure, and probe 6 shows Gemini would have hung rather than failed over.
Whatever provider fills the redundancy role, **the fallback must be authenticated and prompt-free BEFORE it
is needed** — that is a property of the operating setup, not of any CLI, and no provider module supplies it.

Nothing was wired in. `we:scripts/lib/judge-spawn.mjs` is unchanged, per the same Done-when-3 discipline
`#3371` set.

## Progress

- 2026-09-11 — Installed Gemini CLI 0.59.0 for real and ran the `#3371` battery against it. No live model
  call was possible: this machine has no Gemini auth, the subscription path gates on an interactive browser
  prompt that hangs a headless run (proved, killed at 45s), and the auth-free local Gemma fallback was
  declined rather than accept a licence on the operator's behalf. Six probes recorded from real command
  output plus the CLI's own bundled source and docs. Verdict: NOT buildable — `-o json` returns the final
  answer as a free-form string and no schema flag or settings key exists, so the port's central guarantee has
  nothing to bind to. Three genuine advantages recorded (no auto-loaded repo doctrine, a clean fast auth
  error, a real `--session-id`). No code wired in.
