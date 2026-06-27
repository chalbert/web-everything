---
kind: story
size: 3
status: open
dateOpened: "2026-06-27"
tags: [memory, statute, reconciliation]
---

# Collapse statute-restating memory bodies into thin pointers (one-at-a-time)

Sub-task 3 of the memory statute-citation reconciliation, carved from #1894 (which delivered the
codification + citation pass). STD/MON/ARCH leaves now carry a `Codified:` footer pointing at their
`we:docs/agent/platform-decisions.md#anchor`; this collapses the leaf bodies that *merely restate* that
statute to a thin pointer, reclaiming index weight. Bulk is unsafe (#1893 caught one over-classification;
#1881 found most bodies carry nuance), so work one file at a time: collapse only when the body adds nothing
the statute doesn't. Screen the 14 leaves #1894 cited first.

## Detail

Candidates: `#1`/`#2`/`#4`/`#5` (monetization), `#75`/`#78`/`#83`/`#86`/`#89`/`#93`/`#123` (STD),
`#29`/`#87`/`#97` (newly-codified). For each leaf with a `Codified:` footer, diff the body against the cited
statute section; collapse to header + `Codified:` line only when nothing is lost, else keep it (the nuance
is the point). Ready now (its prerequisite #1894's citation pass is done). Lineage: #1894, #1893, #1868,
#1855, #1881.
