---
name: new-standard
description: Author a new Web Everything standard (intent, block, plug, adapter, or project) the canonical way. Use when the user wants to "create/add/design a new standard", "design a new intent/block/plug/adapter", or otherwise introduce a new browser-aligned standard to this repo.
---

# Authoring a Standard

This skill is a **trigger and pointer** — the method lives in
[docs/agent/design-first.md](../../../docs/agent/design-first.md) so every agent (Claude, Copilot, Cursor)
follows the same process; don't duplicate it here — if the process changes, edit that doc.

> **Runs in a lane — set it up FIRST (#2123).** Authoring a standard edits the tree, so work in an
> **isolated lane clone**, never the shared primary checkout (`we:scripts/guard-lane.mjs` blocks a primary
> `Edit` otherwise): `node we:scripts/lane-pool.mjs status --json` → pick a clean lane → author there →
> land via PR. Full rule: *backlog-workflow.md → Working an item*.

When invoked:

1. Read *design-first.md → The method (every standard)* (research prior art → verify overlap & relationship →
   determine semantics term-first → plan, then design-first) and the *design-first.md → taxonomy cheat-sheet*
   to decide which layer(s) the standard occupies.
2. Enter plan mode for step 4. Draft the spec with open questions and iterate with the user *before* writing
   any `*.json` / `.njk`. Present drafts to refine, not rapid-fire multiple-choice questions, unless a clean
   fork genuinely needs a decision.
3. On approval, implement per *design-first.md → Adding a block / plug / intent*, then run the Definition of
   Done from [AGENTS.md](../../../AGENTS.md): `npm run gen:inventory` (if a block/plug/intent changed),
   `npm run check:standards`, and affected tests.
