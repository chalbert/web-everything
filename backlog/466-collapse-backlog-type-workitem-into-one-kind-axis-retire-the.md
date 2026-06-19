---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-backlog-kind-axis.md
tags: [backlog, taxonomy, convention, type, workitem, tooling-refactor, design-decision]
---

# Collapse backlog type + workItem into one kind axis (retire the idea/issue distinction)

**Prepared — ready to ratify.** No new design is invented here; this is a data-model call over shipped
tooling. The prior-art survey ([/research/backlog-kind-axis/](/research/backlog-kind-axis/), report
`we:reports/2026-06-13-backlog-kind-axis.md`) found that **no mature tracker runs WE's two-axis model** —
GitHub, Jira, Linear, and GitLab each keep exactly one structural type/kind axis, hold size separately,
and demote fix-vs-feature to an optional label. That moves the core call from "lean A" to **strong A**.
**2 forks**, each with a **bold** recommended default: (1) unify vs keep two axes; (2) the field name +
migration mechanics. The fix-vs-feature sub-question dissolved during prep — the existing `tags` axis
absorbs it, so it is not a fork.

## Ruling (2026-06-13)

**Both forks ratified to their recommended defaults.**

- **Fork 1 → A — collapse into one `kind` axis** (`story | epic | task | decision`). The two
  nature axes are correlated, not orthogonal, so the schema double-states; `idea`/`issue` carry
  only a badge colour + an unimplemented filter chip, so the collapse loses nothing real. The
  one genuinely orthogonal axis, `size`, stays a separate field. No surveyed tracker validates
  two required nature axes. **High confidence.**
- **Fork 2 → A — introduce a fresh `kind` field, drop both `type` and `workItem`.** Engaged
  against the real runner-up (B, repurpose `type` — which reads fine post-retirement and is
  marginally lower churn): A wins because `kind` is the most honest name for the merged axis, and
  a schema migration *benefits* from a loud field rename — any stale `type:`/`workItem:` value
  then fails as an unknown field rather than silently half-validating. **Medium→settled.**
- **Sub-decision (confirmed):** fix-vs-feature, if ever wanted, is an optional `tags: [fix]` /
  `tags: [feature]` entry — never a required field.

**Successor build:** the migration across the touch-list (loader / validator / scaffold / render
/ `we:backlog-workflow.md` + a one-pass rewrite of every `backlog/*.md` frontmatter) is carved to
**#487** (agent-ready now that the call is made). This decision item is resolved.

## The axis being decided

The concern decomposes into three sub-axes that the current schema conflates across two fields:

- **Nature** — "what kind of work is this" — today `type ∈ {idea, issue, decision}`. Only `decision` is
  load-bearing: the loader tiers `idea` and `issue` **identically** to Tier A and only `decision` to
  Tier B ([we:backlog.js:206-209](src/_data/backlog.js#L206-L209)); the buried-fork lint keys on
  `type === 'decision'` ([we:check-standards-rules.mjs:219-237](scripts/check-standards-rules.mjs#L219-L237));
  and the resolved-without-`graduatedTo` nudge special-cases `issue`/`review`/`decision`
  ([we:check-standards-rules.mjs:120](scripts/check-standards-rules.mjs#L120)). The validator does **not**
  even enum-gate the value the way it gates `workItem`. `idea` vs `issue` is a badge colour
  ([we:backlog.njk:48-51](src/backlog.njk#L48-L51)) + a `typeOrder` filter chip
  ([we:backlog.njk:141](src/backlog.njk#L141)) whose claimed selection ranking is never implemented.
- **Hierarchy role + sizing** — today `workItem ∈ {story, epic, task}` + `size`. This axis is genuinely
  load-bearing: `story` requires a Fibonacci `size`, `task` forbids one, `epic` rolls up children
  ([we:check-standards-rules.mjs:139-148](scripts/check-standards-rules.mjs#L139-L148)); scaffold emits both
  fields ([we:scaffold.mjs:42-44](scripts/backlog/scaffold.mjs#L42-L44)) from `--type`/`--workitem` flags
  ([we:backlog.mjs:156](scripts/backlog.mjs#L156)).
- **Effort** — `size` (Fibonacci) — the only axis that is genuinely **orthogonal** to the others, and
  stays a separate field in every option below.

The crux: `type ∈ {idea, issue}` and `workItem ∈ {story, task}` are **correlated, not independent** (an
idea is a buildable story; an issue is a small fix-task), so the schema states an item's nature twice.
The lingering `review` enum string still sits in `BACKLOG_TYPES`
([we:check-standards-rules.mjs:21](scripts/check-standards-rules.mjs#L21)) though no item uses it — cleanup
the unification absorbs.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — unify the redundant axes? | **A — collapse into one `kind` axis** | B — keep two axes, accept redundancy | **High** — no surveyed tracker validates two axes |
| 2 — field name + migration | **A — fresh field `kind`, drop `type` + `workItem`** | B — repurpose `type`; C — repurpose `workItem` | **Medium** — naming/churn call, all paths equal-cost |

## Fork 1 — unify the two axes, or keep both?

**Crux:** the schema states nature twice via two correlated fields. Prior art
([/research/backlog-kind-axis/](/research/backlog-kind-axis/)) shows every mature tracker keeps **one**
structural type axis (Jira folds Epic-role and Bug-nature into a single enum) + a **separate** size
field, never a parallel required nature field.

- **A — collapse into one `kind` axis: `story | epic | task | decision`** *(recommended)*. `story/epic/
  task` keep the sizing/hierarchy semantics; `decision` keeps Tier-B + fork validation. `idea`/`issue`
  dissolve (a build is just a `story`); `size` stays a separate orthogonal field. One field, no
  double-statement, matches the universal tracker model. Cost: a one-pass migration across `backlog/*.md`
  + the loader / readiness / validator / scaffold / render / `we:backlog-workflow.md`.
- **B — keep two axes, accept the redundancy.** `type` = nature, `workItem` = role/sizing. Zero
  migration; permanent cost is the double-statement + a cosmetic, unimplemented idea/issue split. The
  status quo (minus the already-retired `review`).

**Default: A — unify.** The two axes are correlated, so merging is the honest model; the genuinely
orthogonal axis (`size`) stays separate, which is exactly where bias-toward-separation applies. *Rejected
B:* it preserves a redundancy no surveyed tracker runs, for the sole benefit of avoiding a mechanical
migration.

### Sub-decision (settled in prep, not a fork): fix-vs-feature flavour

If anyone ever wants the old idea/issue ("feature vs fix") distinction, it becomes a free-form **tag**
(`tags: [fix]` / `tags: [feature]`) on the existing `tags` array — **not** a required field. No new
machinery, no reintroduced redundancy. This dissolves what could have been a third fork.

## Fork 2 — the field name + migration mechanics

**Crux:** every item file carries *both* `type` and `workItem` today, so any unification migrates all
backlog files plus the tooling regardless — the only real choice is which field name survives. Churn is
~equal across all three; this is a readability call.

- **A — introduce a fresh `kind` field, drop both `type` and `workItem`** *(recommended)*. A clean name
  with no semantic baggage: readers who knew `type` = nature or `workItem` = sizing aren't misled by a
  repurposed field that now means something wider. Matches #466's original framing.
- **B — repurpose `type`**, widening its enum to `story | epic | task | decision` and deleting
  `workItem`. Slightly less conceptual distance (`type` already reads as "what kind"), but a reader who
  remembers `type: idea` sees the meaning silently shift.
- **C — repurpose `workItem`**, adding `decision` to its enum and deleting `type`. `workItem: decision`
  reads oddly (a decision isn't an agile work item), and same silent-shift hazard.

**Default: A — fresh `kind` field.** Equal migration cost across all three, so optimise for the clearest
read: a new name signals "the taxonomy changed" rather than quietly overloading a familiar field.
*Rejected B/C:* they save no migration (every file is touched anyway) and trade clarity for a name that
now means more than it used to.

## Touch-list (for the build, once ratified)

`backlog/*.md` frontmatter (drop the retired field; rename per Fork 2) ·
[we:backlog.js:206-209](src/_data/backlog.js#L206-L209) (tiering keys on the new field) ·
[we:check-standards-rules.mjs:21](scripts/check-standards-rules.mjs#L21) (enum set + drop dead `review`),
[:120](scripts/check-standards-rules.mjs#L120) (graduatedTo nudge),
[:139-148](scripts/check-standards-rules.mjs#L139-L148) (sizing rules),
[:219-237](scripts/check-standards-rules.mjs#L219-L237) (fork-shape lint keys on `=== 'decision'`) ·
[we:scaffold.mjs:42-44](scripts/backlog/scaffold.mjs#L42-L44) + [we:backlog.mjs:156](scripts/backlog.mjs#L156)
(scaffold flags + frontmatter emit) ·
[we:backlog.njk:48-51](src/backlog.njk#L48-L51) / [:66](src/backlog.njk#L66) / [:141](src/backlog.njk#L141)
+ [we:backlog-pages.njk:12-15](src/backlog-pages.njk#L12-L15) (badges, `typeOrder`) ·
`we:docs/agent/backlog-workflow.md` (the normative enum + agile-sizing table) ·
`we:scripts/check-readiness.mjs` (reuses the loader tier — no change if the loader field is renamed in
place).
