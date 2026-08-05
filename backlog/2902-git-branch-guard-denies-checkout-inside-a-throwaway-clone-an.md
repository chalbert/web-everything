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

## Definition of done

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
  `/private/tmp` case) — and treat a lane checkout nested inside the primary as inside.
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

## Not in scope

Re-litigating the single-branch model itself (#1933/#1985/#2123 cover where work happens). This item
only makes the existing guard's boundary match its own stated rationale.
