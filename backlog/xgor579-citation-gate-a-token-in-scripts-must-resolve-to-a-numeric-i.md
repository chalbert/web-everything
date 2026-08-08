---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [review-integrity, check-standards, citation, gate]
scope: ["we:scripts/check-standards.mjs"]
---

# citation-gate — a #token in scripts must resolve to a numeric item or a hash

review-integrity guard extending the #2821 citation-gate family for the xc7p3q9
S1 invented-marker class.

## Why

The xc7p3q9 PR shipped 18 comment sites reading `#couple-decouple` — an invented
marker that resolves to NOTHING (not a numeric item, not a hash filename, not a
`bornAs` value, not even the item's slug). A reader following the citation lands
nowhere. The sibling (PR #999/xq985wu) correctly used the hash `#xq985wu`. Fixed
this round by replacing all 18 with `#xc7p3q9`.

## The guard

Extend the #2821 citation-gate: a `#<token>` appearing in `scripts/**/*.mjs`
(comments or strings) must resolve to one of:

- a numeric backlog item `#NNN` (a file `backlog/NNN-*.md`), OR
- an `x[0-9a-z]{6}` hash present as a `backlog/<hash>-*.md` filename or a
  `bornAs:` frontmatter value.

An unresolvable `#<token>` (a coined slug like `#couple-decouple`) is an error.
Bare-`#984`-style PR-vs-item ambiguity (S2) is a related but separate concern
(a `#NNN` that means a PR should be written `PR #NNN`); this gate covers the
resolves-to-nothing case.

## Acceptance

- The rule fires on a reintroduced `#couple-decouple`-style coined marker in a
  `scripts/**/*.mjs` file and passes on the current tree.
- 0 new errors on the `check:standards` gate.
