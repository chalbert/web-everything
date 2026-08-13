# The delivery loop, from the driver's seat

`/pr` opens a PR and `/review` performs one. Neither says how to **drive an item from card to merged**, and
the part that is genuinely non-obvious — getting review that is actually independent — is written down
nowhere else. This is that.

## The loop

```
claim → lane → build → mutate → gate → PR → spawn an INDEPENDENT reviewer → verdict → fix → re-spawn → merged
```

Two steps in that chain are the ones people skip, and they are the two that catch things: **mutate** and
**spawn**. Mutation discipline is written up on its own elsewhere; **spawn** is the one documented
nowhere but here, and it is the one whose wrong version looks right.

## Spawning a reviewer that is actually independent

**A subagent is not a second actor.** It inherits the parent's `CLAUDE_CODE_SESSION_ID`, so the repo's
independence check (`we:scripts/lib/review-independence.mjs`) sees the author clearing their own PR.
`review-set-label.mjs` then refuses — though not unconditionally: the refusal needs the PR body's
`authored-by-actor` stamp to match, and `--to=clear-human` is exempt by design (#2895).

**A headless process is.** It mints its own session id whichever way you invoke it
(`judge-spawn.mjs:38` — three spawns carrying the parent's id in their environment each reported a
different one). That, on its own, is what makes it independent.

The three lines below are three SEPARATE properties, and it is worth not fusing them — an earlier
version of this page wrote them as one requirement and was wrong about two:

```bash
# 1. a lane of its OWN — never the driver's, and never the primary checkout.
#    This is tool isolation, not identity: two reviewers editing one tree rebase under each other.
node scripts/lane-pool.mjs acquire --purpose=review-1234 --json

# 2. a derived id. Independence does NOT depend on this — headless is already distinct. What the
#    derivation buys is DETERMINISM: the same seed names the same actor, so a re-review is traceable.
node --input-type=module -e '
  import {deriveSessionId} from "./scripts/lib/judge-spawn.mjs";
  console.log(deriveSessionId("rv-1234-r1"));'

# 3. the mandate on STDIN. `claude -p "text"` works fine — this page previously claimed it errors and
#    that was never tested. stdin is for size: a mandate has no ARG_MAX ceiling there, and argv stays a
#    fixed, assertable flag list (judge-spawn.mjs:60).
cd <that lane> && CLAUDE_CODE_SESSION_ID=<derived> \
  claude -p --session-id <derived> --model opus --permission-mode bypassPermissions < mandate.txt
```

Run it in the background and keep working; the verdict arrives on the PR. Several at once is normal —
see *Parallelism* below.

## Writing the mandate

A generic "review this PR" gets a generic review. Every mandate that found something real had four things:

1. **Setup as separate commands.** `git -C <lane> fetch`, then `reset --hard origin/<branch>`, then `clean`.
   A compound command trips the staleness guard.
2. **What to attack, in priority order** — named, specific, and pointing at the thing most likely to be
   wrong. "Find the sixth hole" produced a sixth hole.
3. **The author's recurring defect.** Telling a reviewer *"this author's pattern is a claim wider than the
   code"* or *"…a statistic computed over one population and applied to another"* turns a general read into
   a targeted hunt. This is the single highest-yield line.
4. **The mutation instruction**: for every guarantee stated in prose, break the guarded line and confirm a
   NAMED test reddens. A test that stays green with the behaviour removed is decorative and is a finding.

Also state the gate (`npm run test:unit -- --shard=1/2` then `2/2`, FOREGROUND — `npm test` is watch mode),
and that the findings body is **mandatory** on a bounce.

## What to do with a verdict

**Run the reviewer's own mutation before believing your fix.** A fix that does not redden the exact mutation
they ran has not fixed it. This has caught fixes-that-fixed-nothing repeatedly.

**Then hunt your own.** Break each behaviour the fix adds. Two of the worst defects found in one week were
tests that passed with the feature deleted — including one written in the same commit that added the rule
against them.

**Watch for the vacuous test.** Assertions inside an `if` that never runs, or a loop over an empty list, pass
silently. So does a bare `return` used as a conditional skip — use `ctx.skip()`, which reports as skipped.

## When to stand down instead of iterating

Three rounds on one defect **class** without convergence is the signal — not three rounds total, which is
often healthy. If each fix moves the defect one level finer rather than removing it, the model is wrong and
another implementation pass will not find it.

Standing down means: restore the previous correct-but-blunt behaviour, record both failed attempts and what
the next attempt needs settled *before* code, and close the PR. Shipping a subtly-wrong version of something
that feeds a decision is worse than shipping nothing. `#3071` is the worked example.

## Parallelism and lane hygiene

Run tracks concurrently only on **disjoint files** — a reviewer driving a file you are editing will rebase
under you. The gate is the bottleneck (roughly 4× slower with three concurrent reviewers), so wall-clock per
track degrades while total throughput improves.

`node scripts/lane-pool.mjs release --lane=N` when done. The pool is finite and an unreleased lane is
invisible to everyone else.

## Recording what only exists in the session

Before a context clear, the cards must hold anything the conversation holds: a ruling on a `decision` item,
why something was stood down, a measurement that justified a choice. PR review history is already durable on
GitHub; the backlog is the tracker. If a fresh session reading the backlog could not continue, something is
missing from it.

## What this page got wrong the first time

Kept deliberately, because the failure mode is the subject. Three claims shipped in the first version;
independent review caught two and the third fell out of testing it:

| claimed | actual |
| --- | --- |
| only a headless process *with its own derived id* is a distinct actor | headless is distinct either way; the derivation buys determinism |
| `claude -p "text"` errors | it does not — never tested. stdin is about size |
| `review-set-label.mjs` refuses it | conditional: needs the `authored-by-actor` stamp, and `clear-human` is exempt |

All three sat in the paragraph explaining why the mechanism is correct, which is where this kind of
error lives. Three genuinely separate properties — headless execution, a reproducible id, and a large
prompt — had been written as one requirement, so a reader dropping any one of them would have drawn the
wrong conclusion about why the remaining two mattered.

The instruction that follows from it: **a claim about a mechanism is worth exactly as much as the
command you ran to check it.** The false one here was the flat assertion, not the subtle one.
