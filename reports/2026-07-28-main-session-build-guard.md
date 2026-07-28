# Prepare #2749 — Enforce main-session-never-builds: a PreToolUse build-guard gate

**Date:** 2026-07-28 · **Item:** [#2749](/backlog/2749-enforce-main-session-never-builds-a-pretooluse-build-guard-g/) ·
**Parent:** #2612 (conveyor skill) · **relatedTo:** #2123 / #2302 / #883 / #2677 / #2607

Prep artifact for #2749 — the research + grounding + fork authoring that brings the enforcement call to
Definition of Ready. It does **not** rule; that is `/next decision`'s job.

## Headline — prep reshaped the naive framing

The operator's leaning (and the card's) was a `PreToolUse(Bash)` build-guard keyed on the primary/main
session, exempting delegated build subagents via cwd. **A code-grounded skeptic pass proved that specific
mechanism is broken.** The reshaped, ready-to-ratify call:

- **Split the predicate.** "The main session must not build" hides two different questions. **(1) "Does this
  command write the PRIMARY TREE?" is script-decidable** → a hard `PreToolUse(Bash)` backstop. **(2) "Is this
  the MAIN SESSION doing mechanical work it should have delegated?" is NOT script-decidable** → judgment,
  handled by structural absence + a warn nudge, per `#deterministic-core-thin-judgment` (#2607).
- **The gate keys on the tree-write, never on session identity** — because there is no reliable ambient
  discriminator between the main session and a delivery subagent (below).

## Why the cwd-keyed session gate is broken (the decisive finding)

The card's default assumed a `PreToolUse` hook keyed on `isPrimaryCwd` would gate only the main session and
naturally exempt lane-clone subagents. The code refutes it:

- **`we:scripts/guard-bash.mjs` (#2335 comment):** *"the harness resets the reported Bash cwd to the PRIMARY
  checkout between tool calls."* So `isPrimaryCwd` reports `true` for **any** session's bare Bash call, not
  just the main session's.
- **`resolveEffectiveCwd`** only recovers a lane cwd from a leading `cd <target>` **in the same command
  string**, and it explicitly **skips command-substitution**. The delivery brief (`we:skills-src/conveyor/delivery-agent-brief.md`)
  acquires its lane via a `LANE=$(… lane-pool acquire …) && cd "$LANE"` command-substitution (unresolvable)
  and then runs a **bare `npm run check:standards`** on a separate line — which therefore reports primary cwd.
- **No other ambient signal separates them:** a spawned subagent inherits the parent's session id verbatim,
  shell env doesn't survive an agent's separate Bash calls, and a minted-slug assertion proves *lane
  ownership*, never *"I am not the main session"* (the #2413 wall — the main session can assert a slug too).

Conclusion: a build-guard keyed on "primary cwd ⇒ main session" would **wedge the conveyor's own delegated
builds** (a delivery subagent's `check:standards` reports primary cwd) — the exact opposite of the intent.

## What IS enforceable (the sound gate)

Re-key the gate onto the **primary-tree-write**, which is script-decidable and sound regardless of which
session runs it — *nothing* may write the shared primary tree; both the main session and a subagent build in a
lane. This also closes a **real gap**: `we:scripts/guard-lane.mjs` only polices the Edit/Write *tools*, so a
`node` script that writes the primary tree via `fs` slips past it today. The tree-write backstop catches
exactly that.

## Grounding — the real code this sits on

- **`we:scripts/guard-bash.mjs`** is already the `PreToolUse(Bash)` hook (wired in `we:.claude/settings.json`),
  with a **pure, unit-tested `reason`/`decide` core** (`we:scripts/guard-bash.test.mjs`). It is *already a
  blacklist* — a banned-command table (`build:plugs` w/o `--noEmit`, `pkill` of vite|node, `rm`/`mv` of
  backlog md, append-redirect bypasses of the Edit/Write hook, `git push … main` #2203, primary-cwd backlog
  mutation #2302, foreign-lease destructive git op #2367). The tree-write backstop is a **4th arm** on that
  table, not a new deny-by-default whitelist section.
- **`we:scripts/conveyor/queue.mjs`** documents itself as the legit primary-session operator surface ("runs
  fine from the primary/main checkout … session-local operator intent") — evidence that the main-session
  surface is *allowed-by-default*, which is why a deny-by-default whitelist over it is wrong.
- **`we:scripts/guard-lane.mjs`** (#2123/#2302) + **`we:scripts/lint-locus-prefix.mjs --pre`** (#883) are the
  precedents: the lane guard closes *edit-to-primary* via the tools; the locus-prefix hook is the hard
  deny-at-write-time pattern. The backstop is that pattern extended to *script fs-writes* the tool guard misses.

## The three forks (defaults — full text in the item)

1. **Fork 1 — how is "main never builds" enforced? → (a) hard tree-write backstop (script-decidable half) +
   (b) enforcement-by-absence (judgment half).** Gate-vs-no-gate is the real either/or (the fresh-context
   screen showed (a)/(b) are complementary layers, not a-vs-b). Excluded: no hard gate at all, which leaves
   the `node`-fs-write-to-primary hole open. The gate keys on the **tree-write**, not on session identity.
2. **Fork 2 — command classification → (a) BLACKLIST of tree-writing invocations** (flipped from the card's
   implied whitelist). Excluded: a whitelist, which (1) needs to identify the main session — uncomputable —
   and (2) strangles the wide operator surface; and guard-bash is *already* a blacklist.
3. **Fork 3 — hard-deny vs warn → SPLIT by layer:** hard-deny the tree-write backstop (a genuine invariant),
   warn the residual "you should have delegated" behavioral norm (not script-decidable; a hard-deny there
   would false-wedge the operator and kill a delivery subagent whose bare build reports primary cwd).

## Skeptic + fresh-context screen (both mandatory passes ran)

- **Fork 1 — Skeptic: SURVIVES-WITH-AMENDMENT.** The attack REFUTED the *original* default (cwd-keyed session
  whitelist) with the decisive code above; folded by re-keying onto the tree-write invariant and moving the
  un-decidable half to absence + warn. **Screen: flagged(prio) → fixed** (a/b are layers, not a merit fork).
- **Fork 2 — Skeptic: REFUTED → default flipped whitelist → blacklist.** A whitelist can't identify whose
  surface to allow and strangles the wide operator surface; the leak objection is answered by scoping the
  blacklist to the *enumerable tree-write* surface. **Screen: clear** (completeness guarantee = merit).
- **Fork 3 — Skeptic: SURVIVES-WITH-AMENDMENT.** "warn == the failed status quo" is a false transplant (the
  status quo failed for edits, which had *zero* enforcement; here the hard floor exists via (a) +
  `#primary-read-only`). Hard-deny retained for the tree-write; warn adopted for the behavioral norm. **Screen:
  clear.**

## Statute reconciliation (no new anchor)

- `codifiedIn` folds under **`#primary-read-only-lanes-only`** — the tree-write backstop is a **4th guard arm**
  on its existing guard-lane / guard-bash / pre-push list, not a new colliding rule.
- **`#deterministic-core-thin-judgment`** (#2607) supplies the *motive* for the judgment half (main delegates
  builds) and authorizes the absence + warn treatment — cited for motive, not as authority over the hook.
- **Citation-scope correction:** #51 hookable-vs-judgment reaches only the *script-decidable* tree-write half
  (an explicit-content test that doesn't reset), the same footing as guard-lane; it does **not** reach "am I
  the main session," whose discriminator resets every call.

## What ratifying unblocks

- One buildable child: add the tree-write backstop segment + the blacklist + `we:scripts/guard-bash.test.mjs`
  cases, scoped to `we:scripts/guard-bash.mjs`.
- The #2677/#2701 tooling-relocation direction (approach (b)) proceeds independently as the behavioral lever.
- A codified 4th guard arm under `#primary-read-only-lanes-only`: "no build writes the primary tree; the main
  session delegates mechanical work to a lane subagent (nudged, not hard-gated)."
