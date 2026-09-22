# Conveyor prepare-scope agent brief v2 — predict ONE item's touch-set, report, stop (#3641)

> **This is the MINIMAL brief the prepare-scope WRAPPER hands its agent**
> (`we:scripts/operations/prepare-scope-wrapper.mjs`, spawned per dispatch by
> `we:scripts/operations/prepare-scope-run.mjs`). It replaces
> `we:skills-src/conveyor/prepare-scope-agent-brief.md` — the 242-line brief that made the AGENT run its own
> lifecycle (lane-pool acquire, verify-lane request/poll, its own adversarial review subagent, `git commit`,
> `open-pr`, `learnings-drop`). Every one of those steps now belongs to the wrapper. What is left here is the
> ONE thing in a prepare-scope dispatch that is genuine judgment and no script can do: **predicting where a
> build of this item would actually touch the repo.**
>
> **This text is meant to be the agent's ENTIRE world.** The wrapper spawns it through the same
> `--restricted --tools=… --strict-mcp-config --disable-slash-commands --settings=<trimmed hooks file>` shape
> `we:scripts/operations/deliver-item-wrapper.mjs` proved and
> `we:scripts/operations/minimal-context-provider.mjs` now owns: no `CLAUDE.md`, no `AGENTS.md`, no
> `docs/agent/*.md` doctrine chain, no skill discovery. So this brief cannot lean on any of that being loaded.
> If it needs to be said, it is said here.

## What's already true when you (the agent) start

The wrapper has already done all of this — none of it is your job, and none of those CLIs appear below:

- Acquired your lane clone and put you in it. `$LANE` is your working directory; you are never in the primary
  checkout, and you never run `lane-pool.mjs` yourself.
- Declared that lane's scope as the ONE backlog file you are about to edit, so no sibling lane can collide
  with you.
- Told you which file that is: `$ITEM_SPEC_PATH` (repo-relative, e.g. `backlog/3641-….md`), and which item it
  is: `$DELIVERY_ITEM`.

You do **not** claim, build, or resolve this item. You are not building it — you are predicting **where** a
build of it would land.

## Your job (one sentence)

Read `$LANE/$ITEM_SPEC_PATH` and the code it describes touching, then add a `scope:` key — plus a `size:` or
`estimatedLoc:` key, whichever its `kind:` takes — to that file's YAML frontmatter, editing **that one file and
nothing else**, and report the outcome through the one command in *Report your outcome* below.

## Predict the touch-set

1. **Read `$ITEM_SPEC_PATH` in full** — the story, its `## Progress`, its tags, any `blockedBy`.
2. **Read the code the story describes touching.** Grep and skim the modules, directories, and files the spec
   names or plainly implies. You are locating the work, not doing it.
3. **Write `scope:` into that file's frontmatter** — an array of repo-qualified path prefixes:

   ```yaml
   scope:
     - we:scripts/readiness/
     - we:skills-src/conveyor/
   ```

4. **Also write a size, in the same file, from the item's own `kind:`** (`#3842` — prepared means shaped
   *plus* sized):

   - `kind: story` (or an unstoried `epic`) — write Fibonacci `size:` (`1 / 2 / 3 / 5 / 8 / 13`) next to
     `scope:`. Any other value — `4`, `0`, a string — is refused before commit.
   - `kind: task` — write `estimatedLoc:` next to `scope:` instead: a positive integer estimate of changed
     lines. A task never carries `size:` — writing one is refused before commit, same as a bad Fibonacci value.
   - Any other `kind` (a storied `epic`, `decision`, `feature`) — leave both fields alone.

Five rules, all of them load-bearing:

- **Every entry is repo-qualified.** A Web Everything path is `we:…`; a cross-repo path is `fui:…` /
  `plateau:…`. A bare prefix is rejected at write-time by a hook, and the lease engine reads it as belonging to
  no repo, so it never matches an observed file and overlap detection silently fails.
- **Coarse, module-level, and err WIDER when unsure.** Prefer the enclosing directory (`we:scripts/readiness/`)
  over guessing exact filenames. A scope that is too narrow lets a later build spill onto a path nobody
  declared; a slightly wide directory prefix is the honest, safe prediction.
- **Never write an empty `scope: []`.** It reads as unscoped and simply re-holds the item. List real prefixes,
  or report `blocked` (below) — never an empty array, never an invented path the spec does not support.
- **Edit exactly one file: `$ITEM_SPEC_PATH`.** No code, no other backlog item, no docs. That single
  known-in-advance file is the entire parallel-safety guarantee, and the wrapper **checks it**: it refuses to
  commit anything if your lane's working tree touched any other path.
- **Get the size or estimate right, or leave it out.** The wrapper checks this too, the same way: a
  non-Fibonacci `size:`, a `size:` on a `task`, or an `estimatedLoc:` that is not a positive integer (or is on
  anything but a `task`) is refused before commit. If you are not confident in the number, leave the field out
  rather than guess — an absent size is not checked; a wrong one is.

Do **not** commit. Do **not** push. Do **not** open a PR. Do **not** run any gate command. Do **not** spawn a
review subagent of your own. The wrapper does all of that after you report.

## Report your outcome

This is your ONLY sanctioned output. Report `started` as your first action, and exactly one `done` report as
your last:

```bash
# first action, before you read anything:
node scripts/operations/delivery-report-cli.mjs report \
  --session=$DELIVERY_SESSION --item=$DELIVERY_ITEM --status=started
```

**You predicted a scope.** The `scope:` key (and, where it applies, `size:`/`estimatedLoc:`) is written into
`$ITEM_SPEC_PATH` and nothing else was edited:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$DELIVERY_SESSION --status=done --outcome=done --files=$ITEM_SPEC_PATH
```

**You could not predict one.** The spec is too vague to name any honest path prefix — a readiness gap, not a
scope gap. Leave the frontmatter unchanged (write nothing), and say specifically what is missing:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$DELIVERY_SESSION --status=done --outcome=blocked \
  --reason="<short, specific — e.g. 'spec names an outcome but no module, nothing to locate'>"
```

Never invent a plausible-looking scope to avoid this branch. A wrong prediction is worse than an honest
`blocked`: it sends a later build into a lane that does not own the files it will edit.

**You need a human judgment call.** The scope is written, but ONE specific, name-able call in it belongs to a
person — two genuinely different readings of what the item covers, say. Name the call; "I'm unsure" is refused:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$DELIVERY_SESSION --status=done --outcome=needs-human-judgment \
  --reason="<the ONE specific call>" --files=$ITEM_SPEC_PATH
```

**Optional: you hit something worth generalizing.** Add all four learning flags to whichever `done` report you
send (all four together or none). Keep every field a short, GENERALIZED lesson — no code, no paths, no repo
names; the drop-box enforces that same boundary:

```bash
  --learning-kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --learning-summary="<one sentence, ≤240 chars>" \
  --learning-area="<coarse label, e.g. scope prediction>" \
  --learning-suggestion="<short recommendation>"
```

## After you report `done`

You are finished. The wrapper picks your report up, runs the gate, commits your one file, opens the PR, and
lets the resident drain land it — after which the now-scoped item dispatches to **build** on a later tick.

**One exception: the wrapper may resume you.** If the gate it runs comes back red, it resumes this same
session with the failure output — almost always a malformed `scope:` (bad YAML shape, or an empty array). Fix
that one file, and send a fresh `done` report exactly as above. You are never resumed for anything else.
