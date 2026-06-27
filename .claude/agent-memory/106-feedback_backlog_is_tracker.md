---
name: feedback_backlog_is_tracker
description: /backlog/ is the website source-of-truth tracker; register report open-questions/decisions as backlog/*.md items (one file per item, no backlog.json) instead of leaving them in markdown
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 88b1b4f5-4f84-4bb7-b9cc-f9597413c005
---

The `/backlog/` section is the single source of truth for open work (ideas / issues / decisions / reviews). **It feeds entirely off a dir of markdown files: `backlog/<id>.md`** (one per item — frontmatter = fields, optional body = the per-item `/backlog/<id>/` page). Loader: `src/_data/backlog.js` parses `backlog/*.md` into the `backlog` array that the pages (`src/backlog.njk`, `src/backlog-pages.njk`) and the validator all consume — single source, no `backlog.json`. **Workflow doc: `docs/agent/backlog-workflow.md`** (Tier-1; AGENTS.md routes to it).

**Why:** open questions rot when scattered across `reports/*.md`. The backlog is the tracker; reports hold the deep thinking and a backlog item links OUT to them.

**How to apply:** when a report ends with open questions/decisions, **register each as a `backlog/<id>.md` file** (filename = id). The backlog is **completely dynamic — NO `title`/`summary` in frontmatter**; title = the body's `# H1`, summary = its first paragraph. Frontmatter is metadata only: `type(idea|issue|review|decision), status(open|active|parked|resolved), dateOpened` (quote it), `tags`, optional `relatedReport`/`relatedProject`/`crossRef`/`graduatedTo`. Two shapes: (1) a **content item** with its own markdown body (H1 + paragraphs); (2) a **pointer item** — a `relatedReport` and NO body — which mirrors the report (title/summary/detail loaded from the report md itself). `relatedReport` must exist on disk, `relatedProject` must resolve in `projects.json`; `npm run check:standards` validates the derived values. Make this the default tracking step after writing a report. Relates to [[feedback_materialization_pattern_codified]] and [[feedback_catalog_auto_render]].
