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

Create `backlog/<NNN>-<slug>.md`. **The filename is the `id`**, and it has two parts: a zero-padded **`NNN` number** (the stable unique id — shown as `#042`, used in the URL `/backlog/<NNN>-<slug>/` and for short refs) plus a kebab-case **`slug`** (the human-readable text, which may be reworded). **Allocate `NNN` = the current highest number + 1** (`ls backlog/ | sort | tail -1` → next). The number is permanent; never reuse a deleted item's number. Frontmatter is metadata only — **no `title`, no `summary`, no `id`/`num`**; the title/summary derive from the body's `# H1` and first paragraph, the id/num from the filename. `check:standards` fails if the `NNN-` prefix is missing or a number collides. There are two shapes:

**1 — Content item** (its own write-up):

```markdown
---
type: idea | issue | review | decision
status: open | active | parked | resolved
dateOpened: "YYYY-MM-DD"          # quote it — keeps it a string, not a parsed date
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
dateOpened: "2026-06-02"
tags: [droplist, traits]
relatedReport: reports/2026-06-02-droplist-trait-language.md
relatedProject: webtraits
---
```

Live-collected form, on a `projects.json` entry:
```json
"openQuestions": [
  { "question": "Should validity merge be last-writer-wins or strictest-wins?", "anchor": "merge-strategy" }
]
```

## Closing out a completed item — delete it (after a final-capture pass)

The backlog tracks **open** work, not history. When an item — or a plan it mirrors — is **fully done**, **delete its `backlog/<id>.md`**. The lasting record is the shipped thing: the spec entity on the website, and the report (kept exposed) for the deep trail. Never delete on a hunch — run this gate first, **carefully**, because deletion is where leftover work and report links silently disappear:

1. **Confirm it's actually done.** Re-check the item's own acceptance criteria against reality — relevant tests green, `npm run check:standards` green, build green. **If the item added or changed a standard's feature, the standard's conformance demo must reflect it** — a shared fixture/case exists for the new feature and the playground shows it (demos are fixture-driven; see the Definition of Done in AGENTS.md). If any criterion is unmet — including a feature with no demo case — it is **not** done; leave the item.
2. **Take a careful last look for leftovers.** Did the work surface anything deferred, half-finished, or newly exposed (a follow-up, an edge case, a related cleanup)? Each such point gets its **own new backlog item now** — *review-before-adding / dedup first* (see Rules). Capturing leftovers before deletion is the whole point: nothing dies with the file.
3. **Pointer guard — don't orphan a report.** If the item is a *pointer* mirroring a report (`relatedReport`, no body) and it is that report's **only** exposure, deleting it turns the report into a *hidden doc* and `npm run check:standards` fails. First promote the report to a `/research/` topic (or keep one pointer), *then* delete. Re-run `check:standards` afterward to prove the build still passes.
4. **Graduated ideas.** When an `idea`/`decision` became a real entity (block/intent/protocol/…), that entity **is** the record — delete the backlog file; you don't need a lingering `resolved` + `graduatedTo` stub.

> `status: resolved | parked` stay valid for an item you *deliberately keep visible* (e.g. parked for later, or a decision whose `graduatedTo` trail you want on the site). But the default for **done** work is **deletion**, not a resolved tombstone.

## Selecting the next item to work on

> Use when asked "what's next?", "pick the next backlog item", "what should I work on?" — or via the `next-backlog-item` skill. The goal is the item an **agent can implement now**, not just the most interesting one.

**Gather.** `ls backlog/*.md`; read each item's frontmatter (`type`, `status`) and skim its body. Keep only `status: open`. **Drop `active`** (already in progress — see *Starting an item* below), `resolved`, and `parked`.

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

**Always give two links per offered item** so the user can open it either way:
- the **live page** — `[<id>](http://localhost:3000/backlog/<id>/)`. Browse on `:3000` (Vite), which **proxies `/backlog/` to the 11ty server on `:8080`** — that's the URL the user actually has open. (A *newly authored* item can `404` until the running 11ty server rebuilds — it's stale, not a wrong URL; a clean `eleventy` build always has it.)
- the **source file** — `[backlog/<id>.md](backlog/<id>.md)` (opens the markdown in the editor; always works regardless of server state).

Example offer line: *`jsx-directive-sugar` — add the deferred `<For>/<Show>/<Resource>` layer ([live](http://localhost:3000/backlog/070-jsx-directive-sugar/) · [md](backlog/070-jsx-directive-sugar.md))*.

## Working an item — claim it, then keep it live

The backlog file is the **durable, resumable record** of in-flight work — treat it that way so a lost or interrupted session can pick up exactly where you left off:

1. **Claim it on start.** The moment you begin work, set the item's frontmatter `status: open` → **`status: active`** and save — *before* writing any code. Selection drops `active` (see *Gather*), so a fresh session won't re-pick work already underway. Add `dateStarted: "YYYY-MM-DD"` if useful.
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

When it's fully done, follow *Closing out a completed item* (delete after the final-capture pass).

## Rules

- **Review before adding (dedup).** Always scan the existing backlog first — list the titles and grep related terms (`grep -rilE "<topic>" backlog/`). If an item already covers the idea, **extend it** rather than adding a near-duplicate sibling. Watch for *parallel* tracks that look similar but are distinct (e.g. the `<component>` adapter items vs. the JSX adapter items) — cross-reference instead of merging.
- The `id` is the filename stem `<NNN>-<slug>` — unique by construction. The `NNN` number (`item.num`) is the stable routing key and short ref (`#042`); the `slug` is reword-able text. `type` and `status` come from the enums above (validated, incl. the `NNN-` prefix + number-collision checks).
- **No `title`/`summary` in frontmatter** — title = the body's `# H1`, summary = its first paragraph (or, for a pointer item, both come from the report). The loader derives them; the validator checks the *derived* values exist, so every item needs either a body or a `relatedReport`.
- `relatedReport` must exist on disk; `relatedProject` must resolve in `projects.json`; `crossRef` needs both `url` and `label`.
- `reports/` is **not** in the 11ty build, so `relatedReport` shows as a path label, not a link. Real site links go via `crossRef` / `relatedProject`.
- `npm run check:standards` validates all of the above — it reads `backlog/*.md` through `src/_data/backlog.js`, the same loader the site uses.
