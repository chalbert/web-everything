# Research-freshness model — prior-art survey for #441

**Date:** 2026-06-12
**Backlog:** [#441](../backlog/441-settle-research-freshness-foundation-history-model-metadata-.md) (decision, plan of record for epic [#192](../backlog/192-longitudinal-research-freshness-system/))
**Research topic:** `/research/research-freshness-model/`
**Status:** prior-art survey supporting a near-ratification decision pass. No design exists in the tree yet — none of `lastReviewed` / `supersedes` / `reviewHorizon` are present.

The decision designs a metadata + versioning model for keeping `/research/` topics
alive over time (refresh without losing history, freshness signals, staleness
enforcement). Per design-first step 1 this surveys how established
documentation/decision-record systems solve the four orthogonal axes, so WE reuses
existing vocabulary (`Supersedes`, `dateModified`, `stale-while-revalidate`) rather
than coining terms. **The survey added one fork the item omitted (review-horizon
expression) and confirmed one of its "forks" is really "support both."**

## Axis 1 — History / revision / supersedes model

How to supersede an old document with new findings *without destroying the dated trail*.

- **IETF RFCs** — `Obsoletes:` / `Obsoleted by:` (full replacement) and `Updates:` /
  `Updated by:` (the old doc stays valid; read both). Bidirectional pointers; the old
  RFC number is permanent and never deleted.
  [How to read an RFC](https://www.ietf.org/blog/how-read-rfc/)
- **Python PEPs** — `Replaces:` on the new PEP, `Superseded-By:` on the old, plus a
  `Status: Superseded` lifecycle value. [PEP 1](https://peps.python.org/pep-0001/)
- **MADR / ADRs** — Immutable dated records; never edit a decided record — write a new
  one and set `Status: superseded by ADR-NNNN` with `Supersedes`/`SupersededBy` links.
  [MADR template](https://github.com/joelparkerhenderson/architecture-decision-record)
- **W3C TR** — Two-URI split: an immutable dated `this version` snapshot vs a moving
  `latest version` pointer. The snapshot is the permanent trail; the pointer is the head.
  [W3C reports guide](https://www.w3.org/OldGuide/Reports)
- **Keep a Changelog** (the living-file alternative) — one `we:CHANGELOG.md`, dated headings
  accumulate; trail lives *inside* one file rather than as discrete snapshots.
  [keepachangelog.com](https://keepachangelog.com/en/1.1.0/)

**Convention (2026):** immutable dated records + **bidirectional** supersedes pointers +
an explicit `superseded` status value; never destroy/rewrite the old record. The living
changelog is the lighter alternative when you don't need per-revision permalinks. → WE's
`/research/` already uses immutable dated `reports/YYYY-MM-DD-{slug}.md` snapshots under a
stable de-dated topic id; the missing piece is the **pointer + status**, and (vs. the
plain `supersedes` in the item) prior art says make it **bidirectional**
(`supersedes` + `supersededBy`) and add a `superseded` status to the topic axis.

## Axis 2 — Freshness-metadata home + field naming

Where the "last reviewed" / "review by" dates live, and what they're called.

- **Microsoft Learn** — `ms.date` in front matter: *"the last time the article was
  substantially edited **or guaranteed fresh**"* — a *required* field (build error if
  omitted). Per-doc front matter is the source of truth.
  [MS Learn metadata](https://learn.microsoft.com/en-us/contribute/content/metadata)
- **schema.org** — `dateModified` / `datePublished`, machine-readable freshness signals.
- **Sitemaps** — `<lastmod>` per URL, should reflect *real* change not auto-bumps.
- **Hugo / docs-as-code** — `lastmod` + `date` front-matter (Hugo derives `lastmod` from
  git if unset). [Front Matter fields](https://frontmatter.codes/docs/content-creation/fields)

**Convention (2026):** per-doc front matter is the prevailing source of truth, mirrored to
`dateModified`/`<lastmod>`. **Key distinction worth preserving:** last-*changed*
(`dateModified`/`lastmod`) vs last-*reviewed/verified-still-correct* are **two different
dates** — Microsoft's `ms.date` conflates them; a good design should not.

→ **Tension the survey surfaces:** prevailing prior art favours *per-doc frontmatter*, but
WE's report is an *immutable* dated snapshot (Axis 1) and the **topic** is the living unit
rendered by the registry. A topic-level `lastReviewed` therefore belongs on the **stable
topic record (the registry)**, not on a report that by-design never changes after its date.
The registry is also the render source for `/research/` and the validator's input, so it
avoids a frontmatter→registry join. The frontmatter counter-argument applies to *per-report*
metadata (which already exists implicitly via the dated filename), not the topic-level
review date.

## Axis 3 — Staleness surfacing + enforcement severity

- **Wikipedia** — reader-facing `{{Update}}` banner + `{{As of}}` dated-statement marker +
  `{{Update after}}` (a *future* review-by date); all also drop the page into a hidden
  maintainer tracking category. [Template:Update](https://en.wikipedia.org/wiki/Template:Update)
- **GitHub `actions/stale`** — maintainer automation: `days-before-stale`, applies a label
  + comment past the idle window. [actions/stale](https://github.com/actions/stale)
- **Vale** — three severities `suggestion`/`warning`/`error`; **only `error` fails CI**;
  default `MinAlertLevel` is `warning`. [Vale docs](https://vale.sh/docs)

**Convention (2026):** stale content is a **warning + reader badge + maintainer report**,
*not* a hard build failure — hard-fail is reserved for explicit opt-in `error` rules. →
This confirms the item's OP-3 default *and* shows badge + warning are not an either/or:
they serve two different audiences and **coexist by design** — so OP-3 isn't a fork, it's
"support both," with the only residue being the severity (warn, never error) = a forced
invariant.

## Axis 4 — Review horizon / volatility expression  *(the fork the item omitted)*

How the review interval/deadline is set per document.

- **HTTP caching (RFC 5861 / 9111)** — the cleanest vocabulary: `max-age` = freshness
  lifetime; `stale-while-revalidate=<sec>` = serve-stale-but-flag grace window;
  `stale-if-error` = serve-stale-on-failure. Splits "fresh deadline" from "tolerable-stale
  grace band." [RFC 5861](https://httpwg.org/specs/rfc5861.html)
- **Wikipedia `{{Update after}}`** — per-statement explicit *future expiry date*, not a
  global interval.
- **Volatility/priority tiers** (content-ops norm) — cadence by content type: high-volatility
  (pricing/API) refreshed far more often than evergreen/conceptual; priority = value ×
  volatility.
- **Freshness bands** — coarse global default (<30d fresh, 30–180d recent, 180d–2y aging,
  >2y stale).

**Convention (2026):** per-document `reviewBy`/horizon beats a single fixed global interval,
and the maturing pattern is **volatility tiers**, modeled on RFC 5861's *freshness lifetime
+ separate grace window* (not a hard cliff). → This is genuinely **divergent across prior
art** and the item never named it: how is "overdue" computed? It's the real call — the
others are near-ratifications.

## Net effect on the decision

| | before (item) | after (survey) |
|---|---|---|
| OP-1 history model | supersedes pointer | **bidirectional** `supersedes`+`supersededBy` + `superseded` status |
| OP-2 metadata home | registry | registry **for topic-level** date; + distinct last-changed vs last-reviewed fields |
| OP-3 staleness enforce | badge + warn (a fork) | **demoted** — badge+warn coexist ("support both"); residue = warn-never-error invariant |
| OP-4 scope | promoted topics only | unchanged (med-high) |
| **Axis-4 review horizon** | *(absent)* | **new Fork** — global vs per-topic `reviewHorizon` vs volatility tiers; the real low-confidence call |
