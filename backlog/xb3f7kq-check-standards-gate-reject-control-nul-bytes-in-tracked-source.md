---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [review-integrity, check-standards, hygiene]
---

# check:standards gate — reject raw control / NUL bytes in tracked source

Add a deterministic `check:standards` rule that fails loudly when a tracked
source file contains a raw control byte (`\x00`–`\x1f`, excluding the ordinary
`\t` / `\n` / `\r` whitespace). A NUL or other control byte embedded in source
makes **git treat the file as binary**, so its diff renders as `Bin … -> …`
bytes and is **unreviewable** — a review-integrity hole, not a cosmetic one, and
exactly the kind of script-decidable defect a sibling gate should catch.

## The live instance that motivated this (already fixed separately)

`we:scripts/lib/jury-ledger.mjs:83` (the review trust-chain / jury durable-log
module) carried a **raw NUL byte** — and a raw `0x1f` — inside a regex character
class:

```
String(subjectKey ?? '').trim().replace(/[/\\\s<NUL>-<0x1f>]+/g, '-')
```

The author plainly intended the escaped range `\x00-\x1f` (strip control chars
from a log-file slug), but wrote the literal bytes. It is **functionally
harmless** — a raw NUL is a valid range start in a character class, so the regex
behaves identically — which is exactly why it survived unreviewed. The cost was
review integrity: git marked the file binary (`Bin 30442 -> 30772` in the commit
that introduced it), so its diff could not be read.

- **Provenance:** introduced by **#2641** (commit `02b8335f`), NOT by PR #976 /
  #2823 — surfaced during that PR's round-3 human review, filed here as its own
  item so it is fixed on the right change.
- **The one-char fix:** replace each literal control byte with its escape —
  `\x00` and `\x1f` — so the class reads `[/\\\s\x00-\x1f]` and the file is text
  again. (Landed on a tiny separate PR alongside this filing; the regex behavior
  is unchanged.)

## The gate (what this item adds)

A `check:standards` rule that scans tracked text-source files (`.mjs`/`.js`/`.ts`
/`.md`/`.json`/… — the source set, not build artifacts or intentional binaries)
and **errors** on any byte in `\x00`–`\x1f` except `\t` (0x09), `\n` (0x0a),
`\r` (0x0d). It names the file + line + the offending code point, and points the
author at the escaped form. This makes "a control byte slipped into source and
turned a file binary" a build-time failure at author time rather than a defect a
human only finds when a diff renders unreadable.

## Acceptance

- The rule errors (not warns) on a tracked source file containing a raw control
  byte outside `\t` / `\n` / `\r`, naming file + line + code point.
- It does NOT fire on legitimate binaries (images, fonts, baselines) — scoped to
  the text-source set (or gated on git's own text/binary attribute).
- Green on the current tree once the `we:scripts/lib/jury-ledger.mjs` one-char
  fix has landed.
- A unit test proves it flags a fixture containing a NUL / `0x1f` and passes a
  clean fixture (incl. tabs/newlines, which must remain allowed).
