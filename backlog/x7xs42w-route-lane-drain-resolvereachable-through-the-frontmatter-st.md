---
kind: task
status: open
relatedTo: ["2455", "2396"]
tags: [lane, drain, proof-of-land, bug]
dateOpened: "2026-07-21"
---

# Route lane-drain resolveReachable through the frontmatter-strict resolved-on-main reader

`we:scripts/lane-drain.mjs` (~line 307) reads the "is item N `status: resolved` on origin/main?" predicate
LOOSELY: `resolveReachable = /^status:\s*resolved/m.test(body)` over the **full body** of
`origin/main:backlog/<num>-*.md`. This is the same spoof class #2455 fixed in `we:scripts/lane-resume.mjs`:
an OPEN item whose prose carries a column-0 `status: resolved` (e.g. a fenced frontmatter example) reads as
resolved. On the DRAIN (the merge path) that fails OPEN — a queued couple whose resolve did not actually flip
`status` could have its queued marker cleared on the strength of a body example.

## Why now
Found by the #2455 adversarial review as the THIRD reader of the one predicate — out of #2455's stated
two-reader (lane-resume) scope, so tracked here to get its own test + review on the merge machinery rather
than riding an unrelated PR.

## Scope
- Replace the loose full-body regex at `we:scripts/lane-drain.mjs` `resolveReachable` with the same
  frontmatter-strict read `we:scripts/lane-resume.mjs` now uses — `readField(body, 'status') === 'resolved'`
  (`readField` from `we:scripts/backlog/frontmatter.mjs` parses only the first `---`…`---` block).
- Fails closed on the same inputs (no frontmatter / bad read → not resolved).

## Acceptance
`resolveReachable` reads a fenced-example spoof (OPEN item, body `status: resolved`) as NOT resolved; a
genuinely frontmatter-resolved item still reads resolved. A regression test on the drain path pins it. The
predicate could also be factored into a shared helper so all three readers (#2455's `docIsResolved`,
`resolvedOnMain`, and this) share one definition.
