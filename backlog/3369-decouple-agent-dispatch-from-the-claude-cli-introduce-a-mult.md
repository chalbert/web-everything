---
bornAs: xgy2ypv
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-27"
tags: [operations, conveyor, dispatch, multi-provider, cost, resilience]
relatedReport: reports/2026-09-06-backlog-consolidation-analysis.md
---

# Decouple agent dispatch from the Claude CLI — introduce a multi-provider abstraction

Every spawned agent in this repo — dispatched builds, review jurors, explore panelists — is `claude`, named as
a literal string at four call sites. That coupling now has a real cost: reviews only ever carry one model's
blind spots, the loop's throughput is capped by one subscription's usage window, and every task pays for the
same tier of model regardless of how hard it actually is. This epic decouples the *contract* (spawn a bounded
agent, get back a bounded result) from Anthropic's CLI specifically, so a second provider can be substituted
per call without redesigning the callers.

## The four goals, and what each actually needs

1. **Diverse review pays off — different agents carry different blind spots.** Needs: a second provider
   answering the SAME judge contract (`judge(request) → outcome`), seated as an additional panelist/lens.
2. **A second subscription's usage window is a second budget, not just a second bill.** Both real candidates
   below sell subscription-included CLI usage distinct from pay-per-token API billing — the same shape as an
   Anthropic Max plan, not a workaround. Needs: dispatch by that provider's own headless CLI, authenticated to
   its subscription, not its API key.
3. **A cheap model for equivalent results on some tasks.** Partly already available WITHIN Claude
   (`--model`, `--effort` on today's judge spawn); a second provider adds another cheap tier on top,
   plausibly cheaper than any Anthropic tier for the same task.
4. **De-risk a single-provider dependency.** Needs: nothing provider-specific becomes load-bearing in the
   caller — the whole point of the abstraction below.

## What the coupling actually is today

Read from source, not recalled, on 2026-08-27:

- **Four call sites hardcode the binary and its argv shape**: `we:scripts/operations/dispatch-lane-io.mjs`
  (`defaultSpawnAgent`, `exec('claude', argv, …)`), `we:scripts/operations/explore-io.mjs` (panelist spawn,
  same `--bg --session-id` contract), `we:scripts/lib/judge-spawn.mjs` (`JUDGE_CLI = 'claude'`, argv:
  `-p --output-format json --safe-mode --model … --effort … --max-budget-usd … --session-id … --json-schema
  …`), and `we:scripts/measure-judge-spawn.mjs`.
- **Every one already injects its spawn function for testing** — `exec = execFileSync` in
  `defaultSpawnAgent`/`defaultRunNode`, `spawnFn` in `judgeSpawn`. That seam exists for test doubles today; it
  is also exactly the seam a provider needs, which is why this epic is decomposition, not new architecture.
- **The engine already speaks a provider-neutral contract at the top of the stack.** A `judge` step in
  `we:scripts/operations/engine.mjs` calls an injected `judge(request) → outcome` async function — it has no
  idea `claude` exists. `createDefaultJudge` (`we:scripts/operations/cli-adapter.mjs:464`) is the ONE place
  that wires that neutral contract to `judgeSpawn`. **This is the cheapest, lowest-risk entry point**: a
  second provider only has to satisfy `judge(request) → outcome`, not reproduce the harder background-dispatch
  machinery `#3331`/`#xnukacf`/`#x4iwn55` are still hardening for Claude itself.
- **The dispatcher (delivery agents, not judges) is a harder target**, and deliberately NOT where this epic
  starts: it needs liveness matching, session addressing, and resume-vs-relaunch — all still being built for
  Claude alone (`#3331`, `#xnukacf`, `#x4iwn55`). Adding a second provider to that surface before it is solid
  for one provider would double an unsolved problem.

## Two real candidates, researched 2026-08-27 (not assumed)

Both were checked for the three properties the judge contract needs — headless invocation, JSON/schema-
constrained output, and a subscription (not just API-key) billing path:

| | Codex CLI (OpenAI) | Gemini CLI (Google) |
|---|---|---|
| Headless invocation | `codex exec --json` — JSONL event stream to stdout | `-p`/`--prompt` triggers headless mode in a non-TTY context |
| Schema-constrained output | `--output-schema <path>` constrains the final response to a JSON Schema | `--output-format json` (single JSON object or JSONL stream) |
| Session continuity | `codex exec resume $SESSION`, id comes FROM the CLI's own output | a new stateful daemon mode (`--daemon`, `--session`) — recent, unlike Claude's `--resume` |
| Subscription vs API billing | ChatGPT Plus/Pro/Business include Codex CLI usage on a separate allowance from API-key billing | Google AI Pro (1,500 req/day) / Ultra (2,000 req/day) are separate from pay-as-you-go API billing |
| Cheapest advertised tier | GPT-5.6 Luna — described as the fastest/most affordable in the current lineup | Gemini Flash-Lite — ~$0.30/$2.50 per 1M tokens, the cheapest current model |

Neither flag shape matches Claude's (`--json-schema` vs `--output-schema` vs `--output-format json`; a minted
`--session-id` vs a CLI-issued resume token). **An adapter per provider is required — there is no shared
argv.** Both are genuinely plausible; neither has been spawned against by this repo yet, and nothing below
should be built on the search evidence alone.

## Decomposition

1. **Extract the provider port** (small, no new provider yet). Generalize the existing `spawn`/`exec`
   injection points across the four call sites into one named shape — a `judge(request) → outcome` port at
   minimum, since that boundary already exists cleanly at `createDefaultJudge`. Pure refactor: behaviour
   unchanged, Claude remains the only implementation. This is the prerequisite for everything below and
   should land regardless of whether a second provider ever ships.
2. **Probe one alternate provider against the judge contract** (research spike, mirrors `#3331`'s method: one
   manual run is not evidence, run it for real before designing anything). Pick ONE candidate — Codex CLI or
   Gemini CLI — spawn it for real with a schema-constrained ask, and record: does the schema constraint
   actually hold under adversarial input, what a rate-limited/quota-exhausted response looks like, and
   whether stdout is parseable with the same discipline `parseJudgeOutcome` applies today. This determines
   which candidate is actually buildable, not the search table above.
3. **Wire the probed provider as a SECOND judge implementation**, seated as one panelist among several in
   `we:scripts/lib/judge-panel.mjs`, gated behind explicit opt-in (an env flag or a lens declaration) so
   today's single-provider behaviour is the unchanged default. This is where goal 1 (diverse review) and
   goal 3 (cheap tier for a suitable task) start paying off.
4. **The dispatcher (delivery-agent) surface** — blocked on `#3331`/`#xnukacf`/`#x4iwn55` landing for Claude
   first, and on step 3 proving the adapter pattern works for one real provider. This is where goal 2 (a
   second subscription's usage window) is actually realized; do not start it earlier.

## Deliberately NOT in scope

- **Picking the second provider now.** The table above is a starting point for step 2's probe, not a
  decision — a probe with real spawns is what step 2 exists to do.
- **A generic N-provider plugin system.** Building for a hypothetical third and fourth provider before a
  second one is proven would be exactly the premature abstraction this repo's own conventions warn against.
  Two providers, proven one at a time.
- **Changing how review verdicts are weighted or reconciled across panelists.** `we:scripts/lib/judge-panel.mjs`
  already has a seating/reconciliation model; this epic feeds a new kind of seat into it, it does not
  redesign it.

## Lineage

Filed 2026-08-27 at the user's request: review from a different agent pays off because of different
weaknesses, a second subscription avoids capping out on one provider's usage window, a cheap model gets
equivalent results on some tasks, and decoupling de-risks a single-provider dependency.

Researched in-session via web search rather than assumed. Sources:

- Codex CLI headless/JSON mode — [openai/codex issue #4219](https://github.com/openai/codex/issues/4219),
  [DeepWiki: Headless Execution Mode](https://deepwiki.com/openai/codex/4.2-headless-execution-mode-(codex-exec))
- Codex pricing and subscription tiers — [Inventive HQ](https://inventivehq.com/blog/codex-subscription-options-guide),
  [UI Bakery](https://uibakery.io/blog/openai-codex-pricing)
- Gemini CLI headless mode docs — [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)
- Gemini CLI daemon mode — [google-gemini/gemini-cli PR #20700](https://github.com/google-gemini/gemini-cli/pull/20700)
- Gemini quotas and pricing — [geminicli.com docs](https://geminicli.com/docs/resources/quota-and-pricing/)
- Gemini model tiers — [Team AI: Gemini models explained](https://platform.teamai.com/blog/large-language-models-llms/gemini-models-explained-the-complete-2026-guide/)

## Placement note (2026-09-07)

we:backlog/2444 (ratified) already fixes the Loop's own agent-runner interface as backend-agnostic, with a
later backend "slotting in behind the same interface" — the identical shape this epic's provider-port
extraction builds for WE's own judge/dispatch seams. we:backlog/3619 tracks that the Loop's eventual
runner build (we:backlog/2444/2530) should reuse this proven port pattern rather than re-deriving it, under
the existing Plateau Loop epic (we:backlog/2445). Build and land this epic for WE's own dispatcher
regardless; this note is a forward pointer, not a dependency.

## Research correction (2026-09-08)

**The "Two real candidates" table above (2026-08-27) is stale for the Google side.** Verified via fresh
web search tonight, independently of any prior summary: Google announced at I/O 2026 (2026-05-19) that
Gemini CLI and the Gemini Code Assist IDE extensions would stop serving Google AI Pro, Ultra, and free-tier
individual accounts on **2026-06-18**, replaced by a new tool, **Antigravity CLI** (binary `agy`). Gemini
Code Assist Standard/Enterprise org seats and pay-as-you-go API-key access were unaffected — only the
individual-subscription tier the table above was evaluating got cut. Sources: [The New Stack — Google pushes
Pro, Ultra, and free users from open-source Gemini CLI to closed-source Antigravity
CLI](https://thenewstack.io/google-antigravity-cli/), [Inventive HQ — Gemini CLI Is Being Retired on June
18](https://inventivehq.com/blog/gemini-cli-deprecated-antigravity-cli-migration), [Google Antigravity —
Changes to Antigravity Plans](https://antigravity.google/blog/changes-to-antigravity-plans), [Google
Antigravity — Plans docs](https://antigravity.google/docs/plans/), [Google Antigravity — Headless mode
docs](https://antigravity.google/docs/cli/headless/).

**What changed, confirmed independently tonight:**

- **Pricing/tiers**: Google AI Pro stays $20/mo. Google AI Ultra split into two tiers as of the May 2026
  restructure: $100/mo (5x Pro's token allowance) and $200/mo (20x Pro's allowance, down from a prior
  single $250/mo Ultra plan). This mirrors the same 5x/20x framing Claude Max and Codex Pro already use —
  useful for cross-provider cost comparison once this is revisited.
- **Metering**: usage is billed in "compute effort" units (task-complexity-dependent — a simple question
  might cost 1 unit, a multi-file refactor 50), not flat per-request or per-token counts. Harder to compare
  1:1 against Claude/Codex's request- or token-based limits than the original table implied for Gemini CLI.
- **License**: Antigravity CLI is closed-source/proprietary (free during preview), unlike the original
  open-source Gemini CLI the table above evaluated.
- **Headless/scriptable invocation — the property this epic's whole research table exists to check —
  appears STRUCTURALLY COMPARABLE to what this epic's table already describes for Codex, not worse.**
  Confirmed from Antigravity's own headless-mode docs: `-p`/`--print`/`--prompt` triggers a single
  non-interactive run and exit (same shape as Codex's `codex exec` / Gemini CLI's old `--prompt`);
  `--output-format json` returns a single JSON envelope (`conversation_id`, `status`, `response`, `usage`,
  `duration_seconds`), `--output-format stream-json` emits NDJSON events as the run progresses;
  `--json-schema <path>` constrains output to a schema, landing in a `structured_output` field — the same
  role `--output-schema` plays for Codex and `--json-schema` played for Claude's own judge spawn; and
  `--continue`/`-c` or `--conversation <id>` resumes a session via a CLI-issued conversation id, the same
  "id comes FROM the CLI's own output" shape the table above already praised in Codex's
  `codex exec resume $SESSION`. **This is docs-only, not a real spawn** — the same caveat this epic's own
  text already applies to the original Codex/Gemini table ("nothing below should be built on the search
  evidence alone"). If Google integration is picked back up, it needs #3371's own method (a real,
  adversarial spawn) run against Antigravity CLI specifically before this comparability claim is trusted.

**Open question for whenever Google integration is actually revisited** (post-Codex, per #3581's ratified
pacing — not now, and this does not reopen that pacing or #3371's Codex-over-Gemini call for the judge
seam): re-run a probe using #3371's method against **Antigravity CLI**, not the retired Gemini CLI the
original table names — the binary, invocation surface, and billing/metering model have all changed even
though "the Google candidate" is still Google. The docs-level read above suggests the headless story is a
rename, not a regression, but that has not been verified with a real spawn and should not be assumed true
until it is.

**Disposition of the table above**: left as-is for the historical record of the original 2026-08-27
research; it should not be used to plan an actual Google integration going forward. This correction section
is the current state of the Google side.
