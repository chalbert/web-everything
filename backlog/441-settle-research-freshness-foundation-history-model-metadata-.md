---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-13"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-12"
tags: [research, freshness, versioning, staleness, review-horizon, design-decision, webdocs]
relatedProject: webdocs
relatedReport: reports/2026-06-12-research-freshness-model.md
reportDate: "2026-06-12"
crossRef: { url: /research/research-freshness-model/, label: "Research-freshness model — prior-art survey" }
---

# Settle research-freshness foundation: history model, metadata home, staleness enforcement, review horizon

## Ruling (2026-06-13) — all four forks ratified at their bold defaults

- **Fork 1 — History model: A.** Immutable dated chain + **bidirectional** `supersedes`/`supersededBy`
  pointer + a `superseded` status; refresh = a new dated `reports/YYYY-MM-DD-{slug}.md`, never an
  in-place overwrite. Bidirectional (not one-way) is the explicit sub-call — the reverse-lookup ("what
  superseded this?") earns its second field given the audit-trail goal.
- **Fork 2 — Metadata home: A (registry).** `lastReviewed`/`reviewHorizon` live on the topic in
  [we:researchTopics.json](src/_data/researchTopics.json), the render+validator source. Three **distinct**
  dates kept separate: `dateOpened` ≠ last-changed ≠ `lastReviewed` — never one overloaded field.
- **Fork 3 — Scope: A.** Freshness applies to promoted `/research/` topics only; ad-hoc `reports/*.md`
  stay frozen by design (opt-in by promotion, so most-permissive default holds).
- **Fork 4 — Review horizon: A.** Per-topic `reviewHorizon` + global fallback + an **RFC 5861
  grace band** (stale-while-shown — past the horizon a topic is *flagged for re-review, not hidden*).
  Committing to the flag-don't-hide semantic now is the explicit sub-call. Volatility tiers (C) deferred;
  A is forward-compatible (a tier just sets `reviewHorizon`).
- **Ratified-by-default (not forks):** a reader-facing freshness **badge** on `/research/` **and** a
  maintainer-facing `check:standards` rule both ship; that staleness rule is **warn-only, never a CI
  error**.

Build slices authored from this ruling: **#476** (A — foundation schema + badge scaffold), **#477**
(B — staleness derivation + warn-only rule + badge, blocked-by #476), **#478** (C — refresh-as-new-report
+ bidirectional supersedes render, blocked-by #476). These unblock epic **#192**'s slices A–C. The
axis-discovery *trigger* concern stays open with #192.

---

**Prepared, ready to ratify.** Foundation forks carved off epic **#192**. **No design exists yet** —
none of `lastReviewed` / `supersedes` / `reviewHorizon` are in the tree; this defines the schema they
add. The four forks below are grounded in a prior-art survey published as
**[/research/research-freshness-model/](/research/research-freshness-model/)** (report
`we:reports/2026-06-12-research-freshness-model.md`), each carrying a **bold** default. **Two are genuine
calls (history model, review horizon), two near-ratifications (metadata home, scope); the survey added
Fork 4 and dissolved the item's old "staleness enforcement" fork into "support both."**

## Why these are one decision

They all land on the **same three surfaces**, so they can't be settled independently without churn: the
research-topic registry [we:src/_data/researchTopics.json](src/_data/researchTopics.json) (the schema home,
e.g. an entry's field block at [:1](src/_data/researchTopics.json#L1)); the renders
[we:src/research.njk:21-44](src/research.njk#L21-L44) (the `/research/` card grid) and
[we:src/research-topic-pages.njk:41](src/research-topic-pages.njk#L41) (`Opened: {{ topic.dateOpened }}` —
the only date surfaced today); and the validator
[we:scripts/check-standards.mjs:73](scripts/check-standards.mjs#L73) (`RESEARCH_STATUSES`) /
[:156](scripts/check-standards.mjs#L156) (the registry dup-check), which today never looks at a date.
The orthogonal axes the survey surfaced map one-to-one onto the forks: *revision/history* · *metadata
location* · *scope* · *review-horizon expression* (staleness *surfacing* turned out not to be an axis —
see "Supported by default").

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — History model** | Immutable dated reports + **bidirectional** `supersedes`/`supersededBy` + `superseded` status; refresh = new dated report | Single living report with in-file changelog | High — RFC/PEP/ADR/W3C consensus + the stated audit goal |
| **2 — Metadata home** | Topic-level `lastReviewed`/`reviewHorizon` on the **registry** (render+validator source); last-changed kept distinct | Report frontmatter (per-doc), or both | High — render-source ownership; one noted counterpoint |
| **3 — Scope** | Promoted `/research/` topics only | Every `reports/*.md` | Med-high — registry is the unit with a date to hang on |
| **4 — Review horizon** | Per-topic `reviewHorizon` + global fallback + RFC 5861 grace band; volatility tiers deferred | Single fixed global interval, or full volatility tiers now | **Low — divergent across prior art (the real call)** |

## Fork 1 — History / revision model

How does a re-researched topic supersede the old without destroying the dated trail? Crux is at the
report chain under a stable topic id (`/research/{id}/` is already de-dated; reports are dated at
[reports/](reports/)).

- **A — Immutable dated chain + bidirectional supersedes pointer (DEFAULT).** Refresh = a *new* dated
  `reports/YYYY-MM-DD-{slug}.md`, never an in-place overwrite; the registry topic surfaces the latest as
  canonical and links superseded revisions as history via a **bidirectional** `supersedes` /
  `supersededBy` pair plus a `superseded` status value on the revision. This is the exact shape RFC
  (`Obsoletes`/`Obsoleted-by`), PEP (`Replaces`/`Superseded-By` + `Status: Superseded`), MADR, and W3C
  TR (dated snapshot vs latest pointer) all converge on — and WE already stores immutable dated reports,
  so only the pointer+status is net-new. Preserves the literal historical document (the audit value
  #192 names).
- **B — Single living report + in-file changelog** (*Rejected*). Lighter (one file, Keep-a-Changelog
  style), but mutates the dated artifact and loses the original framing — directly against #192's "the
  dated trail is the audit value / never an in-place overwrite." Use only if per-revision permalinks are
  never wanted.

*Classification:* not a Protocol (no swappable-vendor interop story — it's an internal docs schema); a
fixed mechanic, because the audit goal makes "never overwrite" an invariant, not a both-legitimate
dimension. Survey sharpened the default from a one-way pointer to a bidirectional one.

## Fork 2 — Freshness-metadata home

Where do `lastReviewed` + `reviewHorizon` live?

- **A — Registry ([we:researchTopics.json](src/_data/researchTopics.json)) (DEFAULT).** It is the render
  source for `/research/` ([we:src/research.njk:25](src/research.njk#L25)) and the validator's input
  ([we:scripts/check-standards.mjs:84](scripts/check-standards.mjs#L84)), so it naturally owns the surfaced
  topic-level date — one place to read for badges and the `check:standards` rule, no join.
- **B — Report frontmatter (per-doc)** (*Rejected as the topic-level home*). This is the *prevailing*
  prior-art convention (Microsoft `ms.date`, Hugo `lastmod`) — but it fits a mutable per-document model,
  whereas WE's report is an **immutable snapshot** (Fork 1) and the **topic** is the living unit. A
  moving review date cannot live on a frozen report; it belongs on the stable topic record. The
  per-report date already exists implicitly via the dated filename.
- **C — Both** (*Rejected*) — two homes to keep in sync, no concrete need.

*Borrowed correction (sub-decision):* Microsoft's `ms.date` **conflates** last-*changed* with
last-*reviewed*; keep them **distinct** — `dateOpened` (existing) ≠ report/last-changed date ≠
`lastReviewed` (last verified-still-correct). Three distinct dates, not one overloaded field.

## Fork 3 — Scope of "research" freshness

What does freshness apply to?

- **A — Promoted `/research/` topics only (DEFAULT).** The registry entry is the unit that carries a
  date and a render; ad-hoc `reports/*.md` (including backlog-mirrored pointer reports, loaded via
  [we:src/_data/backlog.js:106](src/_data/backlog.js#L106)) stay frozen by design — point-in-time session
  artifacts, not living surveys, with no registry entry to hang `lastReviewed` on.
- **B — Every `reports/*.md`** (*Rejected*). Broader, but most reports are not meant to be re-evaluated
  and have no registry row; it would demand a parallel date store for documents that are correct to
  leave frozen.

*Classification:* most-permissive default still respected — freshness is *opt-in by promotion* (any
report can be promoted to a topic to enter the freshness system); the restriction is the author's choice
to promote, not a cap.

## Fork 4 — Review-horizon expression  *(added by the survey)*

How is "overdue for review" computed and made actionable? The item originally folded this into
enforcement; the survey shows it is the genuinely divergent axis. The warning would slot beside the
existing registry checks at [we:scripts/check-standards.mjs:156](scripts/check-standards.mjs#L156).

- **A — Per-topic `reviewHorizon` + global default + grace band (DEFAULT).** Each topic may declare a
  `reviewHorizon` (e.g. months); absent one, a global fallback applies. "Overdue" derives from
  `lastReviewed + reviewHorizon`, with an RFC 5861-style **grace band** (stale-while-shown: past the
  horizon it is flagged for re-review, not hidden) rather than a hard cliff. Borrows the cache-freshness
  vocabulary (`max-age` → horizon, `stale-while-revalidate` → grace) the platform already standardised.
- **B — Single fixed global interval** (*Rejected as sole mechanism*). Simplest (one constant), but
  treats a fast-moving framework survey and an evergreen concept identically; prior art (Wikipedia
  `{{Update after}}`, content-ops cadence-by-type) favours per-document horizons. Fine as the *fallback*
  inside A, not as the whole model.
- **C — Full volatility tiers now** (*Deferred, not rejected*). The maturing pattern (high-volatility
  API docs reviewed far more often than evergreen) — but a tier taxonomy is its own design; defer until
  a second tier is actually demanded. A is forward-compatible (a tier just sets `reviewHorizon`).

*Classification:* an Intent-style configurable dimension (both per-topic and global-fallback are
legitimate end-states), behavioral and config-defaulted — the default flavour is what a topic optionally
overrides, nothing is a hardcoded constant.

## Supported by default (not decisions)

Run through the fork-existence test, the original OP-3 ("staleness enforcement: badge vs warning vs
both") **is not a fork** — the survey shows badge and warning serve two different audiences (readers vs
maintainers, per Wikipedia's banner + hidden tracking category, and `actions/stale`) and **coexist by
design**. So, ratified by default rather than chosen:

- **Reader-facing freshness badge on `/research/`** (the card grid /
  [topic page](src/research-topic-pages.njk#L41)) **and** a maintainer-facing
  `check:standards` rule — both, not either/or.
- **The `check:standards` staleness rule is warn-only, never an error** (forced invariant — Vale's norm:
  only `error` severity fails CI; stale research is a nudge, not a build break). It slots beside the
  registry checks at [we:scripts/check-standards.mjs:156](scripts/check-standards.mjs#L156).

---

## Context — what ratifying this unblocks

Build slices, authored after the ruling (per the carve in
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → "flip *or* carve"):

- **A — foundation:** add `lastReviewed` + `reviewHorizon` + the revision-chain fields
  (`supersedes`/`supersededBy`/`superseded` status) to the registry schema; render "current + history"
  and a freshness-badge scaffold on `/research/`. (size ~3)
- **B — staleness:** derive stale state from `lastReviewed + reviewHorizon` (with the grace band); add
  the warn-only `check:standards` rule and the reader badge. (~2, blocked-by A)
- **C — history/supersedes:** refresh = new dated report + bidirectional pointer; render prior
  revisions. (~3, blocked-by A)

The fifth concern from #192 — the axis-discovery **trigger** (process vs scheduled agent vs
touch-time) — is genuinely open and stays with the epic / its own decision; it does **not** gate this
foundation. Resolving this item unblocks #192's build slices A–C.
