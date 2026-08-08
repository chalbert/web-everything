---
name: progress-board
description: Refresh and re-publish the operator's progress board — the fixed-path Artifact page showing the current plan and where it stands. Use whenever a plan item starts, finishes, gets blocked or unblocked, after a PR lands, or after a review verdict — and when the user asks to "update the board", "refresh the progress board", "show me where the plan is", or runs /board. Costs one Bash call plus one Artifact call; NEVER hand-edit the page or its state file. Not a timer job — run it on state change only.
---

# Progress board — refresh the operator's status page

One page, one URL, refreshed mechanically. **You never see or write the page's markup.** A generator owns
every byte of it; your whole job is one CLI verb and one re-publish.

## The cost contract (this is the point of the skill)

**One update = one `Bash` call + one `Artifact` call.** Nothing else.

- Do **not** read `we:reports/progress-board.html`. It is generated output; reading it burns thousands of
  tokens and teaches you nothing the CLI does not already print.
- Do **not** hand-edit `we:reports/progress-board.json` with Edit/Write. Every field it holds has a verb.
  A hand edit is how the mechanical property dies.
- Do **not** re-derive pull-request state in context. The generator reads it live from `gh` on every render.

## WHEN to run it

On a **state change**, never on a timer:

- a plan item **starts** → `--start=<id>`
- a plan item **finishes** → `--done=<id>`
- a plan item **gets blocked** → `--block=<id> --why="…"`; **unblocked** → `--start=<id>` (it clears the blocker)
- **after a PR lands** → plain re-render (PR state is derived; nothing to type)
- **after a review verdict** → plain re-render, plus `--done=<id>` if that closed the item
- the operator **takes a decision** → `--decide=<id>`
- new work joins the plan → `--add="<title>" --phase=<n>`

If nothing changed, do not run it. A re-render with no change is a wasted publish.

## HOW — step 1, the Bash call

```bash
node scripts/progress-board.mjs                          # re-render from live state
node scripts/progress-board.mjs --start=<id>
node scripts/progress-board.mjs --done=<id>
node scripts/progress-board.mjs --block=<id> --why="waiting on the #2832 gate fix"
node scripts/progress-board.mjs --note=<id> --text="rebased onto main"      # empty --text clears it
node scripts/progress-board.mjs --add="Ship the drain rewrite" --phase=2
node scripts/progress-board.mjs --decide=2978
```

Every verb re-renders the page and prints **one line**: what changed, where the page was written, the
counts, whether PR state is stale, and **the stored artifact URL**. That line is your whole read of the
result — nothing else needs opening. Verbs are idempotent; running one twice is safe.

The page is always written to the same fixed path: **`we:reports/progress-board.html`**.

## HOW — step 2, the Artifact call

> ### ⚠️ THE URL-STABILITY RULE — READ THIS BEFORE EVERY PUBLISH
>
> Re-publishing the same `file_path` keeps the URL **only inside the conversation that first published
> it**. From **any other session** — a new chat, a subagent, tomorrow — publishing without the stored URL
> **mints a brand-new URL and the operator's bookmark silently dies.**
>
> So: **read `artifactUrl` off the CLI's confirmation line, and pass it as the `url` parameter.** The URL
> lives in `we:reports/progress-board.json` precisely so a session that has never published this page can
> still find it.

```
Artifact(
  file_path: "reports/progress-board.html",
  url: "<the artifactUrl the CLI printed>",     # REQUIRED unless THIS conversation published it already
  title: "Progress board",
  description: "Current plan and where it stands.",
  favicon: "📋"                                  # keep this stable across every redeploy
)
```

Two cases, no third:

| Situation | What you pass |
| --- | --- |
| This same conversation already published the board | `file_path` only — the URL is remembered |
| Any other session (the normal case) | `file_path` **and** `url:` from the state file |
| The CLI printed *no artifact URL stored yet* | Publish with `file_path` only, then **immediately** run `node scripts/progress-board.mjs --url=<the URL the publish returned>` so the next session can find it |

If you cannot find the stored URL, run `Artifact(action: "list")` and match the title — do **not** publish
blind. A minted duplicate URL cannot be undone.

## What lives where

- **`we:scripts/progress-board.mjs`** — owns the page. Derives every pull-request row live
  (`gh pr list`) and reduces each to one status: *awaiting your clear* / *changes requested* / *CI red* /
  *conflicted* / *awaiting review* / *queued to land* / *landed*. Degrades to the last cached snapshot,
  behind a visible stale banner, when `gh` is unavailable — it never crashes the render.
- **`we:reports/progress-board.json`** — the small hand-maintained half: plan items, decisions awaiting the
  operator, and the artifact URL. Written only through the verbs above.
- **`we:reports/progress-board.html`** — generated output at a fixed path. Not tracked in git, never read
  by you, never edited by hand.

## The page's own contract

It is **operated, not read**: *Needs you* first (decisions and human-only reviews), then *In flight*, then
the plan table, then *Landed*. State is carried in form — a severity stripe and a chip — so it reads at a
glance. It is theme-aware and fully self-contained (no external font, script, or image), which is what the
Artifact CSP requires.
