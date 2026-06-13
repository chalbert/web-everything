# Research Workflow — plans/ → research/

> Tier-1 reference. Read when processing files in `plans/` or writing research pages.

Users drop short plan files (questions, ideas, design explorations) into `plans/`. Each plan is researched and converted into a permanent research topic page on the docs site.

```
plans/                                          # inbox — short markdown questions/ideas
reports/                                         # session progress reports (NOT in the 11ty build)
src/_data/researchTopics.json                    # registry of all research topics
src/_includes/research-descriptions/{id}.njk     # full research write-ups
```

## Steps
1. **Check** `plans/` for `.md` files.
2. **Read** each plan; understand the question.
3. **Research**: web search + codebase exploration + framework analysis.
4. **Add a registry entry** to `researchTopics.json`:
   ```json
   {
     "id": "kebab-case-id", "title": "Human-Readable Title", "status": "open",
     "summary": "One-paragraph description.", "dateOpened": "YYYY-MM-DD",
     "tags": ["..."], "relatedBlocks": ["..."], "relatedPlugs": ["..."], "relatedProject": "..."
   }
   ```
5. **Write** `src/_includes/research-descriptions/{id}.njk` — wrap entire file in `{% raw %}…{% endraw %}`. Use `<h2>` for top-level sections (template provides `<h1>`). Include: the question, recommendation/finding, historical + framework comparison tables, web-standards alignment, classification/architecture proposal, cross-references.
   - Cross-link projects: `<a href="/projects/{id}/">…</a>`; research: `<a href="/research/{id}/">…</a>`.
6. **Verify build**: `npx @11ty/eleventy` — page count should increase by 1 per new topic.
7. **Delete** the processed `.md` from `plans/`.
8. **Write one report per plan**: `reports/YYYY-MM-DD-{topic}.md` (one report per plan file, never combined).

## Report template
```markdown
# Descriptive Title
**Date**: YYYY-MM-DD
**Point**: one-line summary of what this report is / concludes.
**Plan file**: `plans/{filename}.md`
**Research page**: `/research/{id}/`
---
## Question
## Recommendation
## Key Findings
## Files Created/Modified
| File | Action |
```

**Lead with a clear `# Title` and a one-line `**Point:**`** (or `**Goal:**`/`**Summary:**`), followed by a `---` rule. A report can be surfaced on the site as a *pointer* backlog item that **mirrors** it: the backlog loads the report's H1 as the item title, the `**Point:**` line as its summary, and the content after the `---` as the detail page (see [backlog-workflow.md](backlog-workflow.md)). A vague title or missing point makes a poor backlog entry. (`reports/` itself is not in the 11ty build; the mirror is how a report shows on the site.)

## Refreshing a topic — refresh-as-new-report, never in place (#441 Fork 1 / #478)

A promoted `/research/` topic stays alive over time, but its findings are an **immutable dated audit
trail**: you never overwrite an existing write-up to "update" it. A refresh is a **new dated report +
a new registry entry that supersedes the old one** — the same Obsoletes/Obsoleted-by model RFCs and
PEPs use. To refresh topic `{slug}`:

1. **New dated report** — write `reports/YYYY-MM-DD-{slug}.md` for the new findings (the old dated
   report is left untouched as the frozen prior snapshot).
2. **New registry entry** — add a fresh `researchTopics.json` entry (a new `id`, e.g. `{slug}-2` or a
   dated suffix) for the current revision, with today's `dateOpened`/`lastReviewed` and a
   **`supersedes: ["{old-id}"]`** pointer.
3. **Retire the prior entry** — on the old entry set **`status: "superseded"`** and the **back-pointer
   `supersededBy: ["{new-id}"]`**. The pointer is **bidirectional** by ruling — both directions are
   validated by `check:standards` (a one-way pointer warns).
4. **Write the new description** — `src/_includes/research-descriptions/{new-id}.njk` as in step 5
   above (the superseded entry keeps its own `.njk`, frozen).

Render is automatic: the `/research/` grid surfaces only the **latest as canonical** (superseded
entries are demoted from the grid but still reachable by URL), the superseded topic page shows a
**"Superseded revision"** banner linking the refresh, and both pages render the bidirectional
supersedes/supersededBy chain via the `revisionHistory` macro (`src/_includes/research-freshness.njk`).
Freshness (`lastReviewed` + `reviewHorizon`, the warn-only stale badge from `deriveResearchFreshness`,
#477) is a *lighter* signal — "still current but due a look"; supersession is the *heavier* one — "a
newer revision exists."
