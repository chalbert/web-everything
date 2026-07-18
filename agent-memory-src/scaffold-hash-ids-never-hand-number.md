---
name: scaffold-hash-ids-never-hand-number
description: New backlog items are born with a hash id via scaffold; NEVER hand-assign a sequential NNN — the drain numbers at land. Hand-numbering collides with concurrent sessions.
metadata:
  type: feedback
---

File a new backlog item with `node scripts/backlog.mjs scaffold --kind=… --size=… --title="…"
--digest="…" [--parent=xHASH|NNN --blocked-by=…]`, which mints a collision-free **hash id**
(`xNNNNNN`). Reference not-yet-landed siblings by their hash. **The drain assigns the real
sequential `NNN` at land** and blind-rewrites hash→number everywhere (#2288/#2290). NEVER
hand-pick a number — even from a "next free id" survey.

**Why:** a max+1 / next-free-id you choose at author time races every parallel session. Real
incident (Jul 2026, WE #558): a 14-item set was hand-numbered 2544–2557; a concurrent
visual-diff session grabbed 2544/2545; the drain's collision-heal renumber (`we:scripts/
backlog-renumber-collisions.mjs`, #2291) fired and **blanked 6 files** while rewriting
cross-refs. Re-filed correctly with hash ids as WE #560; prevention filed as WE #561
(hash-id gate + content-preserving renumber + batch-scaffold). Hash-born items go through the
drain's normal number-at-land path and never touch the buggy collision-heal.

**How to apply:** always `scaffold` (it also writes a `check:standards`-shaped file); pass
`--digest` to author in one shot; for a spin-off filed mid-batch add `--session=<slug>` (born
active, `settle` when the body is ready). Filing many items? Still scaffold each — do not
hand-author a batch with hand-numbered ids. Pairs with
[[complete-branch-before-labeling-ready-to-merge]] — both are "don't reach around the drain".
