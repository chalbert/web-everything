---
kind: story
size: 5
parent: "xgy2ypv"
status: open
blockedBy: ["xyp1wnt"]
scope: ["we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-08-27"
tags: [operations, multi-provider, probe]
---

# Probe one alternate provider against the judge contract

`#xgy2ypv` researched two candidates from public documentation — Codex CLI and Gemini CLI — and found both
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
   whole point per `#xgy2ypv` goal 2 is subscription-included usage).
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
   `#xyp1wnt` extracts? If yes, what the port-conforming wrapper has to translate (argv shape, output
   parsing, failure-mode mapping) is listed concretely enough that `#xgy2ypv` step 3 can be scoped without
   re-deriving it. If no, say what blocked it and whether the fallback candidate should be tried instead.
3. **Nothing is wired into the judge panel yet.** This item produces evidence and a verdict, not running
   code — wiring is `#xgy2ypv` step 3, deliberately separated so a probe that fails does not leave half-built
   integration code behind.

## Deliberately NOT in scope

- **Wiring the result into the judge panel module.** That is the epic's step 3, and depends on this item's
  verdict being a clean yes.
- **The dispatcher/panelist spawn sites.** Same reasoning as `#xyp1wnt` — judges first.

## Lineage

Second decomposition step of `#xgy2ypv` (multi-provider agent dispatch), filed 2026-08-27. Candidate research
— Codex headless/JSON: [openai/codex issue #4219](https://github.com/openai/codex/issues/4219); Codex
subscriptions: [Inventive HQ](https://inventivehq.com/blog/codex-subscription-options-guide); Gemini CLI
headless docs: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md).
