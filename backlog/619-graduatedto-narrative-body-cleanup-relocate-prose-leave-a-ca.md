---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: []
---

# graduatedTo narrative→body cleanup — relocate prose, leave a canonical leading token

Follow-on to #614. After #614's normalizer auto-typed the safe bare ids, ~74 resolved items still carry a graduatedTo whose value is prose/narrative (e.g. `plateau: getStandInElement.ts (tag-keyed …)`) instead of a clean leading entity ref or repo path. Per #607's hygiene goal, move the narrative into the item body and leave graduatedTo as the canonical token (`kind:id`, repo-path, or `none`) so entity-graph joins and the G3 lineage walk read it reliably. Run `npm run normalize:graduated -- --json` to enumerate the review buckets; also resolve the four `{url,label}` object-form and four item-id-split values. `check:standards` already surfaces the live count via one aggregated warning pointing here.
