---
kind: story
size: 2
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

- The deny is **path-aware**: a `git checkout`/`switch` whose effective cwd (process cwd or an explicit
  `-C <dir>`) resolves **outside** the known primary + lane checkouts is allowed; inside them it is
  denied exactly as today. Resolve symlinks before comparing (the macOS `/tmp` → `/private/tmp` case).
- The deny message names the **actual** target and, when it denies, states the correct alternative
  (a throwaway clone) rather than "commit on the current branch".
- `branch`/`worktree add` denials inside the known checkouts stay untouched; the push carve-out from
  #1934 is unchanged.
- PreToolUse JSON payload cases pin both directions: a checkout inside the primary/lane checkout still
  denies, and one inside a scratchpad clone is allowed. The hook lives under `~/.claude/`, outside this
  repo, so no repo gate covers it — the cases are the only oracle, as #1934 notes.

## Not in scope

Re-litigating the single-branch model itself (#1933/#1985/#2123 cover where work happens). This item
only makes the existing guard's boundary match its own stated rationale.
