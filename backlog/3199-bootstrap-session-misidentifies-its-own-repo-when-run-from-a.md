---
bornAs: xsarpbt
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# bootstrap-session misidentifies its own repo when run from a lane clone

selfKey/siblingsFor in `we:scripts/bootstrap-session.mjs` use the raw `basename(root)` instead of resolving through `primaryCheckout(root)` first. Run the bootstrap from inside a lane clone — `.lanes/web-everything/lane-9` — and it fails to recognise its own repo, reports an unrecognised checkout, and lists the repo it is standing in as a MISSING sibling. Resolve the root through primaryCheckout before deriving the key. Found by the review-pr correctness juror on PR #1463 at head 43d37efe: CONFIRMED, worseThanBase true, parallelizable, so a carve-out rather than a bounce.

## Why it bites where it does

A lane clone is where agent work actually happens, so "run the bootstrap from a lane" is the normal case, not
an exotic one. The symptom is misleading in both directions at once: the tool reports the repo you are standing
in as *missing*, and reports your checkout as *unrecognised* — so the honest reading of its output is "this
environment is broken", when nothing is.

## Done when

1. **Executable** — a test that calls `selfKey` (or `siblingsFor`) with a lane-clone path such as
   `<workspace>/.lanes/web-everything/lane-9` and asserts it resolves to the `web-everything` key. It fails
   today and passes after.
2. `siblingsFor` on that same path does NOT list the repo the caller is standing in.
3. A primary checkout keeps resolving exactly as it does now — the fix must not trade one misidentification
   for another.
