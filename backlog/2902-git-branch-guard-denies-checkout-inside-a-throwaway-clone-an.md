---
bornAs: x9vcybx
kind: story
size: 3
status: active
dateOpened: "2026-08-03"
dateStarted: "2026-09-19"
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

## Progress

- **Impl:** `we:.claude/hooks/guard-git-branch.mjs` — user-global PreToolUse(Bash) guard, home-relative
  under the user's own `.claude/hooks/`, outside this repo, so no repo gate covers it, same as #1934.
- **Done:**
  - `checkout`/`switch` now resolve the invocation's target repo root before deciding: fold `-C <dir>`
    (repeatable, left-to-right) over the effective cwd; else an explicit `--git-dir=`/`--work-tree=`
    (cmdline flag → inline `VAR=…` prefix on that invocation → the hook process's own env, in that
    order); else walk up from the effective cwd to the nearest `.git`. The effective cwd itself tracks
    any preceding `cd <dir>` in the same compound command (`;`/`&&`/`||`/`|`/newline/subshell — the Bash
    tool runs the whole string as one shell). Both sides are `realpath`'d before the containment compare
    (the macOS `/tmp` → `/private/tmp` case), against the known primaries (`webeverything`, `web-everything`,
    `frontierui`, `plateau-app`, mirroring `we:scripts/guard-lane.mjs`'s `PRIMARY_REPOS`) and any
    `.lanes/**` clone.
  - Fail-closed on every unresolvable case: a poisoned/unstat-able `cd` target, a `$(…)`/backtick
    construct in a `-C`/`--git-dir`/`--work-tree` value, no `.git` found. Found one live tokenizer gap
    while writing the "deliberately unparseable" case: the original whitespace-only tokenizer shredded a
    quoted, space-containing `-C` value (`-C "$(git -C … rev-parse …)"`) across multiple tokens, which
    let a NESTED `-C`/its value get misread as the OUTER invocation's option — the outer subcommand then
    drifted onto `rev-parse` and the call was silently treated as unrecognized (would have ALLOWED). Fixed
    by giving `gitCall`/the `cd`-tracker a quote-aware tokenizer (mirrors `splitSegments`'s own quote
    tracking) so a quoted span with internal whitespace stays one token.
  - Deny message now names the actual resolved target (or says the target could not be resolved
    unambiguously) and points at a throwaway clone, not "commit on the current branch".
  - `branch`/`worktree add` denials, and the #1934 push carve-out, are byte-for-byte untouched — no
    carve-out logic runs for those subcommands at all.
- **Verify:** 19 PreToolUse-JSON cases piped through the hook via an ephemeral scratchpad harness (the
  hook has no repo-side test surface, per #1934's note) — every Definition-of-done vector (each DENY form:
  `-C`, `--git-dir`/`--work-tree`, `GIT_DIR` inline-prefix, `GIT_DIR` env-form, `cd &&`; each ALLOW form:
  cwd-inside-throwaway, `-C <throwaway>` from an unrelated cwd; the unparseable nested-substitution case)
  plus regression spot-checks (branch/worktree-add still always deny, plain checkout/switch inside a known
  checkout still denies, pathspec restore still allowed, `add -A` hygiene deny, the `lane/*` push
  carve-out, the quoted-arg false-positive fix from #1934) — all 19 pass. Also spot-checked repeatable
  `-C` (fold left-to-right) and malformed stdin (fail-open, unchanged). Repo `check:standards`: 0 errors
  (1823 pre-existing warnings, none touching this change).
- **Notes:** Delivered by codex-2902 → independent-Claude pipeline. Codex's sandbox is scoped to
  `--dir=<lane>` and correctly refused to edit the guard file (outside that root) rather than fake a diff;
  the fix above was written directly by the verifying session, following the #1934 precedent for this
  same hook.
