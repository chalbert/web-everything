---
kind: story
size: 5
parent: "3740"
status: open
scope: ["we:scripts/lib/track-line.mjs", "we:scripts/__tests__/track-line.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# track line contract: strict one-line schema, secret pre-flight, and key and provenance from the real path

One pure module that defines what a single intake line may be: kind (fix, build, decide or note), a capped one-line summary, a source reference, an allowed character set, and no frontmatter delimiters. It also derives the idempotency key from source file plus line hash, derives provenance from the real file path and never from content, and scans every line for secrets before any card is written so one bad line fails the whole batch. Design-first, uncleared.

Slice of epic #3740 (design point 2 and the key from point 3). Filed uncleared: a design review comes before any build. This is the shared contract every later slice imports, so it is a foundation with no blockers.

## Design

**Settled (read from the code).**

- One pure module, `we:scripts/lib/track-line.mjs`, no fs and no clock: `parseLine`, `validateLine`, `lineKey`, `provenanceFor`, `preflightSecrets`. It follows the allow-list pattern of `validateEntry` in `we:scripts/conveyor/learnings-drop.mjs` (a fixed field set, a kind enum, per-field caps, a rejected entry is never appended).
- A line carries exactly a kind (`fix`, `build`, `decide` or `note`), a one-line summary, and a source reference. A missing or unknown kind is not a parse failure: it comes back as `kind: 'unset'` with a flag, and the ingest engine defaults it to a card (design point 1: over-filing is cheaper than losing work). The parser never infers a kind.
- The secret scan must be a pre-flight over the whole batch, not the per-write scan that exists today. `assertPublishableContent` (`we:scripts/backlog/guarded-write.mjs:107`) already runs the secret scrub and the locus scan on every card write, but it throws on the Nth card after N-1 cards are already on disk. So `preflightSecrets(lines)` reuses `scrubPublish` (`we:scripts/lib/secret-scrub.mjs:305`) over every line first and fails the whole batch before any write. It re-implements no secret pattern.
- The idempotency key is source path plus a hash of the normalised line text, never the line's position, so moving a line inside its file does not change its key and re-ingest finds the same card. The key is written to the card through the `intakeKey` input the file-item slice adds.
- Provenance is derived from the real path: `provenanceFor` resolves the source with realpath and maps its root to a class. It never reads a header or field from the file content, and a symlink cannot claim another file's class. The class is passed to file-item as `provenance`.

**Open (settle in the design review).**

1. The numbers and the charset: the length cap (200 characters is the working guess) and the allowed character set (printable ASCII plus a short punctuation list, or full unicode minus control characters). "No frontmatter delimiters" also needs a stated rule for a line that starts with three dashes or contains a code fence.
2. The provenance classes and the path-to-class table. Worker result files, learnings and escalation records are clearly non-operator. Whether the orchestrator handoff counts as `orchestrator` or as non-operator is open. Either way the ingest engine always passes `--queue=false`; the class only records where a card came from and feeds the guard in the file-item slice.
3. The line syntax itself: a delimited form (`kind | summary | ref`) versus a small key-value form. It must survive being written by a model at the end of a result file, so leaning to the form that is hardest to malform, not the shortest.

## Done when

1. **Executable** — `node --test we:scripts/__tests__/track-line.test.mjs` passes, with cases that cannot pass before this module exists: an over-length line, a disallowed character, a line starting with a frontmatter delimiter, and an unknown kind (returned as `unset` with a flag, not a throw).
2. **Executable** — the same suite proves the pre-flight: a batch of three lines whose second carries a secret-shaped value returns a failure naming that line, and a caller that stops on it has written zero cards.
3. **Executable** — the same suite proves the key and the provenance: the same line at two positions in one file gives one key, the same line in two files gives two keys, and a symlink named like the handoff but pointing at a result file is classified as the result file.
