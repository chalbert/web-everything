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
dateOpened: "YYYY-MM-DD"          # quote it — keeps it a string, not a parsed date
dateResolved: "YYYY-MM-DD"        # required once status: resolved — the burndown plots this
tags: [tag-a, tag-b]
relatedReport: reports/YYYY-MM-DD-topic.md   # optional — deep dive (date is auto-exposed)
relatedProject: webvalidation                # optional — must resolve in projects.json
crossRef: { url: /blocks/droplist/, label: droplist block page }   # optional
graduatedTo: intent:droplist                 # set when status:resolved by becoming a real entity
---

# Imperative title (this becomes the item title)

The first paragraph is the summary shown on the index card. The rest of the
body is the detail-page content. Keep the *deep* thinking in a report and link
to it via `relatedReport`, rather than pasting a whole report in here.
```

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
3. **Mark it resolved.** Set `status: resolved`, **add `dateResolved: "YYYY-MM-DD"`** (today — the burndown plots this; `check:standards` errors on a resolved item without it), and save. If the item became a real entity (block/intent/protocol/…), add `graduatedTo: <entity>` so the graduation trail is recorded on the item. Re-run `npm run check:standards` to prove the build still passes. Because the file stays, a pointer item keeps its `relatedReport` exposed — there's no orphaned-report risk to guard against.

> Deletion is no longer the close-out step — `resolved` is. The only time you remove a `backlog/<id>.md` is to discard an item that was opened in error or fully superseded, not to record completed work.

## Selecting the next item to work on

> Use when asked "what's next?", "pick the next backlog item", "what should I work on?" — or via the `next-backlog-item` skill. The goal is the item an **agent can implement now**, not just the most interesting one.

**Gather.** `ls backlog/*.md`; read each item's frontmatter (`type`, `status`) and skim its body. Keep only `status: open`. **Drop `active`** (already in progress — see *Starting an item* below), `resolved`, and `parked`.

**Concurrency is real — the snapshot goes stale.** Multiple agents work this backlog at once, so the `status` you read while gathering can be claimed by another agent before you finish presenting. Two guards, both cheap:
- **Cross-check the working tree, not just `status`.** Run `git status --short` during *Gather*. A racing agent often edits an item's named files **before** it flips `status: open → active` — so any candidate whose named file paths (or branch) already show uncommitted edits is **in progress**; drop it even though it still reads `open`.
- **Re-read fresh right before you commit to it.** The instant before you present the single recommendation — and again the instant before you claim it (see *Working an item* → *Claim it on start*) — re-`cat` *that one item's* frontmatter from disk (not the bulk snapshot) and re-run `git status --short`. If it now reads `active`, or its files are now dirty, you lost the race: drop it and fall to the next Tier-A item.

**Score each candidate for dev-readiness** — the test is *"could an agent open a PR for this today, without a design call?"*:

| Signal | Ready ↑ | Not ready ↓ |
|---|---|---|
| `type` | `issue` (known fix) › `idea` (concrete build) | `decision` (open fork), `review` (needs human judgment) |
| Body verbs | "Implement / Roll / Add / Align / Extract" + **named file paths** + acceptance criteria | "Decide whether / Open sub-decision / alternative held open / held open" |
| `relatedReport` | a **plan** or an IMPLEMENTED / self-contained-handoff report | an open exploration with unsettled options |
| Prerequisites | none, or "now that X is proven", or every item it references is `resolved` | references an unresolved item, "blocked on …", "surfaces the moment …" |

**Tier the candidates:**
- **A — agent-ready:** `issue`/`idea`, concrete bounded build, no blocking fork, prereqs resolved. **Pick the next item from here.**
- **B — one nod away:** a `decision` that already states a recommendation — needs only the user to ratify, then it's a quick edit/build. Offer it; don't auto-run it.
- **C — needs design / not agent-ready:** open `decision` forks, `review`s, anything blocked. Surface for discussion, never auto-pick.

**Order within Tier A:** `issue` before `idea`; smaller blast-radius / clearer acceptance criteria first; **items that unblock a chain before their dependents** (e.g. reconcile a page before graduating it); cluster around recently-shipped work for momentum.

**Dependency check.** An item that says "see the `<other>` item", "prerequisite", or "after X" is Tier A only if that prerequisite is `resolved`; otherwise it's blocked — surface the prerequisite instead.

**Output (don't start work yet).** Present a short ranked shortlist (top 3–5, grouped by tier, one-line rationale each), then the single recommended next item with its reasoning, then ask whether to start. Follow the planning-as-discussion style — recommend, don't rapid-fire multiple-choice.

**If the recommended item is a `decision`/`review` (Tier B/C), present the decision to be made — not a build to claim.** A fork is a call to make, not work to start: lay out the open fork / human judgment it needs, the realistic options with their tradeoffs, and your recommendation with reasoning (planning-as-discussion; expect follow-up). Resolving it turns work agent-ready — then continue or re-run selection. This is the same framing as *When nothing is agent-ready* below; the difference is only whether a ready item also exists beneath it.

**Always give two links per offered item** so the user can open it either way:
- the **live page** — `[<id>](http://localhost:3000/backlog/<id>/)`. Browse on `:3000` (Vite), which **proxies `/backlog/` to the 11ty server on `:8080`** — that's the URL the user actually has open. (A *newly authored* item can `404` until the running 11ty server rebuilds — it's stale, not a wrong URL; a clean `eleventy` build always has it.)
- the **source file** — `[backlog/<id>.md](backlog/<id>.md)` (opens the markdown in the editor; always works regardless of server state).

Example offer line: *`jsx-directive-sugar` — add the deferred `<For>/<Show>/<Resource>` layer ([live](http://localhost:3000/backlog/070-jsx-directive-sugar/) · [md](backlog/070-jsx-directive-sugar.md))*.

### When nothing is agent-ready — surface the one highest-leverage blocker

If *Gather* + tiering leaves **no Tier-A item** (the ready pool is empty — everything left is Tier B/C, blocked, or needs a design call), **do not** return a long menu of open decisions. Instead pick **exactly one** item — the one whose resolution unblocks the most downstream work — and put it to the user as the single thing they need to decide. This is the **only** time selection recommends a non-Tier-A item, and it still returns just one.

- **Rank the blockers by downstream unblock count.** For each open `decision`/`review`/blocked item, count how many *other* open items depend on it — anything that names it ("see #NNN", "prerequisite", "after X", "blocked on …"), rolls under it (`parent`), or sits in its chain. **Most dependents wins.** Break ties by the *size* of the work it gates (more / larger downstream points first), then prefer the **smallest decision** (a one-nod Tier-B ratification over a wide-open fork) so the unblock is cheap.
- **Present just that one, as a decision to make — not a build.** State the item (with its live + md links), name **what's blocking it** (the open fork / human judgment needed), and **list concretely which items it unblocks** once resolved (their `#NNN`). Frame it as: *"resolve this and these N items become agent-ready."* Follow planning-as-discussion (lay out the realistic options + your recommendation with reasoning; expect follow-up questions) — **do not** fire a multiple-choice; this is a design call, not a bounded pick among ready items.
- **If even the blocker set is empty** (truly nothing open), say so plainly — the backlog is drained of actionable work — rather than inventing an item.

## Working an item — claim it, then keep it live

The backlog file is the **durable, resumable record** of in-flight work — treat it that way so a lost or interrupted session can pick up exactly where you left off:

1. **Claim it on start — re-read first to win the race.** The moment you begin work, **re-`cat` the item from disk** to confirm it's still `status: open` (a concurrent agent may have claimed it since you presented it; see *Selecting* → *Concurrency is real*). If it's already `active` or its named files are dirty in `git status --short`, **stop — it's taken**; go back and pick another. Only if it's still genuinely open: set `status: open` → **`status: active`**, add `dateStarted: "YYYY-MM-DD"`, and save — *before* writing any code. Selection drops `active` (see *Gather*), so a fresh session won't re-pick work already underway.
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
3. **If abandoned unfinished,** flip `active` → `open`, leave the `## Progress` section as-is (it says where it stopped), so it returns to the pool instead of looking claimed-but-dead.
4. **Reclaiming a stranded claim.** An item left `active` by a crashed/forgotten session would otherwise be invisible forever (selection drops `active`). So when asked to work and the pool looks empty — or when explicitly told to continue one — treat an `active` item as **resumable**: read its `## Progress`, check out its branch, and continue from **Next**. Don't re-pick it as fresh; resume it.

When it's fully done, follow *Closing out a completed item* (mark `resolved` after the final-capture pass).

## Running a batch — chain several small items, stop on a solid condition

> Use via the `batch-backlog-items` skill (`/batch`, `/batch-next`). A batch works several **small, agent-ready** items back-to-back **without stopping for approval between them** — to run a bit longer and progress faster — while keeping a real validation stop at every seam and a hard backstop that guarantees it ends. It **reuses the single-item arc unchanged** (*Selecting*, *Working an item*, *Closing out*); it only adds the loop and the stop rule below.

**What a batch keeps (unchanged): per-item on-disk ownership.** Every item is still claimed individually — re-read to win the race → `status: open → active` + `dateStarted` *before* any code → `## Progress` kept in sync → `resolved` at close-out after the full gate. A stranded batch is therefore exactly as recoverable as a single item: each one is claimed and progress-tracked on disk, and selection still drops `active`, so nothing gets re-picked mid-flight.

**The one thing a batch drops: the claim-as-its-own-turn *stop*.** That stop exists only to keep the per-item chat-rename prompt from being buried — a batch renames the session **once**, up front (see the skill), so there is no per-item prompt to protect. Claim and work flow together. The on-disk active/ownership discipline above is **not** relaxed — only the per-item rename-stop is.

**Eligibility — what may go in a batch.** Only **small Tier-A** items, and "small" is now **explicit, not a guess** — read it off the *Agile sizing* fields:

- A **`story` with `size` ≤ 3** (Fibonacci `1`/`2`/`3` = trivial/small/moderate), **or**
- a **`task`** (bounded sub-work — regression guard, e2e/coverage, wiring, doc/runtime reconcile, small fix; carries no `size`, its points roll up to a parent).

Plus the Tier-A guards on top of the size gate: `issue`/`idea`, concrete bounded build, prereqs resolved, **no design fork**, **named file paths**, **clear acceptance criteria**. **Never batched:** a **`story` of `size` ≥ 5** (substantial/large/should-split), any **`epic`**, and all Tier B/C items (decisions, reviews, anything needing a design call) — surface those for discussion as usual. (If an item has no `size`/`workItem` yet, fall back to the blast-radius heuristic — a handful of files / one subsystem — and treat it as batchable only if it's clearly trivial.)

### The loop

1. **Plan the batch, approve once.** Run *Selecting*, but instead of one recommendation present an **ordered batch plan**: the small Tier-A items it intends to chain, up to the cap `N` (default **3**; override with `/batch N`), each with its live + md links. A single "go" (or one `AskUserQuestion`) authorizes the **whole batch**, not each item. If `/batch-next <NNN-slug>` named a seed, that item starts the chain (skip its selection, per *Selecting* step 0); the rest are picked by ranking.
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
Batch 2/3 · gate ✓ · pts 5 · next: #155
✓ #154 cross-list-empty-tabstop — story·3 — fixed empty-list tabstop; tests+standards green
✓ #151 cross-list-empty-fixtures — task — added shared fixtures; green
▶ #155 registered-behaviors-coverage — task — working
```

Each line carries the item's `workItem`/`size` so the chain's effort is visible; the header's `pts` sums resolved story/unstoried-epic points (tasks contribute none — see *Agile sizing*), which is exactly what the `/backlog/` Burndown moves. Expand to full close-out detail only on a **red gate** (show the failure) or when asked. Keep the body lean — the ledger *is* the report.

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
