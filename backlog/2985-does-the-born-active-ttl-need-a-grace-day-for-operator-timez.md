---
bornAs: x0zc0fn
kind: decision
status: open
dateOpened: "2026-08-08"
preparedDate: "2026-08-17"
relatedReport: reports/2026-08-17-calendar-day-frame-agreement.md
tags: []
---

# Does the born-active TTL need a grace day for operator timezone skew

Prep found the card's premise stale: its own recommended option — age in the operator's day, not UTC — already
shipped in #2747, so on one machine the skew is zero. A grace day then failed the fork test outright and is
recorded as a finding, not a branch. What is left is one genuine call: when a host that is not the operator's
compares a stamped day against its own "today", how does it learn which frame the stamp was written in?

## Glance

| Fork | The call | Recommended default |
| --- | --- | --- |
| 1 | How does a reader that is not the operator's host learn the stamping frame? | **The repo declares one project day in-tree** — one tracked IANA zone both sides read, rather than enrolling each reader |

## Where this came from

Surfaced as a finding on PR #1018 (the #2747 operator-day date stamping work) and deliberately left unfixed
there. **The original card said the fix "loosens a ratified rule"; prep could not substantiate that as
written.** No statute anchor governs this turf — `we:docs/agent/platform-decisions.md` carries no date,
timezone, or day-frame rule, and #2747 and #670 are both `kind: task` with no `codifiedIn`. What the phrase
actually pointed at is a *deliberately pinned unit-test boundary*
(`we:scripts/__tests__/workflow-invariants.test.mjs:68-77`) plus #670's prose rule. That is a real reason to
think before patching, and not a reason a governance rule was at risk. Corrected here so the escalation rests
on what is true.

## Premise correction — option 2 already shipped (2026-08-17 prep)

The card says the ageing side reads UTC while the stamping side reads the operator's day. That describes the
tree *before* PR #1018. Every clock read that feeds the TTL moved onto the operator-local helper in the **same
commit**, `a0f7bcfb` (2026-08-03), which is #2747's own resolve:

| site | what it reads today |
| --- | --- |
| `we:scripts/check-standards.mjs:866` | `const today = localToday();` |
| `we:scripts/check-backlog-workflow.mjs:24` | `const today = localToday();` |
| `we:scripts/audit-backlog-health.mjs:378` | `const TODAY = localToday();` — the O1 flag |
| `we:scripts/backlog.mjs:89` → `we:scripts/backlog/scaffold.mjs:90` | `dateScaffolded` is itself stamped from `localToday()` |

**The enumeration is closed, not asserted.** `validateWorkflowInvariants(` has exactly two non-test call sites
(`we:scripts/check-standards.mjs:867`, `we:scripts/check-backlog-workflow.mjs:25`), both injecting
`localToday()`; `grep -n 'new Date()\|Date.now()'` over `we:scripts/lib/workflow-invariants.cjs`,
`we:scripts/check-backlog-workflow.mjs`, `we:scripts/audit-backlog-health.mjs` and
`we:scripts/backlog/scaffold.mjs` returns nothing; and `we:scripts/lib/utc-day-slice-scan.mjs` runs clean over
`scripts/**`. `git merge-base --is-ancestor a0f7bcfb 1a4054ce` confirms the fix was already on `main` when this
item's file was added (2026-08-07). **On any single machine the stamping frame and the ageing frame are
identical and the skew is exactly zero.**

The card's cost claim falls with it. It says a fix "costs a shared operator-day helper reachable from the CJS
invariants file." No such helper is needed: `we:scripts/lib/workflow-invariants.cjs:26` takes `today` as an
**injected** argument, and its own line-25 comment says why — *"Injected (not read from a clock) so the rule is
pure and fixture-testable."* The rule has no clock to fix. The frame is a property of the **caller**.

## What actually remains — a cross-*machine* frame gap

"The operator's day" is whichever host runs the check, and the repo health gate also runs on hosts that are not
the operator's. `we:.github/workflows/ci.yml:200`, `we:.github/workflows/release-please.yml:71` and
`we:.github/workflows/publish-contracts.yml:49` each run `npm run check:standards`; none sets `TZ` or
`BACKLOG_TZ`, and GitHub-hosted runners are UTC. So in CI `localToday()` is the UTC day while every
`dateScaffolded` in `backlog/` is the operator's day (`America/Toronto`, UTC−4 in DST). An item scaffolded
after 20:00 local trips the TTL a day early there; an eastward operator would get the mirror image.

**Severity — advisory, and now checked across all three consumers rather than one.** The TTL pushes to
`warnings`, and `we:scripts/check-standards.mjs:2232` sets `process.exitCode = errors.length ? 1 : 0`.
`we:scripts/check-backlog-workflow.mjs:34` likewise exits on errors only, and
`we:scripts/audit-backlog-health.mjs` contains **no** `process.exit` at all — it is a report. Neither of those
two is invoked by any workflow (`check:standards` is the only one in CI), so the sole cross-machine instance
that exists is a warning line in one CI log. There are currently **zero** born-active unsettled items in the
tree, so the check is inert as it stands.

*Both of those last facts are snapshots, and the ruling should not lean on them staying true.* They size the
work, not the correctness argument — which is why the recommended default below is justified on frame
correctness and reach, never on "there is nothing here today."

## Prior art

Surveyed and published as `/research/calendar-day-frame-agreement/`; full grounding in
`we:reports/2026-08-17-calendar-day-frame-agreement.md`.

- **Temporal** (Stage 4, ES2026) takes the zone as an argument — `Temporal.Now.plainDateISO(timeZone)`. MDN's
  worked example shows one instant reading as `2021-10-01` with no argument and `2021-09-30` for
  `America/New_York`. There is no zone-free "today". (It does *not* say a bare calendar date is meaningless —
  `PlainDate` is a deliberate concept for birthdays and alarms; the zone binds only at "what is today".)
- **RFC 9557** exists because a bare offset is not a zone: an offset records one instant's relation to UTC,
  while calendar reasoning needs the named zone, since offsets move.
- **Git** stores `<epoch seconds> <offset>` — the instant is canonical, the offset is a rendering hint.
- **Noda Time** formalises the asymmetry: `Instant` → `LocalDate` is unambiguous, `LocalDate` → `Instant` is
  not. Two naked local dates from different clocks sit on the ambiguous side.

**Citation scope, stated honestly.** All four are authority about *representing and comparing* civil time —
"name the frame you are reading in." **None was authored about whether a staleness check may carry slack**, so
none is cited here as authority over a threshold question; they are authority for the default's *frame*
argument only. Prep's own survey found no citable source recommending threshold padding to absorb timezone
skew — that is **absence of evidence, and is not used as evidence of absence.** The nearest real counter-example
is dbt's `warn_after`/`error_after`, which does show mature tooling putting slack on a staleness threshold to
absorb schedule/clock uncertainty; it is answered on the merits below, not dismissed as off-topic.

One source was checked and **rejected as unusable**: GitHub's contributions-graph timezone story is
unreconciled between two first-party sources (current docs say UTC; the 2014 announcement describes per-commit
offset-aware bucketing), so it grounds nothing here.

## Classification pass

1. **Which layer?** Repo delivery machinery (`we:scripts/` + repo config). Not a WE standard and not FUI impl —
   nothing crosses the constellation boundary, so there is no intent to ground vocabulary against.
2. **Protocol or intent dimension?** Neither. No consumer-facing contract.
3. **Expose the whole axis?** Yes, and this is what the fork is about: "which frame am I reading in" is a
   declared value, not a hidden assumption. The fork rules on *where* it is declared.
4. **Fixed mechanic or dimension?** *The TTL's strictness is genuinely dimension-shaped* — "how many days before
   a born-active scaffold is called stranded" is a legitimate knob under
   [`#config-extends-platform-default`](../docs/agent/platform-decisions.md#config-extends-platform-default). **That knob is carved out of this
   item entirely** (see Findings), precisely so the ruling cannot be read as governing it.
5. **DI-injectable?** Already is: `validateWorkflowInvariants(items, { today })` never reads a clock, so the
   only place a frame can be wrong is the injection site. This is why the fork lives at the boundary.
6. **Most-permissive default?** The permissive flavor is the *declared* one — a declaration is readable,
   overridable per-host via the existing `BACKLOG_TZ`, and asserts nothing implicitly.
7. **Seam between intents?** Stamp-side vs read-side. #2747 ruled the stamp side; this fork's default
   deliberately spans both, which is named as an amendment rather than slipped in.

## Findings — settled here, not routed to the decider

**F1 — an unconditional grace day is the wrong instrument, and it is not a fork.** Prep drafted this as a fork
and the independent skeptic refuted the fork-hood, correctly: a binary with one dead branch is a finding, and
the "cannot coexist" claim failed the composability probe (a widened threshold and a declared frame are
orthogonal knobs at different layers). So it is recorded as a finding. Two reasons stand, re-derived against a
*steelmanned* branch (pure day-string arithmetic, no `.toISOString()` idiom, so no lint objection is claimed):

1. **It removes the signal it was protecting.** Widening to born + 2 suppresses the CI-frame false positive and
   the genuine second-day stranded scaffold identically. The check has exactly one job.
2. **It pays where the frames already agree.** The operator's own host is correct by construction (host-local
   *is* the operator's zone), and that is the run whose output is actually read. A global pad blunts the
   correct reading to fix an incorrect one.

Two reasons prep originally gave were **withdrawn** under attack: the "two calendar frames can differ by two
days (UTC+14 vs UTC−12)" argument is inadmissible against a population that is one Toronto operator plus UTC
runners; and the claim that the branch trips `we:scripts/lib/utc-day-slice-scan.mjs` was an artifact of the
snippet prep chose, not a property of the branch.

The genuinely live descendant of the grace day — *tolerate when the frame is unknown* — is **not** dropped: it
survives as Fork 1 (c), where it is answered on merit rather than assumed away.

**F2 — the TTL's strictness stays configurable on its own merits.** Nothing here forecloses a later call to age
born-active items over two days for workflow-rhythm reasons. That is a `#config-extends-platform-default`
dimension decided on its own evidence, and the rule this item would codify is deliberately drafted so it does
not reach it.

**F3 — "leave it" is sequencing, not a branch.** Strip cost and timing and no merit difference survives: a
correct warning dominates a wrong one. Its true content is a size claim, and it is right about that — this is a
small change on an advisory check with zero live instances. Recorded, not offered.

**F4 — #2987 shares a declaration, not the plumbing it claimed.** The CJS-helper coupling
(/backlog/2987-burndown-data-reads-utc-while-its-inputs-are-operator-local/) is dissolved — this item needs no
CJS helper. But under the recommended default, `we:src/_data/burndown.js` would read the *same* declared
project day, so the two remain related through the declaration. Neither blocks the other; sequence the
declaration first if both are worked.

## Fork 1 — how does a non-operator reader learn the stamping frame?

*Fork-existence justification:* a genuine either/or between two coherent designs that cannot both be the
answer — either the frame is a property each **reader** is separately enrolled in, or it is a property the
**repo** declares once for every reader and writer of the checkout. The same value cannot be both per-host
opt-in and repo-wide by construction, and the two produce different behaviour for the reader nobody remembered
to enroll.

**Crux.** `we:scripts/lib/workflow-invariants.cjs:65` warns when `born < today`, where `born` was written by
the operator's host and `today` by whichever host is reading. `we:scripts/lib/local-date.mjs:27` already ships
the one knob for this — `BACKLOG_TZ`, *"an explicit IANA pin … for the operator whose HOST clock is already
wrong, typically a UTC container."*

- **(a) Enrol each non-operator reader** — set `BACKLOG_TZ` inline in the three workflows that run a
  clock-dependent gate. *Tradeoffs:* three lines, no new mechanism, no semantic change to #2747. But its reach
  is **GitHub Actions only**: a devcontainer, a fresh clone in a UTC image, a second machine or a bot is
  untouched — the same population `we:scripts/lib/local-date.mjs:26` was written for. And enrollment is
  per-reader, so a fourth workflow silently inherits today's wrong behaviour. Three copies of one value is
  itself a drift vector, which is an awkward remedy for a drift bug.
- **(b) The repo declares one project day** — a tracked in-tree IANA declaration, read by
  `we:scripts/lib/local-date.mjs` as a rung below `BACKLOG_TZ`, so every reader **and writer** of this checkout
  shares one frame by construction. *(default)*
- **(c) The rule tolerates instead of learning** — compare exactly when a frame is declared, allow one day of
  slack when it is not. *Rejected, on merit, not by assumption.* It is the strongest surviving form of the
  grace day and it does degrade safely where (a) degrades silently — that is a real advantage over (a), and it
  is why (a) is not the default either. But it makes a rule whose docblock advertises purity and
  fixture-testability conditional on an ambient environment fact, threading a new "is my frame trustworthy"
  parameter from caller into a rule that deliberately has none. And under (b) **the unframed reader does not
  exist** — the declaration is a tracked file, present in every checkout — so the tolerance buys nothing while
  permanently blunting the one signal the check emits. (c) is the right answer only if (b) is rejected.
- **(d) A GitHub repository variable** (`vars.BACKLOG_TZ`). *Rejected:* it is (a) with the value moved out of
  the tree, so nothing greps it, review never sees it change, and its reach is still Actions-only.
- **(e) Make the datum carry its own frame** — stamp `dateScaffolded` as an RFC 9557 zone-annotated instant
  (`2026-08-08T21:14:07-04:00[America/Toronto]`, *not* the bare offset this item's own prior art condemns) and
  age on elapsed time. Strictly more correct in a many-operator repo. ***Rejected on merit:*** it contradicts
  #2747's shipped ruling that date-only frontmatter is a human-readable operator-frame calendar day, and
  re-opening that semantics is a bigger claim than an advisory warning supports. *(For sizing only, and
  deliberately not part of the rejection: it would also touch `settle`
  — `we:scripts/backlog/frontmatter.mjs:265` — the CLI snapshot test
  `we:scripts/__tests__/backlog-cli-snapshot.test.mjs:225`, and the TTL fixtures
  `we:scripts/__tests__/workflow-invariants.test.mjs:63-66`. If a decider wants (e) on its merits, that
  migration is a separately prioritized build, not an argument against the branch.)*

**Recommended default: (b) — the repo declares one project day.** It reaches every reader, not just Actions;
it is one tracked value rather than three copies; it removes the unframed-reader case that (c) exists to
survive; and it changes no field's shape. `we:scripts/lib/local-date.mjs` already throws on a zone `Intl`
rejects, so a mistyped declaration fails loud rather than stamping a wrong date.

**Two things the default changes, named rather than smuggled in:**

1. **It amends #2747's semantics.** #2747 made a date-only stamp *each host's own* calendar day; (b) makes it
   *the project's declared* day. Today those are the same value (one operator, `America/Toronto`). Tomorrow a
   second operator in another zone would stamp in the project's day rather than their own — which is the point,
   since it is what makes every date in `backlog/` mutually comparable. `BACKLOG_TZ` stays above the
   declaration as the per-host escape hatch, so #2747's ladder gains one rung at the *bottom* and its
   POSIX-`TZ` finding is untouched (that finding is about `TZ` not being an IANA name; it does not reach a
   tracked IANA file, and prep's earlier claim that it did was an over-reach the skeptic corrected).
2. **It extends the knob's population.** `BACKLOG_TZ` was authored for a *person* recovering their own zone on
   their own bad host. (b) extends frame declaration to unattended readers that have no operator at all. That
   is a deliberate extension of a documented contract and belongs in the ruling, not in a docblock edit.

Code shape:

```js
// scripts/lib/local-date.mjs — Fork 1 (b), the default: one new rung BELOW the existing knob.
// Precedence: BACKLOG_TZ (per-host escape hatch, unchanged) → the repo's declared project day → host local.
export function backlogTimeZone(env = process.env) {
  const pin = env.BACKLOG_TZ;
  if (pin !== undefined && pin !== '') { /* … unchanged: validate or throw … */ return pin; }
  const declared = readProjectDay();          // tracked in-tree IANA name, or undefined
  if (declared !== undefined) {
    if (!isValidTimeZone(declared)) throw new Error(`the repo's declared project day "${declared}" is not a zone Intl accepts`);
    return declared;
  }
  return undefined;                            // host local — unchanged for a repo that declares nothing
}
```

```yaml
# Fork 1 (a), the main alternative — per-reader enrollment, repeated in every workflow that reads a day.
      - name: Repo health gate
        env:
          BACKLOG_TZ: America/Toronto
        run: npm run check:standards
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — an independent juror (`judgeSpawn`, session `001433fa-3883-8620-86ac-850ec92ce58f`,
lens `skeptic`, four axes) refuted prep's *original* Fork 1 as a non-fork and flipped prep's original Fork 2
sub-fork default from per-workflow `env:` to a tracked in-tree declaration, on the finding that prep's rejection
of it cited #2747's POSIX-`TZ` evidence beyond that evidence's scope. Both folded in: the grace-day fork is
demoted to finding F1 (with two of its four rejection reasons withdrawn), and this fork's default is (b), not
(a). Its citation-scope attack — that Temporal/RFC 9557/git/Noda Time are authority about *frames*, never about
*thresholds* — is folded into Prior art, and the argument-from-silence about threshold padding is withdrawn.
The default itself was attacked on merit and held: the juror reported it could not break frame-over-threshold on
correctness, and could not revive the datum-carries-its-frame branch even steelmanned into RFC 9557 form.
Amendments beyond the flip, all applied: the "two calendar frames differ by two days" reason struck as
inadmissible for this population; the severity claim re-verified across all three consumers (both other gates
exit on errors only and neither runs in CI); the enumeration of clock reads backed with search evidence; the
"loosens a ratified rule" provenance corrected; the knob-population extension promoted into the ruling; and the
codified claim redrafted so it turns on an observable property rather than the author's motive.

**Screen:** clear — a **second, separately spawned** juror (`judgeSpawn`, session
`66abba2c-dfd9-8824-affb-a328b1a9af3e`, lens `two-confusion-screen`), given *only* the fork text: no skeptic
verdicts, no findings, no premise-correction or prior-art narrative, which is what makes "has not seen this
session's authoring" structural rather than a claim. **Q1 (impl detail):** not an impl detail — the ruling is
observable on four independent axes (whether CI emits a spurious warning; which readers are covered — Actions
vs devcontainer vs second machine vs bot; the documented meaning of the date-only stamp and of `BACKLOG_TZ`;
and under (e) the on-disk shape of a frontmatter field). **Q2 (merit vs prioritization):** with every branch
free and eternally maintained the options still separate on correctness, reach, silent-vs-safe degradation,
rule purity, single-source-of-truth, auditability, and consistency with two shipped rulings; no branch is
rejected because it costs more. One tightening was raised and **applied**: (e)'s file-touching list was pure
migration burden doing rejection work, so it is now demoted to an explicit sizing note and (e) is rejected on
its merit ground alone.

## Predicted touch-set (#2619)

The work a Fork 1 (b) ruling authorizes:

- `we:scripts/lib/local-date.mjs` — the declaration rung + its docblock, and its test under
  `we:scripts/lib/__tests__/`.
- the tracked declaration file itself (name not predictable ahead of the build).

No child item is carved: the authorized work is one rung in one helper plus its test, too small to slice, and
it must not enter the backlog as ready work before the call is ratified. A Fork 1 (a) ruling would instead
touch `we:.github/workflows/`; a Fork 1 (e) ruling would touch `we:scripts/backlog/`,
`we:scripts/lib/workflow-invariants.cjs` and `we:scripts/__tests__/`.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

## Acceptance

- A ruling recorded with `codifiedIn`, per the decision protocol. **The claim it would codify, drafted to turn
  on an observable property rather than on intent:** *when calendar days stamped on one host are compared
  against "today" on another, the repo declares one IANA zone in-tree and both the stamping and the comparing
  side read it; a per-host override may sit above that declaration, and no reader may be left to infer the
  frame from its own clock.* The collision test was **run, not named**:
  `we:docs/agent/platform-decisions.md` carries no date, timezone, or day-frame anchor; #2747 and #670 are
  `kind: task` with no `codifiedIn`, so there is no prior anchor to amend and this is a genuine mint.
  [`#config-extends-platform-default`](../docs/agent/platform-decisions.md#config-extends-platform-default) governs the adjacent turf of
  *configurable strategy dimensions with more than one legitimate end-state* — the drafted claim deliberately
  says nothing about how strict a staleness threshold should be, so it does not reach that anchor's subject
  (see finding F2); cite the two together for lineage.
  [`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate) governs whether a scored
  signal routes to a human, not how a calendar day is framed — different turf by a different test, and it is
  cited here as context only.
- If the ruling changes the boundary, the pinned test is updated to pin the *new* boundary deliberately, with
  the ruling cited in the test. Under the recommended default it does not — the pin at
  `we:scripts/__tests__/workflow-invariants.test.mjs:68-77` stands unchanged, and that is part of what makes the
  default cheap.
- The declaration is proven, not assumed: a test that a mistyped project-day declaration throws rather than
  silently stamping a wrong date, and a fixture proving a UTC-clocked host reading the declared frame produces
  the same day as the operator's host.
