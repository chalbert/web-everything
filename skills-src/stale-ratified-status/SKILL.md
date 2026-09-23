---
name: stale-ratified-status
description: Find backlog items whose status is still open/active while their body already reads as ratified or built, before a batch/prepare pass wastes effort re-selecting done work. Read-only triage over the check:standards "reads as already ratified or built" warning (#3383); never flips a status itself.
---

# Find status/body mismatches before they waste a pass

A recurring failure (#3838–#3849, #3801): frontmatter says `status: open` while the body already
records the work as ratified or built — a decision ratified inline per-fork with no status flip,
or a build story carrying a "Verified done, `<date>`" note that was never resolved. A batch/prepare
pass can then re-select an already-done item as "ready to build", which is wasted effort. This is
the standing mechanical check for that, not a new tool — it is one WARN-level rule inside
`check:standards`'s existing per-item backlog lint (`lintBacklogItemRendering`,
`findStaleRatifiedClaims` in `scripts/check-standards-rules.mjs`).

## When to run it

- Before a batch/prepare/`/next` pass selects items, especially on a decision-heavy area or a
  branch that just had several forks ratified.
- Whenever a session ratifies a decision fork or records a build as done in prose — run it on that
  one item immediately, before moving on, so the status flip (or its absence) is never left to luck.
- As part of any normal `check:standards` gate run — this rule rides along with no extra step.

## Run it

Whole repo (rides the normal gate):

```bash
npm run check:standards
```

One item, cheaply, right after editing it:

```bash
npm run check:item -- NNN
```

## Reading a finding

Each finding names the item, quotes the exact matched text, its label (`"Verified done" blockquote`
/ `"## Ratified" heading` / `dated "ratified" assertion`), and the body line number. It is a WARN,
not an ERROR — this is a heuristic over prose, calibrated to stay quiet on a body that only
*discusses* ratification (citing another item's, e.g. "Ruled in #3801 Fork 2") and to skip
`kind: epic` (an epic's own "## Ratified …" heading usually documents a ratified design for its
children, not completion of the umbrella). Triage each finding, don't rubber-stamp it:

1. **The work really is done.** Flip `status: resolved` (with a `graduatedTo`, or link the
   follow-through item/PR that will carry it to `main`).
2. **A decision ratified some forks, not all.** Leave it open, but consider noting which forks are
   settled so the next reader doesn't re-derive it.
3. **The body only cites another item's ratification.** False positive — reword the passage so it
   doesn't read as a claim about *this* card (e.g. name the other item explicitly), or leave it; a
   few of these are expected and are not a bug in the check.

This skill never edits a status itself — resolve the item through the normal `resolve` flow (or
`backlog.mjs`) once you've decided it's actually done.
