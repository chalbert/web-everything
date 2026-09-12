---
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/lib/poc-branches.mjs", "we:scripts/lib/poc-branches.json", "we:scripts/backlog.mjs", "we:scripts/check-standards.mjs", "we:docs/agent/backlog-workflow.md", "we:skills-src/mechanical-delivery-doctrine/SKILL.md"]
relatedTo: ["3637", "3639", "3443", "3638", "3643"]
dateOpened: "2026-09-12"
tags: []
---

# How a POC branch keeps its own lightweight running record: outstanding work, small decisions, and what is blocked on what

`#3637` ruled where a POC branch's work lands and when review happens, never how a branch keeps its OWN running
record. Today that is "append another `## Session update` to whatever epic card exists" — `we:backlog/3383-*.md`
is 1647 lines across 12 such sections and 55 commits in 9 days, and only 3 of ~3600 cards use the pattern. This
decides the standard shape for N POC branches. The decisive criterion is not readability but
graduation-decomposability: `#3443` already did that decomposition by hand, and the record it worked from cost
it eight un-graduatable commits. Six forks and a recommendation below.

## Why this is not already answered by `#3637` or `#3639` — checked, not assumed

**`#3637` (resolved).** Read end to end. It rules five forks — transport (`A′`, the lock-serialized
fast-forward lander), completion signal (git ancestry, `startedAt`-guarded), how the target is declared
(`deliveryTarget:` frontmatter), scope (bootstrap + registry together), and whether doctrine rule 10 is amended
(yes). Its output is a registry entry shape — `branch`, `purpose`, `owner`, `dateOpened`, `target`, `scope`,
`graduationItem` — and a follow-on build item (`#3638`). **Nothing in it is about the branch's own running
state.** The closest it comes is one sentence in the `A′` section: "the lander writes a receipt in the
`we:scripts/operations/delivery-report-record.mjs` shape", which is a per-landing machine record, not a
work record. Genuinely unanswered.

**`#3639` (open, in `/prepare`).** Also read end to end, including its 2026-09-12 session update. It is about two
different things, and this is a third:

| Axis | Question it answers | Card |
|---|---|---|
| Instance | which items may a *runner* touch, and how do two runners avoid colliding | `#3639` Forks 1–4, 6–7 |
| Batch | which items form a named unit that can be shelved / planned / handed to another machine | `#3639` Fork 5 + its session update (cases 1–3) |
| Delivery target | WHERE an item's work lands | `#3637` |
| **Branch record** | **what has happened on this POC branch, what is left, and how it decomposes at graduation** | **this card** |

`#3639`'s Fork 6 already ruled instance and `deliveryTarget` orthogonal, with the reasoning "a changeset scopes
WHICH items a runner may touch; `deliveryTarget` scopes WHERE an item's work lands." The same argument separates
this card from both: a record is keyed by **branch** and lives as long as the branch does; a batch is keyed by a
**name** and is temporal ("a sprint worth of work"); an instance is keyed by a **runner**.

**The one real adjacency, named so it is not discovered later.** `#3639`'s session update proposes a *git-tracked
batch object* carrying its own state, and leans registry-file over per-card field. If that ships, a POC branch's
outstanding-work set could be *represented* as a batch. That is a composition opportunity, not a duplication:
a batch would answer "which items are in play right now", and this card answers "what has this branch accumulated
and how does it break apart". **If the operator rules Fork 2 below as (B), the two share a key** — the backlog
item — and compose for free. Fork 2(A) would fork them apart, which is the main argument against it.

## What today's practice actually is — measured, not characterised

`we:backlog/3383-*.md`, the de facto pattern:

| Fact | Value | How |
|---|---|---|
| Size | 1647 lines / 139,625 bytes — the largest file in `we:backlog/` by 136 lines | `wc` |
| `## Session update` sections | 12 | `grep -c` |
| `## Working doctrine` sections | 10 | `grep -c` |
| `## For the next session, in priority order` lists | 3 | `grep -c` |
| Commits touching it | 55, across 9 distinct days | `git log --follow` |
| Cards repo-wide using `## Session update` | **3** of ~3600 (`#3383`, `#3639`, `#3443`) | `grep -l` |

**What worked, and should be preserved by whatever replaces it.** It is durable and git-tracked; it cites real
evidence at `file:line` rather than asserting; it records *changes of mind* explicitly rather than overwriting
them (`#3637`'s "SUPERSEDED, kept for the record" blocks are the best example in the repo); and its doctrine
sections had a working promotion path out — rule 10 was set in-card 2026-09-04, amended in-card 2026-09-12, and
lives in `we:skills-src/mechanical-delivery-doctrine/SKILL.md`, per that skill's own stated amendment path.

**What does not generalise, in order of severity.**

1. **It is chronological, and graduation needs it to be componential.** See the next section — this is the
   decisive one.
2. **It cost real, wasted commits.** `#3443`'s 2026-09-04 progress entry, verbatim: of the 30 commits then unique
   to the branch, **eight** (`3003410fd`, `a2e528c14`, `4f1b19e0b`, `a178cffd0`, `2242b54b0`, `7793ce938`,
   `bbe23dcd3`, `fa3315eae`) "are session-log edits to `we:backlog/3383-*.md` and `we:backlog/3105-*.md` —
   branch-local narrative that doesn't cherry-pick cleanly onto `main`'s independently-evolved #3383 card; not
   proposed as a graduation slice." Writing the log **on the branch** produced 8 un-graduatable commits that then
   had to be hand-reconciled. That is not a projected risk; it is a bill already paid.
3. **It presumes an epic card exists.** Rule 10(c) requires a POC branch to name an `owner:` item, but that item
   may be a story. A 1647-line `## Progress` is not what the convention means.
4. **It is a single append point.** `#3637` exists to allow N fast concurrent landings into one branch; one
   append-point document reintroduces a serialisation point at exactly the seam the design removed. 55 commits
   in 9 days came from ONE serialised session.
5. **It mixes three kinds of content** — narrative, doctrine, and punch-list — under one heading vocabulary, so a
   cold session pays for all 9 days to learn today's state.

## The graduation criterion — the evidence is unusually direct

`#3443` (graduate the branch to `main`, `status: active`) has **already performed this decomposition once, by
hand**, and its `## Progress` records exactly what the record was and was not good for.

- **Chronological, SHA-keyed prose goes stale in one operation.** The 2026-09-04 entry opens: a prior session
  reconciled the branch, which "rewrote every commit SHA on the branch, so **every specific hash named in the
  2026-09-03 entry above is now stale**; treat it as historical narrative only, not a lookup key." A dated
  narrative keyed on commits is destroyed by a rebase — and rebasing is `A′`'s own conflict path.
- **The decomposition that actually worked grouped by COMPONENT.** The same entry reads 30 commits and produces
  **7 slices, each filed as a real child story**: `lane-pool` hardening; `verify-lane` request/check mode;
  `dispatch-lane` hardening; and the reconcile-pass payload split a/b/c with `blockedBy` edges between them. The
  grouping key was the touched path — i.e. `scope:`. The output was a set of backlog items.
- **The record also needs a supersession column.** Three of the 30 commits were already on `main` under different
  SHAs, one was a pure merge commit, and one revert pair netted to zero. A record that cannot say "this concern is
  already landed / superseded / dropped" forces that re-derivation every time.

**So the criterion sorts the options sharply.** A shape scores well here if a reader can go straight from it to
"here are the N separable concerns, here is each one's graduation status," without re-reading a chronology.

Worth noting the clustering machinery already exists: `/consolidate` ("cluster already-filed backlog items that
are really one job") is precisely the group-by this needs, and it operates on filed items — which is an argument
for making the units items.

## What the repo already has that is lighter than a card — surveyed

Four real conventions, none of which is a running work log, plus one governing statute:

| Convention | Shape | Count | Fit |
|---|---|---|---|
| `## Progress` inside the item card (`we:docs/agent/backlog-workflow.md:584`) | `Status` / `Branch` / `Done` / `Next` / `Notes` | **1124 of ~3600 items** | **The sanctioned running punch-list.** Per-item, not per-branch |
| `we:reports/YYYY-MM-DD-<topic>.md` | dated, one topic per file, immutable snapshot | 473 | Research, not in-flight work |
| `we:reports/<date>-program-<slug>.md` | one file per standing program, a new dated `##` appended per run | 12 | **The repo's only sanctioned append-per-run prose artifact outside a card** |
| `we:agent-memory-src/<slug>.md` | one durable lesson per file, ~2.6 KB, frontmatter-indexed | 267 | Lessons, explicitly *not* append-only — "one canonical memory per idea" |
| `we:.conveyor/*.json` sidecars | schema-validated JSON, **every one gitignored** | ~10 | Transient session state only |

**The governing statute is `#state-lives-where-its-nature-dictates`** (`we:docs/agent/platform-decisions.md`,
`#2615`/`#2617`): transient operator/session intent → a gitignored sidecar; durable spec/readiness → committed
state via the guarded lane→PR path. A POC branch's record is durable by construction (it must survive to
graduation), so the statute puts it in git, not in `we:.conveyor/`.

**And the "three homes" rule closes off inventing a new path.** `we:docs/agent/backlog-workflow.md:16-25` and
`we:AGENTS.md:38`: "The test for any new markdown: *is it research (→ report + a `/research/` topic or backlog
mirror), spec (→ website), or a backlog item?* If it fits none, it doesn't belong in the repo." A bare
`we:POC_NOTES.md` fits none. It also escapes real machinery: the locus-prefix hook
(`we:scripts/lint-locus-prefix.mjs --pre`), the citation/anchor scans, and `scrubPublish`
(`we:scripts/lib/secret-scrub.mjs`) are each scoped to `we:backlog/` + `we:reports/` (+ `we:docs/agent/`,
`we:agent-memory-src/`). A new top-level notes file would silently lose all three.

One more precedent worth citing because it is the same mistake in miniature:
`we:audits/backlog-health-audit.md` was git-tracked and then **deliberately gitignored**, because a regenerable
per-run report left every lane dirty.

---

# Fork 1 — What shape is the record?

- **(A) Chronological living report** — one `we:reports/YYYY-MM-DD-poc-<branch-slug>.md` per POC branch, a new
  dated `##` section appended per session, following the 12 existing program reports exactly.
- **(B) Componential ledger** ← **RECOMMENDED** — the same one file per POC branch, but its `##` headings are
  **concerns, not dates**: one heading per separable unit of work ("the review wrapper", "the build wrapper",
  "the watchdog", "the validate-promote pipeline"). Dated bullets nest *under* a concern. Each concern carries a
  one-line **graduation status**: `unlanded` / `sliced as #NNNN` / `superseded by #NNNN` / `dropped — why`.
- **(C) One file per entry** — `we:reports/YYYY-MM-DD-poc-<branch>-<slug>.md`, pure reports convention, no
  append at all.
- **(D) Structured sidecar** — JSON/YAML entries under `we:.conveyor/poc/<branch>.json`.
- **(E) A notes file at a fixed path on the branch itself** — the `we:POC_NOTES.md` sketch.

| | Day-to-day readability | Concurrent writers | **Graduation-decomposability** | Governance (locus lint / scrub / three-homes) |
|---|---|---|---|---|
| (A) chronological | good | one append point | **poor** — this is exactly `#3383`'s shape, and `#3443` had to re-decompose it from scratch | full |
| **(B) componential** | good | one file, but writers touch *different sections* | **strong** — one `##` ⇒ one graduation story; status column removes the supersession re-derivation | full |
| (C) file-per-entry | fragmented | **none** | poor — decomposition is scattered across N files with no grouping key | full, but §6e "no hidden reports" needs a registration *per file* |
| (D) sidecar | poor — JSON is the wrong medium for evidence and changes of mind | append = whole-file rewrite | medium — machine-groupable if entries carry a concern tag | **none** — gitignored, lost on lane recycle, invisible cross-machine |
| (E) branch-local notes | good | one append point | **poor, and actively harmful** — the 8 un-graduatable commits above | **none** — outside every scan |

**Why (B) over (A), stated plainly.** They differ by one thing — the axis of the outer heading — and that one
thing is the whole graduation criterion. (A) is what exists today and has a measured failure. (B) costs nothing
extra to write (the bullets are the same bullets) and makes the graduation pass a read-and-file rather than a
read-and-re-derive. **This is the fork where the graduation criterion changed the answer**: on readability and
concurrency alone (C), the zero-conflict dated files, would win; the graduation criterion eliminates it, because
scattering entries across files destroys the grouping that graduation needs.

**Why (E) is rejected despite being the most intuitive.** It has the best instinct behind it — the record should
travel with the branch. But the branch is exactly where the record must NOT live: `#3443` already proved a
branch-local log does not cherry-pick, and `we:backlog/` is not in the branch's declared registry `scope`
(`["we:scripts/conveyor/", "we:skills-src/conveyor/"]`), so a branch-local record is undeclared drift by the
registry's own rules.

# Fork 2 — Does "what is still left to do" live in the record, or in the backlog?

- **(A) In the record** — a punch-list section in the ledger.
- **(B) In the backlog, keyed by `deliveryTarget:`, and the record never duplicates it** ← **RECOMMENDED**.
- **(C) Both** — record carries "next 3 things", backlog carries the real items.

**Recommendation (B), and this is the finding most worth the operator's attention: it is already done.** The
2026-09-12 audit's remaining work was filed the same day as real items — `#3643` (epic) plus `#3640`, `#3641`,
`#3642`, `#3644`, `#3645`, plus `#3638`, `#3646`, `#3647`. **Five of them already carry
`deliveryTarget: lane/mechanical-dispatcher`.** So the punch-list half of the operator's problem has a standard
mechanism, it is in use, and each entry is *already a graduation-ready story* with a title, a `scope:`, a size and
a done-when — which is precisely the artifact `#3443`'s manual pass had to construct by hand.

**What is missing is a view, not a document.** There is no way to ask "what is open against POC branch X":
`deliveryTarget` is read by `we:scripts/check-standards.mjs`, `we:scripts/check-backlog-item.mjs`,
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/lib/poc-branches.mjs`, and by nothing that lists. One
small addition — `node we:scripts/backlog.mjs list --delivery-target=<branch>` — turns the punch-list into a
query.

**The honest cost of (B):** filing an item is heavier than a bullet, which is the exact friction the operator
named. Two things soften it. First, the friction is smaller than it looks — the eight items above were filed in a
single pass. Second, a bullet in a notes file is not dispatchable by anything, whereas a filed item is work the
conveyor can pick up. **(C) is rejected** for the reason `#3639`'s Fork 1 already gave by name: two sources of
truth about "what is left" that can disagree, with a silent failure mode.

# Fork 3 — Do small decisions made along the way belong here at all?

- **(A) Yes — recorded in the ledger, promoted only if they harden.**
- **(B) No — every decision still goes through a `kind: decision` card, even a fast, low-ceremony one.**
- **(C) Split by blast radius** ← **RECOMMENDED**.

**Recommendation (C).** A decision whose effect is confined to the POC branch is recorded in the ledger, under
its concern. A decision that would bind `main` — a doctrine rule, anything that would earn a `codifiedIn:`, and
anything reaching `we:docs/agent/platform-decisions.md` — goes through a real decision card, unchanged.

This is `#3637`'s own test applied one axis over: skip the ceremony *inside* the branch, pay it in full at the
boundary. It preserves "one place decisions live" exactly where the property is load-bearing — memory rule 25
makes the platform-decisions statute layer binding, and nothing should reach it without a ruling — while not
demanding a `preparedDate` and a ratification turn for "which env key distinguishes the two `fix` spawners."

(A) alone is too loose: `#3383`'s ten `## Working doctrine` sections show in-card rules that genuinely bound
`main`'s behaviour for days before being promoted. (B) alone contradicts `#3637`'s ruling — per-increment
ceremony is the latency the POC mode exists to remove.

# Fork 4 — Does the registry point at the record?

- **(A) Yes — a new `trackingDoc:` field on the registry entry** ← **RECOMMENDED**.
- **(B) No — derive the path by convention from the branch name.**
- **(C) Reuse the existing `owner:` field** as the pointer.

**Recommendation (A).** The reports convention puts a **date prefix** on the filename, and a date is not
derivable from a branch name, so (B) would force either a glob or a break from the convention. (C) conflates "who
graduates this branch" with "where its record is" — only accidentally the same today.

**The cost is small but real, and is not the same as adding a backlog field.** `#3637`'s survey found backlog
frontmatter has no closed schema, so `deliveryTarget:` cost nothing to introduce. The registry is the opposite:
`we:scripts/lib/poc-branches.mjs`'s `normalizeRegistry` builds a **fixed object literal**, so unknown fields are
silently dropped. A `trackingDoc:` needs `validatePocBranch`, `normalizeRegistry`, `writeRegistry`'s projection
and `we:scripts/lib/__tests__/poc-branches.test.mjs` all touched. Roughly an hour, not a day.

**One hazard to rule on with it:** should `trackingDoc:` be required or optional? Optional and absent ⇒ a branch
with no record, which is the undeclared-state failure rule 10(c) exists to prevent. Required ⇒ registering a POC
branch means creating its ledger first. **Lean required**, consistent with rule 10(c)'s posture that a POC branch
must declare itself.

# Fork 5 — On `main`, or on the branch?

Not in the original framing, and it is the fork with the hardest evidence.

- **(A) The record lives on `main`** ← **RECOMMENDED** — the ledger is a report on `main`; the items are
  `we:backlog/` cards on `main`; the POC branch carries only code.
- **(B) On the branch** — travels with the work, one lander writes both in one push.
- **(C) Both, split by content.**

**Recommendation (A), on `#3443`'s eight wasted commits.** A branch-local record does not cherry-pick, is
invisible from `main` until graduation, and is outside the branch's own declared registry `scope`. (B)'s single
genuine advantage — one writer, one push — is bought at the price already paid once.

**And (A) collapses Fork 1's concurrency objection, which is why the two must be ruled together.** If the record
lives on `main`, it is **not** written by the N landing agents: it is written by whatever session supervises the
branch, and by the items' own `## Progress` sections. One writer, not N. That is precisely why Fork 1 can afford
(B)'s single file and does not need (C)'s zero-conflict file-per-entry.

# Fork 6 — What is the join key between the ledger and the items?

The ledger's concerns and the backlog's items have to line up, or graduation still re-derives the grouping.

- **(A) Derive concerns from `scope:` path overlap** — no new field; `/consolidate` already clusters exactly this
  way.
- **(B) An explicit short `concern:` label** on each POC-targeted item, matching a ledger heading.
- **(C) Nothing formal** — a human matches them by reading.

**Recommendation (B), weakly, and this is the fork I am least sure of.** The argument for it is the evidence:
`#3443`'s working decomposition produced human-readable names ("lane-pool hardening", "the reconcile-pass
payload split a/b/c"), and path overlap alone would not have produced the a/b/c landing order or the `blockedBy`
edges between them. The argument against is that it is a new field on the exact axis `scope:` already covers, and
this repo's standing preference is to add a view over existing data rather than a field. **(A) is a defensible
ruling** and is strictly cheaper; if the operator prefers it, the ledger headings should simply be *named after*
the dominant scope path so the mapping stays obvious to a reader.

---

## Recommendation, in one place

**(B) componential ledger · (B) punch-list stays in the backlog · (C) decisions split by blast radius ·
(A) a `trackingDoc:` registry field · (A) the record lives on `main` · (B) an explicit concern label.**

Concretely, a POC branch's record becomes three things that share one key:

1. **Outstanding work** = open `we:backlog/` items carrying `deliveryTarget: <branch>`. Already in use (8 items
   filed 2026-09-12, 5 stamped). Needs one small view: `--delivery-target=`.
2. **Narrative + branch-local decisions** = one report per POC branch, headed by **concern**, each concern
   carrying a graduation status line. Registered via the owner item's `relatedReport:` so §6e "no hidden reports"
   passes.
3. **The pointer** = `trackingDoc:` on the registry entry, so the record is reachable from `main` without
   knowing the branch.

At graduation, `#3443`'s pass becomes: read the ledger's concern headings, drop the ones marked
landed/superseded, and file one story per remaining concern — instead of reading 30 commits whose SHAs may
already be stale.

**The honest counter-argument, stated so it is not buried.** This splits a POC branch's state across two places
where today it is one file you can read top to bottom, and the command that would reunite them
(`poc status <branch>` → open items plus newest ledger entries) is not proposed here. If the operator values
single-artifact readability above graduation-decomposability, Fork 1(A) with everything else unchanged is a
coherent ruling — and its price is that `#3443`'s manual re-decomposition recurs for every POC branch, once per
graduation. Given `#3637` ruled N concurrent POC branches, that price is paid N times, which is the strongest
reason I do not recommend it.

**What this card does not claim.** It does not argue for building a general "work-record" system, and it does not
pre-empt `#3639`'s batch object. If that batch object ships and turns out to be the better home for item 1 above,
this design composes with it rather than competing — both key on the backlog item.

## Relationships

- **Parent `#3383`**, deliberately, matching `#3637` and `#3639` rather than nesting under `#3637`. Reasons:
  `#3637` is `status: resolved` and already has its build child (`#3638`), so a new decision under it reads as
  re-opening a closed ruling; and rule 10 — the doctrine this governs — lives in `#3383`'s own scoped doctrine
  skill. Standing it as a sibling keeps the three POC-mode decisions readable as one set.
- **`#3637`** — ruled the delivery mode this card records the state of. Not superseded, not duplicated.
- **`#3639`** — adjacent on the batch axis, confirmed distinct above. Its Fork 5 / session-update "batch object"
  is the one place the two could converge, and Fork 2(B) here is what keeps them composable.
- **`#3443`** — the graduation epic. Supplies the hardest evidence on this card (the 8 un-graduatable session-log
  commits, the stale-SHA entry, the 7-slice decomposition) and is the primary consumer of whatever is ruled.
- **`#3638`** (`status: active`) — builds the registry a `trackingDoc:` field would extend. Sequencing note: if
  Fork 4 is ruled (A), it is cheaper folded into `#3638` than added after.
- **`#3643`** and its five children — the already-filed punch-list that makes Fork 2(B) an observation rather
  than a proposal.
- Checked for duplicates with `node we:scripts/capability-search.mjs` on two phrasings before filing; nearest
  hits were `#2278` (lane-rebuild discipline) and `#3182` (VM session state), neither this question.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with `codifiedIn:`
   set, and the ruling names, for each of the six forks above, the option taken and why.
2. **Ruled** — the ruling states explicitly whether a POC branch's record is required (rule 10(c)-style) or
   optional, and if required, what refuses a registration without one.
3. **Not built here, by design** — no change to `we:scripts/lib/poc-branches.json`'s schema, no ledger authored,
   no `--delivery-target=` view. The follow-on build item is named by the ruling, not by this card.
