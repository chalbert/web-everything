---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [backlog, gate, hygiene]
---

# Gate in-flight backlog hash citations outside the drain's rewrite scope

JIT numbering (#2288) gives a new item a temporary hash id (`x` + six chars) that the drain rewrites to its
real `NNN` at land. `numberPendingHashes` (`we:scripts/lane-drain.mjs`) rewrites only `backlog/*.md` and
`docs/agent/*.md`. Every hash citation planted anywhere ELSE — `scripts/**`, `skills-src/**`, tests — is
never rewritten and dangles permanently once the item lands.

## Why it is owed

The class is already proven to rot in this repo: `we:scripts/lane-drain.mjs` cites `xnsk54v`, which resolves
to nothing. PR #1046 (`#xdompzx`) planted roughly 60 more across `scripts/**` and `skills-src/**` in a single
change; three of them were RUNTIME-emitted text handed to a live reviewing model (a mandate line and two
JSON-schema `description` fields), which is strictly worse than a stale comment — a reviewer cannot look up
a backlog hash and should never be shown one. Those three were stripped by hand; the rest were left, because
renumbering 60 sites by hand is its own error source.

Nothing today tells an author that a hash they type outside `backlog/` + `docs/agent/` will never be
rewritten. The rewrite scope is a constant inside one script, invisible at the point of authorship.

## The guard

A `check:standards` rule: error on any IN-FLIGHT hash token matching `x[0-9a-z]{6}` that appears outside the
drain's rewrite scope.

- **Derive both sets from the same constant.** The scan set and the exemption set must come from the SAME
  exported constant `numberPendingHashes` uses to decide what it rewrites — if the drain widens or narrows
  its scope, the gate follows automatically. Two independently maintained path lists is the same drift the
  rule exists to catch.
- **In-flight only.** A hash for an item that has already landed (no `backlog/<hash>-*.md` on disk) is a
  different, worse problem — a dangling citation — and should read as such in the message. A hash matching a
  live item is a warning that it is about to dangle.
- **Runtime text is a hard error, comments are the ordinary case.** A hash inside a string literal that is
  emitted to a model or a user (prompt text, a schema `description`) must never be allowed; a source comment
  is the class this gate is nudging.
- The remedy the message should suggest: cite the durable thing (the symbol, the invariant, the landed
  parent item) rather than the temporary id, or wait for the item's `NNN`.

**Prevention for:** PR #1046 review, round 2 finding 8 (`#xdompzx`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lane-drain.mjs`
