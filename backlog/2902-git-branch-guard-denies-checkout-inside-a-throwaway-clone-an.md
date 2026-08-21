---
bornAs: x9vcybx
kind: story
size: 3
status: open
dateOpened: "2026-08-03"
relatedTo: ["1934", "2897"]
tags: [hook, guard, dx, lane]
scope:
  - we:.claude/hooks/guard-git-branch.mjs
---

# git-branch guard denies checkout inside a throwaway clone and misreports it as a shared checkout

The user-global PreToolUse guard `we:.claude/hooks/guard-git-branch.mjs` denies `git checkout`/`switch`/`branch`/`worktree add` with no cwd or `-C` awareness, so it fires inside a fresh throwaway clone and still says "disabled in these shared checkouts" — false there. #1934 shipped only the push carve-out, on the premise "Clones (own HEAD) need no branch/worktree carve-out"; that premise is wrong. It blocks the very remedy the #2336 review mandate prescribes. Workarounds exist (`clone -b`, `git archive`), so cost is low — but a fail-closed guard with a misleading message trains callers off the sanctioned path, the #2897 pattern.

## Observed

Reviewing PR #1011 (2026-08-03). The review mandate itself instructs: *"If you genuinely must run the
code (tests, a repro), do it in a throwaway `git clone` under a temp dir, never here."* Following that
instruction verbatim was denied:

```
git -C <scratchpad-clone> checkout -q FETCH_HEAD
→ Blocked: single-branch (main) workflow — creating or switching git branches is disabled in
  these shared checkouts.
```

The target was a clone under the session scratchpad with its own HEAD — not a shared checkout, and
moving its HEAD could not derail any other session. Fallbacks used instead: `git archive <ref> | tar -x`
for read-only trees, and `git clone -b <branch>` for a writable one.

## Why it is worth fixing despite cheap workarounds

The guard is **correct in intent** and must keep denying branch/checkout ops in the primary and lane
checkouts — this is not a request to weaken it. Two narrower problems:

1. **It contradicts a sanctioned instruction.** `we:scripts/lib/review-core.mjs`'s mandate text tells
   every review subagent to use a throwaway clone for test runs. An agent that follows the mandate hits
   a hard deny, and the guard's message offers no correct alternative — it suggests committing on the
   current branch, which is wrong advice for a throwaway clone.
2. **The message asserts something false.** "these shared checkouts" is printed regardless of target.
   A reader who trusts it concludes the clone *is* shared. #2897 documents the same failure class for
   `we:scripts/review-set-label.mjs`'s `--body-file` allowlist: a fail-closed guard that blocks the
   sanctioned path pressures callers into routing around the module.

## Required behaviour

The carve-out is an **allowlist that stays fail-closed**, never a denylist keyed on cwd. Keyed the other
way it ships a bypassable guard: any target the hook cannot resolve would fall into "outside the known
checkouts" and be allowed, while git actually moves HEAD inside a lane. So:

- **Allow only on positive proof.** A `git checkout`/`switch` is allowed only when the hook resolves the
  command's target repository root AND that root lies outside the known primary + lane checkouts. A
  target it cannot resolve unambiguously is **denied**, exactly as today.
- **Resolve the target from every mechanism that can select it**, not just the process cwd:
  - `-C <dir>` (repeatable, each relative to the previous);
  - `--git-dir=<d>` / `--work-tree=<d>` and their space-separated forms;
  - `GIT_DIR` / `GIT_WORK_TREE`, both from the tool call's environment and from a `VAR=… git …` prefix
    on the command line;
  - a compound command that moves first — `cd <lane> && git checkout …`, and the `;` / `|` / subshell
    variants — since the Bash tool runs the whole string, not one argv.
  Anything the parser cannot reduce to ONE unambiguous repo root (two `git` invocations in the string, a
  shell construct it does not model, a path it cannot stat) is denied.
- Compare **resolved real paths** by containment — `realpath` both sides first (the macOS `/tmp` →
  `/private/tmp` case) — and treat a lane checkout nested inside the primary as inside, in the (unusual)
  case where one is. See the Design note below: in this constellation lanes are NOT nested under a primary.
- The message names the **actual resolved target** and, when it denies, states the correct alternative
  (a throwaway clone) rather than "commit on the current branch".
- `branch`/`worktree add` denials inside the known checkouts stay untouched; the push carve-out from
  #1934 is unchanged.
- PreToolUse JSON payload cases pin **both directions and every vector above** — the hook lives under
  `~/.claude/`, outside this repo, so no repo gate covers it and the cases are the only oracle (#1934).
  At minimum, with the process cwd set to a scratchpad clone, each of these still **denies**:
  `git -C <lane> checkout -b x`; `git --git-dir=<lane>/.git --work-tree=<lane> checkout -b x`;
  `GIT_DIR=<lane>/.git git checkout -b x` (env form and inline-prefix form); `cd <lane> && git checkout
  -b x`. And these **allow**: a checkout with cwd inside the scratchpad clone, and
  `git -C <scratchpad> checkout -q FETCH_HEAD` from anywhere. Plus one unparseable compound command that
  must deny.

## Design

**Where the file is.** `we:.claude/hooks/guard-git-branch.mjs` is the #1934 convention for a
**home-relative** path (`~/.claude/hooks/…`); it is a user-global PreToolUse(Bash) hook and is NOT present
in this repo. Do not spend a search on it — `git grep` finds only the references. The `scope:` entry above
follows the same convention.

**The hook contract, and the trap in verifying it.** A PreToolUse hook reads the tool-call JSON on **stdin**
and signals a deny by writing one JSON document to **stdout**:
`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"…"}}`
— and it **exits 0 either way**. This is provable in-repo from `we:scripts/guard-bash.mjs`, the sibling
guard on the same matcher. So a case runner that asserts on exit status will report every case as passing.
Assert on the stdout document. Note too that stdout must stay ONE JSON document per invocation
(`we:scripts/guard-bash.mjs` carries a review fix for exactly that), so a deny and any advisory message
cannot both be emitted there.

**The sanctioned instruction this contradicts is real and citable.** `we:scripts/lib/review-core.mjs` builds
the review mandate with the literal line *"you genuinely must run the code (tests, a repro), do it in a
throwaway `git clone` under a temp dir, never here."* — that is the instruction the deny blocks, and the
message the deny prints must not send the reader back to "commit on the current branch".

**Why the case table must be committed, not run once.** #1934 shipped the push carve-out and verified it
with 16 PreToolUse payload cases run from a session scratchpad — its own Progress note records that the
harness was ephemeral and "the hook lives under `~/.claude/`, which has no repo-side test surface". That is
how the wrong premise ("clones need no branch carve-out") survived: nothing re-ran. This item must land the
case table and a runner **next to the hook**, so re-proving it is one command rather than a re-derivation.

**Ordering.** Write the case table FIRST, with today's behaviour recorded — the allow-cases red, the
deny-cases green. That baseline is what makes the criterion below a genuine fails-before, and it also pins
the deny-side so the parser rewrite cannot quietly widen the hole while making the allow-cases pass.

**Lanes are not nested inside primaries here, so containment is two independent tests, not one.** The
sibling guard's `isPrimaryCwd` (`we:scripts/guard-bash.mjs`) short-circuits on `'/.lanes/'` appearing
anywhere in the path and returns `false` — lanes live under a sibling `.lanes/<repo>/lane-N` root, treated
as a separate zone from any primary. So "inside a known checkout" means "under the primary root OR under a
lanes root", checked independently; the nesting clause above is defensive, not the normal shape. Reuse
`isPrimaryCwd`'s notion rather than inventing a third one. (Raised by the independent review below.)

**The parser is the risk, not the policy.** Every vector in *Required behaviour* above (`-C` repeated,
`--git-dir`/`--work-tree` in both `=` and space forms, `GIT_DIR`/`GIT_WORK_TREE` from the environment and
from an inline `VAR=… git …` prefix, and a `cd <lane> && git …` compound) is a way to select a repo other
than the process cwd. Anything the parser cannot reduce to ONE unambiguous root — two `git` invocations in
the string, an unmodelled shell construct, an unstattable path — is denied. `we:scripts/guard-bash.mjs`
already solves the neighbouring problem (`canonicalGitOp` normalizing wrapper/path/global-flag disguises,
and a quote-aware segment splitter added by #1934 for this same hook); read those before writing a third
parser.

## Done when

- The committed case table runs as one command and is green. It fails before this item (the throwaway-clone
  allow-cases deny today) and passes after:

  ```
  node ~/.claude/hooks/guard-git-branch.cases.mjs
  ```

  The runner asserts on the hook's **stdout deny document**, never on exit status — the hook exits 0 on
  both paths.
- The table covers both directions and every selection vector in *Required behaviour*: with the process cwd
  in a scratchpad clone, the five lane-targeting forms still **deny**, the two throwaway-clone forms
  **allow**, and one unparseable compound command **denies**. No vector is represented by zero cases.
- A denial message names the **resolved target path** it decided on, and does not contain the string
  "these shared checkouts" when the target is not one, nor advise committing on the current branch.
- The #1934 push carve-out and the in-checkout `branch` / `worktree add` denials are unchanged — their
  existing cases stay in the table and stay green without edits.
- The case table lives beside the hook and is committed, not run from a scratchpad — a later change can
  re-prove the boundary with the one command above.

## Not in scope

Re-litigating the single-branch model itself (#1933/#1985/#2123 cover where work happens). This item
only makes the existing guard's boundary match its own stated rationale.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — The claim that #1934's premise ("Clones (own HEAD) need no branch/worktree carve-out") is wrong is verified against we:backlog/1934-slice-1-git-branch-guard-carve-out-allow-push-to-lane-and-ba.md, which contains that exact sentence, plus a real Observed incident (the 2026-08-03 denial transcript) rather than a hypothetical. The card additionally requires the case table's baseline be captured RED-before/GREEN-after (the 'Ordering' section), which is itself the mutation/reversion discipline the taxonomy asks for, applied to the policy since the hook file cannot be reverted in-repo.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The design deliberately keeps the fix an allowlist ('allow only on positive proof... denied, exactly as today' on any unresolved target) rather than a denylist keyed on cwd, and reasons through the exact inversion bug a denylist would create — this is the blast-radius containment strategy applied at design time, not deferred to review.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — `we:skills-src/context-sweep/SKILL.md` and we:scripts/lib/nnn-collision-heal.mjs / we:scripts/lib/rebase-drop-manifest.mjs all reference guard-git-branch's rule, but none depend on the throwaway-clone-denial behavior being fixed (the two lib comments avoid checkout entirely, and that skill's table entry stays accurate at its one-line grain since primary/lane denials are explicitly left untouched).
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — 'Done when' requires the committed case table to redden on today's behaviour (throwaway-clone allow-cases denied) before the fix and go green after, with assertions on the hook's stdout deny document rather than exit status — confirmed exit-0-always and stdout-deny-document behavior is real and provable in-repo at we:scripts/guard-bash.mjs:1696-1701, the sibling guard the card cites as the oracle for this contract.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's own goal is exactly this risk (a fail-closed guard printing a misleading message), and 'Required behaviour' explicitly mandates the denial name the resolved target and drop the 'commit on the current branch' advice for a throwaway-clone case; that exact phrase is confirmed as the guard's real current message tail in we:agent-memory-src/single-session-should-use-a-lane.md:20-22 (verified 2026-08-09), so the card is fixing a real, quoted wording defect, not a guessed one.

**Corrections applied by this review:**

- The design note "treat a lane checkout nested inside the primary as inside" describes a directory relationship that does not match this repo's actual convention — lane clones live under a sibling `.lanes/` directory, not nested inside a primary checkout (confirmed at we:scripts/guard-bash.mjs:1101-1115, where `isPrimaryCwd` returns false whenever cwd contains `/.lanes/`, treating lanes and primaries as separate, non-nested zones); this doesn't change the required containment logic (each root is still checked independently), so it's a stray/incorrect parenthetical rather than a defect in the required behaviour.

_Recorded through the declared `review-prep` operation._
