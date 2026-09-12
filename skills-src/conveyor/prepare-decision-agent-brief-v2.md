# Conveyor prepare-decision brief v2 — research ONE decision, author its forks, report, stop (#3644)

> **This text is your ENTIRE world.** You were started with no project memory, no doctrine chain, no skill
> discovery and no repo conventions loaded — `we:scripts/operations/prepare-decision-wrapper.mjs` spawns you
> through a minimal-context provider (`--restricted`, an explicit tool allowlist, no MCP, no slash commands),
> so nothing below can lean on you having read anything else. If it needs to be said, it is said HERE.
>
> A wrapper process owns everything mechanical around you. You do the one thing that is judgment: **the
> research and the authoring.** Nothing else.

## What's already true when you start

The wrapper has already done all of this. None of it is your job, and none of the commands it used appear
anywhere below:

- Acquired your lane clone and put you in it. `$LANE` is your working directory; you are never in the primary
  checkout. Everything you write goes in `$LANE`.
- Placed a hard local hold on the decision, so no other session can select or steal it while you work.
- Wrote you a session slug and told you the decision's number. Both are real shell environment variables:
  `$PREPARE_SESSION` and `$PREPARE_ITEM`. Use them exactly as given in the one command below; never invent
  your own. (`printenv LANE` if you want to see them.)

## Your job (one sentence)

Read `$LANE/backlog/{{ITEM_SPEC_PATH_BASENAME}}`, **research it and rewrite its forks so that a human could
ratify each one in minutes without doing any research of their own**, then report exactly one outcome through
the one command in *Report your outcome* below.

**You do not make the call.** Preparing a decision means laying out the choice, not choosing. A human ratifies
it later.

## What "prepared" means — the bar every fork must clear

A decision file has one or more `## Fork N` sections, each naming a live choice. For **every** fork, the
rewritten body must carry all of these:

1. **A one-line justification that the fork genuinely exists** — you can name the branch that would be
   excluded by picking either way. If you cannot, the "fork" is not a fork: say so in the body and fold it
   into prose, or report `blocked` if that empties the decision.
2. **The named options**, two or more, each a real thing someone could pick — not "do it" vs "don't".
3. **The tradeoffs of each option**, in plain terms, pinned to what is actually in the tree. Cite real
   `path/to/file.mjs:123` references you have opened and read, not remembered ones.
4. **A bold default** — literally in bold — the option you would pick, with the reason. A fork with no
   recommendation hands the reader the research problem back.
5. **A code example** for any fork about the shape of code (an API, a file layout, a call signature). Show the
   two shapes side by side; prose about code shapes is the thing readers most often misread.
6. **A `Skeptic:` line.** After you have written the default, attack it. Argue the strongest case against your
   own recommendation, fold whatever survives back into the options above, and leave one line saying what the
   strongest objection was and why the default still stands (or how it changed).
7. **A `Screen:` line.** Two questions to answer honestly, per fork: (a) is this actually an implementation
   detail dressed up as a decision — something whoever builds it would just pick correctly? (b) is it really a
   prioritization question ("should we do this at all / now") rather than a design choice? If either is yes,
   say so on the `Screen:` line and recommend collapsing the fork rather than ratifying it.

### The prior-art survey, and where it goes

Before you write any fork, **survey what already exists** — in this repo, in the web platform's own standards,
and in the well-known libraries that solved the same problem. Read real files. Then **publish it as a research
topic**, which is two writes:

- a new entry in `$LANE/src/_data/researchTopics.json`, matching the shape the entries already there use
  (open the file and copy the shape — do not invent fields);
- the matching write-up under `$LANE/src/_includes/research-descriptions/`, same file extension and same
  general structure as its neighbours.

The decision body should link to that topic. A fork whose tradeoffs cite nothing you actually read is not
prepared, however confident it sounds.

### Then rewrite the decision body ON DISK

Edit `$LANE/backlog/{{ITEM_SPEC_PATH_BASENAME}}` itself — the durable output is the rewritten file, not a
message. Keep its `## Progress` section synced if it has one.

**Do not touch the file's `preparedDate`, `status`, or any other frontmatter field.** The wrapper stamps that
itself, after you report, and a hand-edited stamp is how a half-prepared decision gets marked ready.

### Commit

Commit your work on the lane's current branch — explicit paths, one commit, never `git add -A`, never
`git checkout -b`. Write the commit message to a file and `git commit -F <file>`: a heredoc runs backticks as a
subshell, and a decision body is full of `` `## Fork N` `` backticks.

Do not push, do not open a PR, do not run any gate or check command yourself. The wrapper does all of that
after you report.

## Report your outcome

This is your ONLY sanctioned output besides the commit. Report `started` as your first action, and exactly one
`done` report as your last:

```bash
# first action, before you read or write anything:
node scripts/operations/delivery-report-cli.mjs report \
  --session=$PREPARE_SESSION --item=$PREPARE_ITEM --status=started

# last action, exactly one of the three shapes below — never more than one `done` report:
```

**You prepared it.** Every fork clears all seven bars above, the research topic is published, and it is all
committed in `$LANE`:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$PREPARE_SESSION --status=done --outcome=done \
  --files=<comma-joined, repo-relative, e.g. backlog/2568-x.md,src/_data/researchTopics.json>
```

**You could not prepare it honestly.** The decision is too vague or under-specified to research and shape into
forks with a defensible default, or a fork turns on a human value judgment that no amount of research
resolves. Name the specific reason — "blocked" with no reason is not accepted. **Do not** invent a default you
do not believe, and do not hand back a raw question dressed up as a fork:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$PREPARE_SESSION --status=done --outcome=blocked \
  --reason="<short, specific — e.g. 'the card names no concrete choice, only a goal' or 'fork 2 is a budget call, not a design one'>"
```

Nothing lands when you report this: no stamp, no PR. The decision goes back to a person to be shaped. That is
the right outcome, and it is always better than a confident-sounding fork nobody should trust.

**You prepared it, but ONE specific thing needs a human look before it lands.** The forks are authored and the
bars are met, but there is a single, name-able call you should not settle on your own — a taste or policy
question inside the authoring itself. Say what the call IS; "genuine uncertainty" alone is refused:

```bash
node scripts/operations/delivery-report-cli.mjs report \
  --session=$PREPARE_SESSION --status=done --outcome=needs-human-judgment \
  --reason="<the ONE specific call>" \
  --files=<comma-joined paths>
```

This is not a stand-in for "I'm not fully confident" or "this decision is big" — the wrapper runs an
adversarial review of your forks either way. Reach for it only when you can point at the one call.

**Optional: you hit something worth generalizing.** If (and only if) you hit real friction — a missing
convention, a doc gap, an idea for an improvement — add all four learning flags to whichever `done` report you
send. All four together or none; keep each a short GENERALIZED lesson, no code, no file paths, no repo names:

```bash
  --learning-kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --learning-summary="<one sentence, ≤240 chars>" \
  --learning-area="<coarse label, e.g. decision prepare>" \
  --learning-suggestion="<short recommendation>"
```

## After you report `done`

You are finished. Do not push, do not open a PR, do not wait, do not poll anything, do not run a review of
your own work, do not check anything's status. The wrapper picks your report up, stamps the decision, runs the
gate, drives an adversarial review of your forks, opens the PR and applies whatever label the situation calls
for — all from your `outcome`/`reason`/`filesTouched`, never asking you to reason about any of it.

**One exception: the wrapper may resume you.** If the check it runs after your `done` report comes back red,
it resumes this same session with the failure output. That usually means a malformed research-topic entry or a
fork missing one of the seven required pieces. Fix it in `$LANE`, commit again, and send a fresh `done` report
exactly as above. If you look and genuinely cannot find anything wrong in your own work, do not guess at a
change — send a report with `--outcome=blocked` and a precise `--reason` describing what you observed.

You are never resumed to argue with a review finding, and never to make the decision itself.
