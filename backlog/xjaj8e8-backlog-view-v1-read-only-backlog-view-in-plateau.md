---
kind: story
size: 5
parent: "x0xjkr7"
status: open
blockedBy: ["xg8fwbk"]
dateOpened: "2026-07-14"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view v1 — read-only backlog view in Plateau

The first buildable slice of the operable console: inside Plateau, load **one** repository's `backlog/*.md` and render them as a browsable, read-only list — one row per item. This is the read foundation the operable (write) and live-overlay slices layer onto.

## What it does

Load a single target repo's `backlog/*.md` and render one row per item, each showing:

- **id / number** and **title** (the H1, from the body — not the filename),
- a **one-line summary** (the item's first paragraph),
- per-item **durable state** rendered as FUI badges: `status` (open / active / preparing / parked / resolved), `kind` (story / epic / task / decision), `size` when present, and `tags` when present.

Clicking a row opens the item's **full rendered markdown detail**.

The durable state read here is only what's **authored in each file** — the live pipeline state (claimed / PR / CI / merged) is a separate, deferred slice ([live build-state overlay](/backlog/xryxyhp-backlog-view-live-build-state-overlay-per-item-lane-pr-ci-me/)).

## Constraints

- **Read-only.** The view changes nothing in the target repo.
- **Honest empty state.** No `backlog/` dir → a clear "no items" message, not a blank or broken view.
- **Degrade, don't crash.** A malformed item file is **skipped as a degraded row**, never crashing the whole view.
- **Repo is one configurable seam — not hardcoded.** The target repo is a single configurable input, so multi-repo later ([#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/) / [#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/)) is a config change, not a rewrite.
- **Built fresh on Plateau's FUI stack** — the route-view router plus the `mount<Name>` pattern — dogfooding FUI. No WE templates imported. Web Everything is the reference model only; impl lives in plateau-app.

Blocked by the data-path decision ([D1](/backlog/xg8fwbk-plateau-loop-how-the-backlog-console-reads-a-repo-s-backlog-/)) — how the files reach the view (served endpoint vs build-time snapshot vs remote) fixes the seam this story reads through.

## Acceptance

- One row per `.md` file in the target `backlog/`.
- Title and summary derived from the **body** (H1 + first paragraph), never the filename.
- `status` and `kind` badges rendered from the vocabulary; `size` and `tags` shown when present.
- A malformed item file does not crash the view (it shows a degraded row and the rest render).
- Empty / missing `backlog/` dir → "no items".
- Renders as a Plateau surface (route-view router + `mount<Name>`).
- The target repo is configurable via **one** seam (no hardcoded repo).
