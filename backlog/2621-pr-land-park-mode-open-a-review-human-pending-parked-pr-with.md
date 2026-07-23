---
bornAs: xr2189l
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, pr-land, drain, backlog, tooling]
---

# pr-land --park mode: open a review:human/pending-parked PR WITHOUT stranding its hash ids

Agents that need a **parked** PR (held for human review before land — `review:human` / `review:pending`)
currently fall back to a hand-rolled `gh pr create`, because `we:scripts/pr-land.mjs` has no clean park mode: the
default path waits-and-drains, and `--no-wait` opens the PR **unlabelled**. But `gh pr create` bypasses pr-land's
JIT numbering (#2288), so any NEW hash-id backlog item the PR carries lands **stranded** (#2319 — the heal that
filed this item). Give agents a first-class park route so they stop needing the numbering-bypassing workaround.

## What to build

- Add a `pr-land --park=<review:human|review:pending>` mode that:
  - opens the PR and applies the given review label **immediately** (parked, not `ready-to-merge` — the drain
    won't land it until the human verdict swaps the label, per #2307's producer review labels), AND
  - runs the **same JIT-numbering / land-prep** as the normal path (`we:scripts/backlog-renumber-collisions.mjs`
    / number-stranded pass) so a parked PR never strands a fresh hash id.
- Net effect: parked PRs go through the numbering-aware producer, and agents no longer reach for `gh pr create`.

## Alternatively / additionally

- Have the **drain** number stranded hashes at merge regardless of the route the PR came in on — a belt-and-braces
  backstop so a bypassing land can never leave a hash on main even if some future path skips park mode.

**Refs:** #2319 / #2288 (JIT numbering), #2307 (producer review labels), #2612 (conveyor epic).
