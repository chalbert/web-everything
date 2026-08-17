# How a folded-duplicate backlog item retires — prior art across five trackers

**Date**: 2026-08-17
**Point**: Every mature issue tracker surveyed (Bugzilla, Jira, GitHub, GitLab, Linear) ships a **non-delivered terminal state plus a machine-readable pointer to the survivor** for a duplicate; none leaves the duplicate open with only a cross-reference — which grounds #2982 Fork 1 at Option A and pushes the shape sub-call toward a distinct `status` value rather than a field on an item that stays `open`.
**Decision item**: #2982
**Research page**: `/research/folded-duplicate-backlog-retirement/`

---

## Question

`/consolidate` (#2983, resolved 2026-08-06) can prove that two open backlog items are one job, but the
backlog has no honest way to retire the absorbed one: `resolve` means *delivered* and books points into the
burndown, a park must reduce to a real structural gate, and `supersededBy`'s pointer space is research-topic
ids. So the fold outcome is **reported and never executed** (`we:docs/agent/backlog-workflow.md:929`).

Two questions follow, and the survey was run to ground both:

1. Does a proven-contained duplicate get a **retirement state at all**, or does it stay open and
   cross-referenced?
2. If it retires, is the marker a **new `status` value** or a **field on an item that stays `open`**?

## Prior art — five trackers, one convergent answer

| Tracker | Terminal state for a duplicate | Pointer to the survivor | Counted as delivered? |
| --- | --- | --- | --- |
| **Bugzilla** | `RESOLVED` + resolution `DUPLICATE` | **`dupe_of`** — a first-class bug-id field on the bug, not a comment | No — `DUPLICATE` is a distinct resolution from `FIXED` |
| **Jira** | Closed + Resolution `Duplicate` | a separate **`duplicates` issue-link type** (the link is a second, independent step; Jira attaches no behaviour to the link's name) | No — the standard practice is to filter `resolution != Duplicate` out of reports and epic progress |
| **GitHub Issues** | closed with **`state_reason: duplicate`** — a *third* close reason added Dec 2024, alongside `completed` and `not_planned` | a "marked as a duplicate" timeline event + a note rendered **at the top of the issue** explaining why it closed | No — deliberately distinct from `completed` |
| **GitLab** | closed via the **`/duplicate #id`** quick action | a *duplicate-of* relation plus a related-issue link | No |
| **Linear** | moved into the **reserved `Duplicate` status**, whose *type* is **Canceled** — not Done | a duplicate relation to the canonical issue; attachments and customer requests **migrate to the survivor** | No — the Canceled type is separate from Done everywhere Done is counted |

### Finding 1 — the non-delivered close is universal (5/5); "stay open and cross-ref" is 0/5

No surveyed tracker models a proven duplicate by leaving it in the working set with a "see also" link. All
five move it out of the active set and mark **why**. The consistency matters because the five disagree about
almost everything else in their lifecycle models (resolutions vs close-reasons vs status types), yet converge
here.

This is also the strongest available refutation of #2982's original framing, which cited the repo's standing
*Review before adding (dedup)* rule (`we:docs/agent/backlog-workflow.md:971`) as pointing "the other way."
Read literally, that rule says **"if an item already covers the idea, *extend* it rather than adding a
near-duplicate sibling"** and reserves *cross-reference instead of merging* for **parallel tracks that look
similar but are distinct**. It governs the *adjacent* case, not the *contained* one — so it is not a
counterweight to a fold, and the item's own summary of it overstated the tension.

### Finding 2 — the close reason is carried as an enum value, not inferred (4/5)

Bugzilla (`DUPLICATE` resolution), Jira (`Duplicate` resolution), GitHub (`state_reason: duplicate`) and
Linear (a reserved `Duplicate` status) each carry a **positive enum marker** of *why* the item left. Only
GitLab infers duplicate-ness purely from the presence of a relation, and GitLab is also the tracker with the
longest-running complaint about the resulting state being unreadable and unrecoverable (below).

Every one of the four pairs that enum with a **separate pointer** to the survivor. Nobody encodes the survivor
*in* the enum, and nobody relies on the pointer alone to mean "closed as duplicate."

### Finding 3 — the fold must be reversible, and this is the one place prior art records a real defect

GitLab's `/duplicate` has no inverse. `gitlab-org/gitlab#233050` ("Allow removal of issues marked as
duplicate") has been open for years: once marked, the relation cannot be unlinked, so an accidental or
mistaken fold is permanent and the issue is thereafter always displayed as *Closed (duplicated)*. Users have
repeatedly asked for a `/remove_duplicate` counterpart.

This is the concrete cost of the "an over-eager fold silently removes work" risk #2982 names, observed in a
shipped system. It argues for shipping the **unfold** path in the same slice as the fold path, not as a
follow-up.

### Finding 4 — supersession as a *pointer* (not a status enum) is already ratified here, for a different home

`we:docs/agent/reference-retirement.md` (#584) is this repo's existing retirement convention, and it
explicitly rejects an enum:

> "Death and supersession are **distinct, independently-optional facts** … They are two markers, not one
> `status` enum — **an enum is mutually exclusive and so can't represent the 'dead and superseded' case**"
> — `we:docs/agent/reference-retirement.md:15-17`

Its scope is *this repo's reference data* (`:3-5`), and its stated ambition is uniformity: "the homes differ
in **container**, not in the retirement **concept**." So it must be reconciled, not ignored. The reconciliation
is that its objection is **scope-bound**: it exists because a reference can be *both* dead *and* superseded, so
one enum slot cannot hold both facts. A backlog item cannot be both **delivered** and **folded** — those are
genuinely exclusive — so the objection does not reach this case. What *does* carry over is its field-set
shape: a death **triplet** (`retired` + `retiredDate` + `retiredReason`) plus a **supersession pointer**.

## How the WE backlog's own machinery scores the two shapes

The shape sub-call is not a free choice; the loader and the gate already price it. Verified refs:

- **A distinct status drops out of every selection surface for free.** `deriveTier` returns `undefined` for
  any non-`open` item (`we:src/_data/backlog.js:184`) and the readiness engine filters the whole selection to
  `status === 'open'` (`we:scripts/readiness/engine.mjs:177`) — so tier, batchable, sliceable, splittable and
  the open leverage graph all exclude it with zero new code.
- **A field on an item that stays `open` must be excluded by hand at every one of those sites**, and it also
  trips the CTA invariant: every `status: open` item with no call-to-action pill is a hard gate error
  (`we:scripts/check-standards.mjs:648-660`).
- **The burndown needs one change either way.** Its `done` key is
  `it.status === 'resolved' && it.dateResolved` (`we:src/_data/burndown.js:32`), and a sized item enters
  *scope* purely from `dateOpened` (`we:src/_data/burndown.js:26-34`) — so a folded item must be excluded from
  `sized`, or its points sit in remaining scope forever. Excluding rather than fabricating a `done` date is
  exactly the `#faithful-derivation-exclude-not-fabricate` anchor in `we:docs/agent/platform-decisions.md`.
- **There is precedent for adding a status value**: `preparing` was minted for exactly this reason
  (`we:scripts/check-standards-rules.mjs:22-24` — "non-open + in-flight (drops from selection like `active`)
  but distinct on the board").
- **There is no frontmatter-key whitelist for backlog items** — an unknown key is spread onto the item at
  `we:src/_data/backlog.js:351`. This is a *risk*, not a convenience: `relatedTo` (232 items), `relatedItems`
  and `blocks` already exist on disk as inter-item pointers with **zero validation and zero rendering**. A
  bare `foldedInto:` with no gate and no pill would become the fourth invisible pointer.

## Statute-overlap check (#1886)

The rule #2982 would codify is roughly: *"an item leaves the backlog by exactly one of two doors — delivered
(`resolved`) or withdrawn-into-a-survivor (`folded` + pointer); a non-delivered exit never books points."*
An anchor-by-anchor pass over `we:docs/agent/platform-decisions.md` found **no anchor governing backlog item
retirement** — backlog lifecycle is explicitly delegated out to `we:docs/agent/backlog-workflow.md`
(`we:docs/agent/platform-decisions.md:3495-3497`). Four anchors are adjacent and compose rather than collide:

| Anchor in `we:docs/agent/platform-decisions.md` | Relation |
| --- | --- |
| the backlog **hold model** pointer (`:3498-3501`) | Governs **holds** (`priority: low` / `maturityGated`), not **exits**. It is the codified form of #2982's own "a park can't carry it" argument, so it supports the fold rather than colliding with it. |
| `#ci-lifecycle-total-label-function` | Self-scoped to PR labels, but its principle — *state is a positively-applied marker, never inferred from an absence* — is the precedent for Finding 2 (a positive `folded` marker, not "open with a relation"). |
| `#faithful-derivation-exclude-not-fabricate` | Directly supports excluding a folded item from the burndown rather than fabricating a delivered date. |
| `#state-lives-where-its-nature-dictates` | A fold is durable shared repo truth, not session intent → **committed frontmatter**, which is where both options put it. Also explains why the `preparing`-status retreat (#2219/#2264 replaced `claim --as=preparing` with a local, uncommitted hold) is *not* a precedent against a `folded` status: that hold is transient session state; a fold is permanent. |

## Recommendation

- **Fork 1 → Option A** (a non-delivered retirement with a pointer). Two repo-internal arguments carry it:
  burndown honesty (the absorbed card's points are scope *removed*, and exclusion is the only fate that
  neither books undelivered work nor parks it in `remaining` forever) and ranker cleanliness (the open set is
  what `check:readiness --select` hands agents as claimable work). The 5/5 prior art corroborates but does not
  carry — no surveyed tracker has this repo's ranker or point budget.
- **Fork 2 → a new `status: folded`** plus a required `foldedInto` pointer and a `dateFolded` stamp. The
  cost-independent argument is truthfulness of the data model: `status` is the card's one declared statement
  of its own state, and the field-on-an-open-item shape makes that statement false while the real state lives
  in scattered exclusions. Precedent agrees on the same axis — 5/5 trackers move the state-carrying field
  itself; 0/5 leave it on its working value. The loader-cost advantage is real but is a *cost* argument, not
  the merit case.
- **Amendment from Finding 3:** `fold` and `unfold` land as one atomic child. An irreversible fold is the one
  failure mode prior art actually recorded. (Manual reversal is available from day one regardless — a backlog
  item is plain committed frontmatter.)

## Prep passes — the skeptic and the two-confusion screen

Both were run as **real independent juror processes** via `judgeSpawn` (`we:scripts/lib/judge-spawn.mjs`) —
headless, tool-free `claude -p` spawns each minting its own session id — rather than `Agent`-tool subagents,
which inherit the parent session id and are therefore the same actor by this repo's own independence test
(#3145 / #3146).

| Pass | Actor (session) | Verdict | What it changed |
| --- | --- | --- | --- |
| Skeptic, Fork 1 | `5ca89ad4` | SURVIVES-WITH-AMENDMENT | Option B rewritten to its steelman (burndown exclusion via `crossRef`, no status change) — which repairs the burndown argument but not the ranker one; the five-tracker survey downgraded from authority to supporting context; the hold model's *anti-escape-hatch principle* reconciled rather than dismissed; reversibility corrected to day-one-manual plus an atomic `fold`/`unfold` child. |
| Skeptic, Fork 2 | `533cc76c` | SURVIVES-WITH-AMENDMENT | Found the one real statute-overlap risk — `#categorical-taxonomy`'s "the Web Lifecycle protocol owns which status values exist" — which the item had cited for the pill but never tested against the enum-mint. Traced and cleared (the protocol's members are explicitly open and it governs a consumer's domain entity, not `BACKLOG_STATUSES`), citation narrowed to presentation. Also: the reference-retirement reconciliation was half-quoted (its additive-marker mechanism dropped) — rewritten; the CTA-invariant argument against (b) struck as a false differentiator; `#ci-lifecycle-total-label-function` dropped as support for (a). |
| Two-confusion screen, both forks | `751ed39b` (never saw the authoring) | Fork 1 `clear`; Fork 2 `flagged(prio)` → fixed | Fork 2's case for (a) was self-labelled "the one load-bearing argument: it is nearly free in the loader" — a build-cost claim presented as merit, which evaporates under the zero-cost test. Rewritten before the stamp onto the cost-independent single-source-of-truth argument; the loader-cost material demoted to a paragraph explicitly marked "cost, not merit". |

## Files created/modified

| File | Action |
| --- | --- |
| `we:reports/2026-08-17-2982-folded-duplicate-retirement.md` | created (this report) |
| `we:src/_data/researchTopics/folded-duplicate-backlog-retirement.json` | created |
| `we:src/_includes/research-descriptions/folded-duplicate-backlog-retirement.njk` | created |
| `we:backlog/2982-how-a-folded-duplicate-backlog-item-retires-foldedinto-point.md` | rewritten to the prepared-fork shape |

## Sources

- [GitHub Changelog — Close issue as a duplicate (2024-12-12)](https://github.blog/changelog/2024-12-12-github-issues-projects-close-issue-as-a-duplicate-rest-api-for-sub-issues-and-more/)
- [GitHub community discussion #150535 — `Issue.state_reason` can now be `duplicate`](https://github.com/orgs/community/discussions/150535)
- [GitHub Docs — Marking issues or pull requests as a duplicate](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/marking-issues-or-pull-requests-as-a-duplicate)
- [GitLab Docs — Manage issues](https://docs.gitlab.com/user/project/issues/managing_issues/)
- [gitlab-org/gitlab#233050 — Allow removal of issues marked as duplicate](https://gitlab.com/gitlab-org/gitlab/-/issues/233050)
- [Linear Docs — Issue relations](https://linear.app/docs/issue-relations)
- [Linear Docs — Issue status / workflow configuration](https://linear.app/docs/configuring-workflows)
- [Atlassian community — excluding `Duplicate` / `Won't Do` resolutions from Jira reports and epic progress](https://community.atlassian.com/t5/Jira-Software-questions/How-to-exclude-issues-with-Resolution-of-Duplicate-Won-t-Do-from/qaq-p/1853501)
- [Jira JRASERVER-3758 — offer to create the duplicate link when resolving as Duplicate](https://jira.atlassian.com/browse/JRASERVER-3758)
