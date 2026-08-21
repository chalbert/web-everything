---
bornAs: xxc7d18
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateStarted: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# the 3224 gate proves a skill names the operation, never that the rewire preserved behaviour

The scan answers one question: does this skill instruct a raw home the operation owns. It cannot answer the question that actually bites — does the operation invocation DO what the raw one did. Every defect this session came from that gap, not from the gate: `verify` dropped the gate flag, `open-pr` dropped sha/requireVerified/dryRun, and PR #1523 rewired a dry-run preview to a different mode than the real call because the operation defaults to `park` where the home defaults to `land`. Each was caught by a human or a juror reading two commands side by side.

## The fork, resolved: BOTH halves, partitioned by a property that is itself checkable

The card asked whether a rewire can be checked mechanically, **or** whether the gate must say plainly what it cannot prove. The answer is both, and the line between them is not a judgment call:

**Mechanizable where the operation SHELLS the home it declares over**, because a pure, exported argv builder already exists there by convention. `we:scripts/operations/verify-io.mjs` says so in its own header — *"The argv for one invocation. PURE, and exported so a test can assert the exact command with no subprocess"* — and `listArgv`/`checksArgv` in `we:scripts/operations/pr-status-io.mjs` and `planOpen` in `we:scripts/operations/open-pr.mjs` follow the same discipline. The argv is reachable without running anything.

**Structurally impossible where it does not shell the home**, and for three different reasons that no gate can paper over:

- `claim` — the home DELEGATES INTO the operation (`claimViaOperation`). The arrow points the other way, so there is no argv to compare; naming the home IS naming the declared layer. It is the scan's negative control for exactly this reason.
- `dispatch-lane` — consumes `planTick`'s `decisions.spawnBuilds` and refuses to re-derive the tick. There is no corresponding home invocation.
- `scaffold`, `suggest-next`, `stage-pr-view` — shell nothing at all.

Of the four entries in `DECLARED_HOMES` today, **two are mechanizable (`verify`, `open-pr`) and two are structurally not (`claim`, `dispatch-lane`)** — so the partition has a real test population on both sides from day one.

## What ships here, and what it does NOT claim

**Ships: call sites are validated against the operation's declared input schema.** The CLI adapter already derives argv and usage from `input`, so the same schema can judge a call site. An unknown or misspelled flag is an **error**; a missing required input is a **warning** (prose legitimately shows abbreviated commands). This catches the failure that is otherwise silent and expensive — every one of the ~26 `scaffold`/`resolve` sites the backfill must rewire needs a flag RENAME (`--workitem`→`--workItem`, `--blocked-by`→`--blockedBy`, `--graduated-to`→`--graduatedTo`, `--codified-to`→`--codifiedTo`, `resolve <NNN>` positional→`--ref=`), and a case mismatch does not fail loudly: it lands a card with no `workItem`, which the readiness loader then mis-tiers.

**Does NOT claim: semantic equivalence with the home.** A well-formed invocation can still be the wrong one — PR #1523's rehearsal was well-formed and previewed the wrong mode. So the gate must SAY so rather than let a green read as "the rewire is safe". Naming the limit is half the deliverable, not a caveat on it.

Full argv-diff-at-rewire-time (compare the removed raw argv against the operation's planned argv in the same commit) is the stronger check for the mechanizable half, and it only ever fires once per site. Worth its own item rather than blocking this one.

## Done when

1. ✅ **Executable** — a skill or doc line invoking `we:scripts/operations/run.mjs <op>` with a flag the operation does not declare is reported as an **error** naming the flag and the operation. Covers the case-mismatch class directly.
2. ✅ **Executable** — a call site omitting an input the operation declares `required: true` is reported as a **warning** (not an error: prose legitimately shows abbreviated commands, and erroring on those trains readers to ignore the gate).
3. ⏭ **Split out** — "an operation that shells its home but exports no pure argv builder is reported". Detecting a *pure argv builder* from source is heuristic (match an exported `*Argv`/`plan*`?), and a heuristic gate over a convention is how false findings start. Filed separately rather than shipped weak.
4. ½ **The gate states its limit in its own finding text**, pinned by a test: *"this gate proves the call is WELL-FORMED, never that it preserves the raw home's behaviour."* The docs half could not be done as written — **the #3224/#3253 gate family is documented in NO `.md` at all**, only in code comments, so there was no section to extend. Filed separately.

## What shipped

`findMalformedOperationCalls` in `we:scripts/lib/skill-operation-wiring.mjs`, wired into `we:scripts/check-standards.mjs` beside the #3224 scan and scanning **`docs/` as well as `skills-src/`** — the older walk is `skills-src/**/*.md` only, and a doc instructing a malformed command is exactly as wrong as a skill doing it.

**Two false positives were caught by running it against the live tree before shipping**, and both were the gate's bug rather than the tree's:

- `we:skills-src/review/SKILL.md`'s three `--resume` lines were reported as missing `--pr`/`--repo`. A resume carries no inputs — they live in the run record. Fixed, and unknown flags are still judged on a resume line, because a typo is a typo either way.
- `we:skills-src/next-backlog-item/SKILL.md` wraps a `scaffold` call so `--title` lands on the next line; a single-line read called it missing. Fixed structurally: a line consisting only of flags continues the command, anything else ends it.

A gate whose first live run cries wolf twice is a gate that gets switched off, so both are pinned as regression tests.

## Evidence

37 wiring tests green (26 → 37); 7633 tests across 242 files; `check:standards` 0 errors, and the 7 spurious warnings gone. Three mutants killed: the `--resume` carve-out, the control-flag allowance, and the continuation absorber.
