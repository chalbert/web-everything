---
bornAs: xrnzdxw
kind: decision
parent: "2612"
status: open
relatedReport: reports/2026-07-28-main-session-build-guard.md
dateOpened: "2026-07-28"
preparedDate: "2026-07-28"
relatedTo: ["2123", "2302", "883", "2677", "2607"]
tags: [conveyor, main-session, enforcement, hook, pretooluse, guard, decision]
---

# Enforce main-session-never-builds: a PreToolUse build-guard gate

**The call, in one line:** the conveyor's main/primary session is judgment + operator conversation +
delegation **only** — it should never build. Enforce the **script-decidable** half with a hard
`PreToolUse(Bash)` backstop that extends [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) to deny a
**primary-tree-writing build** (closing the real gap [we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs)
misses — it only sees the Edit/Write *tools*, not a `node` script that writes the tree via `fs`); handle the
**judgment** half (the wide "you're doing mechanical work, delegate it" surface) with **enforcement-by-absence**
(#2677) plus a **warn-level nudge**. Full grounding + the skeptic/screen record:
**[we:reports/2026-07-28-main-session-build-guard.md](../reports/2026-07-28-main-session-build-guard.md)**.

> **PREPARED, NOT RULED (2026-07-28).** Three forks, each with a bold recommended default, a run skeptic, and a
> fresh-context screen. `/next decision` ratifies or overrides. Enforcement is **settled** (relying on model
> discipline has failed repeatedly); the enforcement **mechanism** is what's decided. **Prep reshaped the
> naive framing:** a code-grounded skeptic pass proved the original "a `PreToolUse` hook keyed on primary cwd
> exempts subagents and gates only the main session" is **broken** — the harness resets reported Bash cwd to
> primary between tool calls ([we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) #2335), so `isPrimaryCwd`
> cannot tell the main session from a delivery subagent (whose bare `npm run check:standards` reports primary
> cwd too). The forks below are the corrected shape.

## The problem

The main session's job in the conveyor is judgment, operator conversation, and delegation: decide readiness,
review escalations, ratify forks, dispatch one background agent per launch entry. It is **not** supposed to
build — that is what the per-lane delivery agents are for. But the enforcement we have stops the wrong thing:
[we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) (#2123/#2302) denies *edits* to the primary checkout
via the Edit/Write tools, and [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) denies a direct `main`
push + primary-cwd backlog mutations. Neither closes the *build-in-the-main-session* hole: the session can
still run generator/analysis scripts, write files via `fs` from a `node` script (invisible to the
Edit/Write-tool guard), drive multi-step bash, and generate artifacts. It shows up as recurring operator
frustration ("I see a lot happening in the main session"; "you should have delegated"; "how do we *enforce*
the main session to stop building"). The ask is a **deterministic** mechanism, because model discipline has
failed more than once.

## What is — and isn't — script-decidable (the hookable-vs-judgment split)

The prep's central correction. Two different predicates hide inside "the main session must not build":

- **"Does this command write the PRIMARY TREE?" — script-decidable.** A build-emitting `node` script that
  `fs`-writes the primary checkout, an `npm run build` at primary cwd, a redirection into a primary path — all
  detectable at the seam, exactly like [we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs)'s realpath test.
  This half *does* belong in a hook (MEMORY #51). It is not really "who is the session?" — it is "protect the
  primary tree," and **nothing** (main session *or* subagent) may write the primary tree; both build in a lane.
- **"Is this the MAIN SESSION doing mechanical work it should have delegated?" — NOT script-decidable.** The
  skeptic proved there is **no reliable ambient discriminator** between the main session and a delivery
  subagent: reported cwd resets to primary between calls (#2335 above), a spawned subagent inherits the
  parent's session id verbatim, and shell env doesn't survive an agent's separate Bash calls
  ([we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) — the #2413 wall). A minted-slug
  assertion proves lane-ownership, never "I am not the main session" (the main session can assert it too). And
  the legit main-session surface is **wide and open-ended** (operator conversation + `conveyor-state` /
  `dispatch-plan` / `tick-core` / queue-verb reads, `gh pr view`, `git log`, `jq`, globbing `backlog/*`…). So
  this half is **judgment**, which per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
  (#2607) stays in context — enforced structurally (absence) and nudged (warn), not hard-gated by a predicate
  that can't be computed.

## Fork 1 — how is "the main session never builds" enforced?

**Fork exists:** the genuine either/or is **a hard deterministic gate at the tool-call seam** vs **no hard
gate — rely on structural absence / advisory only**. The excluded/broken branch is *no hard gate at all*: it
leaves the one script-decidable, tree-corrupting hole (a `node` `fs`-write to primary that
[we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) never sees) open, which is a real correctness gap, not
a tolerable one. (Approaches (a) and (b) are **complementary layers**, not a mutually-exclusive pick — the
fresh-context screen caught this — so the fork is gate-vs-no-gate, not a-vs-b.)

- **(a) A `PreToolUse(Bash)` backstop in [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) — DEFAULT
  (for the script-decidable half).** A new deny segment in the guard's pure `reason()`, beside the #2302
  primary-cwd rule it mirrors: deny a **primary-tree-writing build** at primary cwd, steering to a lane
  (cd-chained, the idiom `resolveEffectiveCwd` already recovers). It closes the real gap guard-lane misses
  (script `fs`-writes, not just the Edit/Write tools). **It keys on "writes the primary tree," NOT on "is the
  main session"** — so it is sound regardless of the cwd-reset problem: a delivery subagent that must build
  does so *in its lane* just the same, and its lane-scoped verify (`check:standards`) writes no primary tree,
  so it is untouched.
- **(b) Enforcement-by-absence — the PRIMARY lever for the judgment half.** Relocate the status-board
  generator, reap/scan scripts, and conveyor tooling into the headless runner / a subagent (#2677/#2701), so
  the main session has less local to run. This is the load-bearing lever for the un-script-decidable
  behavioral surface, and it composes *alongside* (a). Absence is not a guarantee (a session can still write
  an ad-hoc one-off `node` script), which is why (a) backstops the tree and (c)/warn nudges the rest — but it
  is the main structural reducer.
- **(c) Advisory-only, no hard gate at all — REJECTED as the *whole* answer.** Leaving even the tree-write
  hole to a reminder is the discipline that already failed. (Advisory has a legitimate *residual* role for the
  judgment half — that is Fork 3's warn layer — but it cannot be the enforcement of the script-decidable
  tree-write invariant.)

**Illustrative shape** — the backstop slots into the existing pure `reason()`, keyed on the *tree-write*, not
on session identity:

```js
// guard-bash.mjs reason(): deny a PRIMARY-TREE-WRITING build at primary cwd (closes the fs-write gap
// guard-lane misses — it only polices the Edit/Write tools). Keys on the WRITE, never on "is main session"
// (the harness resets reported cwd to primary between calls (#2335), so cwd can't identify the session).
if (ctx.primaryCwd && isTreeWritingBuild(s)) {               // build entry points + fs-write/redirect to a primary path
  if (/\bMAIN_SESSION_BUILD_OK=1\b/.test(s)) return null;    // loud sanctioned escape (Fork 3)
  return 'primary-tree BUILD blocked — no build may write the shared PRIMARY tree (#primary-read-only-lanes-only). ' +
    'Run it in a lane clone (cd-chained, the idiom this guard resolves), or delegate it to a lane subagent. ' +
    'Sanctioned one-off? prefix MAIN_SESSION_BUILD_OK=1.';
}
```

**Recommended default: (a) the hard tree-write backstop for the script-decidable half + (b) absence as the
primary lever for the judgment half; (c)-as-the-whole-answer rejected.** Only a gate closes the deterministic
tree-corrupting hole; only absence + a nudge can address the wide, non-script-decidable behavioral surface —
the two are complementary, and neither alone is the answer.

- **Skeptic:** SURVIVES-WITH-AMENDMENT. The attack **REFUTED the original default** (a cwd-keyed *whitelist*
  that claimed to identify the main session and exempt subagents) with decisive code: reported cwd resets to
  primary between tool calls ([we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) #2335), and the delivery
  brief's bare `npm run check:standards` therefore reports primary cwd — a session-identity gate would wedge
  the conveyor's own delegated builds. **Folded:** the gate is re-keyed onto the *script-decidable*
  **primary-tree-write** invariant (sound regardless of session identity), the un-decidable
  "is-it-the-main-session" half is moved to absence + warn, and the whitelist is dropped (see Fork 2).
  Classification: this is not a config dimension and not support-both between (a)/(b) (they are layers over two
  *different* predicates); it is a genuine gate-vs-no-gate call on the tree-write half. Statute-overlap
  reconciled below (fold under an existing anchor, do not mint a colliding one).
- **Screen:** flagged(prio) → **fixed**. Fresh context correctly saw (a)-vs-(b) as complementary layers, not a
  merit either/or. Folded: Fork 1 reframed to gate-vs-no-gate on the tree-write half, (b) stated as the
  co-existing behavioral lever, advisory's residual role moved to Fork 3. Not an impl detail across the WE↔FUI
  boundary — internal agent-harness tooling, correctly filed as a harness decision.

## Fork 2 — command classification: blacklist vs whitelist

*Only bites if Fork 1 → (a).* **Fork exists:** the guard's classification posture is a single choice — a
deny-by-default whitelist of a safe surface, or an allow-by-default blacklist of banned patterns; it cannot be
both. The excluded/broken branch here is the **whitelist**, for two grounded reasons: (1) it can only work if
it can *identify the main session* to know whose surface to whitelist — the exact predicate the skeptic proved
uncomputable; and (2) the legit main/operator surface is **wide and open-ended**, so a deny-by-default
whitelist over it either false-denies constantly or is drawn so broad it enforces nothing.

- **(a) Blacklist / allow-by-default — DEFAULT.** Deny an enumerable set of **primary-tree-writing build
  invocations** (build entry points, `fs`-writing script patterns, redirections/`tee`/`sed -i` into a primary
  path — the guard *already* blocks the last of these for `backlog|reports`). Allow everything else. This is
  **architecturally consistent** — [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) is *already* a
  banned-command table (a blacklist), so this is a 4th arm on it, not a new deny-by-default section bolted on.
- **(b) Whitelist / deny-by-default — EXCLUDED.** Depends on identifying the main session (uncomputable) and
  strangles the wide operator surface.

**Recommended default: (a) blacklist.** The "blacklist leaks on a novel build" objection is *acceptable here*
precisely because the hard floor this backstop protects is the **primary-tree-write** — an enumerable,
tree-corrupting surface — not the open-ended "any mechanical work" surface (which is the judgment half,
handled by absence + warn, not by this classifier). A leak on a novel *read* or a novel non-tree-writing
command is a non-event; a novel tree-write is the enumerable set the blacklist targets.

```js
// A small blacklist of primary-tree-MUTATING invocations — allow-by-default outside it (guard-bash is
// already a banned-command table; this is a 4th arm). Extends the existing append-redirect rule beyond backlog|reports.
const isTreeWritingBuild = (s) =>
  /\bnpm\s+run\s+build\b/.test(s) ||
  /\b(?:>>?|tee(?:\s+-a)?|sed\s+-i|perl\s+-\S*pi)\b.*\/(?:src|scripts|docs|dist)\//.test(s) ||
  (/\bnode\s+\S+\.mjs\b/.test(s) && /--(?:emit|write|out(?:put|dir)?)\b/.test(s));  // fs-writing build scripts
```

- **Skeptic:** REFUTED (default flipped whitelist → blacklist). Attack: "a whitelist can't identify whose
  surface to allow, and it strangles the wide operator surface; guard-bash is already a blacklist." Conceded
  and folded — the default is now a blacklist of tree-writing invocations, consistent with the guard's
  existing architecture; the leak objection is answered by scoping the blacklist to the enumerable tree-write
  surface, not to "any build."
- **Screen:** clear. Internal Bash-classification policy inside the guard — invisible to any consumer. Real
  merit gap survives free-build/instant-maintain: whitelist vs blacklist give different *completeness
  guarantees* over their target surface (a correctness property), not sequencing.

## Fork 3 — hard-deny vs warn (split by layer)

*Only bites if Fork 1 → (a).* **Fork exists:** for a *given* action, the guard either hard-denies (guarantees
the invariant) or warns (requests it) — the two cannot both be the response. The resolution is that the two
**halves** take different answers, because they sit on different predicates:

- **(a) Hard-deny — DEFAULT for the primary-tree-write backstop.** That is a genuine, script-decidable
  invariant (same class as [we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs)'s hard edit-deny), so it
  fails **hard** at the seam (deny JSON / exit 2), with the loud `MAIN_SESSION_BUILD_OK=1` escape mirroring the
  guard's existing `LANE_GUARD_OFF` / `MAIN_PUSH_OK` / `LANE_CLOBBER_OK` convention.
- **(b) Warn — DEFAULT for the residual behavioral norm.** "You're the main session doing mechanical work you
  should have delegated" is **not** script-decidable (no session discriminator; wide surface), so a hard-deny
  there would (1) false-wedge the operator on the open-ended surface and (2) **kill a delivery subagent** whose
  bare build reports primary cwd — the subagent doesn't know it was wrongly blocked, it just dies. A **warn**
  ("this looks like mechanical work — consider delegating") is the correct altitude, because the deterministic
  floor is already held by (a) + absence, not by this nudge.

**Recommended default: hard-deny the tree-write backstop, warn the behavioral norm.** The single "hard vs
warn" question resolves by *which predicate* the action trips: a script-decidable tree-write → hard; the
un-decidable "should-have-delegated" → warn. This is not a fudge — it is the hookable-vs-judgment line drawn
through the guard itself. (The "warn == the failed status quo" instinct is a **false transplant**: the status
quo failed for *edits*, which had **zero** enforcement; here the hard floor exists via (a) + `#primary-read-only`,
so warn is a nudge on top of a real floor, not the only line of defence.)

```js
// (a) tree-write half: participate in the deny path — guaranteed.        return denyReason;
// (b) behavioral half: nudge only, never wedge/kill a subagent.          process.stderr.write(nudge); return null;
```

- **Skeptic:** SURVIVES-WITH-AMENDMENT. Attack: "warn == advisory == the failed status quo; and a hard-deny's
  own escape env is settable by the main session, so it self-defeats while still killing the delivery
  subagent." Folded — hard-deny is retained **only** for the script-decidable tree-write invariant (where it
  cannot false-fire on a subagent's non-tree-writing verify), and warn is adopted for the residual behavioral
  norm exactly because a hard-deny there would kill delegated builds and self-defeat via its own escape.
- **Screen:** clear. Internal seam-enforcement behavior; nothing crosses the boundary. Real merit gap:
  hard-deny guarantees the tree-write invariant; warn only requests the behavioral one — and the split is
  itself the merit answer (guarantee where computable, nudge where not).

## Statute reconciliation & codification (for the ratifying turn)

Do **not** mint a new colliding anchor. The ruling folds under existing statute, reconciled by citation:

- **[we:docs/agent/platform-decisions.md#primary-read-only-lanes-only](../docs/agent/platform-decisions.md#primary-read-only-lanes-only)**
  already enumerates the guard arms (guard-lane / guard-bash / pre-push). The tree-write backstop is a **4th
  arm on that list** — "no build writes the primary tree" — not a new rule. `codifiedIn` should point here.
- **[we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)**
  (#2607) supplies the **motive** for the judgment half (main delegates builds; judgment stays in context) and
  authorizes the absence + warn treatment — cited for motive, not as authority over the hook mechanism.
- **Citation-scope correction:** #51 hookable-vs-judgment reaches **only** the script-decidable tree-write
  half (a realpath/pattern test on explicit command content, a signal that doesn't reset) — the same footing
  as guard-lane. It does **not** reach "am I the main session," whose discriminator resets every call; that
  half is judgment, so #883/#2607 authorize *absence + warn* there, not a hard hook.

## Fork glance-table

| Fork | Question | Recommended default | Main excluded branch |
| --- | --- | --- | --- |
| 1 | How is "main never builds" enforced? | **(a)** hard tree-write backstop (script-decidable half) **+ (b)** absence (judgment half) | no hard gate at all (leaves the fs-write-to-primary hole open) |
| 2 | Command classification | **(a)** blacklist of tree-writing invocations (consistent w/ guard-bash) | whitelist (can't ID the session; strangles the wide surface) |
| 3 | Hard-deny vs warn | **split:** hard-deny the tree-write; warn the behavioral norm | uniform hard-deny (kills delegated builds; self-defeating escape) |

### Review jury (provisional — pre-registered #2638)

_Care band: **elevated** (system-machinery — it extends the `PreToolUse` guard layer that polices the agent's
own tool-call seam + the conveyor operator surface; not statute-self, so not `high`). Predicted touch-set:_
`we:scripts/guard-bash.mjs`, `we:scripts/guard-bash.test.mjs`, `we:.claude/settings.json` (already wired — no
change expected). _The single buildable child (add the tree-write backstop segment + blacklist + tests) takes
`we:scripts/guard-bash.mjs` as its `scope:`._

- **correctness / safety (mandatory):** does the backstop key on the **primary-tree-write** (never on a
  session-identity / cwd discriminator that resets to primary), so it cannot wedge a delivery subagent's
  lane-scoped verify?
- **guard-robustness:** is the blacklist pure + unit-tested in `we:scripts/guard-bash.test.mjs`, consistent
  with the existing banned-command table, and does the loud escape env work as the sanctioned one-off hatch?
- **fail-open discipline:** does a guard fault fail **open** (never wedge the agent), matching the existing
  guards' documented degraded mode?

## Relationships

- **Parent #2612** — the conveyor skill (interim main-session lane operator); this enforces its "main session
  is the operator seat, not a builder" invariant. **Sibling epic #2677** mechanizes the core and delegates
  per-lane orchestration — approach (b) here *is* that direction, adopted as the primary behavioral lever.
- **relatedTo #2123 / #2302** — the lane guard work ([we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) /
  [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs)) this extends from edit-to-primary (Edit/Write tools)
  to build-writes-to-primary (script `fs`-writes the tool guard misses).
- **relatedTo #883** — the shared-gate write-time hook, the deny-at-the-seam precedent Fork 1 (a) mirrors —
  scoped, per the citation-scope note, to the script-decidable tree-write half.
- **relatedTo #2607** — `#deterministic-core-thin-judgment`, which supplies the motive + authorizes the
  absence + warn treatment of the judgment half.

## Lineage

Prep artifact + full grounding / skeptic-screen record:
[we:reports/2026-07-28-main-session-build-guard.md](../reports/2026-07-28-main-session-build-guard.md). Seam
this sits on: the `PreToolUse(Bash)` guard [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) (already
wired in [we:.claude/settings.json](../.claude/settings.json); reported-cwd reset is #2335 there). Statute
folded under: `#primary-read-only-lanes-only` (4th guard arm) + `#deterministic-core-thin-judgment` (#2607,
motive). Parent #2612 / epic #2677. The call is `/next decision`'s to make.
