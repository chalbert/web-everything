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
   Then `Artifact(action:"publish", file_path:"/tmp/prototype-tracker.html")`. On a REFRESH (not the
   first publish), pass the artifact's existing `url` so the same page updates in place — find it via
   `Artifact(action:"list")` (title "Prototype Tracker — #3383") rather than minting a new one.
3. Done. Two CLI calls plus one Artifact call — never hand-edit the rendered HTML, and never publish
   a page you wrote yourself (same discipline `we:skills-src/progress-board/SKILL.md` states for its
   own page): the generator is the only thing that may produce this page's markup.

## What this is not

- **Not the "Dispatch Scaling Roadmap"** — that page synthesizes research (provider pricing,
  probation state, a multi-phase strategy) that doesn't live as structured text in the card; it stays
  a separate, hand-maintained artifact with its own URL. This skill's page is a literal, mechanical
  rendering of the card's own frontmatter, "Done when" gate, and session-update history — nothing it
  shows is invented.
- **Not a generic backlog-note tool.** It is scoped to `backlog/3383-*.md` specifically; don't repoint
  it at another card.
