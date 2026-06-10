# Backlog Workflow — the single source of truth for open work

> Tier-1 reference. Read when capturing an idea/issue/decision/review, or when a report ends with open questions.

The backlog is the website-as-source-of-truth tracker for ideas, issues, decisions, and reviews — so they don't rot in scattered markdown. **It feeds entirely off a directory of markdown files** — one file per item, and it's **completely dynamic**: the title, summary, and detail-page body are all derived from markdown, never hand-typed into frontmatter. Frontmatter holds only metadata (type, status, dates, links). It renders at `/backlog/` (a filterable, grid/list-toggleable index), and **every item gets a detail page at `/backlog/{id}/` automatically**. There is no `backlog.json`.

```
backlog/<id>.md            # one markdown file per item — metadata frontmatter + a markdown body (its title/summary/detail). The only file you create to add an item.
src/_data/backlog.js       # the loader — parses backlog/*.md into the `backlog` array the pages + validator all consume (single source)
src/backlog.njk            # the /backlog/ index (filter + grid/list toggle, status-ordered, live-collects project open questions)
src/backlog-pages.njk      # paginates the array → one /backlog/{id}/ detail page per item (renders the body)
reports/                   # deep thinking — a backlog item links OUT to a report; the report is not the tracker
```

## Three homes — nothing stays hidden

Every doc has exactly one home, and **nothing sits in the repo unreachable from the website**:

- **Research** (analysis, options, citations) → a report in `reports/`. Reports are **not** in the 11ty build, so a report is exposed only when it is either **promoted to a `/research/` topic** (`researchTopics.json` + `research-descriptions/{id}.njk`, where `id` = the report's de-dated slug) **or mirrored by a backlog pointer item** (`relatedReport`, no body — renders the report at `/backlog/{id}/`). A report that is neither is a **hidden doc**.
- **Spec** (the standard itself) → the website: `src/_data/*.json` + `src/_includes/*-descriptions/*.njk` (blocks, plugs, intents, adapters, projects, protocols, semantics). Exposed by construction.
- **Everything else** — ideas, issues, decisions, reviews, "do this later" → a **backlog item** at `/backlog/`.

The test for any new markdown: *is it research (→ report + a `/research/` topic or backlog mirror), spec (→ website), or a backlog item?* If it fits none, it doesn't belong in the repo. **`npm run check:standards` fails if any `reports/*.md` is hidden** — i.e. has neither a matching research topic nor a backlog reference.

## Where an open question goes

| Source of the question | What to do |
|---|---|
| In a `reports/*.md` report | **Convert** it to a `backlog/<id>.md` item with `relatedReport` pointing at the report. Shrink the report's "Open questions" prose to a pointer at `/backlog/`. |
| On a standards **page** (project/block/intent) | **Cross-reference** it: either a `backlog/<id>.md` item with a `crossRef`, or — preferred — declare it on the entity so it's collected live (below). |
| Ideally | **Live-collected from projects.** Add an `openQuestions` array to the entry in `projects.json`; `/backlog/` aggregates them automatically under "Live from the standards." Edit them on the project, never copy into the backlog. |

## Authoring an item

**Fastest path — scaffold it:** `node scripts/backlog.mjs scaffold --type=idea --workitem=story --size=3 --title="…" --digest="…" [--blocked-by=NNN,NNN] [--parent=NNN]` allocates the next free `NNN` atomically (re-globbing right before write to dodge the collision race) and writes a `check:standards`-shaped item — pass `--digest` to author it in one shot (omit it and a `TODO` digest line is left for you to fill). Or author the file by hand:

Create `backlog/<NNN>-<slug>.md`. **The filename is the `id`**, and it has two parts: a zero-padded **`NNN` number** (the stable unique id — shown as `#042`, used in the URL `/backlog/<NNN>-<slug>/` and for short refs) plus a kebab-case **`slug`** (the human-readable text, which may be reworded). **Allocate `NNN` = the current highest number + 1** (`ls backlog/ | sort | tail -1` → next), or any never-used gap number. Re-check `ls backlog/` *immediately before* you write the file; if your chosen number is taken by the time you save (a concurrent session grabbed it), take the next free one — **yield, don't shuffle**.

> **The `NNN` is immutable — never renumber an existing item.** Once a file has a number, that number is its id for life. **Do not rename `backlog/<NNN>-…` to a different `NNN`** — not to tidy the sequence, not to close a gap, not to resolve a collision. Renumbering silently breaks every `#NNN` short-ref and the `/backlog/<NNN>/` URL, and under concurrent agents it cascades into id collisions (two sessions chasing the same next-number, each renumbering the other's work). **On any number collision the *newer* item yields:** give the item you are *adding* a different free number; never touch a number already on disk. You may reword the *slug* (see *Renaming an item* below) — you may never change the *number*. Reusing a deleted item's number is likewise forbidden (a never-allocated gap number is fine).

Frontmatter is metadata only — **no `title`, no `summary`, no `id`/`num`**; the title/summary derive from the body's `# H1` and first paragraph, the id/num from the filename. `check:standards` fails if the `NNN-` prefix is missing or a number collides. There are two shapes:

**1 — Content item** (its own write-up):

```markdown
---
type: idea | issue | review | decision
status: open | active | parked | resolved
workItem: story | epic | task     # agile category (required) — see "Agile sizing" below
size: 3                            # Fibonacci points — ONLY on stories + unstoried epics
parent: "049"                      # optional — NNN of the epic this rolls under (quote it: leading zeros)
blockedBy: ["079", "092"]          # optional — NNN(s) this item can't start until they're resolved (quote: leading zeros)
dateOpened: "YYYY-MM-DD"          # quote it — keeps it a string, not a parsed date
dateResolved: "YYYY-MM-DD"        # required once status: resolved — the burndown plots this
tags: [tag-a, tag-b]
relatedReport: reports/YYYY-MM-DD-topic.md   # optional — deep dive (date is auto-exposed)
relatedProject: webvalidation                # optional — must resolve in projects.json
crossRef: { url: /blocks/droplist/, label: droplist block page }   # optional
graduatedTo: intent:droplist                 # set when status:resolved by becoming a real entity — or `none` if it resolved without spawning one
---

# Imperative title (this becomes the item title)

The first paragraph is the summary shown on the index card. The rest of the
body is the detail-page content. Keep the *deep* thinking in a report and link
to it via `relatedReport`, rather than pasting a whole report in here.
```

**`blockedBy` — a directional prerequisite edge, not a "see also".** `blockedBy: ["NNN", …]` declares that this item *cannot start until each listed item is `resolved`*. It is a distinct relation from the two existing link fields: `crossRef` is a non-directional "see also" URL/label, and `parent` is epic grouping (which item rolls up under which) — neither carries the "blocks / is-blocked-by" direction. Lifting prerequisites out of prose ("blocked on…", "after #NNN") into this field turns the backlog into a real **DAG**, the prerequisite for any *deterministic* readiness scoring (#249/#250) that doesn't need an LLM to read sentences. Keep a short human note in the body too; the field is the machine-readable half. The loader resolves it to a `blockers` array (linked on the detail page), and `check:standards` **errors** if an edge is unresolvable, self-referential, or forms a cycle (the readiness function assumes acyclicity).

**2 — Pointer item** (mirrors a report): omit the body entirely. With a `relatedReport` and no body, the item's title, summary, and detail-page content are loaded *from the report md itself* — so the backlog shows the report, with nothing restated by hand.

```markdown
---
type: idea
status: open
workItem: story          # pointer items are sized too (required on every item)
size: 5
dateOpened: "2026-06-02"
tags: [droplist, traits]
relatedReport: reports/2026-06-02-droplist-trait-language.md
relatedProject: webtraits
---
```

**Renaming an item (slug reword *only* — never the number) — keep old links alive.** Only the `slug`
half is reword-able; the `NNN` is immutable (see the immutability rule above — never renumber an
existing item). The `NNN` number is permanent, so a
cited `/backlog/<NNN>/` URL survives any reword (it redirects to canonical via `src/backlog-redirects.njk`).
But a previously-published link to the **old slug** (`/backlog/<NNN>-old-wording/`, or a pre-NNN
`/backlog/old-wording/`) would 404 after the rename. To preserve it, add the **full former URL segment**
(the whole old filename stem) to a `formerSlugs:` array on the renamed item:

```yaml
formerSlugs: [042-old-wording, even-older-wording]
```

A build-time template (`src/backlog-slug-redirects.njk`, fed by `src/_data/backlogAliases.js`) then
emits one tiny redirect page per entry at `/backlog/<former>/` → the item's canonical `/backlog/<id>/`.
`check:standards` rejects a `formerSlug` that collides with a live item id or with another item's alias.

Live-collected form, on a `projects.json` entry:
```json
"openQuestions": [
  { "question": "Should validity merge be last-writer-wins or strictest-wins?", "anchor": "merge-strategy" }
]
```

## Agile sizing — the burndown's fuel

Every item carries a `workItem` category, and **points (`size`) live at exactly one level** so the `/backlog/` **Burndown** tab (a continuous-flow chart of remaining vs. scope vs. completed *points*, with burn-rate and a future projection) never double-counts. `npm run check:standards` enforces all of this.

| `workItem` | What it is | `size`? |
|---|---|---|
| **story** | One coherent, independently valuable deliverable (a block/intent/trait/adapter feature, or a decision/review that yields a concrete artifact or spec ruling). The default. | **Required** — Fibonacci `1 / 2 / 3 / 5 / 8 / 13`. |
| **task** | Sub-work with no standalone value — a regression guard, e2e/coverage, wiring, doc/runtime reconcile, a bug fix, follow-up hardening. Often `type: issue`. Rolls up under a story/epic via `parent`. | **Never** — its points belong to the parent. |
| **epic** | An umbrella spanning multiple items (a program/initiative/vision). | **Storied** epic (its children are their own items) → **no `size`** (the child stories carry the points). **Unstoried** epic (a bucket not broken into child items) → **sized** as a whole. |

**The no-double-count rule, mechanically:** the burndown sums every item's `size`. A `task` has none; a *storied* epic has none; a `story` and an *unstoried* epic each have exactly one. So each unit of scope is counted once. The validator **errors** if: a story lacks a size, a task has one, a size isn't Fibonacci, a `parent` doesn't resolve, or an **unstoried (sized) epic has a sized child** (that would count its scope twice — make it storied or re-parent the child).

**Sizing guide:** `1` trivial · `2` small · `3` moderate · `5` substantial · `8` large · `13` very large (should-split). Size *relative effort/uncertainty*, not hours. `parent` (quote it — leading zeros) links a story/task to the epic it rolls under, for grouping; it does not affect the point sum.

## Closing out a completed item — mark it `resolved` (after a final-capture pass)

The backlog tracks **open** work; when an item — or a plan it mirrors — is **fully done**, flip its frontmatter `status` → **`resolved`** (don't delete the file). `resolved` items are dropped from selection (see *Gather*) and hidden by default on `/backlog/`, so they don't clutter the live view, but the file stays as an audit trail and keeps any `relatedReport` exposed. Never close on a hunch — run this gate first, **carefully**, because close-out is where leftover work silently disappears:

1. **Confirm it's actually done.** Re-check the item's own acceptance criteria against reality — relevant tests green, `npm run check:standards` green, build green. **If the item added or changed a standard's feature, the standard's conformance demo must reflect it** — a shared fixture/case exists for the new feature and the playground shows it (demos are fixture-driven; see the Definition of Done in AGENTS.md). If any criterion is unmet — including a feature with no demo case — it is **not** done; leave the item `active`.
2. **Take a careful last look for leftovers.** Did the work surface anything deferred, half-finished, or newly exposed (a follow-up, an edge case, a related cleanup)? Each such point gets its **own new backlog item now** — *review-before-adding / dedup first* (see Rules). Capturing leftovers before close-out is the whole point: nothing is lost when the item leaves the live view. **Verify each new item is registered, and don't claim it's live yet:** the `check:standards` you run in step 3 reports a backlog count — confirm it rose by the number of items you added (that proves the frontmatter parsed; a malformed item is silently skipped). New items **do** hot-reload on the running dev server: `backlog/` is an `addWatchTarget` in `.eleventy.js` and `src/_data/backlog.js` exports a function that re-globs `backlog/*.md` on every build, so a fresh item normally appears within seconds — **no restart per item.** The footgun is the *trigger*: a file created by a tool/`Write` (atomic write) can be missed by 11ty's chokidar watcher, so no rebuild fires and the new `/backlog/<id>/` `404`s — and a browser reload does **not** help (reload re-fetches 11ty; it doesn't rebuild it). So after creating an item, don't claim it's live until you've confirmed it, and don't "fix" a 404 by editing/renaming the file (it's stale, not wrong). To force the rebuild without restarting the user's server, **touch any watched file** — `touch src/_data/backlog.js` — then re-probe (give it a few seconds; rebuilds aren't instant and an early `curl` races them). Verify against 11ty directly (`:8080`) or the Vite proxy (`:3000`); a clean one-off build (`npx @11ty/eleventy --output=/tmp/11ty-verify`, grep the id) confirms the file itself is valid if the watch path is ever in doubt. Restarting 11ty is a last resort, not the routine fix.
3. **Mark it resolved.** Run **`node scripts/backlog.mjs resolve <NNN> [--graduated-to=<entity>|none]`** — it flips `active` → `resolved`, stamps `dateResolved` (today — the burndown plots this; `check:standards` errors on a resolved item without it), and sets `graduatedTo` if you pass it, in one splice. (This is the *edit* only — run the close-out gate above **first**; the command doesn't.) If the item became a real entity (block/intent/protocol/…), pass `--graduated-to=<entity>` so the graduation trail is recorded. If it resolved **without spawning a new entity** — an `idea` that enhanced existing code, folded into a sibling, or shipped as a refinement — pass `--graduated-to=none` (the sentinel) (the body already says what it improved). This is the sanctioned way to acknowledge "no new entity, on purpose" so the close-out nudge below doesn't read as forgotten work. (`issue`/`review`/`decision` items are exempt from the nudge and need no `graduatedTo` at all; the sentinel is for the resolved `idea` that genuinely produced no entity.) Re-run `npm run check:standards` to prove the build still passes. Because the file stays, a pointer item keeps its `relatedReport` exposed — there's no orphaned-report risk to guard against.

> Deletion is no longer the close-out step — `resolved` is. The only time you remove a `backlog/<id>.md` is to discard an item that was opened in error or fully superseded, not to record completed work.

## Keep the blocker DAG honest — re-evaluate `blockedBy` whenever you touch the backlog

`blockedBy` only earns its keep — deterministic readiness tiers (#249/#250), the dependency graph, "what's the critical path to ready work" — if the edges stay **current**. The failure mode is silent: prerequisites stated in prose ("after #NNN", "blocked on…", "needs X from #NNN", "once Y ships") never get lifted into the field, so items show as agent-ready (Tier A) when an unfinished dependency actually gates them. So **re-evaluate edges at every seam**, not as a one-off audit:

- **When you author or close-out an item (including leftover spin-offs):** before saving, scan the body for every prerequisite phrasing and lift each into `blockedBy: ["NNN", …]`. A genuine blocker is a **hard prerequisite** — the item *cannot start or complete* until the blocker resolves (it consumes an artifact/API/registry/protocol the blocker produces, or a `decision` the blocker ratifies). It is **not** mere "see also" (that's `crossRef`) or epic grouping (that's `parent`). Record real prerequisites even if the blocker is already `resolved` — the lineage is correct and a resolved blocker leaves the item Tier A. Be conservative: a false edge wrongly hides ready work, so when in doubt, leave it out and keep the prose note.
- **When you claim/resume an item:** sanity-check its own `blockedBy` against reality. A listed blocker that has since resolved is fine (leave the edge; the tier logic handles it). But if the body reveals a real prerequisite that was never declared, **add it now**; if a listed edge is spurious (not actually a prerequisite), **remove it**. A claim is the cheapest moment to correct the item you're already reading.
- **When you resolve an item:** you don't hand-edit dependents — the loader recomputes readiness from the edge set, so resolving an item automatically frees whatever listed it. Just confirm the items this work *created or touched* carry correct edges.
- **Discipline, not blast radius:** edit only the items you're already working; don't sweep the whole backlog mid-task. `check:standards` **errors** on an unresolvable, self-referential, or cyclic edge, so run it after edits — a green gate proves the DAG is still acyclic.

## The digest — every item's lead paragraph; keep it an accurate one-glance summary

Each item's **first paragraph is its digest** — the loader derives `item.summary` from it (no separate field, so it can never become a stale *copy* of the body; it *is* the body). It's what selection reads to rank without opening every item, and what the shortlist / index / graph tooltips surface. Because a fast, trustworthy digest is what makes selection quick, two gates keep it healthy — one mechanical, one human:

- **Mechanical (`check:standards`):** the lead paragraph is a **required field** — a missing/empty one is an **error**. A paragraph over `DIGEST_MAX_WORDS` (100) **warns** — keep the digest to ~2-3 sentences ("what + why"), not the full body; the detail lives below it under `## Build` / `## Acceptance`.
- **Human/agent (review-time) — the part tooling can't judge:** a derived digest can't drift as a *copy*, but its **content** drifts when you rewrite an item's scope and leave the opening paragraph describing the old plan. So **whenever you author, claim, work, close out, or review a story, re-read its lead paragraph and refresh it if it no longer matches the current item.** Authoring a new item (including a close-out spin-off) means *writing* a real digest, not letting the first sentence of detail stand in for one. Reviewing a candidate during selection means *glancing* at its digest and correcting it on the spot if it's stale — this is the cheapest moment, since you're already reading the item. Until this is second-nature across every skill, treat "review a story" as implicitly including "review its digest."

## Selecting the next item to work on

> Use when asked "what's next?", "pick the next backlog item", "what should I work on?" — or via the `next-backlog-item` skill. The goal is the item an **agent can implement now**, not just the most interesting one.

**Gather — run the deterministic ranker first; do not re-derive the tiers by hand.** The readiness
rubric (tier, batchable, leverage) is already computed **once** by the loader (`src/_data/backlog.js`)
and surfaced on the `/backlog/` **Prioritisation** tab. Re-globbing `backlog/*.md` and re-tiering each
item in prose is the slow, drift-prone path that the tab makes unnecessary — it was finding 2 batchable
items in minutes where the loader lists 23 instantly. So **step 1 is a single command**, not a file sweep:

```
npm run check:readiness -- --select          # human-readable ranked view (the same data the tab shows)
node scripts/check-readiness.mjs --json       # machine-readable: { selection: { counts, tierA, batchable, tierB } }
```

It prints, instant and **identical to the tab** (same loader → zero desync): the open counts, the
**Tier-A** items ordered (leverage desc → issue-before-idea → smaller-first → NNN), the **batchable**
subset (small Tier-A), and **Tier-B** decisions ranked by leverage. Take the ranked list from here —
**do not recompute `tier`/`batchable`/leverage**; the loader already did, deterministically. The CLI
already keeps only `open` items (it drops `active`/`resolved`/`parked`), so the only thing left to read
by hand is each *shortlisted* item's body, for the one judgment a field can't make (below).

**Concurrency is real — the snapshot goes stale.** Multiple agents work this backlog at once, so the `status` you read while gathering can be claimed by another agent before you finish presenting. Two guards, both cheap:
- **Cross-check the working tree, not just `status`.** Run `git status --short` during *Gather*. A racing agent often edits an item's named files **before** it flips `status: open → active` — so any candidate whose named file paths (or branch) already show uncommitted edits is **in progress**; drop it even though it still reads `open`.
- **Re-read fresh right before you commit to it.** The instant before you present the single recommendation — and again the instant before you claim it (see *Working an item* → *Claim it on start*) — re-`cat` *that one item's* frontmatter from disk (not the bulk snapshot) and re-run `git status --short`. If it now reads `active`, or its files are now dirty, you lost the race: drop it and fall to the next Tier-A item.

**Refine the top of the ranked list — the CLI gives the structural tier; you add only the prose
judgment.** The `--select` ranking is the deterministic core of the rubric (type + resolved
prerequisites + size). The two signals a field *can't* decide — does the body actually read as a
buildable plan, or does it hide a design fork — are still yours, but you apply them **only to the
shortlist** (the top few candidates you're about to present), not to all 100+ items. The test is
*"could an agent open a PR for this today, without a design call?"*:

| Signal | Ready ↑ | Not ready ↓ |
|---|---|---|
| `type` | `issue` (known fix) › `idea` (concrete build) | `decision` (open fork), `review` (needs human judgment) |
| Body verbs | "Implement / Roll / Add / Align / Extract" + **named file paths** + acceptance criteria | "Decide whether / Open sub-decision / alternative held open / held open" |
| `relatedReport` | a **plan** or an IMPLEMENTED / self-contained-handoff report | an open exploration with unsettled options |
| Prerequisites | none, or "now that X is proven", or every item it references is `resolved` | references an unresolved item, "blocked on …", "surfaces the moment …" |

**The tiers (what the CLI's structural pass assigns — your prose refinement can only *demote*, never promote):**
- **A — agent-ready:** `issue`/`idea`, prereqs resolved — the loader's `tier: 'A'`. **Pick the next item from here.** (A buried fork the field couldn't see drops it to C — that demotion is your shortlist pre-flight, below.)
- **B — one nod away:** a `decision` that already states a recommendation — needs only the user to ratify, then it's a quick edit/build. Offer it; don't auto-run it.
- **C — needs design / not agent-ready:** open `decision` forks, `review`s, anything blocked. Surface for discussion, never auto-pick.

**Order within Tier A** is already applied by `--select` (leverage desc → `issue` before `idea` → smaller-first → NNN — so chain-unblockers and small clear builds float up). Layer only the judgment the sort can't encode: prefer clearer acceptance criteria, and cluster around recently-shipped work for momentum.

**Dependency check.** An item that says "see the `<other>` item", "prerequisite", or "after X" is Tier A only if that prerequisite is `resolved`; otherwise it's blocked — surface the prerequisite instead.

**Output (don't start work yet).** Present a short ranked shortlist (top 3–5, grouped by tier, one-line rationale each), then the single recommended next item with its reasoning, then ask whether to start. Follow the planning-as-discussion style — recommend, don't rapid-fire multiple-choice.

**If the recommended item is a `decision`/`review` (Tier B/C), claim it, then present the decision to be made — not a build.** A fork is a call to make, not a build to start — but talking it through is itself claimable work, so **claim it first** (see *Working an item* → *Claim it on start*: re-read to win the race, flip `open → active` + `dateStarted`, rename the chat) so a concurrent session won't discuss the same fork. *Then* lay out the open fork / human judgment it needs, the realistic options with their tradeoffs, and your recommendation with reasoning (planning-as-discussion; expect follow-up). If the user redirects, release the claim (`active → open`) and claim the one they want. Once the call is made, close it out (`resolved` + the ruling) — its successor work then turns agent-ready, so continue or re-run selection. This is the same framing as *When nothing is agent-ready* below; the difference is only whether a ready item also exists beneath it.

**Always give two links per offered item** so the user can open it either way:
- the **live page** — `[<id>](http://localhost:3000/backlog/<id>/)`. Browse on `:3000` (Vite), which **proxies `/backlog/` to the 11ty server on `:8080`** — that's the URL the user actually has open. (A *newly authored* item can `404` until the running 11ty server rebuilds — it's stale, not a wrong URL; a clean `eleventy` build always has it.)
- the **source file** — `[backlog/<id>.md](backlog/<id>.md)` (opens the markdown in the editor; always works regardless of server state).

Example offer line: *`jsx-directive-sugar` — add the deferred `<For>/<Show>/<Resource>` layer ([live](http://localhost:3000/backlog/070-jsx-directive-sugar/) · [md](backlog/070-jsx-directive-sugar.md))*.

### When nothing is agent-ready — surface the one highest-leverage blocker

If *Gather* + tiering leaves **no Tier-A item** (the ready pool is empty — everything left is Tier B/C, blocked, or needs a design call), **do not** return a long menu of open decisions. Instead pick **exactly one** item — the one whose resolution unblocks the most downstream work — and put it to the user as the single thing they need to decide. This is the **only** time selection recommends a non-Tier-A item, and it still returns just one.

- **Rank the blockers by downstream unblock count.** For each open `decision`/`review`/blocked item, count how many *other* open items depend on it — anything that names it ("see #NNN", "prerequisite", "after X", "blocked on …"), rolls under it (`parent`), or sits in its chain. **Most dependents wins.** Break ties by the *size* of the work it gates (more / larger downstream points first), then prefer the **smallest decision** (a one-nod Tier-B ratification over a wide-open fork) so the unblock is cheap.
- **Claim it first, then present it as a decision to make — not a build.** A decision discussion is itself claimable work, so before laying it out, claim it as its own turn (see *Working an item* → *Claim it on start* — re-read to win the race, flip `open → active` + `dateStarted`, then the chat-rename prompt) so a concurrent session won't talk through the same fork. *Then* state the item (with its live + md links), name **what's blocking it** (the open fork / human judgment needed), and **list concretely which items it unblocks** once resolved (their `#NNN`). Frame it as: *"resolve this and these N items become agent-ready."* Follow planning-as-discussion (lay out the realistic options + your recommendation with reasoning; expect follow-up questions) — **do not** fire a multiple-choice; this is a design call, not a bounded pick among ready items. If the user redirects to a different item, release the claim (`active → open`) and claim that one instead. Once the call is made, close out the decision item (*Closing out* — `active → resolved` + `dateResolved` + the ruling); its successor work is then agent-ready.
- **If even the blocker set is empty** (truly nothing open), say so plainly — the backlog is drained of actionable work — rather than inventing an item.

## Working an item — claim it, then keep it live

The backlog file is the **durable, resumable record** of in-flight work — treat it that way so a lost or interrupted session can pick up exactly where you left off:

1. **Claim it on start — one command does the race-safe flip.** Run **`node scripts/backlog.mjs claim <NNN>`**: it re-reads from disk, refuses if the item isn't still `status: open` (lost the race) or its file is dirty in `git status --short`, and otherwise flips `open` → **`active`** + stamps `dateStarted` (today) in one surgical splice — then prints the chat-rename slug for you to copy. This *is* the claim; you don't hand-edit the frontmatter. (Manual fallback if you must: set `status: active`, add `dateStarted: "YYYY-MM-DD"`, save — *before* writing any code.) If the command errors, **stop — it's taken**; go back and pick another. Selection drops `active` (see *Gather*), so a fresh session won't re-pick work already underway. **This applies to a `decision`/`review` too:** discussing a fork is itself claimable work, so claim it (and rename the chat) *before* presenting the decision's substance — the only difference from a build is that the "work" is the discussion, not code. If the discussion never resolves, release it back to `open` (rule 3); when the call is made, close it out (`resolved` + the ruling) like any item.
2. **Keep it in sync as you go.** Maintain a short **`## Progress`** section in the item's body and update it *as work happens*, not at the end — if the session dies mid-task, this section is **all the next session has** (recovering the prior chat is not reliable; the item body is the contract). Keep this exact shape so any session can resume in seconds:
   ```markdown
   ## Progress
   - **Status:** active — <one line: where things stand>
   - **Branch:** <git branch with the WIP>
   - **Done:** <what's landed + green>
   - **Next:** <the single concrete next step>
   - **Notes:** <key file paths, decisions, gotchas>
   ```
   (An in-session TodoWrite list is fine for live tracking, but it is **not** durable — only the item body survives the session.)
3. **If abandoned unfinished,** run **`node scripts/backlog.mjs release <NNN>`** (`active` → `open`); leave the `## Progress` section as-is (it says where it stopped), so it returns to the pool instead of looking claimed-but-dead.
4. **Reclaiming a stranded claim.** An item left `active` by a crashed/forgotten session would otherwise be invisible forever (selection drops `active`). So when asked to work and the pool looks empty — or when explicitly told to continue one — treat an `active` item as **resumable**: read its `## Progress`, check out its branch, and continue from **Next**. Don't re-pick it as fresh; resume it.

When it's fully done, follow *Closing out a completed item* (mark `resolved` after the final-capture pass).

## Running a batch — chain several small items, stop on a solid condition

> Use via the `batch-backlog-items` skill (`/batch`, `/batch-next`). A batch works several **small, agent-ready** items back-to-back **without stopping for approval between them** — to run a bit longer and progress faster — while keeping a real validation stop at every seam and a hard backstop that guarantees it ends. It **reuses the single-item arc unchanged** (*Selecting*, *Working an item*, *Closing out*); it only adds the loop and the stop rule below.

**What a batch keeps (unchanged): per-item on-disk ownership.** Every item is still claimed individually — re-read to win the race → `status: open → active` + `dateStarted` *before* any code → `## Progress` kept in sync → `resolved` at close-out after the full gate. A stranded batch is therefore exactly as recoverable as a single item: each one is claimed and progress-tracked on disk, and selection still drops `active`, so nothing gets re-picked mid-flight.

**The one thing a batch drops: the claim-as-its-own-turn *stop*.** That stop exists only to keep the per-item chat-rename prompt from being buried — a batch renames the session **once**, up front (see the skill), so there is no per-item prompt to protect. Claim and work flow together. The on-disk active/ownership discipline above is **not** relaxed — only the per-item rename-stop is.

> **Claim as the *first keystroke* on an item — before any file read.** Because claim and work now flow together with no stop between them, it is easy to slide into exploring/editing code while the item is still `open` and only flip it at close-out. That leaves a real window where a concurrent agent sees it as unclaimed. So on starting each item, **flip `open → active` + `dateStarted` first**, then read code. (Re-read to win the race, then immediately claim — don't interleave exploration between the two.)

**Eligibility — take the batchable set straight from the ranker; don't re-derive it.** Only **small
Tier-A** items, and "small" is **explicit, not a guess** — the size+tier gate is **deterministic**, so
the loader derives it as `item.batchable` (`src/_data/backlog.js`) and `npm run check:readiness -- --select`
prints the ready batchable list directly (also `--json` → `selection.batchable`), identical to the
`/backlog/` Prioritisation tab. **That list *is* your candidate pool — read it, don't reconstruct it**
(reconstructing it by hand from frontmatter is exactly the slow, under-counting pass this replaces). The
rule below is documented so the derivation stays auditable; keep it and `item.batchable` identical if
either changes. The flag is the structural gate only — the body-fork pre-flight below is the
non-structural guard a field can't decide, applied **only to the items you're about to chain**.

- A **`story` with `size` ≤ 3** (Fibonacci `1`/`2`/`3` = trivial/small/moderate), **or**
- a **`task`** (bounded sub-work — regression guard, e2e/coverage, wiring, doc/runtime reconcile, small fix; carries no `size`, its points roll up to a parent).

Plus the Tier-A guards on top of the size gate: `issue`/`idea`, concrete bounded build, prereqs resolved, **no design fork**, **named file paths**, **clear acceptance criteria**. **Never batched:** a **`story` of `size` ≥ 5** (substantial/large/should-split), any **`epic`**, and all Tier B/C items (decisions, reviews, anything needing a design call) — surface those for discussion as usual. (If an item has no `size`/`workItem` yet, fall back to the blast-radius heuristic — a handful of files / one subsystem — and treat it as batchable only if it's clearly trivial.)

> **Pre-flight each candidate's *body* for a buried fork — `size` measures effort, not decision-weight.** A `story·3` can still hide a real design call ("decide whether the served form stays self-contained or imports the helper") that the size field never shows. Before approving the plan, skim each body for **"decide whether / alternative held open / open sub-decision"**; a small item with a buried fork is a **stop risk** (stop rule 4), not a clean batch item — either resolve the fork in discussion first (Tier B) or drop it from the chain.

> **Keep the pre-flight to the body skim — don't re-derive what the selection already settled.** The `--select` projection is the source of truth for *ranking and readiness*; re-computing its inputs by hand is wasted turns at equal quality. Specifically: **(a) Don't re-verify already-resolved blockers.** An item only reaches the batchable pool with its `blockedBy` edges resolved — that's the projection's guarantee. The only blocker work here is the body-fork skim catching an *undeclared* prereq (corrected at claim, per *Keep the blocker DAG honest*), not re-`grep`ping that listed `resolved` blockers are still resolved. **(b) A dirty working-tree flag means *drop or defer*, not investigate.** The bulk `git status --short` from *Gather* is a race signal; if a candidate's file is dirty, drop it (or let `claim` adjudicate — it refuses a dirty file). Don't spend a turn `git diff`-ing the change to rationalize keeping it — `claim` is the gate. **(c) Don't hunt for a "better" cluster by default.** Reach one cluster deeper for a tighter same-subsystem alternative **only when the top-N body skim actually surfaces a fork or an "outgrew small"** — that's when the exploration earns its cost. If the ranked top-N skims clean, take it and go.

### The loop

1. **Plan the batch, approve once.** Run *Selecting*, but instead of one recommendation present an **ordered batch plan**: the small Tier-A items it intends to chain, up to the cap `N` (default **3**; override with `/batch N`), each with its live + md links. A single "go" (or one `AskUserQuestion`) authorizes the **whole batch**, not each item. If `/batch-next <NNN-slug>` named a seed, that item starts the chain (skip its selection, per *Selecting* step 0); the rest are picked by ranking. **Cluster the order by subsystem/repo, and treat a repo or subsystem boundary as a *planned* context-seam:** group items that touch the same files/package together, and put items in a different repo (e.g. a frontierui-side change after a run of webeverything ones) **last** — that boundary is a fresh-context load and the natural place the batch will stop (stop rule 5). Predicting the seam at plan time beats discovering it mid-batch.
2. **Work each item through its full arc** — claim → work → close-out gate — reporting the **compact ledger** (below) instead of per-item prose.
3. **At each seam** (after an item's close-out, before claiming the next) **evaluate the stop rule.** If it says continue, **re-read the next item fresh from disk** to win the race (if it's now `active`/dirty, drop to the next eligible; if none remain, stop).

### The stop rule — solid by construction

Built so the fuzzy signal can only ever **shorten** the batch, never extend it: a hard backstop guarantees termination, and every other condition only stops *earlier*. Evaluate at each seam. **Stop the batch if ANY is true:**

1. **Gate red (safety stop).** The item just finished isn't fully green — relevant tests, `npm run check:standards`, and build must all pass (the close-out gate). On red: leave that item `active`, do **not** start another, report the failure. Never batch past a red gate — this is the per-item validation that makes "running longer" safe.
2. **Count cap reached (deterministic backstop).** Completed count == `N`. This **always** fires by `N` regardless of any judgment call, so the batch always terminates — that is what makes the remaining, softer conditions safe to be approximate.
3. **No eligible next item.** Nothing left that is small Tier-A — next is a decision/review, larger than a handful of files, blocked, or the pool is empty after the concurrency re-read.
4. **New fork surfaced.** The completed item raised an open design question, **or** an item turned out **bigger than its "small" assumption mid-work** (sprawled across subsystems / needs a design call). Capture it as its own backlog item (per *Closing out* → leftovers), then stop — that's the user's call, not the batch's.
5. **Context seam (earlier stop only).** If at a seam you judge context is getting heavy (long transcript, many large reads, repeated full test runs), **finish the current item cleanly and stop here** rather than claiming another. This is self-assessed, so it is *allowed* to be imperfect: because the count cap (rule 2) already guarantees termination, an over- or under-eager context call can only make the batch a little shorter — never runaway. **Err toward stopping at a seam:** it is the cheapest possible handoff point — the just-finished item is `resolved` and green, nothing is half-done.

### Reporting — a compact ledger, not prose per item

After each item, update a single running ledger — one line per item, scannable:

```
Batch 2/3 · gate ✓ · pts 5 · net −1/+1 · next: #155
✓ #154 cross-list-empty-tabstop — story·3 — fixed empty-list tabstop; tests+standards green
✓ #151 cross-list-empty-fixtures — task — added shared fixtures; green (+#162 leftover)
▶ #155 registered-behaviors-coverage — task — working
```

Each line carries the item's `workItem`/`size` so the chain's effort is visible; the header's `pts` sums resolved story/unstoried-epic points (tasks contribute none — see *Agile sizing*), which is exactly what the `/backlog/` Burndown moves. The header also shows **net flow** `−<resolved>/+<opened>` — a batch both resolves items *and* opens new ones (leftovers captured at close-out), and capture can outpace drain; surfacing the net keeps that honest. Note each captured leftover inline on its parent item's line (`+#NNN`). Expand to full close-out detail only on a **red gate** (show the failure) or when asked. Keep the body lean — the ledger *is* the report.

### Stopping — report + hand off

When the batch stops, end with: the final ledger, the **stop reason** (which rule fired), and — exactly as *Selecting* step 8 — the **carry-forward** block for a fresh session. When the stop was the **context seam** (or a cluster boundary), say so and recommend starting a **fresh agent** so context resets, emitting the next chain's invocation in its own fenced code block for the one-click copy:

> Stopped at a context seam — 3 items resolved, all green. Start a fresh agent on the next chain:
> ```
> /batch-next 158-editable-grid-typed-editors-validation
> ```

If the stop was a **red gate** or a **surfaced fork**, the carry-forward instead points at what needs attention — the `active` item to fix, or the new decision item to discuss — not a fresh batch.

## Rules

- **Don't touch commits (for now).** Backlog work never reviews, discusses, proposes, or performs git commits — not mid-work, not at close-out. Leave changes uncommitted in the working tree; the user owns committing and chooses the branch/commit strategy. Likewise, don't audit or comment on *unrelated* changes already in the tree — work your item and stop. Close-out (mark the item `resolved` after the capture pass) does **not** require anything to be committed.
- **Review before adding (dedup).** Always scan the existing backlog first — list the titles and grep related terms (`grep -rilE "<topic>" backlog/`). If an item already covers the idea, **extend it** rather than adding a near-duplicate sibling. Watch for *parallel* tracks that look similar but are distinct (e.g. the `<component>` adapter items vs. the JSX adapter items) — cross-reference instead of merging.
- The `id` is the filename stem `<NNN>-<slug>` — unique by construction. The `NNN` number (`item.num`) is the stable routing key and short ref (`#042`); the `slug` is reword-able text. `type` and `status` come from the enums above (validated, incl. the `NNN-` prefix + number-collision checks).
- **Never renumber an existing item.** The `NNN` is immutable for life — don't rename `backlog/<NNN>-…` to a different number to tidy the sequence, close a gap, or dodge a collision. It breaks `#NNN` refs and `/backlog/<NNN>/` URLs and, under concurrent agents, cascades into id collisions. On a collision the *newer* item takes a different free number; the number already on disk is never touched. (Slug rewording is fine — see *Renaming an item*.)
- **No `title`/`summary` in frontmatter** — title = the body's `# H1`, summary = its first paragraph (or, for a pointer item, both come from the report). The loader derives them; the validator checks the *derived* values exist, so every item needs either a body or a `relatedReport`.
- `relatedReport` must exist on disk; `relatedProject` must resolve in `projects.json`; `crossRef` needs both `url` and `label`.
- `reports/` is **not** in the 11ty build, so `relatedReport` shows as a path label, not a link. Real site links go via `crossRef` / `relatedProject`.
- `npm run check:standards` validates all of the above — it reads `backlog/*.md` through `src/_data/backlog.js`, the same loader the site uses.
