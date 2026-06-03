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
