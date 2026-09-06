---
bornAs: x39axfk
kind: decision
status: open
dateOpened: "2026-08-18"
relatedTo: ["3001", "3405", "3427", "3490", "3491", "3029"]
relatedReport: reports/2026-08-08-agent-command-surface-sizing.md
scope:
  - we:docs/agent/platform-decisions.md
  - we:scripts/guard-bash.mjs
tags: [governance, operations, safety, agent-surface, prompt-injection, lanes]
---

# Should an agent session be restricted to declared operations, with bash denied by default

Most of this card was ratified out from under it on 2026-09-04. `#agent-mutations-through-typed-operations`
(via [#3001](/backlog/3001-should-agents-call-named-operations-instead-of-writing-shell/)) already rules the
split for this very population — reads free, mutations only through typed, fail-closed operations — and
explicitly *considered and rejected* both branches this card's Fork 1 offered beside it. What survives, after
that overlap check, is **one genuine fork** (the missing-operation escape's *channel*, in-band vs out-of-band,
default **out-of-band**), **one validation gate** (the egress half `#3001` left unratified, verdict
**not-yet**), and one dissolved fork. No `## Fork` is written for anything already ruled.

## The axes, and where each one actually stands in the tree

Three orthogonal axes hide under "restrict the session": **(1) what the restriction denies**, **(2) what
happens when nothing covers the work**, and **(3) where the session runs**. Axis 1 is settled statute —
`we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations`, grounded in
`we:reports/2026-08-08-agent-command-surface-sizing.md`, whose corpus is 4,485 **local** transcripts, i.e. the
operator's own interactive sessions and therefore exactly this card's population. Axis 2 is settled *except*
for one sub-question the sibling ruling deliberately left short of this population: `#3405` rejected a
break-glass only because "there is no human in the loop to approve one synchronously for a headless
dispatch" — a reason that does not reach an interactive session where the human *is* present. Axis 3
(VM-per-lane) has a ruled merit relation already ("a sandbox bounds *damage*; the operation catalog bounds
*authority* … both are wanted; neither substitutes"), so it carries no live either/or.

The enforcement surface all three lean on is `we:scripts/guard-bash.mjs` — a **denylist** whose `reason()`
(`we:scripts/guard-bash.mjs:1647`) enumerates known-bad shapes and whose arms each carry an **in-band**
sanctioned override written into the command string itself (`we:scripts/guard-bash.mjs:582`, applied at
`:1666`, `:1695`, `:1738`, `:1851`). Its own header states the threat model outright — "accidental-collision
threat model, **NOT** adversarial evasion … this guard is advisory with a one-env-var escape, so an actor
bent on evasion never needs [disguises]" (`we:scripts/guard-bash.mjs:1334-1341`). That sentence is the whole
gap this card is about.

### Recommended path at a glance

| | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — escape channel | **(b) out-of-band: the disarm predicate leaves the command string** | (a) in-band env-prefix, as every arm ships today | High — the in-band branch has already failed once in-repo (#2339) |
| Validation gate — egress half | **not-yet**, un-gated by a named, concrete trigger | go now | Med — merit is genuinely conditional on the mutation flip landing |
| Axis 1 (what is denied) | *already ratified* — nothing to rule | — | — |
| Axis 3 (VM per lane) | *dissolved* — no fork exists | — | — |

## Already ratified — not decisions on this card

**These are recorded, not re-opened.** A ratified call is immutable; re-ruling it here would put a second,
differently-tested rule on the same turf.

- **What the restriction denies.** `#agent-mutations-through-typed-operations` (ratified 2026-09-04):
  reads and inspection stay free and sandboxed; anything mutating state **outside the agent's own lane
  clone** — primary-checkout writes, `git push`, `gh`, network calls, installs, deploys — goes only through
  a named operation with **strictly typed parameters**, failing **closed**. The card's original Fork 1 (a)
  ("deny `Bash` outright, reads included") is the "full allow-list over everything" that ruling *rejected*;
  its (c) ("keep bash, deny the destructive verbs") is the status-quo denylist that ruling also *rejected*,
  on the structural ground that "an enumeration cannot be completed from inside the thing being enumerated."
  The surviving branch is a sharpening of the card's (b), and it is already law.
- **Whether the gap is adjudicated in-session.** Same anchor, Fork 2: a session **emits** (what it was
  trying to do, what it would have run, what it did instead) into the existing learnings pool and **never
  adjudicates in-session**. That excludes the card's original Fork 2 (b) — "declare and generate a new
  operation in-session, then use it."
- **That a sandbox is not a substitute.** Same anchor: authority-bounding and damage-bounding are separate
  axes and both are wanted.
- **The narrower dispatched-agent population.** `#dispatched-agent-never-runs-commands-directly` (#3405,
  ratified 2026-08-30) — denylist by verb-class, halt-and-surface on a gap. It names this card as the
  distinct interactive-session question and does not settle it.

## Fork 1 — is the missing-operation escape in-band or out-of-band?

**Fork-existence justification (case (b), a genuine either/or):** the excluded branch is proven by a *failed
composition*, not asserted. An out-of-band approval cannot be built as a facade over the in-band kernel,
because the in-band kernel's disarm predicate is a substring of the agent-authored command string
(`hasLeadingEnvEscape(segment, name)`, `we:scripts/guard-bash.mjs:582`): if the in-band token still disarms
the arm, the out-of-band channel is decorative and the arm's real strength is the in-band one. Two disarm
predicates on one arm means the weaker one governs, so they cannot coexist on the same arm.

**The crux.** Under the ratified fail-closed rule, an interactive session *will* meet a mutating command no
operation covers — the catalog is 17 declared operations (`we:scripts/operations/run.mjs:84`) against the
~28-operation, 7-family target `#3490` is still closing. The refusal therefore needs a remedy, and the
remedy's *channel* is the open call. Today every arm answers it the same way: the agent writes an
env-assignment prefix into its own command (`STALE_LANE_OK=1` at `we:scripts/guard-bash.mjs:1666`,
`LANE_CLOBBER_OK=1` at `:1695`, `MAIN_SESSION_BUILD_OK=1` at `:1738`, `WE_MERGE_BREAK_GLASS=1` at `:1851`).
Exactly one arm is built the other way: the primary-checkout backlog-mutation deny is **unconditional** —
"There is no override — #2219 ratified that nothing ever splices to primary (#2339)"
(`we:scripts/guard-bash.mjs:1654`) — and the comment beside it records *why* the escape was removed: "the
former `BACKLOG_MUTATE_OK=1` override was itself the hole (used in error 2026-07-09, defeating this very
guard)" (`we:scripts/guard-bash.mjs:1656-1658`).

**Where the fork turns on the call-site shape.** `reason()` already takes a `ctx` the CLI section builds from
the hook envelope and `process.env` (`we:scripts/guard-bash.mjs:2307`, assembled at `:2326`). The whole fork
is which of its two inputs the escape is read from:

```js
// (a) TODAY — we:scripts/guard-bash.mjs:1738. The disarm predicate reads the AGENT-AUTHORED command text.
if (primaryCwd && !hasLeadingEnvEscape(s, 'MAIN_SESSION_BUILD_OK')) { … }
//                 └─ we:scripts/guard-bash.mjs:582 — matches a `VAR=1 ` prefix INSIDE `segment`.

// (b) The same arm, disarmed only from a channel the command cannot write: the hook's OWN process env,
//     read beside `CLAUDE_CODE_SESSION_ID` in the CLI section and threaded through ctx — never `segment`.
if (primaryCwd && !ctx.operatorEscapes.has('MAIN_SESSION_BUILD_OK')) { … }
```

Each `Bash` call is a fresh shell, so a command cannot `export` into the hook's own environment; moving the
predicate from `segment` to `ctx` genuinely leaves the channel an injected instruction controls.

- **(a) In-band sanctioned override — the escape is an env-assignment prefix the agent writes.** *Merit:*
  the remedy travels with the refusal, so a legitimately-uncovered command is never stranded outside the
  conversation; uniform with every arm the guard ships. *Merit cost:* the disarm predicate lives in the same
  channel a prompt injection controls, so the gate bounds **accidents**, not **authority** — the guard's own
  docs say so (`we:scripts/guard-bash.mjs:1334-1341`), and the property this card exists to buy is the one it
  cannot deliver. Already failed once in this repo, by an agent typing the token, not by malice (#2339).
- **(b) Out-of-band operator approval — the escape is not expressible in the command.** *Merit:* the disarm
  predicate leaves the injected-text channel entirely, so the gate bounds authority; consistent with the one
  arm already built this way (`we:scripts/guard-bash.mjs:1654`); the refusal message can still *name* the
  remedy without the message being the remedy. *Merit cost:* availability — a refusal carries no in-context
  remedy, so every legitimately-uncovered mutating command becomes a human round-trip until the catalog
  closes. (An availability property of the ruled fail-closed design, deliberately not an effort claim.)
  **Recommended default.**
- **(c) No escape at all on any arm.** *Rejected.* It conflates "the agent may not authorize this" with "the
  authority may not authorize this." The operator is the authority the whole design defers to; an absolute
  refusal on their own machine excludes a legitimate end-state rather than a broken one.

**Sub-decision, ruled with the fork:** an out-of-band escape is only as strong as the guard's own source
being outside the agent's unreviewed write reach, and `we:scripts/guard-bash.mjs` is **not** registered in
`TRUST_CHAIN` (`we:scripts/lib/gate-config.mjs:99` — the list holds the review-policy files only). So (b)
carries a named dependency: register the guard in `TRUST_CHAIN` at the tier its new role earns. This is
stated as a dependency of the ruling, not smuggled in as an assumption. (`#3401` covers the *dispatch loop's*
TRUST_CHAIN gap, not this file.)

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacked three ways. *(i) Classification —* "is this a config dimension
(two values of one knob) rather than a fork?" It is not: the two values are not both legitimate end-states
under one threat model, and a dimension whose permissive value silently defeats the restrictive one is a
single broken default, not a knob. *(ii) Statute overlap —* "does `#agent-mutations-through-typed-operations`
already fix the channel?" It does not; it rules the *split* and the *gap-reporting channel*, and its own text
defers the enforcement mechanism ("`we:scripts/guard-bash.mjs` stays a deny-list until its own follow-on
flips it"). `#3405` likewise fixed the doctrine's scope and left the mechanism open. No collision. *(iii)
Merit basis —* under the free-to-build-and-instantly-maintained test a merit difference remains: (a) still
admits an injected disarm and (b) still costs a human round-trip. Neither difference is effort. **Amendment
folded in:** the sub-decision above (TRUST_CHAIN registration) was added after the attack showed (b)'s
guarantee was conditional and unstated.
**Screen (fresh-context, 2026-09-06): clear on both axes.** Re-run by an agent that had not seen the authoring session, because the method assigns the conditional-vs-conceded call to a fresh context and the authoring pass could not screen itself. **Codification caveat it raised:** when this is written into a statute the ruling sentence must be the *observable property* — *the escape is not expressible in the agent-authored command string* — never the `ctx.operatorEscapes` Set shape used to illustrate it, which is mechanism. Original inline reasoning retained below. — *impl-vs-standard*: the escape channel is observable to every caller of the
guarded surface (it changes what a refused command can do next), not an internal detail; *merit-vs-prio*:
see (iii) above. Run inline by the preparing agent, **not** by a fresh-context sub-agent — no sub-agent tool
was available in this session, so treat this line as an un-independent screen and re-run it at the decision
turn.

## Validation gate — bound the interactive session's *egress* half?

### What you're deciding

Whether to commit to a host-scoped egress policy for the reads `#agent-mutations-through-typed-operations`
leaves "free, broad, and **sandboxed**" — and on what trigger. The word *sandboxed* in that anchor names no
mechanism that exists: `we:scripts/guard-bash.mjs` has **no** network arm at all (no `curl`/`wget` rule
anywhere in `reason()`), and `we:.claude/settings.json` blanket-allows `WebFetch` and `WebSearch` with no
host rules and no `deny` key.

### Why this isn't a classic fork (and is still a decision)

There is no rival branch to weigh — nobody proposes a *worse* egress policy. It is a one-sided go/no-go on a
candidate the ratifying anchor itself filed as unfinished: "The `curl`/`net.fetch` host-allow-list question
is an open sub-question, not ratified here — it needs its own survey of what agents actually fetch."

### Prior-art delta

| Incumbent | What it does | Delta for this repo |
|---|---|---|
| Deno `--allow-net=<hosts>` | per-host egress allow-list enforced by the runtime | governs a *program*, not an agent's ad-hoc shell — the unit here is a tool call, not a script |
| Container `--network=none` / egress proxy | all-or-nothing network isolation at the boundary | bounds *damage*, not *authority* — the distinction the anchor already ruled is not a substitute |
| Claude Code `permissions.deny` + WebFetch domain rules | harness-level host rules on the tool | available and **unused**: `we:.claude/settings.json` carries 20 allow rules and no `deny` key at all |
| npm `--ignore-scripts` | a class-level exec/egress ban | one package manager, not a channel policy |

*Observed, not repo-grounded:* a cloud-VM session already runs behind a mandatory `HTTPS_PROXY` agent proxy
with its own CA bundle, so an egress chokepoint physically exists on that host — but nothing in `we:` reads,
configures or asserts against it, so it is prior art, not enforcement.

### Dependencies & lineage

`blockedBy` in spirit (not in frontmatter, since the answer may be "no"):
[#3490](/backlog/3490-close-the-gaps-in-the-typed-mutation-operation-catalog-finis/) →
[#3491](/backlog/3491-flip-we-scripts-guard-bash-mjs-from-a-deny-list-to-a-fail-cl/). `#3491`'s own scope
already lists `curl` among the mutating commands to cover, so the *mutating* half of egress is spoken for.

### Recommendation

**Not-yet.** The merit half is genuinely open — not conceded — because it is unknown whether a read-only
egress channel is a real hole *once mutations are fail-closed*: `git push`, `gh` and installs are already on
the ruled mutation side, and an exfiltration that mutates nothing is the only residue. **Concrete un-gate
trigger:** `#3491` lands the fail-closed mutation flip **and** a fetch-destination census over the same
transcript corpus `we:reports/2026-08-08-agent-command-surface-sizing.md` measured shows the outbound host
set. Both are named, dated events, not "when it matters."

**Skeptic:** SURVIVES-WITH-AMENDMENT, refuted on merit. Attack: "exfiltration is already covered — network
calls are explicitly in the ratified mutation half, so there is no read-half hole to gate." That partly
lands, and the amendment is folded in: the gate is narrowed to **egress reads** — a request that carries repo
or credential content outward while mutating nothing, which the ratified predicate ("mutates state outside
the agent's own lane clone") puts on the read side by its own terms. Second attack: "this is a merit-conceded
not-yet, so #2092 says dissolve it to ordering." It is not — strip timing, substrate and demand and a warrant
unknown remains (is the residual channel real, or fully absorbed by the mutation split?), which is exactly
the conditional-merit case #2092 preserves as a gate.
**Screen (fresh-context, 2026-09-06): clear.** The partition test was applied explicitly: stripping timing and substrate-readiness leaves a genuine **warrant** unknown — whether a read-only egress channel is a real residue at all once mutations are fail-closed — so this is the conditional-merit gate the rule preserves (the #1648 shape), not an accepted-on-merit ruling plus an ordering edge. The card denies the delta is established rather than conceding it and deferring, which is the distinction that keeps a not-yet legitimate. Original inline reasoning retained below. — *impl-vs-standard*: an egress policy is a capability boundary every caller sees;
*merit-vs-prio*: the not-yet rests on an unresolved warrant, not on cost. Same caveat as Fork 1 — self-run,
not fresh-context.

## Supported by default (not decisions)

- **VM-per-lane isolation** (the card's original Fork 3). No fork exists: the merit relation is already
  ruled — a sandbox bounds damage, the catalog bounds authority, both are wanted, neither substitutes. What
  is left ("fold it into this programme or split it out") has no merit difference under the
  free-to-build test and is work organisation, so it is a separately-prioritized item, not a branch — and
  the standing *separate-and-decouple* bias settles the shape. Its one merit-bearing sub-question — "does the
  operation surface have to be remote-callable from the start?" — is **answered by the tree, not by
  judgment**: `we:scripts/operations/http-adapter.mjs` already derives a route table, request validation and
  response envelope from the same frozen declaration, so remote-callability is a property every declared
  operation already has at no per-operation cost. Premise dissolved.
- **Both enforcement layers coexisting.** A harness-level permission mode, a `PreToolUse` hook and a
  `deny` rule in `we:.claude/settings.json` have different bypass properties and compose; nothing forces a
  single one. The mechanism remains `#3491`'s build call, per the ratified anchors that both deferred it.

---

## Context

### What already constrains an agent session today

Some of "restrict the session" is enforced, not aspirational. `we:.claude/settings.json` registers
`we:scripts/guard-bash.mjs` as a `PreToolUse(Bash)` hook and five `PreToolUse(Edit|Write)` hooks
(`guard-lane`, `lint-locus-prefix --pre`, `check-memory --pre`, `backlog-guard --pre`,
`guard-backward-edge`). `decide()` (`we:scripts/guard-bash.mjs:2137`) splits a command quote-aware, recurses
into nested re-execution (`$( )`, `eval`, `bash -c`, subshell bodies) and **fails closed** on a command its
parser cannot represent. Already denied outright from a primary checkout: any backlog item-mutation
(unconditional, no override — `:1654`), any tree-writing build (`:1738`), a direct push to `main` (`:1831`),
a raw `gh pr merge` or its REST equivalent (`:1851-1876`), a raw PR-body rewrite, `rm`/renumber of a
`backlog/*.md`, shell in-place edits of `backlog|reports/*.md`, `pkill vite|node`, and a backgrounded
verification run. So the *lane-only mutation guard* and a substantial deny surface are already law and
already enforced; what is **not** enforced is anything resembling an allow-list, and the escapes are in-band.

### Corrections to this card's own premises (2026-09-06)

1. **"Six operations exist" is stale.** the operation CLI's own `--help` (`we:scripts/operations/run.mjs`) lists **17**: `claim`,
   `dispatch-lane`, `explore`, `gap-sweep-status`, `gate-health`, `mutation-check`, `open-pr`, `pr-status`,
   `record-verdict`, `resolve`, `review-pr`, `review-prep`, `route-pr-outcome`, `scaffold`, `stage-pr-view`,
   `suggest-next`, `verify` (`we:scripts/operations/run.mjs:84`). The coverage gap the card warns about is
   real but smaller, and it is now measured and owned by `#3490`.
2. **`deny: []` is wrong** — `we:.claude/settings.json` has **no** `deny` key at all. The 20 allow rules are
   accurate.
3. **A declared operation is not, by itself, a bounded action.** Two facts from the call sites, not the
   signatures: `dispatch-lane`'s effect sink shells `claude --bg` with a caller-supplied prompt payload,
   refusing only an empty prompt or one starting with `-` (`we:scripts/operations/dispatch-lane-io.mjs:818`,
   spawn at `:832`), with the launched agent's permission mode read from `WE_DISPATCH_AGENT_ARGS` (`:722`);
   and the engine inspects nothing about what a step function's closure touches —
   `we:scripts/operations/registry.mjs:463` says so in terms ("a `compute` fn that closes over
   `writeFileSync` passes every check in this file"), and `we:scripts/operations/http-adapter.mjs:30` says it
   louder ("READ THIS BEFORE QUOTING THE TABLE ABOVE AS A SECURITY PROPERTY. It is not one."). The
   *strictly-typed-parameters* sub-decision the ratified anchor attached to the split is what closes this,
   and it is a per-operation authoring obligation the engine does not check.
4. **`#3405`'s cited precedent is not on `main`.** The anchor credits `#3105` with a shipped
   `dispatchedAgentVerificationReason` gated on `WE_DISPATCH_KIND`; neither symbol exists in
   `we:scripts/guard-bash.mjs` (both are branch-only, as `#3383` and `#3405` themselves record). What is on
   `main` is `backgroundedVerificationReason` (`we:scripts/guard-bash.mjs:324`), which is not dispatch-gated
   and applies to every session. Cited here so this card does not inherit an unshipped mechanism as context.

### Statute-overlap check (run at prep)

The rule this card would codify — *"an interactive agent session may only take a mutating action through a
declared operation, and the escape from a refusal is out-of-band"* — was diffed against
`we:docs/agent/platform-decisions.md`. Same-subject anchors found and reconciled:

| Anchor | Same turf? | Composition |
|---|---|---|
| `#agent-mutations-through-typed-operations` | **Yes — the same rule, same population** | Clause 1 is *already ratified*; this card must record it, not re-rule it. The residue is the escape channel, which that anchor defers with the mechanism. |
| `#dispatched-agent-never-runs-commands-directly` | Adjacent — narrower population | Ratified for mechanically-dispatched agents; its Fork 2 rejection of break-glass rests on "no human in the loop," which does not reach an interactive session. Fork 1 here is that carve-out being closed. |
| `#operations-declared-once-callers-generated` | Adjacent — the engine, not the policy | Supplies the surface a restriction would route through; states no restriction of its own. |
| `#primary-read-only-lanes-only`, `#guard-unresolvable-reexecution-denies` | Adjacent — the same enforcement file | Both are deny-side rules on `we:scripts/guard-bash.mjs`; an out-of-band escape refines *how* their overrides are asserted and must cite them when codified. |
| `#deterministic-core-thin-judgment` | Adjacent | Consistent: moving the escape predicate out of model-authored text moves a decision from judgment to the deterministic core. |
| `#agent-runner-cli-backend` | Adjacent | Explicitly "composing with the write-time deny gates" — no conflict. |

**No unreconciled collision found.** The one live hazard is duplication, not contradiction: a ruling here
that restates the mutation split would create a second rule on ratified turf, which is why it is recorded
above under *Already ratified* instead.

## Done when

1. Fork 1 has a dated ruling recorded here with its reason, and the validation gate has a recorded verdict
   (go / no / not-yet) with its trigger.
2. The *Already ratified* section is confirmed as the record — this card codifies **no** clause that
   `#agent-mutations-through-typed-operations` already carries; any codification cites that anchor as
   lineage rather than restating it.
3. If Fork 1 rules (b), a follow-on implementation item exists naming the out-of-band channel **and** the
   `TRUST_CHAIN` registration of `we:scripts/guard-bash.mjs` that (b) depends on, filed against `#3491`'s
   enforcement build rather than duplicating it.
4. VM-per-lane is split out with a named successor item (dissolved here, not folded in).
5. The `no-hand-rolling-around-a-missing-operation` memory note is re-read against the ruling and updated if
   the ruling changes what a session does at a gap.
