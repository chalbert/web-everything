---
bornAs: x4ve94l
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Repair 2821 gate 3 fixture eaten by the at-land hash-to-NNN rewriter

On main, #2821 gate 3's justification reads round 1's dead 2819 links; it originally said the 2819 hash slug. The at-land hash-to-NNN rewrite healed the very example that exists to demonstrate hash slugs are NOT healed, so the sentence now asserts numbered links dangle (false) and gate 3 has lost its reproducible fixture. Restore the example AND make it rewrite-proof so the next land does not eat it again.

## Acceptance

- Gate 3's justification in `we:backlog/2821-…` again names a hash slug (not a `2819`-style number) as its example.
- The example is protected from the at-land hash→NNN rewriter: either escape it, or state it as a shape (e.g. "an `x`-prefixed hash slug") rather than a live slug, so a subsequent land does not rewrite it back to a number.
- After a simulated at-land rewrite pass, the example still reads as a hash slug (a regression check that the fixture survives its own rewriter).

## Related

Repairs a fixture in [#2821] (ratify-gate + provenance hooks), under epic [#2527]. Gate 3 is the "hash slug cited outside backlog+docs that the at-land rewrite never heals" gate; its demonstrating example must itself survive that rewrite.
