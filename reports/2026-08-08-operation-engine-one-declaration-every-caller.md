# Operation engine — one declaration, every caller

**2026-08-08 · design session with Nicolas · backing report for the operations-declared-once decision and the operation-engine epic.**

---

## The question

An agent session and the console both need to perform the same delivery-loop operations — review a PR, claim an
item, dispatch a lane, ratify a decision. Today each caller is hand-wired, and they do not do the same amount of
work. The operator's question: how do we get **the same behaviour with limited duplication**, and does that mean
converting the AI flows to call HTTP services?

## What was already true

The existing seam is good and none of it is discarded. [`#deterministic-core-thin-judgment`](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
(#2607) clause 3 already rules **one source — skills and UIs SHELL the same script**, and the PR-review operation
is the most mature instance of it:

| Step | Single source | Agent path | UI path |
|---|---|---|---|
| Read the park | `we:scripts/review-detail.mjs` (pure assembler + thin CLI) | shells it | dev-panel route → `plateau:tools/drain-daemon/cli.mjs` → same script |
| Net diff | `computeNetDiffText/Paths` (`we:scripts/merge-ai-prs.mjs`) | calls it | **not wired** — diff stat only |
| Judge | `we:scripts/lib/review-core.mjs` + `we:scripts/review-core-cli.mjs` | fresh-context subagent | **nothing** |
| Record verdict | `we:scripts/review-set-label.mjs` (pure `decideSetLabel` + CLI) | shells it | POST → daemon → same script |

Steps 1 and 4 are already exactly right: one script, two shells, and the gate-self invariant lives in the **pure
core** so neither shell can route around it. Steps 2 and 3 are agent-only.

**HTTP-first was rejected.** Inverting the arrow (agent → HTTP → logic) breaks on lane clones — N checkouts, each
its own port — and adds a live-server dependency to the exact path (#2701 headless runner, #2703 session-free
loop) that is supposed to become *more* autonomous. It would also overturn a ratified statute. The correct answer
was never a transport change.

## The ruling

**Declare the operation once; generate the callers.** Three layers, the bottom two of which already exist as house
style:

```
  L2  entry adapters   CLI (agent) · HTTP (console) · tool (typed)   ← GENERATED
  L1  we:scripts/*.mjs thin io shells, --json                        ← exists
  L0  we:scripts/lib/  PURE. invariants live here, unbypassable.     ← exists
```

An operation is a sequence of steps, each of exactly **four kinds** — the whole vocabulary:

- **`compute`** — pure function plus declared reads. No model. Unit-testable without spawning.
- **`judge`** — needs a model, needs *no tools*. Emits a mandate, returns a shape-enforced answer.
- **`confirm`** — needs a person. The run **suspends**; resumable from any surface.
- **`effect`** — declares what should happen; never performs it. The executor applies, keyed by run + step.

### What this buys, beyond deduplication

- **The human stop becomes structural.** It is prose in `we:skills-src/review/SKILL.md` today — *"This is a stop
  point … Do not auto-proceed."* — a rule the model must hold. The engine suspends instead; forgetting is not a
  failure mode that exists.
- **Retry stops being an instruction.** Effects are declared and idempotent per (run, step), so the documented
  *"a non-zero exit means re-run the same command"* and the hand-ordered #2964 comment-before-label sequencing
  both dissolve into replay.
- **Runs cross surfaces.** A review the drain starts headlessly parks at `confirm` and is finished in the browser.
  The run record, not the caller, holds the state.
- **The console gains review capability structurally**, rather than as one more bespoke wire.

## Where the model runs — the split is tools, not surface

The first draft gave each surface its own judge provider (in-session reviewer, console runner, headless spawn).
That was wrong. The right split:

| Model work | Needs | Runs as |
|---|---|---|
| `judge` | a diff and a mandate | **one turn, no tools granted** |
| agentic build | working tree, shell, many turns | a full agent session (unchanged, #2444) |

The review mandate already forbids the reviewer from checking the branch out **in a shared tree**
([we:skills-src/review/SKILL.md](../skills-src/review/SKILL.md), citing #2336) — it is text in, findings out, so an
agent loop buys nothing for the judgment itself. (The mandate does permit a *throwaway clone* for a repro; a
tool-free juror cannot make one, so that escalation path sits outside the judge contract by design and is filed
separately when it is actually wanted.) **Spawning was never the problem; being *in-session* was**: an in-session reviewer
inherits the host session's instructions, memory and working directory, so the same operation behaves differently
depending on who started it.

### Two product tiers, one seam — and this is why the seam matters

Not a migration with a trigger. Two permanent tiers sold to different people:

- **Tier one (today)** — solo operator, one dev browser, their own machine, subscription already bought. Nothing
  metered. **This is what gets built.**
- **Tier two (later)** — hosted, no machine to spawn on, billed per token as a cost of goods.

Nothing above the seam differs between them. This is the same shape as #2626 (local sidecar now, durable store at
product, one swap behind a seam — note #2626 is itself still an **open** decision, so it is cited here as the
proposed shape, not as settled law) and [`#agent-runner-cli-backend`](../docs/agent/platform-decisions.md#agent-runner-cli-backend)
(#2444), which ratified the subscription-funded CLI backend *behind a deliberately backend-agnostic interface* so a
key-billed one could slot in later. Tier two is that backend.

## Measured — the juror spawn

The CLI already does forced schema decoding; there is nothing to approximate. `--json-schema` returns a parsed,
conforming object in a `structured_output` field, and `stop_reason: tool_use` confirms it is implemented as a
forced tool call.

```
claude -p \
  --json-schema "$FINDINGS_SHAPE"    # shape enforced, not requested
  --output-format json               # answer arrives parsed in structured_output
  --safe-mode                        # drop repo instructions, skills, hooks, plugins
  --tools ""                         # cannot touch the repo it is reviewing
  --model sonnet --effort low        # per-lens tuning replaces prompt engineering
  --max-budget-usd 0.10              # hard ceiling per juror
  --no-session-persistence           # a juror is throwaway
  --append-system-prompt "$MANDATE"  # stable prefix; only the diff varies
```

On subscription, with an identical prompt, `--safe-mode --tools ""` cut the spawn's loaded context by **roughly
an order of magnitude** and shortened wall clock correspondingly.

**No figure is carried, and here is why.** The session run and an independent re-run disagree on the absolute
numbers, and **no committed script reproduces either** — the same class of unsourced figure #1118 withdrew from
the R8 statute on 2026-08-07. Both sets are recorded below as raw observations, not as findings, so nobody
re-cites them as measurements:

- *Session run (conditions not recorded — cwd, model and prompt were never written down, so it cannot be
  re-run):* ≈30k → ≈5.5k context tokens, ≈11s → ≈6s wall clock.
- *Independent re-run, 2026-08-09, review of PR #1122* — CLI 2.1.220, `--model sonnet`, prompt `"Reply with the
  single word: ok"`, cwd `we:` primary checkout, context read as the sum of input + cache-read +
  cache-creation tokens across `modelUsage`: **48,609 → 6,476** tokens; **17.8s → 2.0s** wall.

The two runs agree on nothing but the direction, which is the only thing the ruling and the judge-helper slice
rest on. No figure returns to this report, to an item, or to the statute until the measuring script named in that
slice's acceptance is committed.

**Verified, and reproducible from the flags alone** (re-checked 2026-08-09 against CLI 2.1.220):

- `--json-schema` really does force the shape — the result object carries `stop_reason: "tool_use"` and a parsed
  `structured_output`. There is no prose to strip and no ask-and-validate loop to build.
- **Trap:** `--bare` strips more but forces key-based auth and cannot see the subscription — it fails with
  exactly *"Not logged in · Please run /login"*. Tier one must use `--safe-mode`.

**`--tools ""` is a structural guarantee** — with one caveat worth stating precisely. The mandate's rule is
never check the branch out *in a shared tree*; `--tools ""` is stronger, since a tool-free juror cannot check out
anywhere, including the throwaway clone the mandate allows. That is the intended trade, not an accident.

## Conversion order — chosen to falsify early

Every operation converts eventually, so the ordering is free and is spent on risk rather than convenience:

1. **`review-pr`** — all four kinds, proves the engine end to end. Existing scripts stay as the read/effect impls.
2. **`claim`** — compute and effect only. If this feels like ceremony, the engine is over-built, learned on the
   cheapest case.
3. **`ratify`** — human-only, and its effect writes a repo file via branch + PR rather than the forge API. Proves
   the effect executor generalises.
4. **`dispatch`** — the real test. Its effect *starts* an hour-long agent rather than completing. Nothing in the
   four kinds describes that, so a fifth kind shows up here if anywhere. Gated on a 2-point spike into the CLI
   background-agent lifecycle, which may own that lifecycle already.

The risk this ordering manages: engines over-abstract, and the failure is silent — each operation fits badly in a
slightly different way and the vocabulary quietly becomes seven kinds. Smallest-to-strangest surfaces that in
weeks. If step 2 or step 4 fights the model, that is the signal to change the model, not to add a kind.

## Settled in session

| Question | Ruling |
|---|---|
| Which operations convert? | All of them; ordering above. |
| Is `confirm` one kind or two? | **One**, with an actor field. The guard stays in the pure core where it cannot be routed around. Vocabulary holds at four. |
| Where does the run record live? | **Local file behind a store module** now; migrates with the rest of the operational state at product (#2626). |
| Does this need a ratified decision? | Filed **for the trace, ruled not re-argued** — it applies #2607 rather than competing with it. Preparation reopens it only on genuinely new findings. |
| Judge over the API? | **No — nothing metered in tier one.** The API is tier two's backend behind the same seam. |

## Further capability worth adopting (from a live CLI + API surface review)

- `--output-format stream-json` + `--include-partial-messages` → the live output tail (#2778) with no protocol to
  invent.
- `--agents <json>` → juror definitions inline in the operation declaration rather than a separate roster.
- `--session-id <uuid>` set from the run record id → the juror transcript is findable from the run. Audit for free.
- `--exclude-dynamic-system-prompt-sections` → cross-spawn prompt-cache reuse across a multi-lens panel
  (unmeasured; worth confirming).
- `--setting-sources` / `--strict-mcp-config` → a juror stays reproducible regardless of local config drift.
- Tier two only: the Batches API at half price — a background conveyor's judge passes are not latency-critical, so
  it is a direct margin lever. Keep the seam batch-friendly.

## Lineage

Session 2026-08-08 with Nicolas. Applies #2607 (`#deterministic-core-thin-judgment`) and composes with #2444
(`#agent-runner-cli-backend`), #2626 (operational state store), #2701 (conveyor orchestration is mechanics),
#2703 (retire the main-session loop). Program #2606. Children: the operation-engine epic and its eight slices.
