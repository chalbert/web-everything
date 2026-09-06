# Token optimisation — what actually moves agent cost, and how good the evidence is

**Date:** 2026-09-06 · **Why this exists:** #3006's research slice asks for "current research on request
optimisation", and the `kind: decision` card carved from it (the effort-dial-vs-model-cascade fork) rests on
claims that had **no in-repo grounding**. This report is that grounding. Six parallel research streams,
~250 web searches and fetches, plus in-session `tiktoken` measurements.

**Read the sourcing caveat first.** Several primary domains — `arxiv.org`, `docs.anthropic.com`,
`platform.openai.com`, `ai.google.dev` — were egress-blocked in the researching environment. Anthropic figures
came first-party via `platform.claude.com`; a substantial share of the rest is search-engine synthesis of pages
that could not be read directly. **Treat any specific figure here as a pointer to verify, not a citation.**
Non-Anthropic pricing could not be verified against provider pages, and sources actively contradicted each
other on OpenAI's cached-input discount (50% / 75% / 90%) and Gemini's implicit-cache discount (75% / 90%).

---

## The one-paragraph answer

Cost is dominated by **caching** and **model/effort choice**. Everything else — prompt compression, terser
phrasing, format choice — is real but an order of magnitude smaller, and several popular techniques are
*net-negative* because they break the cache they were meant to help. The levers do **not** compose: each
multiplies a different share of the bill, so multiply a lever by the fraction of your spend it touches before
ranking it.

## The levers, by what they multiply

| Lever | Multiplier | On which base | Evidence |
|---|---|---|---|
| Model tier swap | 5–600× | whole request | strong (list prices) |
| Code execution instead of tool results | 1.6–75× | tool traffic | vendor-measured, replicated 75–98% |
| Reasoning / effort tier | 3–23× | output tokens | moderate |
| Concise reasoning (CoD, SoT, TALE) | 3–13× | reasoning output | moderate, several papers |
| Prompt cache read | 10× | repeated prefix | strong, first-party |
| Tool search / deferred schemas | 8.8× | tool definitions | vendor-measured |
| Hard compression (LLMLingua-2) | 2–5× | unstructured context | contested |
| Serialization / minification | 1.6–2.9× | tabular payloads | strong (own measurement) |
| Batch / flex tier | 2× | whole request | strong |
| Telegraphic ("caveman") prompting | 1.1–1.26× | whole prompt | weak-moderate |

## Caching — the lever that outranks the rest

A cache read bills at **0.1× input** on Anthropic and Bedrock against a 1.25× write premium at the 5-minute
TTL (2× at one hour), so it **breaks even after a single reuse**. Minimum cacheable prefixes are only
**512–4,096 tokens**, model-dependent — below which the cache is silently skipped with no error.

Invalidation cascades **tools → system → messages**: a tool-definition change invalidates everything, and any
single byte earlier in the prefix is a full miss. Non-deterministic JSON key ordering silently destroys hit
rates. The engineering rule is *static content first, volatile content last*, and *append to history, never
edit it*.

Reported outcomes: one deployment went **7% → 74% hit rate from a single reordering fix, cutting inference
cost 59%**; a 500-session study found 41–80% real savings against a marketed "up to 90%". **Below 40% on a
stable-prompt workload is a structural bug, not a tuning opportunity.**

**This repo already has a measurement of its own.** #3383 carries
`costTokens: "in:5840 cw:6690099 cr:1085684841 out:1965741"` — roughly **162 cache reads per write, a 99.4%
hit rate** across 9 sessions. Read honestly it measures ordinary interactive-session caching, not the juror
spawn path, but it is real data on the board and it corroborates the direction of #3006's own
2026-08-08 sample (prefix stability beating prompt-size reduction).

## The fork this report exists to ground

The decision card carved from #3006 asks whether agent work should economize by **effort tier inside one
model** or by **routing across models**. The research favours the effort dial, on three grounds:

1. **Caches are model-scoped.** A two-model cascade forfeits cache reuse across its models — a cost absent
   from nearly every published cascade evaluation. Given the hit rates above, that is not a rounding error.
2. **Anthropic's measured alternative.** Running everything at `low` effort and re-running failures at default
   held **~93% pass at ~$0.70/task versus 91.7% at $1.39** — same quality, half the cost, *counting the wasted
   cheap attempts*. It needs a cheap failure signal, which this repo's review path has.
3. **The cascade literature is weaker than its reputation.** FrugalGPT's canonical 50–98% claim has three
   independent critiques since: *Is Escalation Worth It?* found a lightweight **pre-generation router beat the
   best cascade policy on 4 of 5 datasets** (a cascade always pays the cheap model's generation before
   deciding), and a 206,000 query-model-pair study found routers trained on oracle labels **collapse to
   majority-class prediction**, with shuffled-label controls confirming many published routers are elaborate
   constant functions.

Counterweight, stated so the fork stays a fork: routing buys **provider redundancy and reviewer diversity**,
which #3369 wants for reasons that are not cost at all. This report rules on the cost axis only.

## Findings that bear on agent architecture

- **Cost is quadratic in turn count.** Every turn resends the whole prefix. Agents burn ~4× the tokens of
  chat, multi-agent systems ~15×, and token usage alone explained **80% of performance variance** on one
  benchmark — much of "better agent" is just "spent more".
- **Sub-agents start a cold prefix.** A subagent shares no cache with its parent, so fanning out over shared
  context pays full uncached rate to re-read the same material N times. Use fan-out for independent, bulky,
  self-contained work; keep coupled work single-threaded.
- **The tool-definition tax is paid before any work happens** — 550–1,400 tokens per MCP tool schema, with
  large servers reaching tens of thousands per request. This repo's jurors already avoid it via `--tools ''`.
- **More context is not monotonically better.** Lost-in-the-middle (>30% degradation when the gold document
  sits mid-context), context rot (degradation on trivial retrieval well before the window fills; focused
  ~300-token prompts beating full ~113K-token prompts by 30–60% on one benchmark), distraction, and tool
  confusion. Several savings techniques therefore *improve* accuracy — tool search took one model from 49% to
  74% while cutting 85% of tool-definition tokens.

## What is net-negative

- **Compression that breaks caching.** A measured case: shrinking tool output **38.4% increased billed cost
  6.8%** because the edit invalidated the cached prefix. Another dropped patch success from 27/40 to 15/40.
- **Naive full-context caching** can paradoxically increase latency; selective strategies beat it.
- **Retries compound.** Each agentic retry re-pays the entire accumulated context, so a too-terse prompt that
  fails once has already erased its own savings.
- **Routing infrastructure below meaningful scale.** A 40% saving on small spend is dwarfed by the engineering,
  the permanent debugging surface, and a 100–150ms latency tax.
- **"Be concise" degrades factuality.** One benchmark found concise system prompts cut debunking accuracy by
  up to ~15% — a model with no room to acknowledge and correct a false premise chooses brevity over correction.

## The techniques worth retiring

- **"Saying please costs real money."** `"please "` is 2 tokens. The origin claim was a throwaway remark with
  no methodology, and the real cost is the extra *inference round* to reply.
- **Word-level abbreviation.** Measured in-session: `configuration`, `repository`, `authentication` and
  `database` are **one BPE token each**, identical to their abbreviations; `approx.` costs *more* than
  `approximately`, and `e.g.` more than `for example`.
- **"Caveman" prompting at the quoted magnitude.** A paired benchmark on real coding tasks found **14–21%,
  converging to −8.5% at scale**, because code and tool calls are preserved. The viral 40–65% is chat-only.
- **"Non-English costs 3–4× more."** True on cl100k, largely false on o200k (Chinese 2.36× → 1.29×, Hindi
  4.43× → 1.71×).

## Measurement

The metric is **cost per successfully completed task**, not cost per token — run cost ÷ success rate, counting
retries and fallbacks. Once instrumented, model-choice conclusions frequently invert. Count with the provider's
own endpoint, not `tiktoken`, which undercounts Claude by ~15–20% on typical text. Log `cache_read_input_tokens`
and `cache_creation_input_tokens` **separately**; a hit rate of zero across repeated requests is the single
highest-value alert available. A/B a compression change with a **pre-declared non-inferiority margin**, never
"the average looks fine".

This repo's [`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) (#3028) already
implements the discipline this section argues for — conditions stamped on every figure, raw `usage` retained,
and an explicit refusal to let a number be quoted without the block that produced it.

## Shelf life

Pricing, caching behaviour and CLI flags all move. The levers in the first two sections have outlived several
rounds of pricing change; the specific figures have not. Re-measure rather than re-cite — which is #3006's own
standing instruction, and the reason its remaining carvable work is a harness change rather than a conclusion.
