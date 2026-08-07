---
bornAs: xs9x5cm
kind: story
size: 2
status: open
relatedTo: ["2965", "2967"]
scope: ["we:scripts/check-standards-rules.mjs"]
dateOpened: "2026-08-07"
tags: [gate, check-standards]
---

# The declared-module-contract gate misses an undeclared import under the LAST declaration

`validateDeclaredModuleContract` slices a header's declared names per `from we:<path>` declaration line,
but for the **last** declaration the slice runs to `header.length` — the end of the whole block comment
rather than the end of that declaration's own text. Every backticked identifier in the trailing prose is
therefore counted as "declared", so an undeclared import from the last-declared module is silently
accepted. The rule exists specifically to catch a shipped drift (`normalizeFindings` imported, called,
undeclared); it currently cannot catch that drift if it recurs under the final declaration. Found
red-teaming the PR #1064 review.

## Proof, with a control

Injecting `normalizeFindings as nf2` into the import block for `we:scripts/lib/review-core.mjs` inside
`we:scripts/lib/converge-core.mjs` — the header's **last** declaration, which names only
`growOnlyRoster`, `floorGrowOnlyJurors`, `absentMandatoryLenses` — yields **0 errors**. It passes because
three sentences of ordinary prose *after* the last declaration happen to mention `` `normalizeFindings` ``
while describing the original bug, and that mention lands inside the unbounded slice.

Control: injecting an equally undeclared name into the **first** declaration's block
(`we:scripts/lib/jury-core.mjs`, properly bounded by the next declaration's index) correctly yields
**1 error**. The matcher works; the hole is specific to the trailing slice.

## Not the documented one-directional design

The rule's comment marks it *deliberately one-directional* — an undeclared import is an error, a declared
name that is not imported is not. That is a different asymmetry and says nothing about where the last
declaration's text ends. This is a bug, not the stated tradeoff.

The existing unit fixtures all end immediately after their last declaration line, so none exercises the
boundary — which is why it shipped green.

## Done when

- The last declaration's slice is bounded by its own text (e.g. stop at the next blank line within the
  header) rather than by `header.length`.
- A fixture with trailing prose after the last declaration is added, and it fails before the fix.
- The injection described above reports an error.
