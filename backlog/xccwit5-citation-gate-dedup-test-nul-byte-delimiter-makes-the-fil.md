---
kind: story
size: 2
status: open
dateOpened: "2026-08-31"
tags: [testing, reviewability, flagged-by-review]
---

# citation-gate-dedup test's NUL-byte dedup-key delimiter makes the file undiffable

we:scripts/__tests__/citation-gate-dedup.test.mjs builds its dedup key with a raw NUL byte as the field
separator: `` const key = `${f.message}\x00${f.descriptor?.file ?? ''}`; ``. V8 accepts a NUL inside a
template literal without complaint and the tests pass, but git (and GitHub) classify any file containing a
NUL byte as binary — `git diff` on this file prints only `Binary files ... differ`, with no line-level
diff, for any future edit.

This isn't hypothetical: it happened during the we:PR #1741 review (we:backlog/xwt6ola-captureviaexecfilesync-catch-block-cannot-tell-a-killed-chil.md)
— the reviewing juror could not see what the change to this file actually did and had to reconstruct it
from context instead of the diff. Pre-existing, not introduced by that PR — carved out there as non-blocking.

Fix direction: swap the NUL for an ordinary delimiter neither field can contain — `f.message` is free-form
prose, `f.descriptor.file` is a repo-relative path, so a printable separator that can't appear in a path
(e.g. `|`) works, or sidestep the collision question entirely by keying on a two-element tuple instead of a
concatenated string (`JSON.stringify([f.message, f.descriptor?.file ?? ''])`).

A broader check-standards rule that scans every tracked text-source file for embedded NUL/control bytes and
flags any that isn't one of the three already-documented deliberate NUL-sentinel scripts (we:scripts/guard-bash.mjs,
we:scripts/renumber-collisions.mjs, we:scripts/component-render-build-hook.cjs — see the provenance-gate
comment in we:scripts/check-standards.mjs) would catch the next accidental one before it lands. That's a
bigger, separable piece of work — file it as its own item if it still looks warranted once this fix is in,
rather than folding it into this one.

## Done when

1. **Executable** — `python3 -c "print(b'\x00' in open('we:scripts/__tests__/citation-gate-dedup.test.mjs','rb').read())"`
   prints `False` (today it prints `True`).
2. **Executable** — after editing any other line in the file, `git diff -- we:scripts/__tests__/citation-gate-dedup.test.mjs`
   renders a normal line-level diff, not `Binary files ... differ`.
3. **Executable** — `npx vitest run we:scripts/__tests__/citation-gate-dedup.test.mjs` still passes unchanged:
   the dedup behavior (same message + same file dedupes; a different file does not) is preserved, only the
   key's delimiter changes.
