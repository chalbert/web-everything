---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
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

## Progress (batch-2026-06-27)

Screened all 14 cited leaves one-at-a-time, diffing each body against its cited
`we:docs/agent/platform-decisions.md#anchor` section. **Collapsed 3** (body fully subsumed — substance,
cross-links, and lineage all already in the statute):

- **#29** `crossorigin_import_keeps_devserver_clean` → `#cross-origin-dev-server-hygiene` (the statute is
  *more* complete; the leaf's #1499 lineage + #1030 human-gate removal are all there).
- **#87** `bias_separation_decoupling` → `#bias-toward-separation` (statute additionally carries the
  schema/ownership-coupling-not-file-count nuance the leaf lacked).
- **#97** `reusable_to_neutral_home` → `#reusable-neutral-home` (statute subsumes the #1788 overturn + the
  #899 distinction; the leaf's first-person narrative was pure provenance).

Each collapsed to a one-line essence + the `Codified:` pointer + its `[[…]]` cross-links (graph preserved);
the frontmatter `description` (the recall hook) is untouched.

**Kept 11** — they add what the statute omits (consistent with #1881 "most carry nuance"):
- **#1/#4/#5** (monetization cluster) — solo-founder operational ranking, the three-phase backend rule, the
  on-device distillation loop + #488 framing principles, the #775 assembler fork detail: product-strategy
  nuance not in the statute's principle.
- **#2** — the "stamp decision items soft-accepted" operational directive is leaf-only.
- **#75** — `we:docs/agent/design-first.md` step mapping (the statute defers the day-to-day form to
  `we:AGENTS.md` rule 6).
- **#86** — most-flexible-default has **no** dedicated statute section (only referenced by name); the leaf is
  its sole home — collapsing would *lose* the rule.
- **#78** — the render-strategy outlier anti-pattern + the #370 decision-fork tell.
- **#83** — the deterministic-generation mechanism ruling + #505/#506/#507 build program.
- **#89** — the Configurator-domain materialization mechanics + a11y/WCAG #1791 tell + #370 card-per-setting.
- **#93** — the #1486 worked example + `validateProtocol`/`ownedByProject` structural requirement.
- **#123** — conventions→webcompliance default-vocabulary substance (distinct from the statute anchor's
  dev-browser-lens framing).

`check:standards` + `check:health` green (0 errors). Bulk was deliberately avoided (#1893 over-classification
caution); 3/14 is the conservative, nothing-lost cut.
