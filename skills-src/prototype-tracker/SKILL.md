---
name: prototype-tracker
description: Append a real session-update note to epic #3383's own tracker card (backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md) and refresh its mechanically-generated status Artifact. Use at the end of (or a natural pause in) any session that did real work on the #3383 prototype branch (lane/mechanical-dispatcher), or when the operator asks "update the tracker" / "what's the status of #3383" / "refresh the prototype tracker page". NOT the hand-maintained "Dispatch Scaling Roadmap" artifact (a separate, richer, manually-authored page) — this generates a literal, faithful rendering of the card's own text, the same way decision-docket renders a card's forks. A pre-push git hook (guard-prototype-tracker.mjs) BLOCKS a push to this branch when the tracker has gone stale, so this skill is not optional discovery — it is enforced.
---

# Prototype tracker — keep epic #3383's own card current, mechanically

Epic #3383 tracks itself in its own backlog card, in a chronological log of `## Session update (...)`
entries — that log IS the record of this epic's own machinery, and it has already gone stale
mid-epic more than once (see the card's own "Escalation, 2026-09-04" entries). This skill is the
trigger + the mechanism that stops that recurring, not a rubric to restate — the actual parser,
renderer and CLI live in `we:scripts/lib/prototype-tracker-data.mjs`,
`we:scripts/lib/prototype-tracker-render.mjs` and `we:scripts/prototype-tracker.mjs`. Edit those,
not this file, if the note format or the page's design changes.

## Why this can't just be "remember to run the skill"

Skill discovery alone is not durable — a fresh subagent working mid-task on this branch has no
reason to have read this file unless something forces it to. So there are TWO enforcement layers,
not one:

1. **`SessionStart`** — every session opened on a declared #3383 POC branch
   (`we:scripts/lib/poc-branches.json`) sees a loud reminder printed by
   `we:scripts/guard-prototype-tracker.mjs --session-start`, unconditionally, before the session
   can forget.
2. **`pre-push`** (`.githooks/pre-push`, same file, default mode) — BLOCKS a push to that branch
   when the tracker's latest session-update entry is more than a day stale and this push's own diff
   doesn't touch the tracker file. This is a real deny, not a suggestion — mirrors how
   `we:scripts/guard-lane.mjs` blocks a primary-tree edit instead of trusting convention. Sanctioned
   override (rare): `PROTOTYPE_TRACKER_PUSH_OK=1`.

Running this skill proactively is still the point — the hook is the backstop for when it's skipped,
not the intended everyday path.

## The loop

1. **Append the note.** Write the session's real summary and body (what happened, what's still
   open, what was corrected from an earlier claim — same honesty bar the card's existing ~40 entries
   already hold themselves to), then:
   ```bash
   node scripts/prototype-tracker.mjs append-note \
     --summary="<one-line digest, matches the card's own heading style>" \
     [--qualifier="continued"] \
     --body-file=<path to the note body>
   ```
   (Body may also be piped on stdin instead of `--body-file`.) This is a normal tracked-file edit —
   it happens in a lane clone like any other, and lands via the epic's own doctrine (rule 4: a fix
   or update ON the prototype branch pushes directly, no PR ceremony; a change to `main`-side tooling
   like this skill itself takes the full PR pipeline).
2. **Render + publish the status page.**
   ```bash
   node scripts/prototype-tracker.mjs render --out=/tmp/prototype-tracker.html
   ```
   The default page is COMPACT (about 50 KB, phone-first): NEEDS YOU, the top 15 of the priority list as a
   table (rank, card, band, size; a short title from each card's own H1), counts, then the notes collapsed.
   `--full` prints the old page (every note with its body, about 300 KB). Card numbers are plain text; pass
   `--base-url=<url>` only if the page is published where `/backlog/<n>/` exists. Then
   `Artifact(action:"publish", file_path:"/tmp/prototype-tracker.html")`. On a REFRESH (not the
   first publish), pass the artifact's existing `url` so the same page updates in place; it is recorded in
   `~/workspace/.operations/tracker/artifact.json`, or find it via `Artifact(action:"list")` (title
   "Prototype Tracker — #3383").
3. Done. Two CLI calls plus one Artifact call — never hand-edit the rendered HTML, and never publish
   a page you wrote yourself (same discipline `we:skills-src/progress-board/SKILL.md` states for its
   own page): the generator is the only thing that may produce this page's markup.

## The mechanical refresh — everything up to the publish (`tracker-refresh`)

`node scripts/operations/run.mjs tracker-refresh --apply` does the whole chain except the `Artifact` call, and
prints as its LAST line exactly `publish: needed` or `publish: current`:

1. fetches `origin/main`, runs `priority-sync --apply` (never touches a pinned line; leaves the card edited, not
   committed), then `check-priority --strict` (drift prints under `check-priority DRIFT` and exits 1; the page is
   still rendered);
2. renders the compact page to `~/workspace/.operations/tracker/prototype-tracker.html`;
3. hashes the page with its stamp (branch tip and render time) removed, and compares it with
   `~/workspace/.operations/tracker/artifact.json` (`{ url, id, lastPublishedHash, lastPublishedAt }`);
4. when the page changed, writes the publish worker's brief to `~/workspace/.operations/jobs/tracker-publish-task.md`.

Without `--apply` it is a dry run (prints the plan, writes nothing, no `publish:` line). A failed step exits 1
with no `publish:` line: treat that as "do not dispatch".

**The orchestrator's queue check runs it on each fire.** It dispatches the publish worker only when the last line
is `publish: needed` AND the last publish is at least `PUBLISH_MIN_INTERVAL_MINUTES` (30, in
`we:scripts/operations/tracker-refresh.mjs`) old. The run prints `dispatch: due: <command>` or
`dispatch: wait (…)` on the line above, computed by the same function, so the orchestrator does not redo the
arithmetic:

```bash
node scripts/operations/run.mjs dispatch-task --brief=$HOME/workspace/.operations/jobs/tracker-publish-task.md --session=tracker-publish
```

(add `--base=lane/mechanical-dispatcher` from a prototype-tip clone, as for any `dispatch-task`). The worker reads
the page, checks its NEEDS YOU block against `operator-queue.mjs` and its first rows against the priority list,
publishes (UPDATE the recorded page in place, or create it if none is recorded), then runs
`node scripts/operations/tracker-refresh-state.mjs record --html=<page> --url=<url>`, which rewrites
`artifact.json`. It writes `~/workspace/.operations/jobs/tracker-publish.result.md`. The worker never hand-writes
the state file and never publishes a page it wrote itself.

## Keep the priority order current (whoever touches a #3383 card)

The card's `## Priority order` section is the ONE maintained, ordered list of open work under the epic;
its own rules say how a card is placed, so nobody re-prioritises from memory.

- **Whoever files, resolves, re-scopes or blocks a #3383 card updates that section in the same push:**
  insert a new card by the section's rules, delete a resolved card's line, move a re-scoped or newly
  blocked card by its new band and `blockedBy`. Replace the section in place, never append a dated
  copy, and refresh its `Updated:` line.
- **Let the operation do the mechanical part:** `node scripts/operations/run.mjs priority-sync` is a dry
  run that prints the planned change (lines to drop, cards to add, lines to renumber, cards that a merged
  PR or commit on `origin/main` names but that are still open); add `--apply` to write the section in
  place. It never commits or pushes, and it never resolves a card. A line it adds carries
  `why: (unwritten)`: write that one sentence yourself, and place the line by the section's rules (the
  operation puts a new line at the end of its band). `check-priority` warns while any remains
  (`--strict-why` makes it fail). Fetch `origin/main` first; the operation does not.
- **Check before you push:** `node scripts/prototype-tracker.mjs check-priority --ref=origin/main --strict`
  must pass (a plain run only prints the drift and exits 0).
- **The orchestrator dispatches from the top of band A and never chooses order.** If the list looks
  wrong, an agent re-applies the section's rules (or the operator pins a line); the orchestrator does
  not reorder it.

## What this is not

- **Not the "Dispatch Scaling Roadmap"** — that page synthesizes research (provider pricing,
  probation state, a multi-phase strategy) that doesn't live as structured text in the card; it stays
  a separate, hand-maintained artifact with its own URL. This skill's page is a literal, mechanical
  rendering of the card's own frontmatter, priority list, "Done when" gate, and session-update history —
  nothing it shows is invented.
- **Not a generic backlog-note tool.** It is scoped to `backlog/3383-*.md` specifically; don't repoint
  it at another card.
