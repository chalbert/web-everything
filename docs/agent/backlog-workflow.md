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

Create `backlog/<id>.md`. **The filename (kebab-case) is the `id`.** Frontmatter is metadata only — **no `title`, no `summary`**; those are derived from the body's `# H1` (title) and first paragraph (summary). There are two shapes:

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

## Lifecycle — resolve vs. graduate

A backlog item ends one of two ways. Model both so the trail closes instead of forking:
- **Resolve** — an `issue`/`review` gets done → `status: resolved`. (No `graduatedTo` expected.)
- **Graduate** — an `idea`/`decision` becomes a real entity → `status: resolved` **and** `graduatedTo: "intent:droplist"` (or `block:…`, `protocol:…`). The validator warns if a resolved idea/decision has no `graduatedTo`.

## Rules

- The `id` is the filename (kebab-case) — unique by construction. `type` and `status` come from the enums above (validated).
- **No `title`/`summary` in frontmatter** — title = the body's `# H1`, summary = its first paragraph (or, for a pointer item, both come from the report). The loader derives them; the validator checks the *derived* values exist, so every item needs either a body or a `relatedReport`.
- `relatedReport` must exist on disk; `relatedProject` must resolve in `projects.json`; `crossRef` needs both `url` and `label`.
- `reports/` is **not** in the 11ty build, so `relatedReport` shows as a path label, not a link. Real site links go via `crossRef` / `relatedProject`.
- `npm run check:standards` validates all of the above — it reads `backlog/*.md` through `src/_data/backlog.js`, the same loader the site uses.
