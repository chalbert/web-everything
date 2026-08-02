---
bornAs: xctby8b
kind: task
status: open
dateOpened: "2026-08-02"
tags: [check-standards, review-integrity]
---

# Extend the #2821 code-locus rule from path-resolution to token assertion — we:<path>#<token> fails when the token is absent

Extend the #2821 code-locus rule in [we:scripts/check-standards.mjs](scripts/check-standards.mjs) (and its rule module [we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs)) from **path resolution** to **token assertion**: a locus written `we:<path>#<token>` must fail mechanically when `<token>` does not appear in the target file. Today the rule only proves the *path* resolves; a claim about a file's *scope* (e.g. "the config includes X", cited as `we:vitest.config.ts#coverage`) passes even when the cited region says the opposite.

## Prevents (PR #998 finding 1)

The #998 spec claimed the repo has "whole-repo v8 coverage with an 80% threshold" and cited [we:vitest.config.ts](vitest.config.ts). The real `coverage.include` is a curated allowlist that **excludes** `tools/` + `scripts/` — the exact trust-chain files the epic targets. A token-asserting locus (`we:vitest.config.ts#coverage` requiring the `coverage` token to be present *and* the surrounding claim to match) turns a false scope-claim from a review-caught finding into a gate-caught one.

## Acceptance

- A `we:<path>#<token>` locus errors when `<token>` is absent from the resolved file (path-only loci keep current behavior).
- A unit fixture: a present token passes; an absent token fails, naming the file and token.
- Green on the current tree.
