---
bornAs: xt4mi76
kind: story
size: 2
parent: "2527"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/check-standards.mjs
  - we:scripts/check-standards-rules.mjs
tags: [check-standards, gate, hygiene, footgun]
---

# Lint invisible characters (U+200B, U+FEFF, U+00A0) out of scripts and docs source

A zero-width space (U+200B) is embedded in a gate's own warning template, so every emitted warning carries
an invisible codepoint. Nothing in the write path renders invisible characters visible, so it survived
authoring, review, and a green test suite. Make the whole class script-decidable.

## Provenance

Found in the independent `/review` of PR #974 (the CITATION-VERIFICATION gate). The live instance is in
[we:scripts/check-standards.mjs](scripts/check-standards.mjs), in the gate-3 message template:
`` `${f.slug}-…​.md` `` — an ellipsis followed by U+200B.

## Why it matters

The invisible character ships into user-facing gate output. Grepping the CI log for the message fails for
no visible reason; asserting on it in a test fails the same way; and `--json` output ships the raw `​`
to any downstream fixer agent parsing the message. The failure mode is "correct-looking string that does
not match", which is expensive to diagnose precisely because the cause is unrenderable.

## Root cause (the class, not the instance)

The sequence came in from a paste — an editor or chat surface that inserts U+200B after an ellipsis for
line-break control. This is a **writing-path** hazard, not an authoring-judgment one: no reviewer can see
it, and no test catches it unless the test happens to assert on the exact string. Per #51 (hookable vs
judgment) it belongs in a deterministic gate.

## Approach

Prefer the **write-time** guard over the after-the-fact sweep, matching the established
`PreToolUse(Edit|Write)` pattern (#43/#883) that already denies bare locus refs:

- A content scan that rejects U+200B (zero-width space), U+FEFF (BOM / zero-width no-break space), and
  U+00A0 (non-breaking space) in `scripts/**` and `docs/**` source at the moment of the write.
- A `check:standards` rule as the backstop, for the paths a pre-write hook cannot see (heredoc appends,
  direct shell writes) and for the existing corpus.
- Fix the one live instance in the gate-3 message template.

Decide whether Markdown prose warrants the same strictness as code, or whether U+00A0 in prose is a
legitimate typographic choice worth carving out. The zero-width characters are unambiguous; NBSP is the
judgment call.

## Acceptance

- The U+200B in the gate-3 warning template is removed.
- A write of any of the three characters into a scripts/docs source file is refused at write time, with a
  message naming the character and its offset.
- A `check:standards` rule catches the same class as a backstop, and the existing tree passes it (or its
  exceptions are enumerated).
