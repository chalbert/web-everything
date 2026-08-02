---
kind: task
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Raw NUL byte in we:scripts/lib/jury-ledger.mjs makes a trust-chain file's diff unreviewable

`we:scripts/lib/jury-ledger.mjs` line 83 contains a **raw NUL byte** inside a regex
character class, where the source plainly intended the escape `\x00`. Git therefore
classifies the file as **binary** and refuses to render its diff, so changes to a file
in the auto-review trust chain cannot be reviewed as a diff at all. Replace the raw
byte with the escape, and add a `check:standards` rule rejecting raw control
characters in tracked source.

## Context

Found during the round-3/round-4 human review of PR #976 (`/review`, #2326). The PR's
stat line rendered that file as `Bin 30442 -> 30772 bytes`, and `git diff` reported
only `Binary files … differ` — so the reviewer had to read the post-image directly to
review the change to it.

The byte sits at offset 5614, in `subjectSlug`:

```js
const s = String(subjectKey ?? '').trim().replace(/[/\\\s<NUL>-\x1f]+/g, '-').replace(/^-+|-+$/g, '');
```

The range is clearly meant to be `\x00-\x1f`; the low end was written as a literal
control character instead. It is **functionally harmless** — a raw NUL is a valid
range start in a character class, so the regex behaves as intended and every test
passes. That is exactly why it survived since it arrived with `02b8335f` (#2641).

It is **not PR #976's defect** — it predates that PR, which is why it was filed
separately rather than blocking the review. The severity is about review integrity,
not runtime behaviour: on files in the auto-review trust chain (the code deciding
whether a change may land), an unreviewable diff defeats the human gate that
`review:human` exists to enforce. Git's binary detection triggers on a NUL in the
first 8000 bytes, so any such byte anywhere near the top of a source file has the same
effect.

## Acceptance

- The raw NUL in `we:scripts/lib/jury-ledger.mjs` is replaced with `\x00`; the file is
  valid text and `git diff` renders it normally.
- `subjectSlug`'s behaviour is unchanged — a test pins the slug output for input
  containing control characters, so the escape is proven equivalent.
- A `check:standards` rule errors on any raw control character (outside tab / newline
  / carriage return) in tracked source files, naming the file and byte offset. This is
  the captured prevention: the class is "a source file becomes binary to git", which is
  script-decidable and should never again cost a reviewer a manual workaround.
- The new rule is green over the current tree.
