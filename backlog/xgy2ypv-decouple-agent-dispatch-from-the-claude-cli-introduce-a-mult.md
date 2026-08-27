---
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-27"
tags: [operations, conveyor, dispatch, multi-provider, cost, resilience]
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
