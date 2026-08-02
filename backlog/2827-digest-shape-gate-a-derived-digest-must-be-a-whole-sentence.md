---
bornAs: xqycd9e
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Digest-shape gate: a derived digest must be a whole sentence

The `firstParagraph` deriver (we:src/_data/backlog.js) silently yields a headless, mid-sentence, sometimes-unterminated digest when a section opens with a bolded line; DIGEST_MAX_WORDS only checks length. Add a script-decidable check beside the existing digest rule in we:scripts/check-backlog-item.mjs: the derived digest must start with a capital letter and end in terminal punctuation (and optionally must not begin with a lowercase continuation word).

## Acceptance

- A new check in `we:scripts/check-backlog-item.mjs`, beside the existing `DIGEST_MAX_WORDS` rule, runs the same `derive()` the loader uses and asserts the derived digest (a) starts with a capital letter and (b) ends in terminal punctuation (`.`/`!`/`?`).
- Optional third assertion: the digest does not begin with a lowercase continuation word (e.g. "floor", "and", "the").
- A passing fixture (a whole-sentence digest) and a failing fixture (a section opening with a bolded line, yielding a headless fragment) — #957's round-6 headless digest on `we:backlog/xgtiq7f-…` is the live failing instance.

## Related

Same provenance/record gate family as [#2821] (ratify-gate + provenance hooks), under epic [#2527]. Complements `DIGEST_MAX_WORDS` (`we:scripts/check-standards-rules.mjs`), which checks only length. Per memory rule 51 (hookable-vs-judgment): a script-decidable tell → a hook.
