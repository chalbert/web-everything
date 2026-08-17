---
kind: task
status: open
scope: ["we:scripts/lib/jury-ledger.mjs"]
dateOpened: "2026-08-17"
tags: [jury, types, gate-gap]
---

# jury-ledger's FoldedJuror.verdict type is missing 'prevention-outstanding'

`we:scripts/lib/jury-ledger.mjs:338` types `FoldedJuror.verdict` as
`'accept'|'changes'|'needs-human'|null` — but the fold can genuinely produce
`'prevention-outstanding'` as a verdict (seen elsewhere in this repo's own review vocabulary, e.g.
`deriveVerdict`'s reduction). The JSDoc union is simply wrong, and nothing catches it: the
`@verdicts-total` gate scans marked structures for a total, not the JSDoc union itself, so a value the
fold can actually return sits outside its own declared type with no error anywhere.

## Why this is a real gap, not a nicety

Surfaced 2026-08-17 during prep on `#3128`, incidentally — not this item's original subject. Left
unfiled at the time by the discovering agent per instruction; filed now as its own item so the type
doesn't keep quietly lying about what the fold can produce.

## Done when

1. **Executable** — `FoldedJuror.verdict`'s JSDoc union includes `'prevention-outstanding'`; a test
   folding a juror result with that verdict asserts the folded output's type checks (or, if the project
   doesn't type-check JSDoc in CI, asserts the fold itself doesn't drop/coerce the value).
