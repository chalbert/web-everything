---
bornAs: xiueu46
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a write-guarded-content operation for memory notes, not just backlog scaffold

Backlog filing already has a smooth path -- we:scripts/backlog.mjs scaffold does write+guard+frontmatter in one call. Memory notes (we:agent-memory-src/*.md) have no equivalent: writing one tonight required the full manual dance -- acquire a lane, Write the note file, hand-edit the right category sub-index (we:agent-memory-src/index-infra.md etc, picking the right one by scanning topic scope), commit, land via pr-land, dispatch a review. That's the same orchestration-session toil #3160 (declare prepare decision-only as a callable operation) and #3161/#3162 already target for OTHER manual dances -- this is the memory-write instance of the same pattern class. A declared operation (or a CLI convenience wrapping the existing scaffold-guard-write machinery, mirroring we:scripts/backlog.mjs's shape) that takes a memory note's content + type + a target category hint, writes the note file, appends the correct one-line index pointer to the right sub-index (or asks/errs clearly if the category is ambiguous), and hands back a ready-to-land diff would remove this manual, repeatable multi-step ceremony from the orchestrating session's own time, the same way scaffold already did for backlog items.

## Done when

1. **Executable** — a `node we:scripts/backlog.mjs`-sibling CLI (or a registered operation per we:scripts/operations/) takes a note's content, `type` (user/feedback/project/reference, mirroring the existing memory-type taxonomy), and a category hint; writes the note file under we:agent-memory-src/; appends a correctly-formatted one-line pointer to the matching category sub-index (we:agent-memory-src/index-*.md); and exits non-zero with a clear "ambiguous category, pick one of: ..." message when the hint doesn't cleanly match a single sub-index — a test exercises both the clean-match and ambiguous-match paths.
2. The tool refuses (rather than silently writing to the wrong index) when no category hint is given and more than one sub-index plausibly matches, since a wrong or missing index entry makes a memory note undiscoverable — a test asserts this refusal.
3. A test asserts the tool's guard behavior (secret-scrub, locus-prefix) matches we:scripts/backlog.mjs scaffold's — this is content going through the identical write-guard seam (#3015's `scrubPublish`), so the new tool must not bypass it.
4. `npm run check:standards` is 0 errors and the relevant new test suite is green.
