---
kind: task
status: open
dateOpened: "2026-08-24"
tags: []
---

# `we:scripts/backlog.mjs claim` is a delegating front door — never count it as a raw site, never rewire it

A declared-operation coverage sweep must not rewire `node we:scripts/backlog.mjs claim <NNN>` to `we:scripts/operations/run.mjs claim --ref=`. The CLI verb already delegates through `claimViaOperation`, so naming it IS naming the declared layer — and the raw home additionally does the #083 reservation clear, the `we:readiness/claims.json` baseline, and the stop-for-rename block (PR #1525) that the operation does not. PR #1508 made exactly this rewrite and dropped all three. `claim` is the deliberate negative control in `we:scripts/operations/declared-homes.mjs`, which is why the #3224 scan is delegation-aware. Record the rule so a later sweep counting raw mentions does not repeat it.

## Why this needs writing down at all

The coverage question a sweep asks — "how many skills still instruct the raw home an operation owns?" — is
answered by grepping for `we:scripts/backlog.mjs <verb>`. That grep is **right about `scaffold` and `resolve` and wrong
about `claim`**, and nothing in the grep's output says which is which. The distinguishing fact is delegation,
and it is derived from the home's own source, not visible in the mention:

- `we:scripts/operations/declared-homes.mjs` lists `claim: ['we:scripts/backlog.mjs claim']` as the
  **negative control**, with the note that it "must never produce a finding".
- `we:scripts/lib/skill-operation-wiring.mjs` states the rule in the narrower form that actually holds: *a
  skill naming a raw home is a defect ONLY when that home does not reach the operation.* `homeDelegates`
  derives that from the source; it is deliberately not a flag on the declaration, because a flag would go
  stale the moment someone deleted the delegation.
- `we:scripts/backlog.mjs` routes its `claim` verb through `claimViaOperation`, so `node
  we:scripts/backlog.mjs claim <NNN>` **is** the operation's sanctioned front door.

What the raw home does that `we:scripts/operations/run.mjs claim` does not: the #083 reservation clear, the `we:readiness/claims.json` baseline
(so `check:standards --scope=<session>` can attribute later findings), and the rename-slug stop landed in
PR #1525. PR #1508 rewired `we:skills-src/next-backlog-item/SKILL.md` off the CLI on the theory that any
raw-home mention is a miswiring, and dropped all three.

## Done when

1. **Executable** — a sweep's own artifact records the exclusion: the coverage count for
   `we:scripts/backlog.mjs` excludes the `claim` verb and names delegation as the reason, so the number is
   reproducible by someone who did not run the sweep.
2. `node we:scripts/operations/run.mjs claim --ref=` appears at **zero** call sites in `we:skills-src/`,
   `we:docs/`, `we:.claude/` and `we:AGENTS.md` — every `claim` instruction still names
   `node we:scripts/backlog.mjs claim <NNN>`.
3. The rule is stated where a sweeper reads it before grepping — not only in this card.

## Not in scope

Rewiring `scaffold` / `resolve`, which genuinely do not delegate and whose sites were moved to
`we:scripts/operations/run.mjs` alongside this card. Any change to `we:scripts/operations/declared-homes.mjs`
or to the #3224 / #3253 scans — this item records a rule, it does not move a gate.
