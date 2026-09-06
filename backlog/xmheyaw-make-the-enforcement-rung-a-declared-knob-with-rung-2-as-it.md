---
kind: story
size: 3
status: open
parent: "3029"
dateOpened: "2026-09-06"
tags: [operations, conveyor, github, branch-protection, sole-writer, config]
crossRef: { url: /backlog/3423-branch-protection-enforcement-of-the-sole-writer-invariant-p/, label: "the ruling this implements" }
---

# Make the enforcement rung a declared knob, with Rung 2 as its off-by-default flavor

#3423 ruled (2026-09-06, operator) that **script-level discipline is the accepted enforcement layer** of the
sole-writer invariant — and amended the framing on the way through: platform-level enforcement is **a knob that
is not turned on**, not a branch that lost. This is the build that makes that literally true instead of only
written down.

## What the ruling changed, and why it needs a build at all

The card as prepared listed option (a) — `enforce_admins` plus a push allow-list — as *"rejected for now"*. The
operator's framing is the stronger one and is what ratified: **enforcement level is a configurable dimension**
whose current value is Rung 1, with Rung 2 a real, selectable flavor blocked only on an actor to name. That is
`#config-extends-platform-default` applied — a concern with more than one legitimate end-state is a dimension
with a safe default, never a baked mechanism.

Today the dimension does not exist in code. Which rung is live is **inferred from prose** in
[`we:docs/agent/platform-decisions.md`](../docs/agent/platform-decisions.md)'s enforcement ladder, and the live
branch-protection state is whatever GitHub happens to hold. Nothing reconciles the two, so the repo can drift
off its own ratified rung silently — which is the specific failure the ruling's "accepted enforcement layer"
language is worth nothing against.

## Done when

1. **Executable — the rung is declared, not inferred.** One place names the live rung. A check reads the real
   branch-protection / ruleset state and **fails when the declared rung and the observed state disagree**, so a
   drift in either direction is loud. Today's expected reading is Rung 1: `enforce_admins: false`, no
   `restrictions`, no ruleset naming a bypass actor.
2. **Rung 2 exists as an off-by-default flavor.** Selecting it composes the ruleset call #3423 already wrote out
   — `POST repos/:owner/:repo/rulesets`, `target: branch`, `rules: [{type: 'pull_request'}]`, a `bypass_actors`
   entry of `actor_type: 'Integration'` — from a **configured** `bypassActorId`, and **refuses to run with no
   actor id configured** rather than emitting a ruleset that names nobody. Turning it on is then a config change,
   not a code change. That refusal carries a named test.
3. **This story does not turn it on**, and nothing here flips `enforce_admins`. Doing so today would either
   no-op or block the human's own ratified direct-`main` path, and would regress #2152 — see the ruling.

## No `scope:` is declared, deliberately

There is no existing file that owns the enforcement rung — that absence *is* item 1. An earlier draft of this
card scoped it to `we:scripts/lib/gate-config.mjs` on the strength of the name; that file is the **auto-review
trust-chain roster** (#2448/#2445), it is gate-self, and editing it forces `review:human`. It has nothing to do
with branch protection. A wrong `scope:` is not inert — it is machine-read for lane-collision detection by
exact path, so it would both send a builder to the wrong file and manufacture false contention with any lane
genuinely editing that roster. Declaring the home is part of the build; pick it when you build it.

## The prerequisite is a human setup step, and it is not in scope

The blocking gap is the `actor_id`: this repo has exactly one collaborator, and the drain's merges ride that
same human credential. Minting a distinct bot principal — a GitHub App registration plus installation, or a
dedicated machine user with its own PAT, wired into `we:scripts/pr-land.mjs` / `we:scripts/merge-ai-prs.mjs`'s
`gh` auth — is Rung 2's own stated prerequisite and is **not agent-executable**. When only that step remains,
this item earns a `humanGate: { kind: setup }`; it does not carry one now, because items 1 and 2 are ordinary
agent work.

## Scope discipline — what would make this the wrong build

The value here is item 1: a dimension that is **declared and reconciled**. Item 2 is the option the operator
asked to have available, built from a call shape #3423 already specified — wiring, not design. If item 2 grows
into designing an identity model, a credential rotation story, or a second enforcement mechanism, it has left
this story. Re-read #3423's revisit trigger rather than widening here: the decision reopens when a distinct bot
principal exists, or when a second human writer joins.
