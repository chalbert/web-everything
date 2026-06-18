---
type: idea
workItem: story
size: 5
parent: "586"
status: resolved
blockedBy: ["587"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "intent:reaction + block:reaction (src/_data/intents.json + blocks.json + block-descriptions/reaction.njk)"
tags: []
---

# Build the reaction block + intent (ReactionSummary contract)

Build the reaction interaction per #370 Fork 5: a block (each reaction an aria-pressed toggle) backed by an intent for declarative dimensions. Contract baseline = Atlassian ReactionSummary: count · users[] (roster, display limit) · reacted (toggle-your-own) · optimisticallyUpdated. NOT a protocol (data contract, no engine-interop). Multi-user sync is a composed webrealtime concern, never baked in. A11y (load-bearing): composed accessible name (emoji+count+reacted-state), announce local toggle only — never every remote tick, keyboard-reachable roster. Reaction set = open config-driven named-set registry (default-less; sentiment default; allowAllEmojis escape).

## Progress

- **Resolved 2026-06-14.** Authored the reaction standard per #370 Fork 5 — **block + intent**, the
  consumer end of the expressive-symbol seam (sibling of #587/#594 in epic #586).
  - **Reaction intent** (`we:src/_data/intents.json`, footgun-safe splice) — dimensions `reactionSet`
    (sentiment | named-set | all-emojis; default-less core, sentiment flavor default per Fork 6),
    `roster` (count-only | names — display-limited, keyboard-reachable), `optimistic` (on | off). The
    description carries the `ReactionSummary` contract + the load-bearing a11y rules.
  - **Reaction block** (`fui:src/_data/blocks.json` + `we:src/_includes/block-descriptions/reaction.njk`) —
    `type: Component`, `composesIntents: [reaction, expressive-symbol]` (composes the glyph, never
    re-renders it). designDecisions capture: **ReactionSummary baseline** (count · users[] · reacted ·
    optimisticallyUpdated), **data contract NOT a protocol** (no vendor/engine interop → no lock-in),
    **sync composed via webrealtime** (never baked), `aria-pressed` toggle + **composed accessible
    name**, announce-local-toggle-only, config-driven reaction-set registry, and vs-#354 badge
    (compose-don't-merge).
  - **Verified:** both pages render (/intents/reaction/, /blocks/reaction/ — 11ty smoke 1541 pages);
    `check:standards` green; we:AGENTS.md inventory regen folds in the new block + intent counts.
