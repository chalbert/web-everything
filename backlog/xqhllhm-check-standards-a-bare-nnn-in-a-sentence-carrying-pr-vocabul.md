---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [check-standards, review-integrity]
---

# check:standards — a bare #NNN in a sentence carrying PR vocabulary must be written PR #NNN

Add a `check:standards` rule (in [we:scripts/check-standards.mjs](scripts/check-standards.mjs) / [we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs)): a bare `#NNN` inside a sentence carrying **pull-request vocabulary** — `merged`, `review round`, `landed via`, `false positive`, and similar — must be written `PR #NNN` (house style, #2820/#2823). Bare `#NNN` is backlog-**item** syntax, so a `#NNN` meant as a PR resolves to an unrelated backlog item; the reader (or a resolver) silently follows the wrong link.

## Prevents (PR #998 finding 4)

The #998 epic cited "#984 four rounds, #983 a false-green, #974 false positives, #985 a duplicate" as evidence — all meant as PRs, but bare `#NNN` resolves them to unrelated FUI-demo / MaaS backlog items. Rewriting them `PR #984` … `PR #985` fixed it; this rule catches the class so PR evidence is never mis-linked to an item again.

## Acceptance

- A bare `#NNN` in a sentence containing PR vocabulary (`merged` / `review round` / `landed via` / `false positive` / …) errors, suggesting `PR #NNN`.
- An already-`PR #NNN` reference, and a bare `#NNN` in a plain item cross-ref sentence, both pass.
- Unit fixtures for the flagged case, the two passing cases, and green on the current tree.
