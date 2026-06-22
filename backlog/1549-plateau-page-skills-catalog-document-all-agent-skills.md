---
kind: story
size: 5
locus: plateau-app
status: open
dateOpened: "2026-06-22"
tags: [plateau-app, skills, docs, dogfood]
---

# Plateau page: skills catalog (document all agent skills)

A plateau-app page cataloguing the project's Claude Code agent skills across all repos — name, purpose, when-to-use, scope — so they are discoverable instead of buried as files. A reader (human or a fresh agent session) can see what automation exists and how to invoke it, in one place. **For later.**

## What it documents

The ~12 Claude Code skills under `we:.claude/skills/` (backlog/standards workflows — batch, split, next, prepare, review-design, new-standard, stress-test, …) and `fui:.claude/skills/` (explorer devtools — stress-test, improve-explorer), plus `plateau:.claude/skills/` if/when plateau grows its own. Per skill: its `name`, `description`, the "use when…" triggers, and which repo/scope it applies to.

## Source of truth (the one real call)

Generate the page from each skill's frontmatter (the `name` + `description` fields) under `we:.claude/skills/`, via a small build step — so the catalogue never drifts from the actual skills — **vs** hand-authoring it (drifts the moment a skill is added/renamed). Strong lean: **generated**. Mirrors how the rest of the platform treats catalogs (derive from the source artifact, don't re-key it).

## Shape

A plateau doc surface like `plateau:src/development-guide/` (the Learn Pathway) — grouped by repo/domain, each skill a card with name + description + triggers + scope. Dogfoods FUI components (#1254). Read-only; no execution (running a skill is the agent's job, not this page's — distinct from the explorer run-manager #1548).

## Depends on

Nothing blocking — the skills already exist as files under `we:.claude/skills/` and `fui:.claude/skills/`. The only build piece is the frontmatter reader, if generated.
